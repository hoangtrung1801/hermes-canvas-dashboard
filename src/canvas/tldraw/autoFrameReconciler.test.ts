import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from 'tldraw'
import { createMemoryTldrawTarget } from './tldrawActionExecutor'
import {
  isAutoFrameRelevantChange,
  reconcileAutoFrames,
  subscribeToAutoFrameChanges
} from './autoFrameReconciler'

function createEditorDouble(initial: any[]) {
  const shapes = initial.map((shape) => ({
    typeName: 'shape',
    parentId: 'page:page',
    x: 0,
    y: 0,
    props: {},
    meta: {},
    ...shape
  }))
  const listeners = new Set<(entry: any) => void>()
  const emit = (changes: any) => {
    for (const listener of listeners) listener({ changes, source: 'user' })
  }
  const get = (id: string) => shapes.find((shape) => shape.id === id)

  const editor: any = {
    shapes,
    getCurrentPageId: vi.fn(() => 'page:page'),
    getCurrentPageShapesSorted: vi.fn(() => shapes),
    getSelectedShapeIds: vi.fn(() => []),
    getCamera: vi.fn(() => ({ x: 0, y: 0, z: 1 })),
    getShapePageBounds: vi.fn((id: string) => {
      const current = get(id)
      if (!current) return undefined
      const parent = get(current.parentId)
      return {
        x: current.x + (parent?.type === 'frame' ? parent.x : 0),
        y: current.y + (parent?.type === 'frame' ? parent.y : 0),
        w: Number(current.props.w) || 0,
        h: Number(current.props.h) || 0
      }
    }),
    createShapes: vi.fn((records: any[]) => {
      for (const record of records) {
        const created = {
          typeName: 'shape',
          parentId: 'page:page',
          x: 0,
          y: 0,
          props: {},
          meta: {},
          ...record
        }
        shapes.push(created)
        emit({ added: { [created.id]: created }, updated: {}, removed: {} })
      }
    }),
    updateShapes: vi.fn((patches: any[]) => {
      for (const patch of patches) {
        const index = shapes.findIndex((shape) => shape.id === patch.id)
        if (index < 0) continue
        const before = shapes[index]
        const after = {
          ...before,
          ...patch,
          props: { ...before.props, ...(patch.props ?? {}) },
          meta: { ...before.meta, ...(patch.meta ?? {}) }
        }
        shapes[index] = after
        emit({ added: {}, updated: { [patch.id]: [before, after] }, removed: {} })
      }
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      for (const id of ids) {
        const index = shapes.findIndex((shape) => shape.id === id)
        if (index < 0) continue
        const [removed] = shapes.splice(index, 1)
        emit({ added: {}, updated: {}, removed: { [id]: removed } })
      }
    }),
    run: vi.fn((fn: () => void) => fn()),
    store: {
      listen: vi.fn((listener: (entry: any) => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }),
      update: vi.fn((id: string, updater: (record: any) => any) => {
        const index = shapes.findIndex((shape) => shape.id === id)
        if (index < 0) return
        const before = shapes[index]
        const after = updater(before)
        shapes[index] = after
        emit({ added: {}, updated: { [id]: [before, after] }, removed: {} })
      })
    }
  }

  return { editor: editor as Editor, raw: editor, shapes, emit }
}

function todo(id: string, x: number) {
  return {
    id,
    type: 'todo_block',
    x,
    y: 40,
    props: { w: 320, h: 180, title: 'Todo', tasks: [] }
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('reconcileAutoFrames', () => {
  it('creates a native frame, reparents cards, and synchronizes the adapter', () => {
    const { editor, raw, shapes } = createEditorDouble([
      todo('shape:todo_1', 20),
      todo('shape:todo_2', 400)
    ])
    const adapter = createMemoryTldrawTarget('canvas_001')
    const setObservation = vi.fn()

    const result = reconcileAutoFrames({ editor, adapter, setObservation })

    expect(raw.run).toHaveBeenCalledWith(expect.any(Function), { history: 'ignore' })
    expect(raw.createShapes).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'frame',
        props: expect.objectContaining({ name: 'Todos', color: 'yellow' })
      })
    ])
    const generated = shapes.find((shape) => shape.type === 'frame')
    expect(shapes.filter((shape) => shape.type === 'todo_block'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ parentId: generated.id, x: 32, y: 64 }),
        expect.objectContaining({ parentId: generated.id, x: 376, y: 64 })
      ]))
    expect(result).toMatchObject({ cardCount: 2, frameCount: 1, changed: true })
    expect(adapter.shapes.get(generated.id)).toMatchObject({ type: 'frame', parentId: 'page:page' })
    expect(setObservation).toHaveBeenCalledWith(
      expect.objectContaining({ shapes: expect.arrayContaining([expect.objectContaining({ id: generated.id })]) })
    )
  })

  it('does not write again after the canvas has settled', () => {
    const { editor, raw } = createEditorDouble([todo('shape:todo', 20)])
    const adapter = createMemoryTldrawTarget('canvas_001')
    reconcileAutoFrames({ editor, adapter })
    raw.createShapes.mockClear()
    raw.updateShapes.mockClear()
    raw.deleteShapes.mockClear()

    const result = reconcileAutoFrames({ editor, adapter })

    expect(result.changed).toBe(false)
    expect(raw.createShapes).not.toHaveBeenCalled()
    expect(raw.updateShapes).not.toHaveBeenCalled()
    expect(raw.deleteShapes).not.toHaveBeenCalled()
  })

  it('hydrates the adapter even when a settled canvas needs no editor writes', () => {
    const frameId = 'shape:hermes-auto-frame-page-page-todo'
    const { editor } = createEditorDouble([
      {
        id: frameId,
        type: 'frame',
        x: 100,
        y: 200,
        props: { w: 400, h: 276, name: 'Todos', color: 'yellow' },
        meta: { hermesAutoFrame: { version: 1, kind: 'todo' } }
      },
      {
        ...todo('shape:todo', 32),
        parentId: frameId,
        x: 32,
        y: 64
      }
    ])
    const adapter = createMemoryTldrawTarget('canvas_001')

    const result = reconcileAutoFrames({ editor, adapter })

    expect(result.changed).toBe(false)
    expect(adapter.shapes.get(frameId)).toMatchObject({ type: 'frame', x: 100, y: 200 })
    expect(adapter.shapes.get('shape:todo')).toMatchObject({ parentId: frameId, x: 32, y: 64 })
  })
})

describe('auto-frame change subscription', () => {
  it('recognizes supported cards and managed frames but ignores unrelated records', () => {
    const entry = (record: any) => ({
      changes: { added: { [record.id]: record }, updated: {}, removed: {} },
      source: 'user'
    })
    expect(isAutoFrameRelevantChange(entry({ ...todo('shape:todo', 0), typeName: 'shape' }))).toBe(true)
    expect(isAutoFrameRelevantChange(entry({
      id: 'shape:frame',
      typeName: 'shape',
      type: 'frame',
      props: {},
      meta: { hermesAutoFrame: { version: 1, kind: 'todo' } }
    }))).toBe(true)
    expect(isAutoFrameRelevantChange(entry({ id: 'shape:arrow', typeName: 'shape', type: 'arrow', props: {}, meta: {} }))).toBe(false)
    expect(isAutoFrameRelevantChange(entry({ id: 'camera:camera', typeName: 'camera' }))).toBe(false)
  })

  it('debounces bursts and unsubscribes cleanly', () => {
    vi.useFakeTimers()
    const { editor, raw, emit } = createEditorDouble([])
    const reconcile = vi.fn()
    const unsubscribe = subscribeToAutoFrameChanges({ editor, reconcile })
    const record = { ...todo('shape:todo', 0), typeName: 'shape', parentId: 'page:page', meta: {} }

    for (let index = 0; index < 5; index += 1) {
      emit({ added: { [record.id]: record }, updated: {}, removed: {} })
    }
    vi.advanceTimersByTime(79)
    expect(reconcile).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(reconcile).toHaveBeenCalledTimes(1)
    expect(raw.store.listen).toHaveBeenCalledWith(expect.any(Function), {
      source: 'all',
      scope: 'document'
    })

    emit({ added: { [record.id]: record }, updated: {}, removed: {} })
    unsubscribe()
    vi.runAllTimers()
    expect(reconcile).toHaveBeenCalledTimes(1)
  })

  it('does not schedule recursive work from writes during reconciliation', () => {
    vi.useFakeTimers()
    const { editor, emit } = createEditorDouble([todo('shape:todo', 0)])
    const adapter = createMemoryTldrawTarget('canvas_001')
    const reconcile = vi.fn(() => reconcileAutoFrames({ editor, adapter }))
    const unsubscribe = subscribeToAutoFrameChanges({ editor, reconcile })
    const record = { ...todo('shape:todo_2', 400), typeName: 'shape', parentId: 'page:page', meta: {} }

    emit({ added: { [record.id]: record }, updated: {}, removed: {} })
    vi.runAllTimers()

    expect(reconcile).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('restores cards when deleting a generated frame also removes its children', () => {
    vi.useFakeTimers()
    const { editor, shapes, emit } = createEditorDouble([])
    const adapter = createMemoryTldrawTarget('canvas_001')
    const reconcile = () => reconcileAutoFrames({ editor, adapter })
    const unsubscribe = subscribeToAutoFrameChanges({ editor, reconcile })
    const frameId = 'shape:hermes-auto-frame-page-page-todo'
    const removedFrame = {
      id: frameId,
      typeName: 'shape',
      type: 'frame',
      parentId: 'page:page',
      x: 100,
      y: 200,
      props: { w: 400, h: 276, name: 'Todos', color: 'yellow' },
      meta: { hermesAutoFrame: { version: 1, kind: 'todo' } }
    }
    const removedCard = {
      ...todo('shape:todo', 32),
      typeName: 'shape',
      parentId: frameId,
      x: 32,
      y: 64,
      meta: {}
    }

    emit({
      added: {},
      updated: {},
      removed: { [frameId]: removedFrame, [removedCard.id]: removedCard }
    })
    vi.runAllTimers()

    expect(shapes.find((shape) => shape.id === frameId)).toMatchObject({
      type: 'frame',
      x: 100,
      y: 200
    })
    expect(shapes.find((shape) => shape.id === removedCard.id)).toMatchObject({
      parentId: frameId,
      x: 32,
      y: 64
    })
    unsubscribe()
  })
})
