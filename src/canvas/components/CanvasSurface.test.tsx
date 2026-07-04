import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { useBridgeStore } from '../state/bridgeStore'

const socketSpies = vi.hoisted(() => ({
  connect: vi.fn(),
  send: vi.fn()
}))

const gatewayMock = vi.hoisted(() => ({
  url: null as string | null
}))

const syncMock = vi.hoisted(() => ({
  calls: [] as unknown[],
  store: { status: 'synced-remote', store: { id: 'mock-store' } }
}))

const tldrawMock = vi.hoisted(() => {
  const shapes: any[] = []
  const editor = {
    createShape(shape: any) {
      shapes.push({ ...shape, props: shape.props ?? {}, meta: shape.meta ?? {} })
    },
    updateShape(patch: any) {
      const index = shapes.findIndex((shape) => shape.id === patch.id)
      if (index >= 0) {
        shapes[index] = {
          ...shapes[index],
          ...patch,
          props: { ...shapes[index].props, ...(patch.props ?? {}) },
          meta: { ...shapes[index].meta, ...(patch.meta ?? {}) }
        }
      }
    },
    deleteShapes(ids: string[]) {
      for (const id of ids) {
        const index = shapes.findIndex((shape) => shape.id === id)
        if (index >= 0) shapes.splice(index, 1)
      }
    },
    getCurrentPageShapesSorted() {
      return shapes
    },
    getSelectedShapeIds() {
      return []
    },
    getCamera() {
      return { x: 0, y: 0, z: 1 }
    },
    setCamera() {},
    zoomToFit() {},
    select() {},
    selectNone() {}
  }

  return {
    editor,
    shapes,
    props: null as any
  }
})

vi.mock('../bridge/websocketClient', () => ({
  BridgeWebSocketClient: class {
    connect = socketSpies.connect
    send = socketSpies.send
  }
}))

vi.mock('../bridge/gatewayConfig', () => ({
  getCanvasGatewayUrl: () => gatewayMock.url,
  getTldrawSyncUrl: (canvasId: string) => `ws://localhost:8787/sync/${canvasId}`
}))

vi.mock('@tldraw/sync', () => ({
  useSync: (options: unknown) => {
    syncMock.calls.push(options)
    return syncMock.store
  }
}))

vi.mock('tldraw', () => ({
  Tldraw: (props: any) => {
    useEffect(() => {
      tldrawMock.props = props
      props.onMount(tldrawMock.editor)
    }, [])

    return <div data-testid="tldraw-root">tldraw mounted</div>
  },
  defaultShapeUtils: [],
  defaultBindingUtils: [],
  inlineBase64AssetStore: {},
  HTMLContainer: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Rectangle2d: class {
    constructor(public readonly config: unknown) {}
  },
  ShapeUtil: class {}
}))

describe('CanvasSurface', () => {
  beforeEach(() => {
    gatewayMock.url = null
    socketSpies.connect.mockClear()
    socketSpies.send.mockClear()
    syncMock.calls = []
    tldrawMock.shapes.splice(0)
    tldrawMock.props = null
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }))
    useBridgeStore.setState({
      bridge: null,
      adapter: null,
      editor: null,
      status: 'disconnected',
      lastObservation: null,
      logs: []
    })
  })

  it('renders the tldraw surface and connects it to tldraw sync', async () => {
    render(<App />)

    expect(screen.getByTestId('tldraw-root')).toBeInTheDocument()
    await expect(screen.findByText('Bridge ready')).resolves.toBeInTheDocument()
    expect(syncMock.calls[0]).toMatchObject({
      uri: 'ws://localhost:8787/sync/canvas_001'
    })
    expect(tldrawMock.props.shapeUtils).toHaveLength(3)
  })

  it('does not connect to the Hermes websocket gateway unless a gateway url is configured', async () => {
    render(<App />)

    await screen.findByText('Bridge ready')
    expect(socketSpies.connect).not.toHaveBeenCalled()
  })

  it('handles Hermes actions through the mounted tldraw editor without snapshot fetches', async () => {
    gatewayMock.url = 'ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge'
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
              id: 'shape:task_1',
              title: 'Saved from Hermes',
              body: 'Rendered with tldraw',
              x: 100,
              y: 120
            }
          ]
        })
      )
    })

    await waitFor(() => {
      expect(useBridgeStore.getState().lastObservation?.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'shape:task_1',
            type: 'task_card',
            props: expect.objectContaining({ title: 'Saved from Hermes' })
          })
        ])
      )
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(socketSpies.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'canvas.result', ok: true })
    )
  })
})
