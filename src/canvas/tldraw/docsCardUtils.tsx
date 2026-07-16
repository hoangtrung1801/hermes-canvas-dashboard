import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  resizeBox,
  useEditor,
  type TLResizeInfo,
  type TLShape
} from 'tldraw'
import { T } from '@tldraw/validate'
import type { MouseEvent, PointerEvent } from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DocsCardModal, type DocsCardDraft } from '../components/DocsCardModal'
import { DocsCardReaderPanel } from '../components/DocsCardReaderPanel'
import {
  DOCS_CARD_DEFAULT_HEIGHT,
  DOCS_CARD_DEFAULT_WIDTH,
  DOCS_CARD_MIN_HEIGHT,
  DOCS_CARD_MIN_WIDTH,
  DOCS_CARD_TYPE,
  createDocsCardProps,
  docsCardMigrations,
  fitDocsCardDimensions,
  type DocsCardProps
} from './docsCard.types'
import { renderDocsMarkdown } from './docsMarkdown'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [DOCS_CARD_TYPE]: DocsCardProps
  }
}

export type DocsCardShape = TLShape<typeof DOCS_CARD_TYPE>

type DocsCardComponentProps = {
  shape: DocsCardShape
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 2.75h6l4 4V17H5z" />
      <path d="M11 2.75v4h4M7.5 10h5M7.5 13h5" />
    </svg>
  )
}

function markCanvasEventHandled(editor: ReturnType<typeof useEditor>, event: PointerEvent<HTMLElement>) {
  editor.markEventAsHandled(event)
}

function openDocsCardEditor(
  setEditorOpen: (open: boolean) => void,
  editor: ReturnType<typeof useEditor>,
  event: MouseEvent<HTMLElement>
) {
  setEditorOpen(true)
  editor.markEventAsHandled(event)
}

function openDocsCardReader(
  setReaderOpen: (open: boolean) => void,
  editor: ReturnType<typeof useEditor>,
  event: MouseEvent<HTMLElement>
) {
  setReaderOpen(true)
  editor.markEventAsHandled(event)
}

export class DocsCardShapeUtil extends ShapeUtil<DocsCardShape> {
  static override type = DOCS_CARD_TYPE
  static override migrations = docsCardMigrations
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    content: T.string
  }

  override canEdit = () => false
  override canResize = () => true
  override isAspectRatioLocked = () => false

  override onDoubleClick(shape: DocsCardShape) {
    return {
      id: shape.id,
      type: DOCS_CARD_TYPE as 'docs_card',
      props: shape.props
    }
  }

  getDefaultProps(): DocsCardProps {
    return createDocsCardProps({
      title: 'New Document',
      content: '',
      w: DOCS_CARD_DEFAULT_WIDTH,
      h: DOCS_CARD_DEFAULT_HEIGHT
    })
  }

  getGeometry(shape: DocsCardShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true
    })
  }

  getIndicatorPath() {
    return undefined
  }

  override onResize(shape: DocsCardShape, info: TLResizeInfo<DocsCardShape>) {
    const { id: _id, type: _type, ...patch } = resizeBox(shape as any, info as any, {
      minWidth: DOCS_CARD_MIN_WIDTH,
      minHeight: DOCS_CARD_MIN_HEIGHT
    })

    if (patch.props) {
      patch.props = {
        ...patch.props,
        ...fitDocsCardDimensions(patch.props.w, patch.props.h)
      }
    }
    return patch
  }

  component(shape: DocsCardShape) {
    return <DocsCardComponent shape={shape} />
  }
}

function DocsCardComponent({ shape }: DocsCardComponentProps) {
  const editor = useEditor()
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isReaderOpen, setIsReaderOpen] = useState(false)
  const preview = renderDocsMarkdown(shape.props.content)

  const commitDraft = (draft: DocsCardDraft) => {
    editor.updateShape({
      id: shape.id,
      type: DOCS_CARD_TYPE,
      props: {
        title: draft.title.trim() || shape.props.title,
        content: draft.content
      }
    } as any)
  }

  const closeEditor = () => setIsEditorOpen(false)

  return (
    <>
      <HTMLContainer
        className="hermes-shape hermes-docs-card"
        onDoubleClick={(event) => openDocsCardReader(setIsReaderOpen, editor, event)}
      >
        <header className="hermes-card-header hermes-docs-header">
          <span className="hermes-card-icon">
            <DocumentIcon />
          </span>
          <strong>{shape.props.title}</strong>
          <button
            type="button"
            className="hermes-docs-open-button"
            onClick={(event) => openDocsCardEditor(setIsEditorOpen, editor, event)}
            onDoubleClick={(event) => {
              event.stopPropagation()
              editor.markEventAsHandled(event)
            }}
            onPointerDown={(event) => markCanvasEventHandled(editor, event)}
            onPointerUp={(event) => markCanvasEventHandled(editor, event)}
          >
            Edit
          </button>
        </header>
        <div
          className="hermes-docs-body"
          role="region"
          aria-label="Markdown document"
          onWheel={(event) => {
            event.stopPropagation()
            editor.markEventAsHandled(event)
          }}
        >
          {preview.error ? (
            <p role="alert">Unable to render Markdown: {preview.error}</p>
          ) : preview.html ? (
            <div
              className="hermes-docs-content"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : (
            <p className="hermes-docs-empty">Click Edit to add content</p>
          )}
        </div>
      </HTMLContainer>
      {isEditorOpen && createPortal(
        <DocsCardModal
          title={shape.props.title}
          content={shape.props.content}
          onCommit={commitDraft}
          onClose={closeEditor}
        />,
        document.body
      )}
      {isReaderOpen && (
        <DocsCardReaderPanel
          title={shape.props.title}
          content={shape.props.content}
          onClose={() => setIsReaderOpen(false)}
        />
      )}
    </>
  )
}
