import { act, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
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
  const selectedShapeIds: string[] = []
  const createDefaultThemeColors = () => {
    const paletteColor = { noteFill: '#ffffff' }
    return {
      text: '#111827',
      background: '#ffffff',
      negativeSpace: '#ffffff',
      solid: '#ffffff',
      cursor: '#111827',
      noteBorder: '#e5e7eb',
      snap: '#3b82f6',
      selectionStroke: '#3b82f6',
      selectionFill: '#ffffff',
      brushFill: '#bfdbfe',
      brushStroke: '#3b82f6',
      selectedContrast: '#ffffff',
      laser: '#ef4444',
      black: paletteColor,
      grey: paletteColor,
      'light-violet': paletteColor,
      violet: paletteColor,
      blue: paletteColor,
      'light-blue': paletteColor,
      yellow: paletteColor,
      orange: paletteColor,
      green: paletteColor,
      'light-green': paletteColor,
      'light-red': paletteColor,
      red: { noteFill: '#FC8282' },
      white: paletteColor
    }
  }
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
    updateShapes(patches: any[]) {
      for (const patch of patches) {
        this.updateShape(patch)
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
      return selectedShapeIds
    },
    getCamera() {
      return { x: 0, y: 0, z: 1 }
    },
    getViewportPageBounds() {
      return { x: 0, y: 0, w: 1200, h: 800 }
    },
    updateTheme: vi.fn(),
    setCurrentTheme: vi.fn(),
    updateInstanceState: vi.fn(),
    setCamera() {},
    markHistoryStoppingPoint: vi.fn(),
    zoomToFit: vi.fn(),
    select(...ids: string[]) {
      selectedShapeIds.splice(0, selectedShapeIds.length, ...ids)
    },
    selectNone() {
      selectedShapeIds.splice(0)
    }
  }

  return {
    editor,
    defaultColorStyle: { id: 'tldraw:color', defaultValue: 'black' },
    defaultTheme: {
      id: 'default',
      fontSize: 16,
      lineHeight: 1.35,
      strokeWidth: 2,
      fonts: {},
      colors: {
        light: createDefaultThemeColors(),
        dark: createDefaultThemeColors()
      }
    },
    shapes,
    selectedShapeIds,
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
  DefaultColorStyle: tldrawMock.defaultColorStyle,
  DEFAULT_THEME: tldrawMock.defaultTheme,
  getColorValue: (colors: any, color: string, variant: string) => colors[color]?.[variant] ?? color,
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
    tldrawMock.selectedShapeIds.splice(0)
    tldrawMock.props = null
    tldrawMock.editor.updateTheme.mockClear()
    tldrawMock.editor.setCurrentTheme.mockClear()
    tldrawMock.editor.updateInstanceState.mockClear()
    tldrawMock.editor.markHistoryStoppingPoint.mockClear()
    tldrawMock.editor.zoomToFit.mockClear()
    window.history.pushState({}, '', '/?debug=true')
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

  it('enables the built-in tldraw grid on mount', async () => {
    render(<App />)

    await screen.findByText('Bridge ready')
    expect(tldrawMock.editor.updateInstanceState).toHaveBeenCalledWith({ isGridMode: true })
  })

  it('registers the pastel tldraw theme as the active toolbar palette on mount', async () => {
    render(<App />)

    await screen.findByText('Bridge ready')
    expect(tldrawMock.editor.updateTheme).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'hermes-pastel',
        fontSize: 12,
        fonts: expect.objectContaining({
          draw: expect.objectContaining({ fontFamily: expect.stringContaining('Inter') }),
          sans: expect.objectContaining({ fontFamily: expect.stringContaining('Inter') })
        })
      })
    )
    expect(tldrawMock.editor.setCurrentTheme).toHaveBeenCalledWith('hermes-pastel')
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
              type: 'create_link_card',
              id: 'shape:link_1',
              title: 'Saved from Hermes',
              url: 'https://example.com',
              description: 'Rendered with tldraw',
              x: 100,
              y: 120
            },
            {
              type: 'create_note_card',
              id: 'shape:note_1',
              title: 'Captured Idea',
              tag: 'Idea',
              content: 'Use rectangle notes',
              x: 180,
              y: 240
            }
          ]
        })
      )
    })

    await waitFor(() => {
      expect(useBridgeStore.getState().lastObservation?.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'shape:link_1',
            type: 'link_card',
            props: expect.objectContaining({ title: 'Saved from Hermes' })
          }),
          expect.objectContaining({
            id: 'shape:note_1',
            type: 'geo',
            props: expect.objectContaining({
              geo: 'rectangle',
              richText: expect.objectContaining({ type: 'doc' })
            })
          })
        ])
      )
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(socketSpies.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'canvas.result', ok: true })
    )
  })

  it('shows custom component actions in a flat floating toolbar', async () => {
    render(<App />)

    const toolbar = await screen.findByRole('toolbar', { name: 'Canvas custom tools' })
    expect(toolbar.closest('.canvas-container')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todo Block' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link Card' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Note Card' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Insert component' })).not.toBeInTheDocument()
  })

  it('inserts todo and link cards from the floating canvas menu', async () => {
    render(<App />)

    act(() => {
      screen.getByRole('button', { name: 'Todo Block' }).click()
    })

    act(() => {
      screen.getByRole('button', { name: 'Link Card' }).click()
    })

    await waitFor(() => {
      expect(useBridgeStore.getState().lastObservation?.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'todo_block', props: expect.objectContaining({ title: 'Todo' }) }),
          expect.objectContaining({ type: 'link_card', props: expect.objectContaining({ title: 'New Link' }) })
        ])
      )
    })
  })

  it('inserts a rectangle note card from the floating canvas menu and selects it', async () => {
    render(<App />)

    act(() => {
      screen.getByRole('button', { name: 'Note Card' }).click()
    })

    await waitFor(() => {
      expect(useBridgeStore.getState().lastObservation?.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'geo',
            props: expect.objectContaining({
              geo: 'rectangle',
              richText: expect.objectContaining({ type: 'doc' })
            })
          })
        ])
      )
    })

    expect(tldrawMock.editor.getSelectedShapeIds()).toHaveLength(1)
  })

  it('shows the floating custom toolbar in fullscreen canvas view', async () => {
    window.history.pushState({}, '', '/?view=canvas')

    render(<App />)

    const toolbar = await screen.findByRole('toolbar', { name: 'Canvas custom tools' })
    expect(toolbar).toBeInTheDocument()
    expect(toolbar.closest('.fullscreen-canvas-container')).toBeInTheDocument()
  })

  it('tidies cards into columns grouped by type', async () => {
    render(<App />)

    for (const optionName of [/Link Card/, /Todo Block/, /Note Card/]) {
      act(() => screen.getByRole('button', { name: optionName }).click())
    }

    act(() => screen.getByRole('button', { name: 'Tidy cards by type' }).click())

    const todo = tldrawMock.shapes.find((shape) => shape.type === 'todo_block')
    const note = tldrawMock.shapes.find((shape) => shape.type === 'geo')
    const link = tldrawMock.shapes.find((shape) => shape.type === 'link_card')

    expect(todo.x).toBeLessThan(note.x)
    expect(note.x).toBeLessThan(link.x)
    expect(todo.y).toBe(note.y)
    expect(note.y).toBe(link.y)
    expect(tldrawMock.editor.markHistoryStoppingPoint).toHaveBeenCalledWith('tidy card layout')
    expect(tldrawMock.editor.zoomToFit).toHaveBeenCalledWith({ animation: { duration: 250 } })
  })

  it('layers the floating custom toolbar above tldraw header and menu panels', () => {
    const styles = readFileSync('src/styles.css', 'utf8')
    const floatingRule = styles.match(
      /\.canvas-container > \.canvas-floating-toolbar,\n\.fullscreen-canvas-container > \.canvas-floating-toolbar \{(?<body>[\s\S]*?)\n\}/
    )

    expect(floatingRule?.groups?.body).toMatch(/z-index:\s*(?:1\d{3}|[2-9]\d{3});/)
  })

  it('anchors the floating custom toolbar to the canvas bottom-right corner', () => {
    const styles = readFileSync('src/styles.css', 'utf8')
    const floatingRule = styles.match(
      /\.canvas-container > \.canvas-floating-toolbar,\n\.fullscreen-canvas-container > \.canvas-floating-toolbar \{(?<body>[\s\S]*?)\n\}/
    )

    expect(floatingRule?.groups?.body).toMatch(/bottom:\s*14px;/)
    expect(floatingRule?.groups?.body).toMatch(/right:\s*14px;/)
    expect(floatingRule?.groups?.body).not.toMatch(/top:\s*14px;/)
  })

  it('uses a single light panel for all custom canvas actions', () => {
    const styles = readFileSync('src/styles.css', 'utf8')
    const toolbarRule = styles.match(/^\.canvas-floating-toolbar \{(?<body>[\s\S]*?)\n\}/m)

    expect(toolbarRule?.groups?.body).toMatch(/display:\s*inline-flex;/)
    expect(toolbarRule?.groups?.body).toMatch(/background:\s*rgba\(255, 255, 255, 0\.96\);/)
  })
})
