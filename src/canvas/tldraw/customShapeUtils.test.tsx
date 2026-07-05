import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LinkCardShapeUtil, TaskCardShapeUtil, TodoBlockShapeUtil } from './customShapeUtils'

const tldrawMock = vi.hoisted(() => ({
  editor: {
    updateShape: vi.fn(),
    markEventAsHandled: vi.fn()
  },
  resizeBox: vi.fn((shape: any) => ({ ...shape, props: { ...shape.props, w: 480, h: 260 } }))
}))

vi.mock('tldraw', () => {
  return {
    HTMLContainer: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Rectangle2d: class {
      constructor(public props: unknown) {}
    },
    ShapeUtil: class {},
    resizeBox: tldrawMock.resizeBox,
    useEditor: () => tldrawMock.editor
  }
})

describe('custom tldraw ShapeUtils', () => {
  beforeEach(() => {
    tldrawMock.editor.updateShape.mockClear()
    tldrawMock.editor.markEventAsHandled.mockClear()
    tldrawMock.resizeBox.mockClear()
  })

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

  it('updates todo task completion from the rendered checkbox', () => {
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
          tasks: [{ id: 'task_copy', text: 'Write copy', done: false }]
        }
      } as any)
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Write copy' }))

    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:todo_1',
      type: 'todo_block',
      props: {
        tasks: [{ id: 'task_copy', text: 'Write copy', done: true }]
      }
    })
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
    expect(screen.getByRole('link', { name: 'https://tldraw.dev' })).toHaveAttribute('href', 'https://tldraw.dev')
    expect(screen.getByRole('link', { name: 'https://tldraw.dev' })).toHaveAttribute('target', '_blank')
  })

  it('resizes custom card shapes through tldraw resizeBox', () => {
    const util = new TaskCardShapeUtil({} as any)
    const shape = {
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
    } as any

    expect(util.onResize(shape, { scaleX: 2, scaleY: 2 } as any)).toMatchObject({
      props: { w: 480, h: 260 }
    })
    expect(tldrawMock.resizeBox).toHaveBeenCalledWith(shape, { scaleX: 2, scaleY: 2 }, {
      minWidth: 180,
      minHeight: 96
    })
  })
})
