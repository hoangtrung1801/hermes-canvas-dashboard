import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocsCardShapeUtil } from './docsCardUtils'

const tldrawMock = vi.hoisted(() => ({
  editor: {
    updateShape: vi.fn(),
    markEventAsHandled: vi.fn(),
    setEditingShape: vi.fn(),
    getColorMode: vi.fn(() => 'light')
  },
  editingShapeId: null as string | null,
  resizeBox: vi.fn((shape: any) => ({ ...shape, props: { ...shape.props, w: 700, h: 820 } }))
}))

vi.mock('tldraw', () => ({
  HTMLContainer: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Rectangle2d: class {
    constructor(public props: unknown) {}
  },
  ShapeUtil: class {},
  resizeBox: tldrawMock.resizeBox,
  useEditor: () => tldrawMock.editor,
  useIsEditing: (shapeId: string) => tldrawMock.editingShapeId === shapeId
}))

const shape = {
  id: 'shape:docs_1',
  type: 'docs_card',
  x: 0,
  y: 0,
  rotation: 0,
  index: 'a1',
  parentId: 'page:page',
  isLocked: false,
  opacity: 1,
  meta: {},
  props: {
    w: 480,
    h: 640,
    title: 'Release notes',
    content: '# Heading\n\nBody'
  }
} as any

describe('Docs Card ShapeUtil', () => {
  beforeEach(() => {
    tldrawMock.editor.updateShape.mockClear()
    tldrawMock.editor.markEventAsHandled.mockClear()
    tldrawMock.editor.setEditingShape.mockClear()
    tldrawMock.editingShapeId = null
  })

  it('exposes the docs shape contract and default props', () => {
    expect(DocsCardShapeUtil.type).toBe('docs_card')
    expect(DocsCardShapeUtil.props).toMatchObject({
      w: expect.anything(),
      h: expect.anything(),
      title: expect.anything(),
      content: expect.anything()
    })
    expect(new DocsCardShapeUtil({} as any).getDefaultProps()).toEqual({
      w: 480,
      h: 640,
      title: 'New Document',
      content: ''
    })
  })

  it('renders Markdown content and enters editing mode on request', () => {
    const util = new DocsCardShapeUtil({} as any)
    render(util.component(shape))

    expect(screen.getByText('Release notes')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))
    expect(tldrawMock.editor.setEditingShape).toHaveBeenCalledWith('shape:docs_1')
  })

  it('renders the editor modal for an editing shape', () => {
    tldrawMock.editingShapeId = 'shape:docs_1'
    const util = new DocsCardShapeUtil({} as any)
    render(util.component(shape))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Markdown source' })).toHaveValue('# Heading\n\nBody')
  })
})
