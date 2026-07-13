import { describe, expect, it } from 'vitest'
import { resolveProjectTaskDrop } from './projectCardDrag'

const zones = [
  {
    status: 'todo' as const,
    rect: { left: 0, right: 200, top: 40, bottom: 300 },
    tasks: [
      { id: 'task_a', rect: { left: 0, right: 200, top: 60, bottom: 100 } },
      { id: 'task_b', rect: { left: 0, right: 200, top: 110, bottom: 150 } }
    ]
  },
  {
    status: 'doing' as const,
    rect: { left: 210, right: 410, top: 40, bottom: 300 },
    tasks: []
  }
]

describe('resolveProjectTaskDrop', () => {
  it('returns beginning, middle, end, and empty-column targets', () => {
    expect(resolveProjectTaskDrop(100, 65, zones)).toEqual({
      status: 'todo',
      beforeTaskId: 'task_a'
    })
    expect(resolveProjectTaskDrop(100, 115, zones)).toEqual({
      status: 'todo',
      beforeTaskId: 'task_b'
    })
    expect(resolveProjectTaskDrop(100, 250, zones)).toEqual({
      status: 'todo',
      beforeTaskId: null
    })
    expect(resolveProjectTaskDrop(300, 100, zones)).toEqual({
      status: 'doing',
      beforeTaskId: null
    })
  })

  it('returns null outside all column bodies', () => {
    expect(resolveProjectTaskDrop(500, 100, zones)).toBeNull()
    expect(resolveProjectTaskDrop(100, 20, zones)).toBeNull()
  })
})
