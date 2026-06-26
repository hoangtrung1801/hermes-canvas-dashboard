import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

vi.mock('./canvas/components/CanvasSurface', () => ({
  CanvasSurface: () => <div data-testid="canvas-surface-stub" />
}))

describe('App', () => {
  it('shows the bridge status header', () => {
    render(<App />)

    expect(screen.getByText('Canvas for Hermes')).toBeInTheDocument()
    expect(screen.getByText('Bridge disconnected')).toBeInTheDocument()
  })
})
