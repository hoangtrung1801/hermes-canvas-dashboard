import { useEffect } from 'react'
import { Tldraw } from 'tldraw'
import { TldrawAdapter } from '../adapters/TldrawAdapter'
import { CanvasBridge } from '../bridge/CanvasBridge'
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

  useEffect(() => {
    if (!bridge) {
      return
    }

    socket.connect('ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge', {
      onOpen() {
        setStatus('ready')
        socket.send({
          type: 'canvas.ready',
          canvasId: 'canvas_001',
          roomId: 'room_001'
        })
      },
      onClose() {
        setStatus('disconnected')
      },
      onError() {
        setStatus('error')
      },
      onMessage(data) {
        const payload = JSON.parse(data)

        if (payload.type === 'canvas.action') {
          const validated = canvasActionEnvelopeSchema.parse(payload)
          const response = bridge.handleActionEnvelope(validated)
          if ('error' in response) {
            socket.send(response.error)
            return
          }

          setObservation(response.observation.state)
          socket.send(response.result)
          socket.send(response.observation)
          return
        }

        if (payload.type === 'canvas.result') {
          canvasResultEnvelopeSchema.parse(payload)
          return
        }

        if (payload.type === 'canvas.observation') {
          const observation = canvasObservationEnvelopeSchema.parse(payload)
          setObservation(observation.state)
          return
        }

        if (payload.type === 'canvas.error') {
          canvasErrorEnvelopeSchema.parse(payload)
          setStatus('error')
        }
      }
    })
  }, [bridge, setObservation, setStatus])

  return (
    <Tldraw
      persistenceKey="hermes-canvas"
      onMount={(editor) => {
        setBridge(new CanvasBridge(new TldrawAdapter(editor as never, 'canvas_001')))
      }}
    />
  )
}
