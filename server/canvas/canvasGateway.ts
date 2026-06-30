import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import {
  canvasToHermesEnvelopeSchema,
  hermesToCanvasEnvelopeSchema
} from '../../src/canvas/protocol/canvasMessages'
import { RoomManager } from './roomManager'

type UnknownEnvelope = {
  requestId?: unknown
  type?: unknown
}

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
      let parsed: UnknownEnvelope
      try {
        parsed = JSON.parse(payload)
      } catch (error) {
        sendCanvasError(socket, 'req_invalid_json', `Invalid JSON: ${formatError(error)}`)
        return
      }

      if (role === 'hermes') {
        const validated = hermesToCanvasEnvelopeSchema.safeParse(parsed)
        if (!validated.success) {
          sendCanvasError(
            socket,
            getRequestId(parsed),
            `Invalid Hermes message: ${validated.error.message}`
          )
          return
        }
        rooms.forwardToBridge(canvasId, payload)
        return
      }

      const validated = canvasToHermesEnvelopeSchema.safeParse(parsed)
      if (!validated.success) {
        sendCanvasError(
          socket,
          getRequestId(parsed),
          `Invalid bridge message: ${validated.error.message}`
        )
        return
      }
      rooms.forwardToHermes(canvasId, payload)
    })
  })

  return { wss, rooms }
}

function getRequestId(envelope: UnknownEnvelope): string {
  return typeof envelope.requestId === 'string' ? envelope.requestId : 'req_invalid_message'
}

function sendCanvasError(socket: WebSocket, requestId: string, message: string) {
  socket.send(
    JSON.stringify({
      type: 'canvas.error',
      requestId,
      message
    })
  )
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
