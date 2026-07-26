import { act, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { CanvasContextMenu } from './CanvasContextMenu'
import { useBridgeStore } from '../state/bridgeStore'

const socketSpies = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
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
  const storeListeners = new Set<(entry: any) => void>()
  const coloredFrameShapeUtil = { type: 'frame' }
  const frameShapeUtil = {
    configure: vi.fn(() => coloredFrameShapeUtil)
  }
  const emitShapeChange = (changes: any) => {
    for (const listener of storeListeners) listener({ changes, source: 'user' })
  }
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
      const created = {
        typeName: 'shape',
        parentId: 'page:page',
        ...shape,
        props: shape.props ?? {},
        meta: shape.meta ?? {}
      }
      shapes.push(created)
      emitShapeChange({ added: { [created.id]: created }, updated: {}, removed: {} })
    },
    createShapes(records: any[]) {
      for (const record of records) this.createShape(record)
    },
    updateShape(patch: any) {
      const index = shapes.findIndex((shape) => shape.id === patch.id)
      if (index >= 0) {
        const before = shapes[index]
        const after = {
          ...before,
          ...patch,
          props: { ...before.props, ...(patch.props ?? {}) },
          meta: { ...before.meta, ...(patch.meta ?? {}) }
        }
        shapes[index] = after
        emitShapeChange({ added: {}, updated: { [patch.id]: [before, after] }, removed: {} })
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
        if (index >= 0) {
          const [removed] = shapes.splice(index, 1)
          emitShapeChange({ added: {}, updated: {}, removed: { [id]: removed } })
        }
      }
    },
    getCurrentPageId() {
      return 'page:page'
    },
    getCurrentPageShapesSorted() {
      return shapes
    },
    getShapePageBounds(id: string) {
      const current = shapes.find((shape) => shape.id === id)
      if (!current) return undefined
      const parent = shapes.find((shape) => shape.id === current.parentId)
      return {
        x: current.x + (parent?.type === 'frame' ? parent.x : 0),
        y: current.y + (parent?.type === 'frame' ? parent.y : 0),
        w: Number(current.props.w) || 0,
        h: Number(current.props.h) || 0
      }
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
    run: vi.fn((fn: () => void) => fn()),
    store: {
      listen: vi.fn((listener: (entry: any) => void) => {
        storeListeners.add(listener)
        return () => storeListeners.delete(listener)
      }),
      update: vi.fn((id: string, updater: (record: any) => any) => {
        const index = shapes.findIndex((shape) => shape.id === id)
        if (index < 0) return
        const before = shapes[index]
        const after = updater(before)
        shapes[index] = after
        emitShapeChange({ added: {}, updated: { [id]: [before, after] }, removed: {} })
      })
    },
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
    coloredFrameShapeUtil,
    frameShapeUtil,
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
    storeListeners,
    selectedShapeIds,
    props: null as any
  }
})

vi.mock('../bridge/websocketClient', () => ({
  BridgeWebSocketClient: class {
    connect = socketSpies.connect
    disconnect = socketSpies.disconnect
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

    // Render the injected Toolbar and QuickActions so the card inserts and
    // Tidy, which now live inside tldraw's own chrome rather than the floating
    // pill, are reachable in tests.
    const Toolbar = props.components?.Toolbar
    const QuickActions = props.components?.QuickActions

    return (
      <div data-testid="tldraw-root">
        tldraw mounted
        {Toolbar ? <Toolbar /> : null}
        {QuickActions ? <QuickActions /> : null}
      </div>
    )
  },
  DefaultToolbar: ({ children }: any) => <div data-testid="tldraw-toolbar">{children}</div>,
  TldrawUiMenuToolItem: ({ toolId }: any) => <button data-testid={`tool-${toolId}`} />,
  DefaultQuickActions: ({ children }: any) => (
    <div data-testid="tldraw-quick-actions">{children}</div>
  ),
  DefaultQuickActionsContent: () => null,
  TldrawUiMenuItem: ({ label, disabled, onSelect }: any) => (
    <button disabled={disabled} onClick={() => onSelect('quick-actions')}>
      {label}
    </button>
  ),
  defaultShapeUtils: [],
  defaultBindingUtils: [],
  inlineBase64AssetStore: {},
  HTMLContainer: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DefaultColorStyle: tldrawMock.defaultColorStyle,
  FrameShapeUtil: tldrawMock.frameShapeUtil,
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
    socketSpies.disconnect.mockClear()
    socketSpies.send.mockClear()
    syncMock.calls = []
    tldrawMock.shapes.splice(0)
    tldrawMock.storeListeners.clear()
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
    expect(tldrawMock.props.shapeUtils).toHaveLength(6)
  })

  it('enables color rendering for native frames in the canvas and synced schema', async () => {
    render(<App />)

    await screen.findByText('Bridge ready')

    expect(tldrawMock.frameShapeUtil.configure).toHaveBeenCalledWith({ showColors: true })
    expect(tldrawMock.props.shapeUtils).toContain(tldrawMock.coloredFrameShapeUtil)
    expect((syncMock.calls[0] as any).shapeUtils).toContain(tldrawMock.coloredFrameShapeUtil)
  })

  it('uses the Hermes context menu wrapper', async () => {
    render(<App />)

    await waitFor(() => expect(tldrawMock.props).toBeTruthy())
    expect(tldrawMock.props.components.ContextMenu).toBe(CanvasContextMenu)
  })

  it('does not connect to the Hermes websocket gateway unless a gateway url is configured', async () => {
    render(<App />)

    await screen.findByText('Bridge ready')
    expect(socketSpies.connect).not.toHaveBeenCalled()
  })

  it('disconnects the Hermes websocket when the canvas effect unmounts', async () => {
    gatewayMock.url = 'ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge'
    const { unmount } = render(<App />)
    await waitFor(() => expect(socketSpies.connect).toHaveBeenCalled())

    unmount()

    expect(socketSpies.disconnect).toHaveBeenCalled()
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
            type: 'note_card',
            props: expect.objectContaining({
              title: expect.any(String),
              tag: expect.any(String),
              content: expect.any(String)
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

  it('shows the card inserts inside the tldraw toolbar, not a separate pill', async () => {
    render(<App />)

    const insertGroup = await screen.findByRole('group', { name: 'Insert card' })
    expect(insertGroup.closest('[data-testid="tldraw-toolbar"]')).toBeInTheDocument()

    for (const label of ['Todo Block', 'Link Card', 'Note Card', 'Project Card', 'Docs Card']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }

    // The floating custom toolbar is gone entirely.
    expect(screen.queryByRole('toolbar', { name: 'Canvas custom tools' })).not.toBeInTheDocument()
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

  it('automatically groups newly inserted cards in a managed native frame', async () => {
    render(<App />)

    act(() => screen.getByRole('button', { name: 'Todo Block' }).click())
    act(() => screen.getByRole('button', { name: 'Todo Block' }).click())

    await waitFor(() => {
      expect(tldrawMock.shapes.filter((shape) => shape.type === 'frame')).toHaveLength(1)
    })

    const generated = tldrawMock.shapes.find((shape) => shape.type === 'frame')
    expect(generated).toMatchObject({
      props: { name: 'Todos', color: 'yellow', w: 728, h: 276 },
      meta: { hermesAutoFrame: { version: 1, kind: 'todo' } }
    })
    expect(tldrawMock.shapes.filter((shape) => shape.type === 'todo_block')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parentId: generated.id, x: 32, y: 64 }),
        expect.objectContaining({ parentId: generated.id, x: 376, y: 64 })
      ])
    )
  })

  it('inserts a note card from the toolbar and selects it', async () => {
    render(<App />)

    act(() => {
      screen.getByRole('button', { name: 'Note Card' }).click()
    })

    await waitFor(() => {
      expect(useBridgeStore.getState().lastObservation?.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'note_card',
            props: expect.objectContaining({
              title: 'New Note',
              tag: 'Idea'
            })
          })
        ])
      )
    })

    expect(tldrawMock.editor.getSelectedShapeIds()).toHaveLength(1)
  })

  it('inserts a default Docs Card from the floating canvas menu and selects it', async () => {
    render(<App />)

    act(() => {
      screen.getByRole('button', { name: 'Docs Card' }).click()
    })

    await waitFor(() => {
      expect(useBridgeStore.getState().lastObservation?.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'docs_card',
            x: 360,
            y: 80,
            w: 480,
            h: 640,
            props: expect.objectContaining({
              title: 'New Document',
              content: ''
            })
          })
        ])
      )
    })

    expect(tldrawMock.editor.getSelectedShapeIds()).toHaveLength(1)
  })

  it('inserts a default project card from the floating canvas menu and selects it', async () => {
    render(<App />)

    act(() => {
      screen.getByRole('button', { name: 'Project Card' }).click()
    })

    await waitFor(() => {
      expect(useBridgeStore.getState().lastObservation?.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'project_card',
            x: 120,
            y: 160,
            w: 960,
            h: 480,
            props: expect.objectContaining({
              title: 'New Project',
              tasks: []
            })
          })
        ])
      )
    })

    expect(tldrawMock.editor.getSelectedShapeIds()).toHaveLength(1)
  })

  it('puts Tidy in the tldraw quick actions in fullscreen canvas view', async () => {
    window.history.pushState({}, '', '/?view=canvas')

    render(<App />)

    const tidy = await screen.findByRole('button', { name: 'Tidy' })
    expect(tidy.closest('[data-testid="tldraw-quick-actions"]')).toBeInTheDocument()
    expect(screen.queryByRole('toolbar', { name: 'Canvas custom tools' })).not.toBeInTheDocument()
  })

  it('tidies cards into ordered managed frames', async () => {
    render(<App />)

    for (const optionName of [/Link Card/, /Todo Block/, /Note Card/, /Project Card/]) {
      act(() => screen.getByRole('button', { name: optionName }).click())
    }

    act(() => screen.getByRole('button', { name: 'Tidy' }).click())

    const frames = tldrawMock.shapes
      .filter((shape) => shape.type === 'frame')
      .sort((a, b) => a.x - b.x || a.y - b.y)
    expect(frames.map((frame) => frame.props.name)).toEqual([
      'Projects',
      'Todos',
      'Notes',
      'Links'
    ])
    expect(frames.every((frame, index) => index === 0 || frame.x >= frames[index - 1].x + frames[index - 1].props.w + 64)).toBe(true)
    expect(new Set(frames.map((frame) => frame.y)).size).toBe(1)

    for (const card of tldrawMock.shapes.filter((shape) => shape.type !== 'frame')) {
      expect(frames.some((frame) => frame.id === card.parentId)).toBe(true)
    }
    expect(tldrawMock.editor.markHistoryStoppingPoint).toHaveBeenCalledWith('tidy auto frames')
    expect(tldrawMock.editor.zoomToFit).toHaveBeenCalledWith({ animation: { duration: 250 } })
    expect(useBridgeStore.getState().logs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'canvas.tidy',
        payload: 'Arranged 4 cards in 4 frames'
      })
    ]))
  })

  it('no longer ships the floating custom toolbar styles', () => {
    const styles = readFileSync('src/styles.css', 'utf8')

    expect(styles).not.toMatch(/\.canvas-floating-toolbar/)
  })

  it('sizes the toolbar card inserts to match the tldraw tool buttons', () => {
    const styles = readFileSync('src/styles.css', 'utf8')
    const insertRule = styles.match(/^\.canvas-toolbar-insert \{(?<body>[\s\S]*?)\n\}/m)

    expect(insertRule?.groups?.body).toMatch(/width:\s*40px;/)
    expect(insertRule?.groups?.body).toMatch(/height:\s*40px;/)
  })
})
