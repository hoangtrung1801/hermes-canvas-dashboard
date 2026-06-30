import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import type { ExcalidrawElementLike } from '../adapters/ExcalidrawAdapter'
import { useBridgeStore } from '../state/bridgeStore'

const socketSpies = vi.hoisted(() => ({
  connect: vi.fn(),
  send: vi.fn()
}))

const gatewayMock = vi.hoisted(() => ({
  url: null as string | null
}))

const excalidrawMock = vi.hoisted(() => ({
  elements: [] as ExcalidrawElementLike[],
  updateSceneCalls: [] as Array<{ elements?: readonly ExcalidrawElementLike[]; appState?: Record<string, unknown> | null }>,
  onChange: undefined as undefined | ((elements: readonly ExcalidrawElementLike[]) => void),
  api: {
    updateScene(scene: { elements?: readonly ExcalidrawElementLike[]; appState?: Record<string, unknown> | null }) {
      excalidrawMock.updateSceneCalls.push(scene)
      if (scene.elements) {
        excalidrawMock.elements = [...scene.elements]
      }
    },
    getSceneElements() {
      return excalidrawMock.elements
    },
    getAppState() {
      return { scrollX: 0, scrollY: 0, width: 1200, height: 800, selectedElementIds: {} }
    },
    scrollToContent() {}
  }
}))

vi.mock('../bridge/websocketClient', () => ({
  BridgeWebSocketClient: class {
    connect = socketSpies.connect
    send = socketSpies.send
  }
}))

vi.mock('../bridge/gatewayConfig', () => ({
  getCanvasGatewayUrl: () => gatewayMock.url
}))

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: ({
    excalidrawAPI,
    onChange
  }: {
    excalidrawAPI(api: unknown): void
    onChange?: (elements: readonly ExcalidrawElementLike[]) => void
  }) => {
    useEffect(() => {
      excalidrawMock.onChange = onChange
      excalidrawAPI(excalidrawMock.api)
    }, [])

    return <div data-testid="excalidraw-root">excalidraw mounted</div>
  }
}))

describe('CanvasSurface', () => {
  beforeEach(() => {
    gatewayMock.url = null
    socketSpies.connect.mockClear()
    socketSpies.send.mockClear()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }))
    excalidrawMock.elements = []
    excalidrawMock.updateSceneCalls = []
    excalidrawMock.onChange = undefined
    useBridgeStore.setState({
      bridge: null,
      adapter: null,
      editor: null,
      status: 'disconnected',
      lastObservation: null,
      logs: []
    })
  })

  it('renders the Excalidraw surface inside the app shell', () => {
    render(<App />)

    expect(screen.getByTestId('excalidraw-root')).toBeInTheDocument()
    return expect(screen.findByText('Bridge ready')).resolves.toBeInTheDocument()
  })

  it('does not connect to a websocket gateway unless a gateway url is configured', async () => {
    render(<App />)

    await screen.findByText('Bridge ready')
    expect(socketSpies.connect).not.toHaveBeenCalled()
  })

  it('restores the saved single-session canvas when Excalidraw mounts', async () => {
    const savedElement: ExcalidrawElementLike = {
      id: 'element_0001',
      type: 'rectangle',
      x: 100,
      y: 120,
      width: 200,
      height: 120
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          version: 1,
          canvasId: 'canvas_001',
          elements: [savedElement],
          adapter: {
            blocks: [
              {
                id: 'block_0001',
                type: 'task_card',
                name: 'Saved task',
                x: 100,
                y: 120,
                w: 200,
                h: 120,
                text: 'Saved task',
                props: {},
                shapeIds: ['element_0001']
              }
            ],
            sequence: 1,
            todoTaskSequence: 0
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    render(<App />)

    await waitFor(() => {
      expect(excalidrawMock.updateSceneCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ elements: [savedElement] })
        ])
      )
    })
    expect(useBridgeStore.getState().adapter?.getBlockById('block_0001')).toMatchObject({
      name: 'Saved task'
    })
  })

  it('saves the single-session canvas after handling a canvas action', async () => {
    gatewayMock.url = 'ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge'
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }))
    render(<App />)

    await waitFor(() => expect(socketSpies.connect).toHaveBeenCalled())
    const callbacks = socketSpies.connect.mock.calls[0][1]

    act(() => {
      callbacks.onMessage(
        JSON.stringify({
          type: 'canvas.action',
          requestId: 'req_1',
          canvasId: 'canvas_001',
          actions: [
            {
              type: 'create_task_card',
              name: 'Saved from Hermes',
              x: 100,
              y: 120
            }
          ]
        })
      )
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8787/canvas-state/canvas_001',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        })
      )
    })

    const putCall = vi.mocked(fetch).mock.calls.find(([, options]) => {
      return options && typeof options === 'object' && 'method' in options && options.method === 'PUT'
    })
    const saved = JSON.parse(String((putCall?.[1] as RequestInit).body))
    expect(saved.adapter.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Saved from Hermes' })
      ])
    )
    expect(saved.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.stringMatching(/^element_/) })
      ])
    )
  })
})
