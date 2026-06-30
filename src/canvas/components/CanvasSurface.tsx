import { useEffect } from 'react'
import { Tldraw } from 'tldraw'
import { TldrawAdapter } from '../adapters/TldrawAdapter'
import { CanvasBridge } from '../bridge/CanvasBridge'
import { getCanvasGatewayUrl } from '../bridge/gatewayConfig'
import { BridgeWebSocketClient } from '../bridge/websocketClient'
import {
  canvasActionEnvelopeSchema,
  canvasErrorEnvelopeSchema,
  canvasObservationEnvelopeSchema,
  canvasResultEnvelopeSchema
} from '../protocol/canvasMessages'
import { useBridgeStore } from '../state/bridgeStore'

const socket = new BridgeWebSocketClient()

export function CanvasSurface() {
  const bridge = useBridgeStore((state) => state.bridge)
  const setBridge = useBridgeStore((state) => state.setBridge)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const setStatus = useBridgeStore((state) => state.setStatus)
  const addLog = useBridgeStore((state) => state.addLog)

  useEffect(() => {
    if (!bridge) {
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
          canvasId: 'canvas_001',
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
  }, [bridge, setObservation, setStatus, addLog])

  return (
    <Tldraw
      persistenceKey="hermes-canvas"
      onMount={(editor) => {
        const adapter = new TldrawAdapter(editor as never, 'canvas_001')
        const bridgeInstance = new CanvasBridge(adapter)
        setBridge(bridgeInstance, adapter, editor)
        // Set initial observation state so UI has something to show initially
        setObservation(adapter.getCanvasState())
      }}
    />
  )
}
