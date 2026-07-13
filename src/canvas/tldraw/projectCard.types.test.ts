import { describe, expect, it } from 'vitest'
import {
  appendProjectTask,
  createProjectCardProps,
  moveProjectTask,
  nextProjectTaskId,
  projectCardMigrations,
  removeProjectTask,
  updateProjectTaskText
} from './projectCard.types'

const tasks = [
  { id: 'task_a', text: 'A', status: 'todo' as const },
  { id: 'task_b', text: 'B', status: 'todo' as const },
  { id: 'task_c', text: 'C', status: 'doing' as const }
]

describe('project task-board domain', () => {
  it('creates wide defaults and reserves explicit task ids before generation', () => {
    expect(
      createProjectCardProps({
        title: '  Website launch  ',
        tasks: [
          { text: '  Draft copy  ' },
          { id: 'task_0001', text: 'Review', status: 'doing' },
          { text: 'Ship', status: 'blocked' }
        ]
      })
    ).toEqual({
      w: 960,
      h: 480,
      title: 'Website launch',
      tasks: [
        { id: 'task_0002', text: 'Draft copy', status: 'todo' },
        { id: 'task_0001', text: 'Review', status: 'doing' },
        { id: 'task_0003', text: 'Ship', status: 'blocked' }
      ],
      color: 'light-violet'
    })
  })

  it('fits dimensions to 760 by 320 and allocates the first free task id', () => {
    expect(createProjectCardProps({ title: 'Small', w: 100, h: 100 })).toMatchObject({
      w: 760,
      h: 320
    })
    expect(nextProjectTaskId([{ id: 'task_0001' }, { id: 'task_0003' }])).toBe('task_0002')
  })

  it('discards legacy lifecycle fields in the task-board migration', () => {
    const migration = projectCardMigrations.sequence[1]
    if (!('up' in migration)) throw new Error('Expected task-board up migration')
    const props: Record<string, unknown> = {
      w: 360,
      h: 320,
      title: 'Legacy',
      color: 'light-violet',
      status: 'active',
      priority: 'high',
      dueDate: '2026-07-31',
      actions: [{ id: 'action_ship', text: 'Ship', done: false }]
    }

    migration.up(props)

    expect(props).toEqual({
      w: 760,
      h: 320,
      title: 'Legacy',
      color: 'light-violet',
      tasks: []
    })
  })

  it('appends, edits, and removes tasks without changing unrelated tasks', () => {
    const appended = appendProjectTask(tasks, {
      id: 'task_d',
      text: ' D ',
      status: 'done'
    })

    expect(appended.at(-1)).toEqual({ id: 'task_d', text: 'D', status: 'done' })
    expect(updateProjectTaskText(appended, 'task_d', '  Delivered  ').at(-1)?.text).toBe(
      'Delivered'
    )
    expect(removeProjectTask(appended, 'task_b').map((task) => task.id)).toEqual([
      'task_a',
      'task_c',
      'task_d'
    ])
  })

  it('moves across columns and before a destination task', () => {
    expect(moveProjectTask(tasks, 'task_b', 'doing', 'task_c')).toEqual([
      { id: 'task_a', text: 'A', status: 'todo' },
      { id: 'task_b', text: 'B', status: 'doing' },
      { id: 'task_c', text: 'C', status: 'doing' }
    ])
  })

  it('reorders within a column and appends to an empty column', () => {
    expect(moveProjectTask(tasks, 'task_b', 'todo', 'task_a').map((task) => task.id)).toEqual([
      'task_b',
      'task_a',
      'task_c'
    ])
    expect(moveProjectTask(tasks, 'task_a', 'blocked').at(-1)).toEqual({
      id: 'task_a',
      text: 'A',
      status: 'blocked'
    })
  })

  it('returns the original array for a no-op and rejects invalid targets', () => {
    expect(moveProjectTask(tasks, 'task_a', 'todo', 'task_b')).toBe(tasks)
    expect(() => moveProjectTask(tasks, 'missing', 'todo')).toThrow(
      'Unknown project task missing'
    )
    expect(() => moveProjectTask(tasks, 'task_a', 'doing', 'task_b')).toThrow(
      'Project task task_b is not in doing'
    )
    expect(() => moveProjectTask(tasks, 'task_a', 'todo', 'task_a')).toThrow(
      'Project task cannot move before itself'
    )
  })

  it('rejects blank text, duplicate ids, and invalid runtime status values', () => {
    expect(() => createProjectCardProps({ title: '   ' })).toThrow(
      'Project title must not be empty'
    )
    expect(() =>
      createProjectCardProps({
        title: 'Launch',
        tasks: [
          { id: 'same', text: 'A' },
          { id: 'same', text: 'B' }
        ]
      })
    ).toThrow('Duplicate project task same')
    expect(() =>
      appendProjectTask(tasks, {
        id: 'task_bad',
        text: 'Bad',
        status: 'paused' as never
      })
    ).toThrow('Invalid project task status paused')
  })
})
