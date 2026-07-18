import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasContextMenu } from './CanvasContextMenu'

const tldrawMock = vi.hoisted(() => ({
  selectedShape: null as { id: string } | null,
  selectedShapeCount: 0,
  writeText: vi.fn(),
  addToast: vi.fn()
}))

vi.mock('tldraw', () => ({
  DefaultContextMenu: ({ children }: { children?: ReactNode }) => (
    <div data-testid="default-context-menu">{children}</div>
  ),
  DefaultContextMenuContent: () => <div data-testid="default-context-menu-content" />,
  TldrawUiMenuGroup: ({ children }: { children: ReactNode }) => (
    <div data-testid="menu-group">{children}</div>
  ),
  TldrawUiMenuItem: ({ label, onSelect }: { label?: string; onSelect: (source: string) => void }) => (
    <button onClick={() => onSelect('context-menu' as never)}>{label}</button>
  ),
  useEditor: () => ({
    getOnlySelectedShape: () => tldrawMock.selectedShape,
    getSelectedShapeIds: () =>
      Array.from({ length: tldrawMock.selectedShapeCount }, (_, index) => `shape:${index}`),
    getContainer: () => ({
      ownerDocument: {
        defaultView: { navigator: { clipboard: { writeText: tldrawMock.writeText } } }
      }
    })
  }),
  useValue: (_name: string, getValue: () => boolean) => getValue(),
  useToasts: () => ({ addToast: tldrawMock.addToast })
}))

describe('CanvasContextMenu', () => {
  beforeEach(() => {
    tldrawMock.selectedShape = null
    tldrawMock.selectedShapeCount = 0
    tldrawMock.writeText.mockReset()
    tldrawMock.writeText.mockResolvedValue(undefined)
    tldrawMock.addToast.mockReset()
  })

  it('keeps the default menu and copies the selected shape id', async () => {
    tldrawMock.selectedShape = { id: 'shape:todo_123' }
    tldrawMock.selectedShapeCount = 1

    render(<CanvasContextMenu />)

    expect(screen.getByTestId('default-context-menu-content')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy ID' }))

    await waitFor(() => expect(tldrawMock.writeText).toHaveBeenCalledWith('shape:todo_123'))
    expect(tldrawMock.addToast).toHaveBeenCalledWith({
      title: 'Component ID copied',
      description: 'shape:todo_123',
      severity: 'success',
      icon: 'clipboard-copied'
    })
  })

  it('hides Copy ID without exactly one selected shape', () => {
    render(<CanvasContextMenu />)
    expect(screen.queryByRole('button', { name: 'Copy ID' })).not.toBeInTheDocument()

    tldrawMock.selectedShape = { id: 'shape:one' }
    tldrawMock.selectedShapeCount = 2
    render(<CanvasContextMenu />)
    expect(screen.queryByRole('button', { name: 'Copy ID' })).not.toBeInTheDocument()
  })

  it('shows an error toast when clipboard access fails', async () => {
    tldrawMock.selectedShape = { id: 'shape:docs_456' }
    tldrawMock.selectedShapeCount = 1
    tldrawMock.writeText.mockRejectedValue(new Error('denied'))

    render(<CanvasContextMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy ID' }))

    await waitFor(() =>
      expect(tldrawMock.addToast).toHaveBeenCalledWith({
        title: 'Could not copy component ID',
        description: 'Clipboard access was denied.',
        severity: 'error',
        icon: 'clipboard-copy'
      })
    )
  })
})
