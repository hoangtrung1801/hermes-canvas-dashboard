import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteCardShapeUtil } from './noteCardUtils'
import { createNoteCardShapeProps, NOTE_CARD_TYPE } from './noteCard.types'

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
          red: { noteFill: '#fecaca' },
          yellow: { noteFill: '#fde68a' }
        }
      }
    })),
    getColorMode: vi.fn(() => 'light')
  },
  editingShapeId: null as string | null,
  resizeBox: vi.fn((shape: any) => ({ ...shape, props: { ...shape.props, w: 480, h: 400 } }))
}))

vi.mock('tldraw', () => ({
  HTMLContainer: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Rectangle2d: class {
    constructor(public props: unknown) {}
  },
  ShapeUtil: class {},
  DefaultColorStyle: tldrawMock.defaultColorStyle,
  getColorValue: (colors: any, color: string, variant: string) =>
    colors[color]?.[variant] ?? color,
  resizeBox: tldrawMock.resizeBox,
  useEditor: () => tldrawMock.editor,
  useIsEditing: (shapeId: string) => tldrawMock.editingShapeId === shapeId
}))

function renderNote(props: Record<string, unknown> = {}) {
  const util = new NoteCardShapeUtil({} as any)
  return render(
    util.component({
      id: 'shape:note_1',
      type: NOTE_CARD_TYPE,
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
        h: 180,
        title: 'Launch',
        tag: 'Idea',
        content: 'Ship it',
        color: 'yellow',
        ...props
      }
    } as any)
  )
}

describe('NoteCardShapeUtil', () => {
  beforeEach(() => {
    tldrawMock.editor.updateShape.mockClear()
    tldrawMock.editor.setEditingShape.mockClear()
    tldrawMock.editingShapeId = null
  })

  it('renders on the shared card chassis so it matches its siblings', () => {
    renderNote()
    expect(screen.getByText('Launch').closest('.hermes-shape')).toBeInTheDocument()
    expect(screen.getByText('Launch').closest('.hermes-note-card')).toBeInTheDocument()
  })

  it('shows the tag as a kicker and the content as the body', () => {
    renderNote()
    expect(screen.getByText('Idea')).toHaveClass('hermes-card-kicker')
    expect(screen.getByText('Ship it')).toHaveClass('hermes-note-body')
  })

  it('omits the kicker when there is no tag', () => {
    const { container } = renderNote({ tag: '' })
    expect(container.querySelector('.hermes-card-kicker')).toBeNull()
  })

  it('carries the accent token from the theme colour', () => {
    renderNote({ color: 'red' })
    expect(screen.getByText('Launch').closest('.hermes-shape')).toHaveStyle({
      '--hc-accent': '#fecaca'
    })
  })

  it('enters edit mode on double click', () => {
    renderNote()
    fireEvent.doubleClick(screen.getByText('Launch').closest('.hermes-shape')!)
    expect(tldrawMock.editor.setEditingShape).toHaveBeenCalledWith('shape:note_1')
  })

  it('edits title, tag and content while editing', () => {
    tldrawMock.editingShapeId = 'shape:note_1'
    renderNote()

    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Renamed' } })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith(
      expect.objectContaining({ props: { title: 'Renamed' } })
    )

    fireEvent.change(screen.getByLabelText('Note content'), { target: { value: 'Body' } })
    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith(
      expect.objectContaining({ props: { content: 'Body' } })
    )
  })
})

describe('createNoteCardShapeProps', () => {
  it('defaults content, colour and dimensions', () => {
    expect(createNoteCardShapeProps({ title: 'A', tag: 'B' })).toMatchObject({
      title: 'A',
      tag: 'B',
      content: '',
      color: 'yellow',
      w: 320,
      h: 180
    })
  })

  it('rejects a blank title the way the docs card does', () => {
    expect(() => createNoteCardShapeProps({ title: '   ', tag: 'B' })).toThrow()
  })

  it('clamps dimensions below the minimum', () => {
    expect(createNoteCardShapeProps({ title: 'A', tag: 'B', w: 10, h: 10 })).toMatchObject({
      w: 240,
      h: 140
    })
  })
})
