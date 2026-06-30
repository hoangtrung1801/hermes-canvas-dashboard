import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExcalidrawElementLike } from '../adapters/ExcalidrawAdapter'
import {
  canvasStateEndpoint,
  loadCanvasSnapshot,
  saveCanvasSnapshot,
  type CanvasPersistenceSnapshot
} from './canvasPersistence'

const element: ExcalidrawElementLike = {
  id: 'element_0001',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 200,
  height: 120
}

const snapshot: CanvasPersistenceSnapshot = {
  version: 1,
  canvasId: 'canvas_001',
  elements: [element],
  adapter: {
    blocks: [
      {
        id: 'block_0001',
        type: 'task_card' as const,
        name: 'Ship feature',
        x: 10,
        y: 20,
        w: 200,
        h: 120,
        text: 'Ship feature',
        props: { status: 'todo' },
        shapeIds: ['element_0001']
      }
    ],
    sequence: 1,
    todoTaskSequence: 0
  }
}

describe('canvasPersistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds the default machine-file persistence endpoint', () => {
    expect(canvasStateEndpoint('canvas_001')).toBe('http://localhost:8787/canvas-state/canvas_001')
  })

  it('loads a valid snapshot for the requested canvas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(snapshot), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )

    await expect(loadCanvasSnapshot('canvas_001')).resolves.toEqual(snapshot)
    expect(fetch).toHaveBeenCalledWith('http://localhost:8787/canvas-state/canvas_001')
  })

  it('returns null when the server has no saved snapshot', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }))

    await expect(loadCanvasSnapshot('canvas_001')).resolves.toBeNull()
  })

  it('returns null for malformed server data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ...snapshot, canvasId: 'canvas_002' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await expect(loadCanvasSnapshot('canvas_001')).resolves.toBeNull()
  })

  it('saves a canvas snapshot through PUT', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await saveCanvasSnapshot(snapshot)

    expect(fetch).toHaveBeenCalledWith('http://localhost:8787/canvas-state/canvas_001', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    })
  })
})
