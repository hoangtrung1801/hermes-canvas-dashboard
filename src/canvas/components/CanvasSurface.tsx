import { useEffect } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import { ExcalidrawAdapter, type ExcalidrawApiLike, type ExcalidrawElementLike } from '../adapters/ExcalidrawAdapter'
import { CanvasBridge } from '../bridge/CanvasBridge'
import { getCanvasGatewayUrl } from '../bridge/gatewayConfig'
import { BridgeWebSocketClient } from '../bridge/websocketClient'
import {
  canvasActionEnvelopeSchema,
  canvasErrorEnvelopeSchema,
  canvasObservationEnvelopeSchema,
  canvasResultEnvelopeSchema
} from '../protocol/canvasMessages'
import { createCanvasSnapshot, loadCanvasSnapshot, saveCanvasSnapshot } from '../state/canvasPersistence'
import { useBridgeStore } from '../state/bridgeStore'

const socket = new BridgeWebSocketClient()
const CANVAS_ID = 'canvas_001'

async function saveCurrentCanvas(adapter: ExcalidrawAdapter, api: ExcalidrawApiLike): Promise<void> {
  await saveCanvasSnapshot(
    createCanvasSnapshot({
      canvasId: adapter.canvasId,
      elements: api.getSceneElements(),
      adapter: adapter.exportSnapshot()
    })
  )
}

export function CanvasSurface() {
  const bridge = useBridgeStore((state) => state.bridge)
  const adapter = useBridgeStore((state) => state.adapter)
  const editor = useBridgeStore((state) => state.editor)
  const setBridge = useBridgeStore((state) => state.setBridge)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const setStatus = useBridgeStore((state) => state.setStatus)
  const addLog = useBridgeStore((state) => state.addLog)

  useEffect(() => {
    if (!bridge || !(adapter instanceof ExcalidrawAdapter) || !editor) {
      return
    }

    const gatewayUrl = getCanvasGatewayUrl()
    if (!gatewayUrl) {
      addLog(
        'info',
        'gateway_disabled',
        'WebSocket gateway disabled. Set VITE_CANVAS_GATEWAY_URL to connect Hermes.'
      )
      return
    }

    addLog('info', 'connection_attempt', `Connecting to ${gatewayUrl}`)

    socket.connect(gatewayUrl, {
      onOpen() {
        setStatus('ready')
        const readyPayload = {
          type: 'canvas.ready' as const,
          canvasId: CANVAS_ID,
          roomId: 'room_001'
        }
        socket.send(readyPayload)
        addLog('out', 'canvas.ready', readyPayload)
      },
      onClose() {
        setStatus('disconnected')
        addLog('info', 'connection_closed', 'Websocket connection disconnected')
      },
      onError() {
        setStatus('error')
        addLog('error', 'connection_error', 'Websocket connection error')
      },
      onMessage(data) {
        let payload: any
        try {
          payload = JSON.parse(data)
        } catch (e) {
          addLog('error', 'parse_error', { raw: data, error: String(e) })
          return
        }

        if (payload.type === 'canvas.action') {
          addLog('in', 'canvas.action', payload)
          const validated = canvasActionEnvelopeSchema.parse(payload)
          const response = bridge.handleActionEnvelope(validated)
          if ('error' in response) {
            socket.send(response.error)
            addLog('out', 'canvas.error', response.error)
            return
          }

          setObservation(response.observation.state)
          void saveCurrentCanvas(adapter, editor as ExcalidrawApiLike)
          socket.send(response.result)
          addLog('out', 'canvas.result', response.result)
          socket.send(response.observation)
          addLog('out', 'canvas.observation', response.observation)
          return
        }

        if (payload.type === 'canvas.result') {
          addLog('in', 'canvas.result', payload)
          canvasResultEnvelopeSchema.parse(payload)
          return
        }

        if (payload.type === 'canvas.observation') {
          addLog('in', 'canvas.observation', payload)
          const observation = canvasObservationEnvelopeSchema.parse(payload)
          setObservation(observation.state)
          return
        }

        if (payload.type === 'canvas.error') {
          addLog('in', 'canvas.error', payload)
          canvasErrorEnvelopeSchema.parse(payload)
          setStatus('error')
        }
      }
    })
  }, [bridge, adapter, editor, setObservation, setStatus, addLog])

  return (
    <Excalidraw
      onChange={(elements) => {
        const state = useBridgeStore.getState()
        if (state.adapter instanceof ExcalidrawAdapter && state.editor) {
          void saveCanvasSnapshot(
            createCanvasSnapshot({
              canvasId: state.adapter.canvasId,
              elements: elements as readonly ExcalidrawElementLike[],
              adapter: state.adapter.exportSnapshot()
            })
          )
        }
      }}
      excalidrawAPI={(api) => {
        const excalidrawApi = api as unknown as ExcalidrawApiLike
        void loadCanvasSnapshot(CANVAS_ID).then((saved) => {
          if (saved) {
            excalidrawApi.updateScene({ elements: saved.elements })
          }

          const adapter = new ExcalidrawAdapter(excalidrawApi, CANVAS_ID, saved?.adapter)
          const bridgeInstance = new CanvasBridge(adapter)
          setBridge(bridgeInstance, adapter, api)
          // Set initial observation state so UI has something to show initially
          setObservation(adapter.getCanvasState())
        })
      }}
    />
  )
}
