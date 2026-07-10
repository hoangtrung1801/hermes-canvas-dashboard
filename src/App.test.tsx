import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

vi.mock('./canvas/components/CanvasSurface', () => ({
  CanvasSurface: () => <div data-testid="canvas-surface-stub" />
}))

describe('App', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('enters a canvas-only page by default', () => {
    render(<App />)

    expect(screen.getByTestId('canvas-surface-stub')).toBeInTheDocument()
    expect(screen.queryByText('Canvas for Hermes')).not.toBeInTheDocument()
    expect(screen.queryByText('Bridge disconnected')).not.toBeInTheDocument()
    expect(screen.queryByText('Action Simulator')).not.toBeInTheDocument()
    expect(screen.queryByText('Canvas Inspector')).not.toBeInTheDocument()
    expect(screen.queryByText('Fullscreen Canvas')).not.toBeInTheDocument()
  })

  it('shows the action debug dashboard when debug query is true', () => {
    window.history.replaceState({}, '', '/?debug=true')

    render(<App />)

    expect(screen.getByText('Hermes Canvas Productivity')).toBeInTheDocument()
    expect(screen.getByText('Visual workspace for agent-driven execution')).toBeInTheDocument()
    expect(screen.getByText('Bridge disconnected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /action simulator/i })).toBeInTheDocument()
    expect(screen.getByText('Canvas Inspector')).toBeInTheDocument()
  })

  it('does not show removed task card simulator or inspector options', () => {
    window.history.replaceState({}, '', '/?debug=true')

    render(<App />)
    const removedLabel = ['Task', 'Card'].join(' ')

    expect(screen.queryByRole('option', { name: `Sprint ${removedLabel}` })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: removedLabel })).not.toBeInTheDocument()
  })

  it('keeps the legacy canvas view query in canvas-only mode', () => {
    window.history.replaceState({}, '', '/?view=canvas')

    render(<App />)

    expect(screen.getByTestId('canvas-surface-stub')).toBeInTheDocument()
    expect(screen.queryByText('Fullscreen Canvas')).not.toBeInTheDocument()
    expect(screen.queryByText('Bridge disconnected')).not.toBeInTheDocument()
    expect(screen.queryByText('Action Simulator')).not.toBeInTheDocument()
    expect(screen.queryByText('Canvas Inspector')).not.toBeInTheDocument()
  })
})
