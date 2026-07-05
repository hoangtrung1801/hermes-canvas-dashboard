import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { join } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  canvasToHermesEnvelopeSchema,
  hermesToCanvasEnvelopeSchema
} from '../../src/canvas/protocol/canvasMessages'
import { RoomManager } from './roomManager'
import { executeHeadlessTldrawAction } from './tldrawHeadlessExecutor'
import { TldrawSyncRoomManager } from './tldrawSyncServer'

type UnknownEnvelope = {
  requestId?: unknown
  type?: unknown
}

type CanvasGatewayLogger = {
  log(message?: unknown, ...optionalParams: unknown[]): void
}

type CanvasGatewayOptions = {
  dataDir?: string
  logger?: CanvasGatewayLogger
}

export function createCanvasGateway(port = 8787, options: CanvasGatewayOptions = {}) {
  const rooms = new RoomManager()
  const dataDir = options.dataDir ?? join(process.cwd(), 'data')
  const logger = options.logger ?? console
  const syncRooms = new TldrawSyncRoomManager({ dataDir })
  const server = createServer((_request, response) => {
    sendJson(response, 404, { error: 'Not found' })
  })
  const wss = new WebSocketServer({ noServer: true })
  const syncWss = new WebSocketServer({ noServer: true })
  let closeState: 'open' | 'closing' | 'closed' = 'open'
  const closeCallbacks: Array<() => void> = []

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const syncMatch = /^\/sync\/([^/]+)$/.exec(url.pathname)

    if (url.pathname === '/canvas') {
      wss.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
        wss.emit('connection', websocket, request)
      })
      return
    }

    if (syncMatch) {
      syncWss.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
        syncWss.emit('connection', websocket, request, decodeURIComponent(syncMatch[1]))
      })
      return
    }

    socket.destroy()
  })

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
      socket.on('close', () => rooms.detachBridge(canvasId, socket))
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
        const route = rooms.hasBridge(canvasId) ? 'bridge' : 'headless'
        logHermesActionBatch(logger, validated.data, route)

        if (route === 'bridge') {
          rooms.forwardToBridge(canvasId, payload)
          return
        }

        void executeHeadlessTldrawAction(syncRooms, validated.data).then((responses) => {
          responses.forEach((responseEnvelope) => {
            socket.send(JSON.stringify(responseEnvelope))
          })
        })
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

  syncWss.on('connection', (socket: WebSocket, request: IncomingMessage, roomId: string) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    syncRooms.connectSocket(roomId, socket, url.searchParams.get('sessionId') ?? undefined)
  })

  server.listen(port)

  return {
    wss,
    syncWss,
    server,
    rooms,
    syncRooms,
    close(callback: () => void) {
      if (closeState === 'closed') {
        queueMicrotask(callback)
        return
      }

      closeCallbacks.push(callback)
      if (closeState === 'closing') return
      closeState = 'closing'

      wss.close(() => {
        syncWss.close(() => {
          server.close(() => {
            syncRooms.close()
            closeState = 'closed'
            closeCallbacks.splice(0).forEach((closeCallback) => closeCallback())
          })
        })
      })
    }
  }
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(payload))
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

function logHermesActionBatch(
  logger: CanvasGatewayLogger,
  envelope: {
    requestId: string
    canvasId: string
    actions: Array<{ type: string }>
  },
  route: 'bridge' | 'headless'
): void {
  logger.log('[canvas:ws-action]', {
    canvasId: envelope.canvasId,
    requestId: envelope.requestId,
    route,
    actionTypes: envelope.actions.map((action) => action.type)
  })
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
