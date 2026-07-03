import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
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

  it('persists canvas snapshots through the local http endpoint', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'hermes-canvas-http-'))
    tempDirs.push(dataDir)
    const gateway = createCanvasGateway(8792, { dataDir })
    instances.push(gateway)

    const snapshot = {
      version: 1,
      canvasId: 'canvas_001',
      elements: [{ id: 'element_0001', type: 'rectangle', x: 10, y: 20, width: 100, height: 80 }],
      adapter: {
        blocks: [],
        sequence: 1,
        todoTaskSequence: 0
      }
    }

    const putResponse = await fetch('http://localhost:8792/canvas-state/canvas_001', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    })
    const getResponse = await fetch('http://localhost:8792/canvas-state/canvas_001')

    expect(putResponse.status).toBe(204)
    expect(getResponse.status).toBe(200)
    await expect(getResponse.json()).resolves.toEqual(snapshot)
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
              { type: 'create_text', text: 'Created without dashboard', x: 80, y: 120 }
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
          actionType: 'create_text',
          createdBlockIds: ['block_0001']
        }
      ]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      state: {
        blocks: [
          {
            id: 'block_0001',
            text: 'Created without dashboard'
          }
        ]
      }
    })

    const saved = JSON.parse(await readFile(join(dataDir, 'canvas_001.json'), 'utf8'))
    expect(saved.adapter.blocks[0]).toMatchObject({
      id: 'block_0001',
      text: 'Created without dashboard'
    })
  })
})
