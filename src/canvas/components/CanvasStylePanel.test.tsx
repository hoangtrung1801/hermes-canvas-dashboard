import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasStylePanel } from './CanvasStylePanel'

const tldrawMock = vi.hoisted(() => ({
  currentToolId: 'select',
  selectedShapes: [] as { id: string; type: string }[]
}))

vi.mock('tldraw', () => ({
  DefaultStylePanel: () => <div data-testid="default-style-panel" />,
  useEditor: () => ({
    getCurrentToolId: () => tldrawMock.currentToolId,
    getSelectedShapes: () => tldrawMock.selectedShapes
  }),
  useValue: (_name: string, getValue: () => boolean) => getValue()
}))

describe('CanvasStylePanel', () => {
  beforeEach(() => {
    tldrawMock.currentToolId = 'select'
    tldrawMock.selectedShapes = []
  })

  it('renders nothing when nothing is selected', () => {
    render(<CanvasStylePanel />)
    expect(screen.queryByTestId('default-style-panel')).toBeNull()
  })

  it('renders nothing when only Hermes cards are selected', () => {
    tldrawMock.selectedShapes = [
      { id: 'shape:a', type: 'todo_block' },
      { id: 'shape:b', type: 'docs_card' }
    ]
    render(<CanvasStylePanel />)
    expect(screen.queryByTestId('default-style-panel')).toBeNull()
  })

  it('renders when a native shape is selected', () => {
    tldrawMock.selectedShapes = [{ id: 'shape:a', type: 'draw' }]
    render(<CanvasStylePanel />)
    expect(screen.getByTestId('default-style-panel')).toBeInTheDocument()
  })

  it('renders when a mixed selection contains a native shape', () => {
    tldrawMock.selectedShapes = [
      { id: 'shape:a', type: 'todo_block' },
      { id: 'shape:b', type: 'arrow' }
    ]
    render(<CanvasStylePanel />)
    expect(screen.getByTestId('default-style-panel')).toBeInTheDocument()
  })

  it('renders while a drawing tool is active with an empty selection', () => {
    tldrawMock.currentToolId = 'draw'
    render(<CanvasStylePanel />)
    expect(screen.getByTestId('default-style-panel')).toBeInTheDocument()
  })
})
