import { describe, expect, it } from 'vitest'
import { buildDefaultHermesActions, parseHermesClientArgs } from './hermesCanvasClient'

describe('hermesCanvasClient', () => {
  it('builds a Hermes demo payload that writes tldraw shapes into the canvas', () => {
    const actions = buildDefaultHermesActions()

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'create_shape',
          shape: expect.objectContaining({ type: 'geo' })
        }),
        expect.objectContaining({
          type: 'create_task_card',
          body: expect.stringContaining('inside this shape')
        }),
        expect.objectContaining({ type: 'zoom_to_fit' })
      ])
    )
  })

  it('parses a custom gateway url and action JSON', () => {
    const config = parseHermesClientArgs([
      '--url',
      'ws://localhost:8787/canvas?canvasId=demo_canvas&role=hermes',
      '--requestId',
      'req_custom',
      '--timeoutMs',
      '250',
      '--actions',
      '[{"type":"create_task_card","title":"Hello","body":"World","x":10,"y":20}]'
    ])

    expect(config).toEqual({
      url: 'ws://localhost:8787/canvas?canvasId=demo_canvas&role=hermes',
      canvasId: 'demo_canvas',
      requestId: 'req_custom',
      timeoutMs: 250,
      actions: [{ type: 'create_task_card', title: 'Hello', body: 'World', x: 10, y: 20 }]
    })
  })

  it('keeps the default gateway url in sync with a custom canvas id', () => {
    const config = parseHermesClientArgs(['--canvasId', 'demo_canvas'])

    expect(config.canvasId).toBe('demo_canvas')
    expect(config.url).toBe('ws://localhost:8787/canvas?canvasId=demo_canvas&role=hermes')
  })

  it('normalizes custom urls so the demo always connects as Hermes', () => {
    const config = parseHermesClientArgs([
      '--url',
      'ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge'
    ])

    expect(config.url).toBe('ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes')
  })
})
