import { describe, expect, it } from 'vitest'
import { ExcalidrawAdapter, type ExcalidrawApiLike, type ExcalidrawElementLike } from './ExcalidrawAdapter'

const createFakeApi = (): ExcalidrawApiLike & {
  elements: ExcalidrawElementLike[]
  appState: ReturnType<ExcalidrawApiLike['getAppState']> & { zoom: { value: number } }
  updateSceneCalls: Array<{ elements?: readonly ExcalidrawElementLike[]; appState?: Record<string, unknown> | null }>
} => ({
  elements: [],
  appState: {
    scrollX: 0,
    scrollY: 0,
    width: 1200,
    height: 800,
    zoom: { value: 1 }
  },
  updateSceneCalls: [],
  updateScene(scene: { elements?: readonly ExcalidrawElementLike[]; appState?: Record<string, unknown> | null }) {
    this.updateSceneCalls.push(scene)
    if (scene.elements) {
      this.elements = [...scene.elements]
    }
    if (scene.appState) {
      this.appState = { ...this.appState, ...scene.appState }
    }
  },
  getSceneElements() {
    return this.elements
  },
  getAppState() {
    return this.appState
  },
  scrollToContent() {
    this.updateScene({ appState: { scrolledToContent: true } })
  }
})

describe('ExcalidrawAdapter', () => {
  it('creates a task card as rectangle and text elements', () => {
    const api = createFakeApi()
    const adapter = new ExcalidrawAdapter(api, 'canvas_001')

    const result = adapter.createTaskCard({
      name: 'Design import modal',
      text: 'Design the import modal',
      x: 100,
      y: 120,
      props: { status: 'todo' }
    })

    expect(result.block.type).toBe('task_card')
    expect(result.shapeIds).toHaveLength(2)
    expect(api.elements[0]).toMatchObject({
      id: result.shapeIds[0],
      type: 'rectangle',
      boundElements: [{ id: result.shapeIds[1], type: 'text' }]
    })
    expect(api.elements[1]).toMatchObject({
      id: result.shapeIds[1],
      type: 'text',
      text: 'Design the import modal',
      containerId: result.shapeIds[0]
    })
    expect(api.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: result.shapeIds[0], type: 'rectangle', x: 100, y: 120 }),
        expect.objectContaining({ id: result.shapeIds[1], type: 'text', text: 'Design the import modal' })
      ])
    )
  })

  it('creates Excalidraw-compatible element ids', () => {
    const api = createFakeApi()
    const adapter = new ExcalidrawAdapter(api, 'canvas_001')

    const result = adapter.createTaskCard({
      name: 'Design import modal',
      x: 100,
      y: 120
    })

    expect(result.shapeIds[0]).toMatch(/^element_/)
    expect(api.elements[0]).toMatchObject({
      id: expect.stringMatching(/^element_/)
    })
  })

  it('creates and mutates todo block tasks', () => {
    const api = createFakeApi()
    const adapter = new ExcalidrawAdapter(api, 'canvas_001')

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
    expect(api.updateSceneCalls.length).toBeGreaterThanOrEqual(4)
  })

  it('moves and deletes every element that belongs to a block', () => {
    const api = createFakeApi()
    const adapter = new ExcalidrawAdapter(api, 'canvas_001')

    const created = adapter.createLinkCard({
      name: 'Excalidraw Documentation',
      url: 'https://docs.excalidraw.com',
      x: 100,
      y: 120
    })

    const moved = adapter.moveBlock({ blockId: created.block.id, x: 240, y: 320 })
    const deletedShapeIds = adapter.deleteBlock({ blockId: created.block.id })

    expect(moved).toMatchObject({ x: 240, y: 320 })
    expect(deletedShapeIds).toEqual(created.shapeIds)
    expect(api.elements).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.shapeIds[0] })
      ])
    )
  })

  it('does not create an arrow when either endpoint block is missing', () => {
    const api = createFakeApi()
    const adapter = new ExcalidrawAdapter(api, 'canvas_001')
    const created = adapter.createTaskCard({
      name: 'Existing block',
      x: 100,
      y: 120
    })

    expect(adapter.createArrow({
      fromBlockId: created.block.id,
      toBlockId: 'block_missing',
      label: 'Missing target'
    })).toBeNull()
    expect(adapter.createArrow({
      fromBlockId: 'block_missing',
      toBlockId: created.block.id,
      label: 'Missing source'
    })).toBeNull()
    expect(api.elements).toHaveLength(created.shapeIds.length)
  })

  it('reports selected ids and viewport from Excalidraw app state', () => {
    const api = createFakeApi()
    api.appState = {
      ...api.appState,
      selectedElementIds: { element_0001: true },
      scrollX: -25,
      scrollY: -50,
      width: 1000,
      height: 700
    } as never
    const adapter = new ExcalidrawAdapter(api, 'canvas_001')

    const state = adapter.getCanvasState()

    expect(state.selectedShapeIds).toEqual(['element_0001'])
    expect(state.viewport).toEqual({ x: 25, y: 50, w: 1000, h: 700 })
  })

  it('restores blocks from a snapshot and continues generated ids', () => {
    const api = createFakeApi()
    const adapter = new ExcalidrawAdapter(api, 'canvas_001')
    const created = adapter.createTodoBlock({
      name: 'Launch checklist',
      x: 100,
      y: 120,
      tasks: ['Write docs']
    })

    const restored = new ExcalidrawAdapter(createFakeApi(), 'canvas_001', adapter.exportSnapshot())

    expect(restored.getBlockById(created.block.id)).toEqual(created.block)
    expect(restored.getCanvasState().blocks).toEqual([created.block])

    const next = restored.createTaskCard({
      name: 'Ship feature',
      x: 240,
      y: 320
    })

    expect(next.block.id).not.toBe(created.block.id)
    expect(next.shapeIds).not.toEqual(expect.arrayContaining(created.shapeIds))
  })
})
