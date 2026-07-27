import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INSERT_OPTIONS, useCanvasInsert } from './CanvasInsertMenu'

const storeMock = vi.hoisted(() => ({
  bridge: null as null | { handleActionEnvelope: ReturnType<typeof vi.fn> },
  adapter: null as null | { canvasId: string },
  editor: null as null | {
    getViewportPageBounds: () => { x: number; y: number; w: number; h: number }
  },
  setObservation: vi.fn(),
  addLog: vi.fn()
}))

vi.mock('../state/bridgeStore', () => ({
  useBridgeStore: (selector: (state: typeof storeMock) => unknown) => selector(storeMock)
}))

describe('useCanvasInsert', () => {
  beforeEach(() => {
    storeMock.bridge = {
      handleActionEnvelope: vi.fn(() => ({
        result: { ok: true },
        observation: { state: { shapes: [] } }
      }))
    }
    storeMock.adapter = { canvasId: 'canvas_001' }
    storeMock.editor = { getViewportPageBounds: () => ({ x: 0, y: 0, w: 1000, h: 800 }) }
    storeMock.setObservation.mockReset()
    storeMock.addLog.mockReset()
  })

  it('exposes one option per card kind', () => {
    expect(INSERT_OPTIONS.map((option) => option.kind)).toEqual([
      'project',
      'todo',
      'link',
      'note',
      'docs'
    ])
  })

  it('is not ready until bridge, adapter and editor all exist', () => {
    storeMock.editor = null
    const { result } = renderHook(() => useCanvasInsert())
    expect(result.current.isReady).toBe(false)
  })

  it('dispatches a create action followed by a select action', () => {
    const { result } = renderHook(() => useCanvasInsert())
    act(() => result.current.insertCard('todo'))

    const envelope = storeMock.bridge!.handleActionEnvelope.mock.calls[0][0]
    expect(envelope.canvasId).toBe('canvas_001')
    expect(envelope.actions[0].type).toBe('create_todo_block')
    expect(envelope.actions[1].type).toBe('select_shapes')
    expect(envelope.actions[1].shapeIds).toEqual([envelope.actions[0].id])
    expect(storeMock.bridge!.handleActionEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ actions: expect.any(Array) }),
      { origin: 'canvas' }
    )
    expect(storeMock.setObservation).toHaveBeenCalledWith({ shapes: [] })
  })

  it('centres the new card in the viewport', () => {
    const { result } = renderHook(() => useCanvasInsert())
    act(() => result.current.insertCard('todo'))

    const createAction = storeMock.bridge!.handleActionEnvelope.mock.calls[0][0].actions[0]
    expect(createAction.x).toBe(360)
    expect(createAction.y).toBe(320)
  })
})
