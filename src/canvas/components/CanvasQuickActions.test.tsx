import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasQuickActions } from './CanvasQuickActions'

const tidyMock = vi.hoisted(() => ({
  tidyCanvas: vi.fn(),
  isReady: true
}))

vi.mock('./CanvasTidyButton', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./CanvasTidyButton')>()
  return {
    ...actual,
    useCanvasTidy: () => tidyMock
  }
})

vi.mock('tldraw', () => ({
  DefaultQuickActions: ({ children }: { children?: ReactNode }) => (
    <div data-testid="default-quick-actions">{children}</div>
  ),
  DefaultQuickActionsContent: () => <div data-testid="default-quick-actions-content" />,
  TldrawUiMenuItem: ({
    label,
    disabled,
    onSelect
  }: {
    label?: string
    disabled?: boolean
    onSelect: (source: string) => void
  }) => (
    <button disabled={disabled} onClick={() => onSelect('quick-actions')}>
      {label}
    </button>
  )
}))

describe('CanvasQuickActions', () => {
  beforeEach(() => {
    tidyMock.tidyCanvas.mockReset()
    tidyMock.isReady = true
  })

  it('keeps the default quick actions', () => {
    render(<CanvasQuickActions />)
    expect(screen.getByTestId('default-quick-actions-content')).toBeInTheDocument()
  })

  it('adds a Tidy action that reconciles the frames', () => {
    render(<CanvasQuickActions />)
    fireEvent.click(screen.getByRole('button', { name: 'Tidy' }))
    expect(tidyMock.tidyCanvas).toHaveBeenCalledTimes(1)
  })

  it('disables Tidy until the canvas is ready', () => {
    tidyMock.isReady = false
    render(<CanvasQuickActions />)
    expect(screen.getByRole('button', { name: 'Tidy' })).toBeDisabled()
  })
})
