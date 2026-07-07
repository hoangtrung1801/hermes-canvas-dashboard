import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { createCanvasGateway } from './canvasGateway'
import { createHermesCanvasToolPayload } from './hermesCanvasTool'

describe('canvas gateway integration', () => {
  const instances: Array<{ close(callback: () => void): void }> = []
  const clients: WebSocket[] = []
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map(
        (client) =>
          new Promise<void>((resolve) => {
            if (
              client.readyState === WebSocket.CLOSED ||
              client.readyState === WebSocket.CLOSING
            ) {
              resolve()
              return
            }

            client.addEventListener('close', () => resolve(), { once: true })
            client.close()
          })
      )
    )

    await Promise.all(
      instances.splice(0).map(
        (instance) =>
          new Promise<void>((resolve) => {
            instance.close(() => resolve())
          })
      )
    )

    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('forwards Hermes actions to the connected bridge client', async () => {
    const gateway = createCanvasGateway(8790)
    instances.push(gateway)

    const bridgeClient = new WebSocket(
      'ws://localhost:8790/canvas?canvasId=canvas_001&role=bridge'
    )
    const hermesClient = new WebSocket(
      'ws://localhost:8790/canvas?canvasId=canvas_001&role=hermes'
    )
    clients.push(bridgeClient, hermesClient)

    const received = await new Promise<string>((resolve) => {
      bridgeClient.addEventListener('message', (event: { data: unknown }) =>
        resolve(String(event.data))
      )
      hermesClient.addEventListener('open', () => {
        hermesClient.send(
          JSON.stringify(
            createHermesCanvasToolPayload('canvas_001', [{ type: 'read_canvas' }])
          )
        )
      })
    })

    expect(JSON.parse(received).type).toBe('canvas.action')
  })

  it('logs Hermes websocket action batches before routing them', async () => {
    const logger = { log: vi.fn() }
    const gateway = createCanvasGateway(8795, { logger })
    instances.push(gateway)

    const bridgeClient = new WebSocket(
      'ws://localhost:8795/canvas?canvasId=canvas_001&role=bridge'
    )
    const hermesClient = new WebSocket(
      'ws://localhost:8795/canvas?canvasId=canvas_001&role=hermes'
    )
    clients.push(bridgeClient, hermesClient)

    await new Promise<void>((resolve) => {
      bridgeClient.addEventListener('message', () => resolve(), { once: true })
      hermesClient.addEventListener('open', () => {
        hermesClient.send(
          JSON.stringify(
            createHermesCanvasToolPayload('canvas_001', [
              { type: 'read_canvas' },
              { type: 'zoom_to_fit' }
            ])
          )
        )
      })
    })

    expect(logger.log).toHaveBeenCalledWith(
      '[canvas:ws-action]',
      expect.objectContaining({
        canvasId: 'canvas_001',
        requestId: expect.any(String),
        route: 'bridge',
        actionTypes: ['read_canvas', 'zoom_to_fit']
      })
    )
  })

  it('does not crash when a bridge connection sends a Hermes action payload', async () => {
    const gateway = createCanvasGateway(8791)
    instances.push(gateway)

    const bridgeClient = new WebSocket(
      'ws://localhost:8791/canvas?canvasId=canvas_001&role=bridge'
    )
    clients.push(bridgeClient)

    const received = await new Promise<string>((resolve) => {
      bridgeClient.addEventListener('message', (event: { data: unknown }) =>
        resolve(String(event.data))
      )
      bridgeClient.addEventListener('open', () => {
        bridgeClient.send(
          JSON.stringify(
            createHermesCanvasToolPayload('canvas_001', [{ type: 'read_canvas' }])
          )
        )
      })
    })

    const parsed = JSON.parse(received)
    expect(parsed.type).toBe('canvas.error')
    expect(parsed.message).toContain('Invalid bridge message')
  })

  it('does not expose the legacy canvas-state http endpoint', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'hermes-canvas-http-'))
    tempDirs.push(dataDir)
    const gateway = createCanvasGateway(8792, { dataDir })
    instances.push(gateway)

    const getResponse = await fetch('http://localhost:8792/canvas-state/canvas_001')

    expect(getResponse.status).toBe(404)
  })

  it('exposes a health endpoint from the Fastify gateway', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'hermes-canvas-health-'))
    tempDirs.push(dataDir)
    const gateway = createCanvasGateway(8796, { dataDir })
    instances.push(gateway)

    const response = await fetch('http://localhost:8796/health')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('coalesces repeated close requests during shutdown', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'hermes-canvas-close-'))
    tempDirs.push(dataDir)
    const gateway = createCanvasGateway(0, { dataDir })

    await new Promise<void>((resolve) => {
      gateway.server.once('listening', () => resolve())
    })

    const maxListenerWarnings: string[] = []
    const onWarning = (warning: Error) => {
      if (
        warning.name === 'MaxListenersExceededWarning' &&
        warning.message.includes('[WebSocketServer]')
      ) {
        maxListenerWarnings.push(warning.message)
      }
    }
    process.on('warning', onWarning)

    try {
      let closeCallbackCount = 0

      await Promise.all(
        Array.from(
          { length: 11 },
          () =>
            new Promise<void>((resolve) => {
              gateway.close(() => {
                closeCallbackCount += 1
                resolve()
              })
            })
        )
      )
      await new Promise<void>((resolve) => setImmediate(resolve))

      expect(closeCallbackCount).toBe(11)
      expect(maxListenerWarnings).toEqual([])
    } finally {
      process.off('warning', onWarning)
    }
  })

  it('hosts tldraw sync websocket rooms', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'hermes-canvas-sync-gateway-'))
    tempDirs.push(dataDir)
    const gateway = createCanvasGateway(8794, { dataDir })
    instances.push(gateway)

    const syncClient = new WebSocket(
      'ws://localhost:8794/sync/canvas_001?sessionId=session_test'
    )
    clients.push(syncClient)

    await new Promise<void>((resolve) => {
      syncClient.addEventListener('open', () => resolve())
    })

    expect(gateway.syncRooms.getOrCreateRoom('canvas_001').getNumActiveSessions()).toBe(1)
    expect(gateway.syncRooms.databasePath).toBe(join(dataDir, 'tldraw-sync.sqlite'))
  })

  it('executes Hermes actions headlessly when no bridge client is connected', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'hermes-canvas-headless-gateway-'))
    tempDirs.push(dataDir)
    const gateway = createCanvasGateway(8793, { dataDir })
    instances.push(gateway)

    const hermesClient = new WebSocket(
      'ws://localhost:8793/canvas?canvasId=canvas_001&role=hermes'
    )
    clients.push(hermesClient)

    const responses = await new Promise<any[]>((resolve, reject) => {
      const received: any[] = []
      const timer = setTimeout(() => reject(new Error('Timed out waiting for headless responses')), 2000)

      hermesClient.addEventListener('message', (event: { data: unknown }) => {
        received.push(JSON.parse(String(event.data)))
        if (received.some((item) => item.type === 'canvas.observation')) {
          clearTimeout(timer)
          resolve(received)
        }
      })

      hermesClient.addEventListener('open', () => {
        hermesClient.send(
          JSON.stringify(
            createHermesCanvasToolPayload('canvas_001', [
              {
                type: 'create_task_card',
                id: 'shape:task_gateway',
                title: 'Created without dashboard',
                body: 'Headless tldraw action',
                x: 80,
                y: 120
              }
            ])
          )
        )
      })
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      ok: true,
      results: [
        {
          actionType: 'create_task_card',
          createdShapeIds: ['shape:task_gateway']
        }
      ]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      state: {
        shapes: [
          {
            id: 'shape:task_gateway',
            type: 'task_card',
            props: {
              title: 'Created without dashboard',
              body: 'Headless tldraw action'
            }
          }
        ]
      }
    })

    const snapshot = gateway.syncRooms.getOrCreateRoom('canvas_001').getCurrentSnapshot()
    expect(snapshot.documents.some((entry) => entry.state.id === 'shape:task_gateway')).toBe(true)
  })
})
