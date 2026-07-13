import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultColorStyle } from 'tldraw'
import { ProjectCardShapeUtil } from './projectCardUtils'

const tldrawMock = vi.hoisted(() => ({
  defaultColorStyle: { id: 'tldraw:color', defaultValue: 'black' },
  editor: {
    updateShape: vi.fn(),
    markEventAsHandled: vi.fn(),
    setEditingShape: vi.fn((shapeId: string | null) => {
      tldrawMock.editingShapeId = shapeId
    }),
    getCurrentTheme: vi.fn(() => ({
      colors: {
        light: {
          'light-violet': { noteFill: '#ddd6fe' }
        }
      }
    })),
    getColorMode: vi.fn(() => 'light')
  },
  editingShapeId: null as string | null,
  resizeBox: vi.fn((shape: any) => ({
    ...shape,
    props: { ...shape.props, w: 480, h: 360 }
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
  useEditor: () => tldrawMock.editor,
  useIsEditing: (shapeId: string) => tldrawMock.editingShapeId === shapeId
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
      w: 360,
      h: 320,
      title: 'Website launch',
      status: 'active',
      priority: 'high',
      dueDate: '2026-07-31',
      actions: [
        { id: 'action_copy', text: 'Write copy', done: true },
        { id: 'action_ship', text: 'Ship', done: false }
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
    tldrawMock.editor.setEditingShape.mockClear()
    tldrawMock.editingShapeId = null
    tldrawMock.resizeBox.mockClear()
  })

  it('registers defaults and independent project resizing', () => {
    const util = new ProjectCardShapeUtil({} as any)

    expect(ProjectCardShapeUtil.type).toBe('project_card')
    expect(ProjectCardShapeUtil.props.color).toBe(DefaultColorStyle)
    expect(util.getDefaultProps()).toMatchObject({
      w: 360,
      h: 320,
      title: 'New Project',
      status: 'planned',
      priority: 'medium',
      actions: [],
      color: 'light-violet'
    })
    expect(util.isAspectRatioLocked()).toBe(false)
    expect(util.onResize(projectShape(), { scaleX: 2, scaleY: 2 } as any)).toMatchObject({
      props: { w: 480, h: 360 }
    })
    expect(tldrawMock.resizeBox).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'shape:project_1' }),
      { scaleX: 2, scaleY: 2 },
      { minWidth: 320, minHeight: 240 }
    )
  })

  it('renders scan mode and derives progress from action completion', () => {
    const util = new ProjectCardShapeUtil({} as any)
    render(util.component(projectShape()))

    expect(screen.getByText('Website launch')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByLabelText('1 of 2 project actions complete')).toHaveTextContent('1/2')
    expect(screen.getByRole('progressbar', { name: 'Project action progress' })).toHaveAttribute(
      'aria-valuenow',
      '50'
    )
    expect(screen.getByText('Write copy').closest('.hermes-project-action')).toHaveClass('is-done')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ship' }))
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: {
        actions: [
          { id: 'action_copy', text: 'Write copy', done: true },
          { id: 'action_ship', text: 'Ship', done: true }
        ]
      }
    })
  })

  it('enters focused edit mode on double click', () => {
    const util = new ProjectCardShapeUtil({} as any)
    render(util.component(projectShape()))

    fireEvent.doubleClick(screen.getByText('Website launch'))

    expect(tldrawMock.editor.setEditingShape).toHaveBeenCalledWith('shape:project_1')
    expect(tldrawMock.editor.markEventAsHandled).toHaveBeenCalled()
  })

  it('edits metadata and actions and exits on Escape', () => {
    tldrawMock.editingShapeId = 'shape:project_1'
    const util = new ProjectCardShapeUtil({} as any)
    const { container } = render(
      util.component(
        projectShape({
          actions: [{ id: 'action_copy', text: 'Write copy', done: false }]
        })
      )
    )

    fireEvent.change(screen.getByLabelText('Project title'), { target: { value: 'Release' } })
    fireEvent.change(screen.getByLabelText('Project status'), { target: { value: 'blocked' } })
    fireEvent.change(screen.getByLabelText('Project priority'), { target: { value: 'medium' } })
    fireEvent.change(screen.getByLabelText('Project due date'), {
      target: { value: '2026-08-01' }
    })
    fireEvent.change(screen.getByLabelText('Project action: Write copy'), {
      target: { value: 'Publish copy' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add project action' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove action: Write copy' }))
    fireEvent.keyDown(container.firstElementChild!, { key: 'Escape' })

    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: { title: 'Release' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: { status: 'blocked' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: { priority: 'medium' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: { dueDate: '2026-08-01' }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: { actions: [{ id: 'action_copy', text: 'Publish copy', done: false }] }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: {
        actions: [
          { id: 'action_copy', text: 'Write copy', done: false },
          { id: 'action_0001', text: 'New action', done: false }
        ]
      }
    })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:project_1',
      type: 'project_card',
      props: { actions: [] }
    })
    expect(tldrawMock.editor.setEditingShape).toHaveBeenCalledWith(null)
  })

  it('warns only for overdue unfinished projects', () => {
    const util = new ProjectCardShapeUtil({} as any)
    const active = render(
      util.component(projectShape({ dueDate: '2000-01-01', status: 'active' }))
    )
    expect(active.container.querySelector('.hermes-project-due')).toHaveClass('is-overdue')
    active.unmount()

    const done = render(util.component(projectShape({ dueDate: '2000-01-01', status: 'done' })))
    expect(done.container.querySelector('.hermes-project-due')).not.toHaveClass('is-overdue')
  })

  it('keeps long action lists inside a scrolling viewport', () => {
    const styles = readFileSync('src/styles.css', 'utf8')
    const rule = styles.match(/\.hermes-project-actions\s*\{(?<body>[\s\S]*?)\n\}/)

    expect(rule?.groups?.body).toMatch(/overflow-y:\s*auto;/)
    expect(rule?.groups?.body).toMatch(/overscroll-behavior:\s*contain;/)
  })
})
