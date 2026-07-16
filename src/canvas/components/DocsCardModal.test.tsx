import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocsCardModal } from './DocsCardModal'

describe('DocsCardModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('autosaves edits and flushes the latest draft before close', () => {
    const onCommit = vi.fn()
    const onClose = vi.fn()

    render(
      <DocsCardModal
        title="Draft"
        content="# Old"
        onCommit={onCommit}
        onClose={onClose}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Document title' }), {
      target: { value: 'Published' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown source' }), {
      target: { value: '# New' }
    })

    expect(onCommit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(onCommit).toHaveBeenLastCalledWith({
      title: 'Published',
      content: '# New'
    })

    fireEvent.click(screen.getByRole('button', { name: 'Close document editor' }))
    expect(onCommit).toHaveBeenLastCalledWith({
      title: 'Published',
      content: '# New'
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('renders Markdown preview and closes on Escape', () => {
    const onClose = vi.fn()

    render(
      <DocsCardModal
        title="Draft"
        content="# New"
        onCommit={vi.fn()}
        onClose={onClose}
      />
    )

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'New' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
