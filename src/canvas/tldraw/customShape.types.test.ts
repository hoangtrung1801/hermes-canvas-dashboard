import { describe, expect, it } from 'vitest'
import {
  createLinkCardProps,
  createTaskCardProps,
  createTodoBlockProps,
  linkCardMigrations,
  normalizeTodoTasks,
  taskCardMigrations,
  todoBlockMigrations
} from './customShape.types'

function runFirstMigration(migrations: typeof todoBlockMigrations, props: Record<string, unknown>) {
  const migration = migrations.sequence[0]
  if (!('up' in migration)) throw new Error('Expected first migration to include an up migration')
  migration.up(props)
}

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
      color: 'black',
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
      priority: 'medium',
      color: 'black'
    })
    expect(createLinkCardProps({ title: 'Docs', url: 'https://tldraw.dev' })).toEqual({
      w: 300,
      h: 120,
      title: 'Docs',
      url: 'https://tldraw.dev',
      description: '',
      color: 'black'
    })
  })

  it('preserves explicit background colors for custom component props', () => {
    expect(createTodoBlockProps({ title: 'Launch', backgroundColor: '#fee2e2' })).toMatchObject({
      backgroundColor: '#fee2e2'
    })
    expect(createTaskCardProps({ title: 'Design', backgroundColor: '#fef3c7' })).toMatchObject({
      backgroundColor: '#fef3c7'
    })
    expect(createLinkCardProps({ title: 'Docs', url: 'https://tldraw.dev', backgroundColor: '#ecfccb' })).toMatchObject({
      backgroundColor: '#ecfccb'
    })
  })

  it('migrates existing custom component props to include a tldraw color', () => {
    const todoProps = { w: 320, h: 220, title: 'Todo', tasks: [] } as Record<string, unknown>
    const taskProps = { w: 280, h: 160, title: 'Task', body: '', status: 'todo', priority: 'medium' } as Record<string, unknown>
    const linkProps = { w: 300, h: 120, title: 'Link', url: 'https://tldraw.dev', description: '' } as Record<string, unknown>

    runFirstMigration(todoBlockMigrations, todoProps)
    runFirstMigration(taskCardMigrations, taskProps)
    runFirstMigration(linkCardMigrations, linkProps)

    expect(todoProps.color).toBe('black')
    expect(taskProps.color).toBe('black')
    expect(linkProps.color).toBe('black')
  })
})
