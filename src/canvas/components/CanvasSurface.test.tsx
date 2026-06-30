import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'

const socketSpies = vi.hoisted(() => ({
  connect: vi.fn(),
  send: vi.fn()
}))

vi.mock('../bridge/websocketClient', () => ({
  BridgeWebSocketClient: class {
    connect = socketSpies.connect
    send = socketSpies.send
  }
}))

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: ({ excalidrawAPI }: { excalidrawAPI(api: unknown): void }) => {
    useEffect(() => {
      excalidrawAPI({
        updateScene() {},
        getSceneElements() {
          return []
        },
        getAppState() {
          return { scrollX: 0, scrollY: 0, width: 1200, height: 800, selectedElementIds: {} }
        },
        scrollToContent() {}
      })
    }, [])

    return <div data-testid="excalidraw-root">excalidraw mounted</div>
  }
}))

describe('CanvasSurface', () => {
  it('renders the Excalidraw surface inside the app shell', () => {
    render(<App />)

    expect(screen.getByTestId('excalidraw-root')).toBeInTheDocument()
    expect(screen.getByText('Bridge ready')).toBeInTheDocument()
  })

  it('does not connect to a websocket gateway unless a gateway url is configured', () => {
    render(<App />)

    expect(socketSpies.connect).not.toHaveBeenCalled()
  })
})
