import { type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { renderDocsMarkdown } from '../tldraw/docsMarkdown'

export type DocsCardReaderPanelProps = {
  title: string
  content: string
  onClose: () => void
}

export function DocsCardReaderPanel({ title, content, onClose }: DocsCardReaderPanelProps) {
  const preview = renderDocsMarkdown(content)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return createPortal(
    <div
      className="hermes-docs-reader-backdrop"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <aside
        className="hermes-docs-reader-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="docs-card-reader-title"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="hermes-docs-modal-header hermes-docs-reader-header">
          <div>
            <h2 id="docs-card-reader-title">{title}</h2>
            <p>Markdown reader</p>
          </div>
          <button type="button" aria-label="Close document reader" onClick={onClose}>
            ×
          </button>
        </header>

        <div
          className="hermes-docs-reader-body"
          role="region"
          aria-label="Markdown reader"
          onWheel={(event) => event.stopPropagation()}
        >
          {preview.error ? (
            <p role="alert">Unable to render Markdown: {preview.error}</p>
          ) : preview.html ? (
            <div
              className="hermes-docs-content"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : (
            <p className="hermes-docs-empty">No Markdown content yet.</p>
          )}
        </div>
      </aside>
    </div>,
    document.body
  )
}
