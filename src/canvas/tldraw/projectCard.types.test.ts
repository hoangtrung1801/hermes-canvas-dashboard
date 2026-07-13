import { describe, expect, it } from 'vitest'
import {
  createProjectCardProps,
  getProjectProgress,
  isProjectOverdue,
  isValidProjectDueDate,
  nextProjectActionId
} from './projectCard.types'

describe('project card domain', () => {
  it('creates trimmed defaults and reserves explicit action ids before generation', () => {
    expect(
      createProjectCardProps({
        title: '  Website launch  ',
        actions: [
          { text: '  Draft copy  ' },
          { id: 'action_0001', text: 'Approve design', done: true },
          { text: 'Publish' }
        ]
      })
    ).toEqual({
      w: 360,
      h: 320,
      title: 'Website launch',
      status: 'planned',
      priority: 'medium',
      actions: [
        { id: 'action_0002', text: 'Draft copy', done: false },
        { id: 'action_0001', text: 'Approve design', done: true },
        { id: 'action_0003', text: 'Publish', done: false }
      ],
      color: 'light-violet'
    })
  })

  it('fits dimensions independently to the project minimums', () => {
    expect(createProjectCardProps({ title: 'Small', w: 120, h: 100 })).toMatchObject({
      w: 320,
      h: 240
    })
    expect(createProjectCardProps({ title: 'Wide', w: 640, h: 260 })).toMatchObject({
      w: 640,
      h: 260
    })
  })

  it('rejects blank text and duplicate explicit ids', () => {
    expect(() => createProjectCardProps({ title: '   ' })).toThrow(
      'Project title must not be empty'
    )
    expect(() =>
      createProjectCardProps({
        title: 'Launch',
        actions: [
          { id: 'action_ship', text: 'Ship' },
          { id: 'action_ship', text: 'Announce' }
        ]
      })
    ).toThrow('Duplicate project action action_ship')
  })

  it('derives empty, partial, and complete progress', () => {
    expect(getProjectProgress([])).toEqual({ completed: 0, total: 0, percent: 0 })
    expect(
      getProjectProgress([
        { id: 'a', text: 'A', done: true },
        { id: 'b', text: 'B', done: false },
        { id: 'c', text: 'C', done: true }
      ])
    ).toEqual({ completed: 2, total: 3, percent: 67 })
  })

  it('validates real ISO dates and applies explicit overdue rules', () => {
    expect(isValidProjectDueDate('2026-07-13')).toBe(true)
    expect(isValidProjectDueDate('2026-02-30')).toBe(false)
    expect(isValidProjectDueDate('13-07-2026')).toBe(false)
    expect(isProjectOverdue('2026-07-12', 'active', '2026-07-13')).toBe(true)
    expect(isProjectOverdue('2026-07-13', 'active', '2026-07-13')).toBe(false)
    expect(isProjectOverdue('2026-07-12', 'done', '2026-07-13')).toBe(false)
  })

  it('finds the next unused local action id', () => {
    expect(
      nextProjectActionId([
        { id: 'action_0001', text: 'A', done: false },
        { id: 'action_0003', text: 'C', done: false }
      ])
    ).toBe('action_0002')
  })
})
