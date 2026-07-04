import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LinkCardShapeUtil, TaskCardShapeUtil, TodoBlockShapeUtil } from './customShapeUtils'

vi.mock('tldraw', () => {
  return {
    HTMLContainer: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Rectangle2d: class {
      constructor(public props: unknown) {}
    },
    ShapeUtil: class {}
  }
})

describe('custom tldraw ShapeUtils', () => {
  it('renders todo block content', () => {
    const util = new TodoBlockShapeUtil({} as any)
    render(
      util.component({
        id: 'shape:todo_1',
        type: 'todo_block',
        x: 0,
        y: 0,
        rotation: 0,
        index: 'a1',
        parentId: 'page:page',
        isLocked: false,
        opacity: 1,
        meta: {},
        props: {
          w: 320,
          h: 220,
          title: 'Launch',
          tasks: [{ id: 'task_copy', text: 'Write copy', done: true }]
        }
      } as any)
    )

    expect(screen.getByText('Launch')).toBeInTheDocument()
    expect(screen.getByText('Write copy')).toBeInTheDocument()
  })

  it('renders task and link cards', () => {
    const taskUtil = new TaskCardShapeUtil({} as any)
    const linkUtil = new LinkCardShapeUtil({} as any)

    render(
      <>
        {taskUtil.component({
          id: 'shape:task_1',
          type: 'task_card',
          x: 0,
          y: 0,
          rotation: 0,
          index: 'a1',
          parentId: 'page:page',
          isLocked: false,
          opacity: 1,
          meta: {},
          props: { w: 280, h: 160, title: 'Design', body: 'Build UI', status: 'todo', priority: 'high' }
        } as any)}
        {linkUtil.component({
          id: 'shape:link_1',
          type: 'link_card',
          x: 0,
          y: 0,
          rotation: 0,
          index: 'a2',
          parentId: 'page:page',
          isLocked: false,
          opacity: 1,
          meta: {},
          props: { w: 300, h: 120, title: 'Docs', url: 'https://tldraw.dev', description: 'SDK docs' }
        } as any)}
      </>
    )

    expect(screen.getByText('Design')).toBeInTheDocument()
    expect(screen.getByText('https://tldraw.dev')).toBeInTheDocument()
  })
})
