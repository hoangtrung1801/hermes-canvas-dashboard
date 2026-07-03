import { describe, expect, it } from 'vitest'
import type { ExcalidrawElementLike } from '../../src/canvas/adapters/ExcalidrawAdapter'
import { HeadlessExcalidrawApi } from './headlessExcalidrawApi'

describe('HeadlessExcalidrawApi', () => {
  it('stores and replaces scene elements in memory', () => {
    const initial: ExcalidrawElementLike[] = [
      { id: 'element_0001', type: 'rectangle', x: 10, y: 20, width: 100, height: 80 }
    ]
    const api = new HeadlessExcalidrawApi(initial)

    expect(api.getSceneElements()).toEqual(initial)

    const next: ExcalidrawElementLike[] = [
      { id: 'element_0002', type: 'text', x: 30, y: 40, width: 160, height: 32 }
    ]

    api.updateScene({ elements: next })

    expect(api.getSceneElements()).toEqual(next)
    expect(api.getSceneElements()).not.toBe(next)
  })

  it('returns stable default app state for observations', () => {
    const api = new HeadlessExcalidrawApi([])

    expect(api.getAppState()).toEqual({
      scrollX: 0,
      scrollY: 0,
      selectedElementIds: {},
      width: 1200,
      height: 800
    })
  })

  it('accepts scrollToContent without requiring a browser runtime', () => {
    const api = new HeadlessExcalidrawApi([])

    expect(() => api.scrollToContent()).not.toThrow()
    expect(api.getAppState()).toMatchObject({ width: 1200, height: 800 })
  })
})
