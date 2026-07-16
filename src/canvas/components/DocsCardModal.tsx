import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { renderDocsMarkdown } from '../tldraw/docsMarkdown'

export type DocsCardDraft = {
  title: string
  content: string
}

export type DocsCardModalProps = DocsCardDraft & {
  onCommit: (draft: DocsCardDraft) => void
  onClose: () => void
}

export function DocsCardModal({ title, content, onCommit, onClose }: DocsCardModalProps) {
  const [draft, setDraft] = useState<DocsCardDraft>({ title, content })
  const latestDraft = useRef(draft)
  const timer = useRef<number | null>(null)
  const isFirstRender = useRef(true)

  const commitDraft = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    onCommit(latestDraft.current)
  }

  useEffect(() => {
    latestDraft.current = draft

    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      onCommit(latestDraft.current)
    }, 200)

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [draft, onCommit])

  const updateTitle = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value
    setDraft((current) => ({ ...current, title: value }))
  }

  const updateContent = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.currentTarget.value
    setDraft((current) => ({ ...current, content: value }))
  }

  const close = () => {
    commitDraft()
    onClose()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  const preview = renderDocsMarkdown(draft.content)

  return createPortal(
    <div
      className="hermes-modal-backdrop"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) close()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <section
        className="hermes-docs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="docs-card-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="hermes-docs-modal-header">
          <div>
            <h2 id="docs-card-modal-title">Edit document</h2>
            <p>Write Markdown and review the rendered document.</p>
          </div>
          <button type="button" aria-label="Close document editor" onClick={close}>
            ×
          </button>
        </header>

        <label className="hermes-docs-title-field">
          <span>Title</span>
          <input
            aria-label="Document title"
            value={draft.title}
            onChange={updateTitle}
          />
        </label>

        <div className="hermes-docs-modal-panes">
          <label className="hermes-docs-modal-pane hermes-docs-source-pane">
            <span>Markdown source</span>
            <textarea
              aria-label="Markdown source"
              value={draft.content}
              onChange={updateContent}
              spellCheck={false}
            />
          </label>
          <div className="hermes-docs-modal-pane hermes-docs-preview-pane">
            <span>Preview</span>
            {preview.error ? (
              <p role="alert">Unable to render Markdown: {preview.error}</p>
            ) : (
              <div
                aria-label="Markdown preview"
                className="hermes-docs-content"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
