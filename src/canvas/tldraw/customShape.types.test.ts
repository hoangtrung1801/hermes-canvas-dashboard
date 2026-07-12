import { describe, expect, it } from 'vitest'
import {
  createLinkCardProps,
  createTodoBlockProps,
  linkCardMigrations,
  normalizeTodoTasks,
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
      color: 'yellow',
      tasks: [{ id: 'task_0001', text: 'Ship', done: false }]
    })
  })

  it('creates stable default props for link cards', () => {
    expect(createLinkCardProps({ title: 'Docs', url: 'https://tldraw.dev' })).toEqual({
      w: 300,
      h: 120,
      title: 'Docs',
      url: 'https://tldraw.dev',
      description: '',
      color: 'light-blue'
    })
  })

  it('preserves explicit background colors for custom component props', () => {
    expect(createTodoBlockProps({ title: 'Launch', backgroundColor: '#fee2e2' })).toMatchObject({
      backgroundColor: '#fee2e2'
    })
    expect(createLinkCardProps({ title: 'Docs', url: 'https://tldraw.dev', backgroundColor: '#ecfccb' })).toMatchObject({
      backgroundColor: '#ecfccb'
    })
  })

  it('migrates existing custom component props to include a tldraw color', () => {
    const todoProps = { w: 320, h: 220, title: 'Todo', tasks: [] } as Record<string, unknown>
    const linkProps = { w: 300, h: 120, title: 'Link', url: 'https://tldraw.dev', description: '' } as Record<string, unknown>

    runFirstMigration(todoBlockMigrations, todoProps)
    runFirstMigration(linkCardMigrations, linkProps)

    expect(todoProps.color).toBe('yellow')
    expect(linkProps.color).toBe('light-blue')
  })
})
