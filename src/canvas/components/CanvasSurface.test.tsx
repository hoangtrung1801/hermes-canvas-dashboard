import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'

vi.mock('../bridge/websocketClient', () => ({
  BridgeWebSocketClient: class {
    connect() {}
    send() {}
  }
}))

vi.mock('tldraw', () => ({
  Tldraw: ({ onMount }: { onMount(editor: unknown): void }) => {
    useEffect(() => {
      onMount({
        createShape() {},
        updateShape() {},
        deleteShape() {},
        getCurrentPageShapes() {
          return []
        },
        getSelectedShapeIds() {
          return []
        },
        getViewportPageBounds() {
          return { x: 0, y: 0, w: 1200, h: 800 }
        },
        zoomToFit() {}
      })
    }, [])

    return <div data-testid="tldraw-root">tldraw mounted</div>
  }
}))

describe('CanvasSurface', () => {
  it('renders the tldraw surface inside the app shell', () => {
    render(<App />)

    expect(screen.getByTestId('tldraw-root')).toBeInTheDocument()
    expect(screen.getByText('Bridge ready')).toBeInTheDocument()
  })
})
