import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { createCanvasGateway } from './canvasGateway'
import { createHermesCanvasToolPayload } from './hermesCanvasTool'

describe('canvas gateway integration', () => {
  const instances: Array<{ wss: { close(callback: () => void): void } }> = []
  const clients: WebSocket[] = []

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
      instances.map(
        (instance) =>
          new Promise<void>((resolve) => {
            instance.wss.close(() => resolve())
          })
      )
    )
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
})
