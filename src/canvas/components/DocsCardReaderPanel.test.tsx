import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocsCardReaderPanel } from './DocsCardReaderPanel'

describe('DocsCardReaderPanel', () => {
  it('renders a read-only, scrollable Markdown reader', () => {
    render(
      <DocsCardReaderPanel
        title="Release notes"
        content={'# Heading\n\nBody'}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Release notes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Markdown reader' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('closes from the close button and Escape', () => {
    const onClose = vi.fn()

    render(
      <DocsCardReaderPanel
        title="Release notes"
        content="# Heading"
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close document reader' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Release notes' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
