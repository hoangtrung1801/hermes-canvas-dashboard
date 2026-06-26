import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import {
  canvasToHermesEnvelopeSchema,
  hermesToCanvasEnvelopeSchema
} from '../../src/canvas/protocol/canvasMessages'
import { RoomManager } from './roomManager'

export function createCanvasGateway(port = 8787) {
  const rooms = new RoomManager()
  const wss = new WebSocketServer({ port })

  wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    const url = new URL(
      request.url ?? '/canvas?canvasId=canvas_001&role=bridge',
      'http://localhost'
    )
    if (url.pathname !== '/canvas') {
      socket.close()
      return
    }

    const canvasId = url.searchParams.get('canvasId') ?? 'canvas_001'
    const role = url.searchParams.get('role') ?? 'bridge'

    if (role === 'bridge') {
      rooms.attachBridge(canvasId, socket)
    } else {
      rooms.attachHermes(canvasId, socket)
    }

    socket.on('message', (raw: unknown) => {
      const payload = String(raw)
      const parsed = JSON.parse(payload)

      if (role === 'hermes') {
        hermesToCanvasEnvelopeSchema.parse(parsed)
        rooms.forwardToBridge(canvasId, payload)
        return
      }

      canvasToHermesEnvelopeSchema.parse(parsed)
      rooms.forwardToHermes(canvasId, payload)
    })
  })

  return { wss, rooms }
}
