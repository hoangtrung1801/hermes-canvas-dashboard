import { describe, expect, it } from 'vitest'
import {
  createLinkCardProps,
  createTodoBlockProps,
  fitHermesCardDimensions,
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
      h: 180,
      title: 'Launch',
      color: 'yellow',
      tasks: [{ id: 'task_0001', text: 'Ship', done: false }]
    })
  })

  it('creates stable default props for link cards', () => {
    expect(createLinkCardProps({ title: 'Docs', url: 'https://tldraw.dev' })).toEqual({
      w: 320,
      h: 180,
      title: 'Docs',
      url: 'https://tldraw.dev',
      description: '',
      imageUrl: '',
      color: 'light-blue'
    })
  })

  it('sizes link cards for a browsed screenshot or preview image', () => {
    expect(
      createLinkCardProps({
        title: 'Docs',
        url: 'https://tldraw.dev',
        imageUrl: 'https://tldraw.dev/preview.png'
      })
    ).toMatchObject({
      w: 480,
      h: 270,
      imageUrl: 'https://tldraw.dev/preview.png'
    })
  })

  it('fits requested card dimensions inside a 16:9 frame', () => {
    const portraitRequest = fitHermesCardDimensions(400, 300)
    expect(portraitRequest.w).toBeCloseTo(300 * 16 / 9)
    expect(portraitRequest.h).toBe(300)
    expect(fitHermesCardDimensions(640, 200)).toEqual({ w: 640, h: 360 })
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

  it('migrates existing link cards to an empty preview image URL', () => {
    const props = { w: 300, h: 120, title: 'Link', url: 'https://tldraw.dev', description: '' } as Record<string, unknown>
    const migration = linkCardMigrations.sequence[1]
    if (!('up' in migration)) throw new Error('Expected image URL migration')

    migration.up(props)

    expect(props.imageUrl).toBe('')
  })

  it('migrates existing custom cards to a content-preserving 16:9 frame', () => {
    const todoProps = { w: 320, h: 220 } as Record<string, unknown>
    const linkProps = { w: 300, h: 120 } as Record<string, unknown>
    const todoMigration = todoBlockMigrations.sequence[1]
    const linkMigration = linkCardMigrations.sequence[2]
    if (!('up' in todoMigration) || !('up' in linkMigration)) {
      throw new Error('Expected aspect ratio migrations')
    }

    todoMigration.up(todoProps)
    linkMigration.up(linkProps)

    expect(todoProps.w).toEqual(expect.any(Number))
    expect(todoProps.w as number).toBeCloseTo(220 * 16 / 9)
    expect(todoProps.h).toBe(220)
    expect(linkProps).toEqual({ w: 320, h: 180 })
  })
})
