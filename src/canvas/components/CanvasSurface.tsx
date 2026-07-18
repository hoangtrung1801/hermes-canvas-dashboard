import { useEffect, useMemo } from 'react'
import { useSync } from '@tldraw/sync'
import {
  Tldraw,
  defaultBindingUtils,
  defaultShapeUtils,
  FrameShapeUtil,
  inlineBase64AssetStore,
  type Editor
} from 'tldraw'
import 'tldraw/tldraw.css'
import { CanvasBridge } from '../bridge/CanvasBridge'
import { getCanvasGatewayUrl, getTldrawSyncUrl } from '../bridge/gatewayConfig'
import { BridgeWebSocketClient } from '../bridge/websocketClient'
import {
  canvasActionEnvelopeSchema,
  canvasErrorEnvelopeSchema,
  canvasObservationEnvelopeSchema,
  canvasResultEnvelopeSchema
} from '../protocol/canvasMessages'
import { createMemoryTldrawTarget, readTldrawObservation } from '../tldraw/tldrawActionExecutor'
import { hermesShapeUtils } from '../tldraw/customShapeUtils'
import { HERMES_PASTEL_THEME_ID, hermesPastelTheme } from '../tldraw/pastelTheme'
import { useBridgeStore } from '../state/bridgeStore'
import { CanvasContextMenu } from './CanvasContextMenu'
import { useCanvasAutoFrames } from './useCanvasAutoFrames'

const socket = new BridgeWebSocketClient()
const CANVAS_ID = 'canvas_001'
const ColoredFrameShapeUtil = FrameShapeUtil.configure({ showColors: true })
const tldrawComponents = { ContextMenu: CanvasContextMenu }

export function CanvasSurface() {
  const bridge = useBridgeStore((state) => state.bridge)
  const target = useBridgeStore((state) => state.adapter)
  const editor = useBridgeStore((state) => state.editor)
  const setBridge = useBridgeStore((state) => state.setBridge)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const setStatus = useBridgeStore((state) => state.setStatus)
  const addLog = useBridgeStore((state) => state.addLog)
  useCanvasAutoFrames()

  const syncShapeUtils = useMemo(
    () => [
      ...defaultShapeUtils.filter((shapeUtil) => shapeUtil.type !== 'frame'),
      ColoredFrameShapeUtil,
      ...hermesShapeUtils
    ],
    []
  )
  const store = useSync({
    uri: getTldrawSyncUrl(CANVAS_ID),
    assets: inlineBase64AssetStore,
    shapeUtils: syncShapeUtils,
    bindingUtils: defaultBindingUtils
  })

  useEffect(() => {
    if (!bridge || !target || !editor) {
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
          roomId: CANVAS_ID
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

    return () => socket.disconnect()
  }, [bridge, target, editor, setObservation, setStatus, addLog])

  return (
    <Tldraw
      store={store}
      shapeUtils={[...hermesShapeUtils, ColoredFrameShapeUtil]}
      components={tldrawComponents}
      onMount={(mountedEditor: Editor) => {
        mountedEditor.updateTheme(hermesPastelTheme)
        mountedEditor.setCurrentTheme(HERMES_PASTEL_THEME_ID)
        mountedEditor.updateInstanceState({ isGridMode: true })
        const mountedTarget = createMemoryTldrawTarget(CANVAS_ID)
        mountedTarget.editor = mountedEditor
        const bridgeInstance = new CanvasBridge(mountedTarget)
        setBridge(bridgeInstance, mountedTarget, mountedEditor)
        setObservation(readTldrawObservation(mountedTarget))
      }}
    />
  )
}
