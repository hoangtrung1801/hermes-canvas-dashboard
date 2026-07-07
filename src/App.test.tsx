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

  it('shows the bridge status header', () => {
    render(<App />)

    expect(screen.getByText('Canvas for Hermes')).toBeInTheDocument()
    expect(screen.getByText('Bridge disconnected')).toBeInTheDocument()
  })

  it('links from the dashboard canvas panel to fullscreen canvas view', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: /fullscreen/i })).toHaveAttribute('href', '?view=canvas')
    expect(screen.getByRole('button', { name: /action simulator/i })).toBeInTheDocument()
    expect(screen.getByText('Canvas Inspector')).toBeInTheDocument()
  })

  it('does not show removed task card simulator or inspector options', () => {
    render(<App />)

    expect(screen.queryByRole('option', { name: 'Sprint Task Card' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Task Card' })).not.toBeInTheDocument()
  })

  it('renders a focused fullscreen canvas page from the query string', () => {
    window.history.replaceState({}, '', '/?view=canvas')

    render(<App />)

    expect(screen.getByText('Fullscreen Canvas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/')
    expect(screen.getByTestId('canvas-surface-stub')).toBeInTheDocument()
    expect(screen.queryByText('Action Simulator')).not.toBeInTheDocument()
    expect(screen.queryByText('Canvas Inspector')).not.toBeInTheDocument()
  })
})
