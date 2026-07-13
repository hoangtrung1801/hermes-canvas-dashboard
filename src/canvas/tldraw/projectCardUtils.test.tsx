import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultColorStyle } from 'tldraw'
import { ProjectCardShapeUtil } from './projectCardUtils'

const tldrawMock = vi.hoisted(() => ({
  defaultColorStyle: { id: 'tldraw:color', defaultValue: 'black' },
  editor: {
    updateShape: vi.fn(),
    markEventAsHandled: vi.fn(),
    getCurrentTheme: vi.fn(() => ({
      colors: {
        light: {
          'light-violet': { noteFill: '#ddd6fe' }
        }
      }
    })),
    getColorMode: vi.fn(() => 'light')
  },
  resizeBox: vi.fn((shape: any) => ({
    ...shape,
    props: { ...shape.props, w: 1000, h: 520 }
  }))
}))

vi.mock('tldraw', () => ({
  HTMLContainer: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Rectangle2d: class {
    constructor(public readonly config: unknown) {}
  },
  ShapeUtil: class {},
  DefaultColorStyle: tldrawMock.defaultColorStyle,
  getColorValue: (colors: any, color: string, variant: string) =>
    colors[color]?.[variant] ?? color,
  resizeBox: tldrawMock.resizeBox,
  useEditor: () => tldrawMock.editor
}))

function projectShape(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shape:project_1',
    type: 'project_card',
    x: 0,
    y: 0,
    rotation: 0,
    index: 'a1',
    parentId: 'page:page',
    isLocked: false,
    opacity: 1,
    meta: {},
    props: {
      w: 960,
      h: 480,
      title: 'Website launch',
      tasks: [
        { id: 'task_copy', text: 'Write copy', status: 'todo' },
        { id: 'task_ship', text: 'Ship', status: 'done' }
      ],
      color: 'light-violet',
      ...overrides
    }
  } as any
}

describe('ProjectCardShapeUtil', () => {
  beforeEach(() => {
    tldrawMock.editor.updateShape.mockClear()
    tldrawMock.editor.markEventAsHandled.mockClear()
    tldrawMock.resizeBox.mockClear()
  })

  it('registers task-board defaults and independent resizing', () => {
    const util = new ProjectCardShapeUtil({} as any)

    expect(ProjectCardShapeUtil.type).toBe('project_card')
    expect(ProjectCardShapeUtil.props.color).toBe(DefaultColorStyle)
    expect(util.getDefaultProps()).toEqual({
      w: 960,
      h: 480,
      title: 'New Project',
      tasks: [],
      color: 'light-violet'
    })
    expect(util.isAspectRatioLocked()).toBe(false)
    expect(util.onResize(projectShape(), { scaleX: 2, scaleY: 2 } as any)).toMatchObject({
      props: { w: 1000, h: 520 }
    })
    expect(tldrawMock.resizeBox).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'shape:project_1' }),
      { scaleX: 2, scaleY: 2 },
      { minWidth: 760, minHeight: 320 }
    )
  })

  it('renders the board and adapts task changes to tldraw props', () => {
    const util = new ProjectCardShapeUtil({} as any)
    render(util.component(projectShape()))

    expect(screen.getByRole('heading', { name: 'Todo 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Done 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: {
        tasks: [
          { id: 'task_copy', text: 'Write copy', status: 'todo' },
          { id: 'task_ship', text: 'Ship', status: 'done' },
          { id: 'task_0001', text: 'New task', status: 'todo' }
        ]
      }
    })
  })

  it('adapts inline title edits and interactive events', () => {
    const util = new ProjectCardShapeUtil({} as any)
    render(util.component(projectShape()))

    fireEvent.doubleClick(screen.getByText('Website launch'))
    const input = screen.getByRole('textbox', { name: 'Project title' })
    fireEvent.change(input, { target: { value: 'Release' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: { title: 'Release' }
    })
    expect(tldrawMock.editor.markEventAsHandled).toHaveBeenCalled()
  })

  it('uses the selected tldraw color as the board surface', () => {
    const util = new ProjectCardShapeUtil({} as any)
    const { container } = render(util.component(projectShape()))

    expect(container.querySelector('.hermes-project-card')).toHaveStyle({
      width: '960px',
      height: '480px',
      backgroundColor: '#ddd6fe'
    })
  })
})
