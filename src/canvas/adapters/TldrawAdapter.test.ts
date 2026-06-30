import { describe, expect, it } from 'vitest'
import { TldrawAdapter } from './TldrawAdapter'

const fakeEditor = {
  created: [] as unknown[],
  updated: [] as unknown[],
  createShape(shape: unknown) {
    this.created.push(shape)
    return shape
  },
  updateShape(shape: unknown) {
    this.updated.push(shape)
    return shape
  },
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
    fakeEditor.created = []
    fakeEditor.updated = []
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

  it('creates tldraw-compatible shape ids', () => {
    fakeEditor.created = []
    fakeEditor.updated = []
    const adapter = new TldrawAdapter(fakeEditor as never, 'canvas_001')

    const result = adapter.createTaskCard({
      name: 'Design import modal',
      x: 100,
      y: 120
    })

    expect(result.shapeIds[0]).toMatch(/^shape:/)
    expect(fakeEditor.created[0]).toMatchObject({
      id: expect.stringMatching(/^shape:/)
    })
  })

  it('creates geo shapes without legacy text props', () => {
    fakeEditor.created = []
    fakeEditor.updated = []
    const adapter = new TldrawAdapter(fakeEditor as never, 'canvas_001')

    adapter.createTaskCard({
      name: 'Design import modal',
      text: 'Design the import modal',
      x: 100,
      y: 120
    })

    expect(fakeEditor.created[0]).toMatchObject({
      type: 'geo',
      props: {
        w: 280,
        h: 160,
        geo: 'rectangle',
        richText: expect.any(Object)
      }
    })
    expect((fakeEditor.created[0] as { props: Record<string, unknown> }).props).not.toHaveProperty('text')
  })

  it('creates text shapes with rich text props', () => {
    fakeEditor.created = []
    fakeEditor.updated = []
    const adapter = new TldrawAdapter(fakeEditor as never, 'canvas_001')

    adapter.createText({
      text: 'Hello from Hermes',
      x: 100,
      y: 120
    })

    expect(fakeEditor.created[0]).toMatchObject({
      type: 'text',
      props: {
        richText: expect.any(Object)
      }
    })
    expect((fakeEditor.created[0] as { props: Record<string, unknown> }).props).not.toHaveProperty('text')
  })

  it('creates and mutates todo block tasks', () => {
    fakeEditor.created = []
    fakeEditor.updated = []
    const adapter = new TldrawAdapter(fakeEditor as never, 'canvas_001')

    const created = adapter.createTodoBlock({
      name: 'Launch checklist',
      x: 100,
      y: 120,
      tasks: [{ id: 'task_docs', text: 'Write docs' }]
    })

    expect(created.block.type).toBe('todo_block')
    expect(created.block.props?.tasks).toEqual([
      { id: 'task_docs', text: 'Write docs', done: false }
    ])
    expect(created.block.text).toContain('- [ ] Write docs')

    const appended = adapter.appendTodoTask({
      blockId: created.block.id,
      taskId: 'task_ship',
      text: 'Ship feature'
    })
    const completed = adapter.setTodoTaskDone({
      blockId: created.block.id,
      taskId: 'task_docs',
      done: true
    })
    const removed = adapter.removeTodoTask({
      blockId: created.block.id,
      taskId: 'task_ship'
    })

    expect(appended?.task.id).toBe('task_ship')
    expect(completed?.text).toContain('- [x] Write docs')
    expect(removed?.props?.tasks).toEqual([
      { id: 'task_docs', text: 'Write docs', done: true }
    ])
    expect(fakeEditor.updated).toHaveLength(3)
  })

  it('creates link cards with URL props and visible URL text', () => {
    fakeEditor.created = []
    fakeEditor.updated = []
    const adapter = new TldrawAdapter(fakeEditor as never, 'canvas_001')

    const result = adapter.createLinkCard({
      name: 'tldraw Documentation',
      url: 'https://tldraw.dev',
      x: 100,
      y: 120
    })

    expect(result.block.props?.url).toBe('https://tldraw.dev')
    expect(result.block.text).toBe('tldraw Documentation\nhttps://tldraw.dev')
  })
})
