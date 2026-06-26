import { describe, expect, it } from 'vitest'
import { TldrawAdapter } from './TldrawAdapter'

const fakeEditor = {
  created: [] as unknown[],
  createShape(shape: unknown) {
    this.created.push(shape)
    return shape
  },
  updateShape() {},
  deleteShape() {},
  getCurrentPageShapes() {
    return []
  },
  getSelectedShapeIds() {
    return []
  },
  getViewportPageBounds() {
    return { x: 0, y: 0, w: 1200, h: 800 }
  },
  zoomToFit() {}
}

describe('TldrawAdapter', () => {
  it('creates a task card as a geo shape', () => {
    const adapter = new TldrawAdapter(fakeEditor as never, 'canvas_001')

    const result = adapter.createTaskCard({
      name: 'Design import modal',
      x: 100,
      y: 120,
      props: { status: 'todo' }
    })

    expect(result.block.type).toBe('task_card')
    expect(result.shapeIds).toHaveLength(1)
  })
})
