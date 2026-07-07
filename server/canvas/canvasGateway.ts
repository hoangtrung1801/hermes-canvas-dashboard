import { join } from 'node:path'
import Fastify, { type FastifyRequest } from 'fastify'
import websocketPlugin from '@fastify/websocket'
import type { WebSocket } from 'ws'
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
  const app = Fastify({ logger: false })
  let closeState: 'open' | 'closing' | 'closed' = 'open'
  const closeCallbacks: Array<() => void> = []

  app.get('/health', async () => ({ ok: true }))

  void app.register(async (routes) => {
    await routes.register(websocketPlugin)

    routes.get('/canvas', { websocket: true }, (socket, request) => {
      handleCanvasSocket(socket, request, rooms, syncRooms, logger)
    })

    routes.get<{ Params: { roomId: string } }>('/sync/:roomId', { websocket: true }, (socket, request) => {
      const url = new URL(request.raw.url ?? '/', 'http://localhost')
      syncRooms.connectSocket(
        request.params.roomId,
        socket,
        url.searchParams.get('sessionId') ?? undefined
      )
    })
  })

  void app.listen({ port, host: '0.0.0.0' })

  return {
    app,
    server: app.server,
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

      app.close(() => {
        syncRooms.close()
        closeState = 'closed'
        closeCallbacks.splice(0).forEach((closeCallback) => closeCallback())
      })
    }
  }
}

function handleCanvasSocket(
  socket: WebSocket,
  request: FastifyRequest,
  rooms: RoomManager,
  syncRooms: TldrawSyncRoomManager,
  logger: CanvasGatewayLogger
): void {
  const url = new URL(
    request.raw.url ?? '/canvas?canvasId=canvas_001&role=bridge',
    'http://localhost'
  )
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
