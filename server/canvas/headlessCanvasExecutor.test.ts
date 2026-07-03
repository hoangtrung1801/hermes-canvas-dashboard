import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasFileStore } from './canvasFileStore'
import { executeHeadlessCanvasAction } from './headlessCanvasExecutor'

describe('executeHeadlessCanvasAction', () => {
  let dir: string
  let store: CanvasFileStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hermes-canvas-headless-'))
    store = new CanvasFileStore(dir)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('creates a blank snapshot when no saved state exists and handles read_canvas', async () => {
    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_read',
      canvasId: 'canvas_001',
      actions: [{ type: 'read_canvas' }]
    })

    expect(responses).toHaveLength(2)
    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_read',
      ok: true,
      results: [{ actionType: 'read_canvas' }]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      requestId: 'req_read',
      canvasId: 'canvas_001',
      state: {
        canvasId: 'canvas_001',
        blocks: []
      }
    })
    await expect(store.load('canvas_001')).resolves.toMatchObject({
      version: 1,
      canvasId: 'canvas_001',
      elements: [],
      adapter: {
        blocks: [],
        sequence: 0,
        todoTaskSequence: 0
      }
    })
  })

  it('executes create_text and persists elements plus adapter state', async () => {
    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_create',
      canvasId: 'canvas_001',
      actions: [{ type: 'create_text', text: 'Hello headless', x: 80, y: 120 }]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      ok: true,
      results: [
        {
          actionType: 'create_text',
          createdBlockIds: ['block_0001'],
          createdShapeIds: ['element_0002']
        }
      ]
    })

    const saved = await store.load('canvas_001')
    expect(saved).toMatchObject({
      version: 1,
      canvasId: 'canvas_001',
      adapter: {
        blocks: [
          {
            id: 'block_0001',
            type: 'text',
            text: 'Hello headless',
            x: 80,
            y: 120,
            shapeIds: ['element_0002']
          }
        ],
        sequence: 2,
        todoTaskSequence: 0
      }
    })
    expect((saved as { elements: unknown[] }).elements).toEqual([
      expect.objectContaining({
        id: 'element_0002',
        type: 'text',
        text: 'Hello headless'
      })
    ])
  })

  it('returns result ok false plus observation for action-level failures', async () => {
    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_missing',
      canvasId: 'canvas_001',
      actions: [{ type: 'update_text', blockId: 'block_missing', text: 'Nope' }]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_missing',
      ok: false,
      results: [
        {
          actionType: 'update_text',
          error: 'Unknown block block_missing'
        }
      ]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      requestId: 'req_missing',
      canvasId: 'canvas_001'
    })
  })

  it('returns canvas.error for invalid persisted snapshot without overwriting it', async () => {
    await writeFile(join(dir, 'canvas_001.json'), '{"version":1,"canvasId":"wrong"}\n', 'utf8')

    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_invalid_snapshot',
      canvasId: 'canvas_001',
      actions: [{ type: 'read_canvas' }]
    })

    expect(responses).toEqual([
      {
        type: 'canvas.error',
        requestId: 'req_invalid_snapshot',
        message: 'Invalid persisted canvas snapshot for canvas_001'
      }
    ])
    await expect(readFile(join(dir, 'canvas_001.json'), 'utf8')).resolves.toBe(
      '{"version":1,"canvasId":"wrong"}\n'
    )
  })

  it('accepts zoom_to_fit in headless mode', async () => {
    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_zoom',
      canvasId: 'canvas_001',
      actions: [{ type: 'zoom_to_fit' }]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_zoom',
      ok: true,
      results: [{ actionType: 'zoom_to_fit' }]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      state: {
        viewport: { x: 0, y: 0, w: 1200, h: 800 }
      }
    })
  })
})
