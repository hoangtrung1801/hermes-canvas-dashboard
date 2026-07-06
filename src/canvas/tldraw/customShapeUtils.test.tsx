import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LinkCardShapeUtil, TaskCardShapeUtil, TodoBlockShapeUtil } from './customShapeUtils'

const tldrawMock = vi.hoisted(() => ({
  editor: {
    updateShape: vi.fn(),
    markEventAsHandled: vi.fn(),
    setEditingShape: vi.fn((shapeId: string | null) => {
      tldrawMock.editingShapeId = shapeId
    })
  },
  editingShapeId: null as string | null,
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
    useEditor: () => tldrawMock.editor,
    useIsEditing: (shapeId: string) => tldrawMock.editingShapeId === shapeId
  }
})

describe('custom tldraw ShapeUtils', () => {
  beforeEach(() => {
    tldrawMock.editor.updateShape.mockClear()
    tldrawMock.editor.markEventAsHandled.mockClear()
    tldrawMock.editor.setEditingShape.mockClear()
    tldrawMock.editingShapeId = null
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
    expect(screen.queryByLabelText('Todo title')).not.toBeInTheDocument()
  })

  it('asks tldraw to enter editing mode on double click', () => {
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

    fireEvent.doubleClick(screen.getByText('Launch'))

    expect(tldrawMock.editor.setEditingShape).toHaveBeenCalledWith('shape:todo_1')
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

  it('updates todo title and task text from editable fields', () => {
    tldrawMock.editingShapeId = 'shape:todo_1'
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

    fireEvent.change(screen.getByLabelText('Todo title'), { target: { value: 'Release' } })
    fireEvent.change(screen.getByLabelText('Task text: Write copy'), { target: { value: 'Publish notes' } })

    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:todo_1',
      type: 'todo_block',
      props: { title: 'Release' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:todo_1',
      type: 'todo_block',
      props: {
        tasks: [{ id: 'task_copy', text: 'Publish notes', done: false }]
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
    expect(screen.getByText('https://tldraw.dev')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://tldraw.dev' })).toHaveAttribute('href', 'https://tldraw.dev')
    expect(screen.getByRole('link', { name: 'https://tldraw.dev' })).toHaveAttribute('target', '_blank')
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Link title')).not.toBeInTheDocument()
  })

  it('updates task card fields from editable controls', () => {
    tldrawMock.editingShapeId = 'shape:task_1'
    const util = new TaskCardShapeUtil({} as any)
    render(
      util.component({
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
      } as any)
    )

    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Review' } })
    fireEvent.change(screen.getByLabelText('Task body'), { target: { value: 'Check UI' } })
    fireEvent.change(screen.getByLabelText('Task status'), { target: { value: 'doing' } })
    fireEvent.change(screen.getByLabelText('Task priority'), { target: { value: 'medium' } })

    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:task_1',
      type: 'task_card',
      props: { title: 'Review' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:task_1',
      type: 'task_card',
      props: { body: 'Check UI' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:task_1',
      type: 'task_card',
      props: { status: 'doing' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:task_1',
      type: 'task_card',
      props: { priority: 'medium' }
    })
  })

  it('updates link card fields while keeping an external link', () => {
    tldrawMock.editingShapeId = 'shape:link_1'
    const util = new LinkCardShapeUtil({} as any)
    render(
      util.component({
        id: 'shape:link_1',
        type: 'link_card',
        x: 0,
        y: 0,
        rotation: 0,
        index: 'a1',
        parentId: 'page:page',
        isLocked: false,
        opacity: 1,
        meta: {},
        props: { w: 300, h: 120, title: 'Docs', url: 'https://tldraw.dev', description: 'SDK docs' }
      } as any)
    )

    fireEvent.change(screen.getByLabelText('Link title'), { target: { value: 'API' } })
    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'https://example.com' } })
    fireEvent.change(screen.getByLabelText('Link description'), { target: { value: 'Reference' } })

    expect(screen.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', 'https://tldraw.dev')
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:link_1',
      type: 'link_card',
      props: { title: 'API' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:link_1',
      type: 'link_card',
      props: { url: 'https://example.com' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:link_1',
      type: 'link_card',
      props: { description: 'Reference' }
    })
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
