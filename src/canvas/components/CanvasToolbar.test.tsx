import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasToolbar } from './CanvasToolbar'

const insertMock = vi.hoisted(() => ({
  insertCard: vi.fn(),
  isReady: true
}))

vi.mock('./CanvasInsertMenu', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./CanvasInsertMenu')>()
  return {
    ...actual,
    useCanvasInsert: () => insertMock
  }
})

vi.mock('tldraw', () => ({
  DefaultToolbar: ({ children }: { children?: ReactNode }) => (
    <div data-testid="default-toolbar">{children}</div>
  ),
  TldrawUiMenuToolItem: ({ toolId }: { toolId: string }) => (
    <button data-testid={`tool-${toolId}`} />
  )
}))

describe('CanvasToolbar', () => {
  beforeEach(() => {
    insertMock.insertCard.mockReset()
    insertMock.isReady = true
  })

  it('renders the five card inserts', () => {
    render(<CanvasToolbar />)
    for (const label of ['Project Card', 'Todo Block', 'Link Card', 'Note Card', 'Docs Card']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('renders exactly the six kept tools', () => {
    render(<CanvasToolbar />)
    for (const toolId of ['select', 'hand', 'arrow', 'text', 'draw', 'eraser']) {
      expect(screen.getByTestId(`tool-${toolId}`)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('tool-note')).toBeNull()
    expect(screen.queryByTestId('tool-frame')).toBeNull()
  })

  it('inserts the matching card kind on click', () => {
    render(<CanvasToolbar />)
    fireEvent.click(screen.getByLabelText('Docs Card'))
    expect(insertMock.insertCard).toHaveBeenCalledWith('docs')
  })

  it('disables the inserts until the canvas is ready', () => {
    insertMock.isReady = false
    render(<CanvasToolbar />)
    expect(screen.getByLabelText('Todo Block')).toBeDisabled()
    expect(screen.getByLabelText('Todo Block')).toHaveAttribute(
      'title',
      'Canvas is still loading'
    )
  })
})
