import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { join } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  canvasToHermesEnvelopeSchema,
  hermesToCanvasEnvelopeSchema
} from '../../src/canvas/protocol/canvasMessages'
import { CanvasFileStore } from './canvasFileStore'
import { executeHeadlessCanvasAction } from './headlessCanvasExecutor'
import { RoomManager } from './roomManager'

type UnknownEnvelope = {
  requestId?: unknown
  type?: unknown
}

type CanvasGatewayOptions = {
  dataDir?: string
}

export function createCanvasGateway(port = 8787, options: CanvasGatewayOptions = {}) {
  const rooms = new RoomManager()
  const store = new CanvasFileStore(options.dataDir ?? join(process.cwd(), 'data'))
  const server = createServer((request, response) => {
    void handleHttpRequest(request, response, store)
  })
  const wss = new WebSocketServer({ server, path: '/canvas' })

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
        if (rooms.hasBridge(canvasId)) {
          rooms.forwardToBridge(canvasId, payload)
          return
        }

        void executeHeadlessCanvasAction(store, validated.data).then((responses) => {
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

  server.listen(port)

  return {
    wss,
    server,
    rooms,
    close(callback: () => void) {
      wss.close(() => {
        server.close(() => callback())
      })
    }
  }
}

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  store: CanvasFileStore
): Promise<void> {
  setCorsHeaders(response)

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const url = new URL(request.url ?? '/', 'http://localhost')
  const match = /^\/canvas-state\/([^/]+)$/.exec(url.pathname)
  if (!match) {
    sendJson(response, 404, { error: 'Not found' })
    return
  }

  const canvasId = decodeURIComponent(match[1])

  try {
    if (request.method === 'GET') {
      const snapshot = await store.load(canvasId)
      if (!snapshot) {
        sendJson(response, 404, { error: 'Canvas snapshot not found' })
        return
      }

      sendJson(response, 200, snapshot)
      return
    }

    if (request.method === 'PUT') {
      const snapshot = await readJsonBody(request)
      await store.save(canvasId, snapshot)
      response.writeHead(204)
      response.end()
      return
    }

    response.setHeader('Allow', 'GET, PUT, OPTIONS')
    sendJson(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    sendJson(response, 400, { error: formatError(error) })
  }
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : null
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

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
