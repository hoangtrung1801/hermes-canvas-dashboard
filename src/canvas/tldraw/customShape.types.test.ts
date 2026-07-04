import { describe, expect, it } from 'vitest'
import {
  createLinkCardProps,
  createTaskCardProps,
  createTodoBlockProps,
  normalizeTodoTasks
} from './customShape.types'

describe('custom tldraw shape types', () => {
  it('normalizes todo tasks with generated ids and done defaults', () => {
    expect(
      normalizeTodoTasks([
        'Write copy',
        { id: 'task_assets', text: 'Prepare assets', done: true }
      ])
    ).toEqual([
      { id: 'task_0001', text: 'Write copy', done: false },
      { id: 'task_assets', text: 'Prepare assets', done: true }
    ])
  })

  it('creates stable default props for todo blocks', () => {
    expect(createTodoBlockProps({ title: 'Launch', tasks: ['Ship'] })).toEqual({
      w: 320,
      h: 220,
      title: 'Launch',
      tasks: [{ id: 'task_0001', text: 'Ship', done: false }]
    })
  })

  it('creates stable default props for task and link cards', () => {
    expect(createTaskCardProps({ title: 'Design', body: 'Build UI' })).toEqual({
      w: 280,
      h: 160,
      title: 'Design',
      body: 'Build UI',
      status: 'todo',
      priority: 'medium'
    })
    expect(createLinkCardProps({ title: 'Docs', url: 'https://tldraw.dev' })).toEqual({
      w: 300,
      h: 120,
      title: 'Docs',
      url: 'https://tldraw.dev',
      description: ''
    })
  })
})
