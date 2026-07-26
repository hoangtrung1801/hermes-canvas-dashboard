# Canvas Chrome (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse six competing floating UI clusters into four owned corners by merging the Hermes card inserts into tldraw's toolbar, trimming the tool set, making the style panel conditional, moving Tidy into QuickActions, and flipping chat to the right edge.

**Architecture:** tldraw's own UI is retained and reshaped through its public `overrides` (tool registry) and `components` (UI slot) APIs — no `hideUi`, no reimplemented menus. Insert *behaviour* is extracted into a `useCanvasInsert` hook so relocating the buttons cannot change what they do; the same is done for Tidy. Each new UI file is presentational and independently testable.

**Tech Stack:** React 19, TypeScript, tldraw 5.2.2, `@tldraw/sync`, zustand, Vitest + @testing-library/react + jsdom, plain global CSS.

## Global Constraints

- tldraw version is 5.2.2. All APIs used here are verified present in `node_modules/tldraw/dist-cjs/index.d.ts`.
- Kept tool ids, exactly: `select`, `hand`, `arrow`, `text`, `draw`, `eraser`.
- Dropped tool ids, exactly: `note`, `asset`, `rectangle`, `ellipse`, `triangle`, `diamond`, `hexagon`, `oval`, `rhombus`, `star`, `cloud`, `heart`, `x-box`, `check-box`, `arrow-left`, `arrow-up`, `arrow-down`, `arrow-right`, `line`, `highlight`, `laser`, `frame`.
- No new dependencies.
- Tests run with `npm test` (Vitest). Type check with `npm run lint:types`.
- Existing tests mock the `tldraw` module wholesale via `vi.mock('tldraw', ...)`. Follow that pattern — see `src/canvas/components/CanvasContextMenu.test.tsx:13-35`.
- Do not change any card shape rendering. Phase A is chrome only.
- Phase B introduces the `--hc-*` token layer. Phase A must not add new hex literals to `.hermes-*` rules; new chrome classes use the `canvas-*` prefix, which Phase B does not govern.

---

### Task 1: Extract the insert behaviour into a hook

`CanvasInsertMenu.tsx` currently couples the bridge-dispatch logic to a `<div className="canvas-insert-actions">`. Task 4 needs that logic inside tldraw's toolbar. Extract it first, changing no behaviour.

**Files:**
- Modify: `src/canvas/components/CanvasInsertMenu.tsx`
- Test: `src/canvas/components/CanvasInsertMenu.test.tsx` (create)

**Interfaces:**
- Consumes: `useBridgeStore` from `../state/bridgeStore`; `CanvasAction` from `../actions/canvasAction.types`.
- Produces:
  - `export type ComponentKind = 'project' | 'todo' | 'link' | 'note' | 'docs'`
  - `export type InsertOption = { kind: ComponentKind; label: string; icon: ComponentKind }`
  - `export const INSERT_OPTIONS: InsertOption[]`
  - `export function ComponentIcon({ icon }: { icon: InsertOption['icon'] }): JSX.Element`
  - `export function useCanvasInsert(): { insertCard(kind: ComponentKind): void; isReady: boolean }`

- [ ] **Step 1: Write the failing test**

Create `src/canvas/components/CanvasInsertMenu.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INSERT_OPTIONS, useCanvasInsert } from './CanvasInsertMenu'

const storeMock = vi.hoisted(() => ({
  bridge: null as null | { handleActionEnvelope: ReturnType<typeof vi.fn> },
  adapter: null as null | { canvasId: string },
  editor: null as null | { getViewportPageBounds: () => { x: number; y: number; w: number; h: number } },
  setObservation: vi.fn(),
  addLog: vi.fn()
}))

vi.mock('../state/bridgeStore', () => ({
  useBridgeStore: (selector: (state: typeof storeMock) => unknown) => selector(storeMock)
}))

describe('useCanvasInsert', () => {
  beforeEach(() => {
    storeMock.bridge = {
      handleActionEnvelope: vi.fn(() => ({
        result: { ok: true },
        observation: { state: { shapes: [] } }
      }))
    }
    storeMock.adapter = { canvasId: 'canvas_001' }
    storeMock.editor = { getViewportPageBounds: () => ({ x: 0, y: 0, w: 1000, h: 800 }) }
    storeMock.setObservation.mockReset()
    storeMock.addLog.mockReset()
  })

  it('exposes one option per card kind', () => {
    expect(INSERT_OPTIONS.map((option) => option.kind)).toEqual([
      'project',
      'todo',
      'link',
      'note',
      'docs'
    ])
  })

  it('is not ready until bridge, adapter and editor all exist', () => {
    storeMock.editor = null
    const { result } = renderHook(() => useCanvasInsert())
    expect(result.current.isReady).toBe(false)
  })

  it('dispatches a create action followed by a select action', () => {
    const { result } = renderHook(() => useCanvasInsert())
    act(() => result.current.insertCard('todo'))

    const envelope = storeMock.bridge!.handleActionEnvelope.mock.calls[0][0]
    expect(envelope.canvasId).toBe('canvas_001')
    expect(envelope.actions[0].type).toBe('create_todo_block')
    expect(envelope.actions[1].type).toBe('select_shapes')
    expect(envelope.actions[1].shapeIds).toEqual([envelope.actions[0].id])
    expect(storeMock.setObservation).toHaveBeenCalledWith({ shapes: [] })
  })

  it('centres the new card in the viewport', () => {
    const { result } = renderHook(() => useCanvasInsert())
    act(() => result.current.insertCard('todo'))

    const createAction = storeMock.bridge!.handleActionEnvelope.mock.calls[0][0].actions[0]
    expect(createAction.x).toBe(360)
    expect(createAction.y).toBe(320)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CanvasInsertMenu`
Expected: FAIL — `useCanvasInsert` is not exported from `./CanvasInsertMenu`.

- [ ] **Step 3: Extract the hook**

In `src/canvas/components/CanvasInsertMenu.tsx`, export the existing types and constants, and replace the `CanvasInsertMenu` component body with a hook plus a thin renderer. Keep `nextInsertId`, `getInsertPoint`, `buildCreateAction` and `ComponentIcon` exactly as they are — only their `export` keywords and the component split change.

```tsx
export type ComponentKind = 'project' | 'todo' | 'link' | 'note' | 'docs'

export type InsertOption = {
  kind: ComponentKind
  label: string
  icon: ComponentKind
}

export const INSERT_OPTIONS: InsertOption[] = [
  { kind: 'project', label: 'Project Card', icon: 'project' },
  { kind: 'todo', label: 'Todo Block', icon: 'todo' },
  { kind: 'link', label: 'Link Card', icon: 'link' },
  { kind: 'note', label: 'Note Card', icon: 'note' },
  { kind: 'docs', label: 'Docs Card', icon: 'docs' }
]

export function ComponentIcon({ icon }: { icon: InsertOption['icon'] }) {
  // unchanged body
}

export function useCanvasInsert() {
  const bridge = useBridgeStore((state) => state.bridge)
  const adapter = useBridgeStore((state) => state.adapter)
  const editor = useBridgeStore((state) => state.editor)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const addLog = useBridgeStore((state) => state.addLog)
  const isReady = Boolean(bridge && adapter && editor)

  const insertCard = (kind: ComponentKind) => {
    if (!bridge || !adapter || !editor) return

    const point = getInsertPoint(editor, kind)
    const shapeId = nextInsertId(kind)
    const createAction = buildCreateAction(kind, shapeId, point.x, point.y)
    const envelope = {
      type: 'canvas.action' as const,
      requestId: 'insert_' + Math.random().toString(36).substring(2, 9),
      canvasId: adapter.canvasId,
      actions: [createAction, { type: 'select_shapes' as const, shapeIds: [shapeId] }]
    }

    addLog('in', 'canvas.action (Insert Component)', envelope)
    const response = bridge.handleActionEnvelope(envelope)

    if ('error' in response) {
      addLog('error', 'canvas.error (Insert Component)', response.error)
      alert(`Error inserting component: ${response.error.message}`)
      return
    }

    setObservation(response.observation.state)
    addLog('out', 'canvas.result (Insert Component)', response.result)
    addLog('out', 'canvas.observation (Insert Component)', response.observation)
  }

  return { insertCard, isReady }
}

export function CanvasInsertMenu() {
  const { insertCard, isReady } = useCanvasInsert()

  return (
    <div className="canvas-insert-actions">
      {INSERT_OPTIONS.map((option) => (
        <button
          key={option.kind}
          type="button"
          className="canvas-toolbar-button"
          aria-label={option.label}
          disabled={!isReady}
          title={isReady ? option.label : 'Canvas is still loading'}
          onClick={() => insertCard(option.kind)}
        >
          <ComponentIcon icon={option.icon} />
        </button>
      ))}
    </div>
  )
}
```

The `alert()` stays for now — Phase C replaces it with a toast. Do not change it here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- CanvasInsertMenu`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the full suite and type check**

Run: `npm test && npm run lint:types`
Expected: All pass. `CanvasInsertMenu` still renders identically, so no existing test should change.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/components/CanvasInsertMenu.tsx src/canvas/components/CanvasInsertMenu.test.tsx
git commit -m "refactor: extract useCanvasInsert hook from CanvasInsertMenu"
```

---

### Task 2: Trim the tool registry

**Files:**
- Create: `src/canvas/tldraw/uiOverrides.ts`
- Test: `src/canvas/tldraw/uiOverrides.test.ts`
- Modify: `src/canvas/components/CanvasSurface.tsx` (add the `overrides` prop)

**Interfaces:**
- Consumes: `TLUiOverrides`, `TLUiToolsContextType` types from `tldraw`.
- Produces:
  - `export const KEPT_TOOL_IDS: readonly string[]`
  - `export const DROPPED_TOOL_IDS: readonly string[]`
  - `export const canvasUiOverrides: TLUiOverrides`

- [ ] **Step 1: Write the failing test**

Create `src/canvas/tldraw/uiOverrides.test.ts`. This is a pure config object — no `vi.mock('tldraw')` needed, because only types are imported from tldraw.

```ts
import { describe, expect, it } from 'vitest'
import { canvasUiOverrides, DROPPED_TOOL_IDS, KEPT_TOOL_IDS } from './uiOverrides'

function makeTools(ids: readonly string[]) {
  return Object.fromEntries(
    ids.map((id) => [id, { id, label: id, icon: id, onSelect: () => {} }])
  )
}

function applyOverride(ids: readonly string[]) {
  const tools = makeTools(ids)
  return canvasUiOverrides.tools!({} as never, tools as never, {} as never)
}

describe('canvasUiOverrides', () => {
  it('keeps exactly the card-workspace tools', () => {
    const result = applyOverride([...KEPT_TOOL_IDS, ...DROPPED_TOOL_IDS])
    expect(Object.keys(result).sort()).toEqual([...KEPT_TOOL_IDS].sort())
  })

  it('drops the note tool so N cannot spawn a competing sticky', () => {
    const result = applyOverride([...KEPT_TOOL_IDS, 'note'])
    expect(result.note).toBeUndefined()
  })

  it('drops the frame tool so manual frames cannot fight the auto-frame reconciler', () => {
    const result = applyOverride([...KEPT_TOOL_IDS, 'frame'])
    expect(result.frame).toBeUndefined()
  })

  it('drops tools that are not on the keep list even if tldraw adds new ones', () => {
    const result = applyOverride([...KEPT_TOOL_IDS, 'some-future-tool'])
    expect(result['some-future-tool']).toBeUndefined()
  })

  it('tolerates a keep-list tool being absent from the registry', () => {
    const result = applyOverride(['select', 'hand'])
    expect(Object.keys(result).sort()).toEqual(['hand', 'select'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- uiOverrides`
Expected: FAIL — cannot resolve `./uiOverrides`.

- [ ] **Step 3: Write the implementation**

Create `src/canvas/tldraw/uiOverrides.ts`:

```ts
import type { TLUiOverrides, TLUiToolsContextType } from 'tldraw'

/**
 * The only tools a card workspace needs. Everything else is removed from the
 * registry, which also removes its keyboard shortcut.
 */
export const KEPT_TOOL_IDS = ['select', 'hand', 'arrow', 'text', 'draw', 'eraser'] as const

/**
 * Documented for the test fixture and for readers. The override works by
 * allow-list, so this array is not consulted at runtime — a tool tldraw adds in
 * a future version is dropped without needing to be listed here.
 */
export const DROPPED_TOOL_IDS = [
  'note',
  'asset',
  'rectangle',
  'ellipse',
  'triangle',
  'diamond',
  'hexagon',
  'oval',
  'rhombus',
  'star',
  'cloud',
  'heart',
  'x-box',
  'check-box',
  'arrow-left',
  'arrow-up',
  'arrow-down',
  'arrow-right',
  'line',
  'highlight',
  'laser',
  'frame'
] as const

export const canvasUiOverrides: TLUiOverrides = {
  tools(_editor, tools) {
    const kept: TLUiToolsContextType = {}

    for (const id of KEPT_TOOL_IDS) {
      const tool = tools[id]
      if (tool) kept[id] = tool
    }

    return kept
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- uiOverrides`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire the override into the canvas**

In `src/canvas/components/CanvasSurface.tsx`, add the import beside the existing `CanvasContextMenu` import:

```tsx
import { canvasUiOverrides } from '../tldraw/uiOverrides'
```

and add the prop to the `<Tldraw>` element (currently at line 146), directly after `components={tldrawComponents}`:

```tsx
      components={tldrawComponents}
      overrides={canvasUiOverrides}
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`, open the app.
Expected: the bottom toolbar now shows only Select, Hand, Draw, Eraser, Arrow, Text — no Note, no Media, no shapes, and no overflow chevron. Pressing `N` or `F` does nothing.

- [ ] **Step 7: Run the full suite and type check, then commit**

```bash
npm test && npm run lint:types
git add src/canvas/tldraw/uiOverrides.ts src/canvas/tldraw/uiOverrides.test.ts src/canvas/components/CanvasSurface.tsx
git commit -m "feat: trim tldraw tool registry to card-workspace tools"
```

---

### Task 3: Make the style panel conditional

**Files:**
- Create: `src/canvas/components/CanvasStylePanel.tsx`
- Test: `src/canvas/components/CanvasStylePanel.test.tsx`
- Modify: `src/canvas/components/CanvasSurface.tsx:31` (the `tldrawComponents` map)

**Interfaces:**
- Consumes: `DefaultStylePanel`, `useEditor`, `useValue`, `TLUiStylePanelProps` from `tldraw`.
- Produces: `export function CanvasStylePanel(props: TLUiStylePanelProps): JSX.Element | null`

- [ ] **Step 1: Write the failing test**

Create `src/canvas/components/CanvasStylePanel.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CanvasStylePanel`
Expected: FAIL — cannot resolve `./CanvasStylePanel`.

- [ ] **Step 3: Write the implementation**

Create `src/canvas/components/CanvasStylePanel.tsx`:

```tsx
import { DefaultStylePanel, useEditor, useValue, type TLUiStylePanelProps } from 'tldraw'

/**
 * Shape types and tool ids whose appearance the style panel actually controls.
 * Hermes cards are absent deliberately: their colour comes from the card accent,
 * not from this panel.
 */
const NATIVE_STYLED = new Set(['draw', 'text', 'arrow', 'line', 'geo', 'highlight'])

export function CanvasStylePanel(props: TLUiStylePanelProps) {
  const editor = useEditor()

  const shouldShow = useValue(
    'style panel applies to selection',
    () => {
      if (NATIVE_STYLED.has(editor.getCurrentToolId())) return true
      return editor.getSelectedShapes().some((shape) => NATIVE_STYLED.has(shape.type))
    },
    [editor]
  )

  if (!shouldShow) return null

  return <DefaultStylePanel {...props} />
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- CanvasStylePanel`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire it into the components map**

In `src/canvas/components/CanvasSurface.tsx`, add the import:

```tsx
import { CanvasStylePanel } from './CanvasStylePanel'
```

and extend the map at line 31:

```tsx
const tldrawComponents = {
  ContextMenu: CanvasContextMenu,
  StylePanel: CanvasStylePanel
}
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`, open the app.
Expected: the top-right style panel is gone on load and stays gone when you click a Todo or Docs card. Select the Draw tool, or draw a stroke and select it — the panel appears.

- [ ] **Step 7: Run the full suite and type check, then commit**

```bash
npm test && npm run lint:types
git add src/canvas/components/CanvasStylePanel.tsx src/canvas/components/CanvasStylePanel.test.tsx src/canvas/components/CanvasSurface.tsx
git commit -m "feat: show style panel only for natively styled shapes"
```

---

### Task 4: Merge the card inserts into the tldraw toolbar

**Files:**
- Create: `src/canvas/components/CanvasToolbar.tsx`
- Test: `src/canvas/components/CanvasToolbar.test.tsx`
- Modify: `src/canvas/components/CanvasSurface.tsx:31` (the `tldrawComponents` map)
- Modify: `src/App.tsx:40-43` and `src/App.tsx:79-82` (drop `<CanvasInsertMenu />` from both floating toolbars)
- Modify: `src/styles.css` (add toolbar group styles)

**Interfaces:**
- Consumes: `useCanvasInsert`, `INSERT_OPTIONS`, `ComponentIcon` from `./CanvasInsertMenu` (Task 1). `DefaultToolbar`, `TldrawUiMenuToolItem` from `tldraw`.
- Produces: `export function CanvasToolbar(): JSX.Element`

`TldrawUiMenuToolItem` returns `JSX.Element | null` and reads from the tool registry, so it renders nothing for a tool Task 2 removed. Listing the six kept ids explicitly — rather than using `DefaultToolbarContent` — keeps the toolbar's contents and their order deterministic.

- [ ] **Step 1: Write the failing test**

Create `src/canvas/components/CanvasToolbar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasToolbar } from './CanvasToolbar'

const insertMock = vi.hoisted(() => ({
  insertCard: vi.fn(),
  isReady: true
}))

vi.mock('./CanvasInsertMenu', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./CanvasInsertMenu')>()
  return {
    ...actual,
    useCanvasInsert: () => insertMock
  }
})

vi.mock('tldraw', () => ({
  DefaultToolbar: ({ children }: { children?: ReactNode }) => (
    <div data-testid="default-toolbar">{children}</div>
  ),
  TldrawUiMenuToolItem: ({ toolId }: { toolId: string }) => (
    <button data-testid={`tool-${toolId}`} />
  )
}))

describe('CanvasToolbar', () => {
  beforeEach(() => {
    insertMock.insertCard.mockReset()
    insertMock.isReady = true
  })

  it('renders the five card inserts', () => {
    render(<CanvasToolbar />)
    for (const label of ['Project Card', 'Todo Block', 'Link Card', 'Note Card', 'Docs Card']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('renders exactly the six kept tools', () => {
    render(<CanvasToolbar />)
    for (const toolId of ['select', 'hand', 'arrow', 'text', 'draw', 'eraser']) {
      expect(screen.getByTestId(`tool-${toolId}`)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('tool-note')).toBeNull()
    expect(screen.queryByTestId('tool-frame')).toBeNull()
  })

  it('inserts the matching card kind on click', () => {
    render(<CanvasToolbar />)
    fireEvent.click(screen.getByLabelText('Docs Card'))
    expect(insertMock.insertCard).toHaveBeenCalledWith('docs')
  })

  it('disables the inserts until the canvas is ready', () => {
    insertMock.isReady = false
    render(<CanvasToolbar />)
    expect(screen.getByLabelText('Todo Block')).toBeDisabled()
    expect(screen.getByLabelText('Todo Block')).toHaveAttribute(
      'title',
      'Canvas is still loading'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CanvasToolbar`
Expected: FAIL — cannot resolve `./CanvasToolbar`.

- [ ] **Step 3: Write the implementation**

Create `src/canvas/components/CanvasToolbar.tsx`:

```tsx
import { DefaultToolbar, TldrawUiMenuToolItem } from 'tldraw'
import { ComponentIcon, INSERT_OPTIONS, useCanvasInsert } from './CanvasInsertMenu'

const TOOLBAR_TOOL_IDS = ['select', 'hand', 'arrow', 'text', 'draw', 'eraser'] as const

export function CanvasToolbar() {
  const { insertCard, isReady } = useCanvasInsert()

  return (
    <DefaultToolbar>
      <div className="canvas-toolbar-group" role="group" aria-label="Insert card">
        {INSERT_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            className="canvas-toolbar-insert"
            aria-label={option.label}
            disabled={!isReady}
            title={isReady ? option.label : 'Canvas is still loading'}
            onClick={() => insertCard(option.kind)}
          >
            <ComponentIcon icon={option.icon} />
          </button>
        ))}
      </div>
      <div className="canvas-toolbar-divider" aria-hidden="true" />
      {TOOLBAR_TOOL_IDS.map((toolId) => (
        <TldrawUiMenuToolItem key={toolId} toolId={toolId} />
      ))}
    </DefaultToolbar>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- CanvasToolbar`
Expected: PASS, 4 tests.

- [ ] **Step 5: Style the insert group**

Append to `src/styles.css`. These sizes match tldraw's own toolbar buttons so the two groups sit on one baseline.

```css
.canvas-toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.canvas-toolbar-insert {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #293241;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}

.canvas-toolbar-insert svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.canvas-toolbar-insert:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.07);
}

.canvas-toolbar-insert:focus-visible {
  outline: 2px solid rgba(108, 92, 231, 0.62);
  outline-offset: -2px;
}

.canvas-toolbar-insert:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.canvas-toolbar-divider {
  width: 1px;
  height: 24px;
  margin: 0 4px;
  background: rgba(15, 23, 42, 0.14);
}
```

- [ ] **Step 6: Wire the toolbar in and remove the inserts from the floating pill**

In `src/canvas/components/CanvasSurface.tsx`, add the import and extend the map:

```tsx
import { CanvasToolbar } from './CanvasToolbar'

const tldrawComponents = {
  ContextMenu: CanvasContextMenu,
  StylePanel: CanvasStylePanel,
  Toolbar: CanvasToolbar
}
```

In `src/App.tsx`, delete `<CanvasInsertMenu />` from both floating toolbars (lines 40-43 and 79-82), leaving only `<CanvasTidyButton />` in each. Remove the now-unused `CanvasInsertMenu` import.

The `CanvasInsertMenu` component export itself stays in the file — Task 1's hook lives alongside it, and the component is still covered by tests. Leaving it costs nothing and keeps the diff reviewable.

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`, open the app.
Expected: one toolbar at bottom-centre — five card icons, a divider, then the six tools. Clicking Todo Block creates a Todo at viewport centre and selects it. The bottom-right pill now holds only the Tidy button.

- [ ] **Step 8: Run the full suite and type check, then commit**

```bash
npm test && npm run lint:types
git add src/canvas/components/CanvasToolbar.tsx src/canvas/components/CanvasToolbar.test.tsx src/canvas/components/CanvasSurface.tsx src/App.tsx src/styles.css
git commit -m "feat: merge card inserts into the tldraw toolbar"
```

---

### Task 5: Move Tidy into QuickActions and delete the floating pill

**Files:**
- Create: `src/canvas/components/CanvasQuickActions.tsx`
- Test: `src/canvas/components/CanvasQuickActions.test.tsx`
- Modify: `src/canvas/components/CanvasTidyButton.tsx` (extract a hook, mirroring Task 1)
- Modify: `src/canvas/components/CanvasSurface.tsx:31`
- Modify: `src/App.tsx` (delete both `.canvas-floating-toolbar` blocks)
- Modify: `src/styles.css:690-716` (delete the pill rules)

**Interfaces:**
- Consumes: `reconcileAutoFrames` from `../tldraw/autoFrameReconciler`; `useBridgeStore`. `DefaultQuickActions`, `DefaultQuickActionsContent`, `TldrawUiMenuItem`, `TLUiQuickActionsProps` from `tldraw`.
- Produces:
  - From `CanvasTidyButton.tsx`: `export function useCanvasTidy(): { tidyCanvas(): void; isReady: boolean }` and `export function TidyIcon(): JSX.Element`
  - `export function CanvasQuickActions(props: TLUiQuickActionsProps): JSX.Element`

`TLUiMenuItemProps.icon` accepts `IconType | TLUiIconJsx`, where `TLUiIconJsx = ReactElement<HTMLAttributes<HTMLDivElement>>` — so the existing `TidyIcon` SVG is passed wrapped in a `div`, avoiding the need for a registered tldraw icon name.

- [ ] **Step 1: Write the failing test**

Create `src/canvas/components/CanvasQuickActions.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasQuickActions } from './CanvasQuickActions'

const tidyMock = vi.hoisted(() => ({
  tidyCanvas: vi.fn(),
  isReady: true
}))

vi.mock('./CanvasTidyButton', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./CanvasTidyButton')>()
  return {
    ...actual,
    useCanvasTidy: () => tidyMock
  }
})

vi.mock('tldraw', () => ({
  DefaultQuickActions: ({ children }: { children?: ReactNode }) => (
    <div data-testid="default-quick-actions">{children}</div>
  ),
  DefaultQuickActionsContent: () => <div data-testid="default-quick-actions-content" />,
  TldrawUiMenuItem: ({
    label,
    disabled,
    onSelect
  }: {
    label?: string
    disabled?: boolean
    onSelect: (source: string) => void
  }) => (
    <button disabled={disabled} onClick={() => onSelect('quick-actions')}>
      {label}
    </button>
  )
}))

describe('CanvasQuickActions', () => {
  beforeEach(() => {
    tidyMock.tidyCanvas.mockReset()
    tidyMock.isReady = true
  })

  it('keeps the default quick actions', () => {
    render(<CanvasQuickActions />)
    expect(screen.getByTestId('default-quick-actions-content')).toBeInTheDocument()
  })

  it('adds a Tidy action that reconciles the frames', () => {
    render(<CanvasQuickActions />)
    fireEvent.click(screen.getByRole('button', { name: 'Tidy' }))
    expect(tidyMock.tidyCanvas).toHaveBeenCalledTimes(1)
  })

  it('disables Tidy until the canvas is ready', () => {
    tidyMock.isReady = false
    render(<CanvasQuickActions />)
    expect(screen.getByRole('button', { name: 'Tidy' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CanvasQuickActions`
Expected: FAIL — cannot resolve `./CanvasQuickActions`.

- [ ] **Step 3: Extract the tidy hook**

In `src/canvas/components/CanvasTidyButton.tsx`, export `TidyIcon`, and split the component exactly as Task 1 split the insert menu — the body of `tidyCanvas` is unchanged:

```tsx
export function TidyIcon() {
  // unchanged body
}

export function useCanvasTidy() {
  const editor = useBridgeStore((state) => state.editor)
  const adapter = useBridgeStore((state) => state.adapter)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const addLog = useBridgeStore((state) => state.addLog)

  const tidyCanvas = () => {
    if (!editor || !adapter) return

    const result = reconcileAutoFrames({
      editor,
      adapter,
      mode: 'tidy',
      setObservation,
      addLog
    })
    if (result.error) return

    if (result.cardCount === 0) {
      addLog('info', 'canvas.tidy', 'No card components to frame')
      return
    }

    editor.markHistoryStoppingPoint('tidy auto frames')
    editor.zoomToFit({ animation: { duration: 250 } })
    addLog(
      'info',
      'canvas.tidy',
      `Arranged ${result.cardCount} cards in ${result.frameCount} frames`
    )
  }

  return { tidyCanvas, isReady: Boolean(editor && adapter) }
}

export function CanvasTidyButton() {
  const { tidyCanvas, isReady } = useCanvasTidy()

  return (
    <button
      type="button"
      className="canvas-toolbar-button"
      aria-label="Tidy cards by type"
      disabled={!isReady}
      title={isReady ? 'Arrange cards into groups by type' : 'Canvas is still loading'}
      onClick={tidyCanvas}
    >
      <TidyIcon />
    </button>
  )
}
```

- [ ] **Step 4: Write the quick actions component**

Create `src/canvas/components/CanvasQuickActions.tsx`:

```tsx
import {
  DefaultQuickActions,
  DefaultQuickActionsContent,
  TldrawUiMenuItem,
  type TLUiQuickActionsProps
} from 'tldraw'
import { TidyIcon, useCanvasTidy } from './CanvasTidyButton'

export function CanvasQuickActions(props: TLUiQuickActionsProps) {
  const { tidyCanvas, isReady } = useCanvasTidy()

  return (
    <DefaultQuickActions {...props}>
      <DefaultQuickActionsContent />
      <TldrawUiMenuItem
        id="hermes-tidy"
        label="Tidy"
        icon={
          <div className="canvas-quick-action-icon">
            <TidyIcon />
          </div>
        }
        disabled={!isReady}
        onSelect={tidyCanvas}
      />
    </DefaultQuickActions>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- CanvasQuickActions`
Expected: PASS, 3 tests.

- [ ] **Step 6: Wire it in and delete the floating pill**

In `src/canvas/components/CanvasSurface.tsx`:

```tsx
import { CanvasQuickActions } from './CanvasQuickActions'

const tldrawComponents = {
  ContextMenu: CanvasContextMenu,
  StylePanel: CanvasStylePanel,
  Toolbar: CanvasToolbar,
  QuickActions: CanvasQuickActions
}
```

In `src/App.tsx`, delete both `<div className="canvas-floating-toolbar" role="toolbar" aria-label="Canvas custom tools">` wrappers and the `<CanvasTidyButton />` inside each, plus the now-unused `CanvasTidyButton` import. The fullscreen branch becomes:

```tsx
      <main className="fullscreen-canvas-page chat-workspace">
        <section className="fullscreen-canvas-container" aria-label="Fullscreen canvas surface">
          <CanvasSurface />
        </section>
        {isChatEnabled() && <ChatSidebar canvasId="canvas_001" />}
      </main>
```

In `src/styles.css`, delete these now-dead rules: `.canvas-container > .canvas-floating-toolbar, .fullscreen-canvas-container > .canvas-floating-toolbar` (lines 690-696), `.canvas-floating-toolbar` (698-708), and `.canvas-insert-actions` (710-712). Keep `.canvas-toolbar-button` — `CanvasTidyButton` and `CanvasInsertMenu` still use it and are still under test.

Add the icon sizing rule:

```css
.canvas-quick-action-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}
```

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`, open the app.
Expected: no floating pill anywhere. Tidy sits in the top-left cluster beside undo/redo; clicking it groups the cards into frames and zooms to fit. The bottom-right corner is empty.

- [ ] **Step 8: Run the full suite and type check, then commit**

```bash
npm test && npm run lint:types
git add src/canvas/components/CanvasQuickActions.tsx src/canvas/components/CanvasQuickActions.test.tsx src/canvas/components/CanvasTidyButton.tsx src/canvas/components/CanvasSurface.tsx src/App.tsx src/styles.css
git commit -m "feat: move Tidy into quick actions and remove the floating pill"
```

---

### Task 6: Move the chat panel to the right edge

The chat panel and its collapsed FAB are pinned left, colliding with the zoom control and contradicting `docs/superpowers/specs/2026-07-17-floating-right-chat-panel-design.md`. This is a pure CSS change — no component touched.

**Files:**
- Modify: `src/chat/chat.css:30-40` (panel), `:528-534` (FAB), `:576-588` and `:604-616` (the 760px breakpoint)

- [ ] **Step 1: Move the expanded panel**

In `.chat-sidebar` (line 30), swap the horizontal anchors:

```css
.chat-sidebar {
  position: absolute;
  z-index: 20;
  top: 3rem;
  left: auto;
  right: 14px;
  bottom: 14px;
  /* ...rest unchanged... */
}
```

- [ ] **Step 2: Move the collapsed FAB**

In `.chat-expand` (line 528):

```css
.chat-expand {
  position: absolute;
  z-index: 20;
  top: auto;
  bottom: 3rem;
  left: auto;
  right: 14px;
  /* ...rest unchanged... */
}
```

The FAB was at `left: 0` — flush against the viewport edge and overlapping the zoom control. `right: 14px` matches the panel's inset so the two agree when toggling.

- [ ] **Step 3: Mirror the mobile breakpoint**

Inside `@media (max-width: 760px)` (line 576), the panel slides from the right instead of the left:

```css
  .chat-sidebar {
    position: fixed;
    top: 0;
    left: auto;
    right: 0;
    bottom: 0;
    width: min(92vw, 360px);
    height: 100dvh;
    border-radius: 0;
    border-left-color: rgba(148, 163, 184, 0.28);
    box-shadow: -18px 0 50px rgba(2, 8, 23, 0.42);
  }
```

Note `border-right-color` becomes `border-left-color` and the shadow offset flips sign — the panel now casts its shadow leftward, onto the canvas.

And the mobile FAB (line 604):

```css
  .chat-expand {
    position: fixed;
    top: auto;
    left: auto;
    right: 12px;
    bottom: max(74px, calc(env(safe-area-inset-bottom) + 16px));
    /* ...rest unchanged... */
  }
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open the app.
Expected at 1512×900: chat panel on the right, its FAB on the right when collapsed, bottom-left holding only zoom and the minimap toggle with nothing overlapping. Narrow the window below 760px: the panel becomes a full-height right drawer with its shadow falling leftward.

- [ ] **Step 5: Run the full suite and commit**

```bash
npm test
git add src/chat/chat.css
git commit -m "fix: move chat panel and FAB to the right edge"
```

---

### Task 7: Verify the four-corner layout end to end

No new code. This task confirms Phase A's goal actually holds in the running app, because the previous six tasks each verified only their own slice.

- [ ] **Step 1: Run the full suite and type check**

Run: `npm test && npm run lint:types`
Expected: all green.

- [ ] **Step 2: Start both servers**

```bash
npm run server   # tldraw sync on :8787
npm run dev      # vite
```

- [ ] **Step 3: Walk the corner contract**

Check each row against the spec's table:

| Corner | Expected |
|---|---|
| top-left | menu · page · undo · redo · **Tidy** — and nothing else |
| top-right | empty on load; style panel appears only after selecting a drawn stroke, arrow or text |
| bottom-left | zoom · minimap toggle — no chat FAB, nothing overlapping |
| bottom-centre | one toolbar: 5 inserts · divider · 6 tools, no overflow chevron |
| right edge | chat panel, or its FAB when collapsed |

- [ ] **Step 4: Confirm the dropped tools are truly gone**

Press `N`, `F`, `R`, `S` and `⌘U` in turn with the canvas focused.
Expected: no sticky note, no frame, no shape, no laser, no media picker. Only the six kept tools respond to their shortcuts (`V`, `H`, `A`, `T`, `D`, `E`).

- [ ] **Step 5: Confirm insert behaviour is unchanged**

Click each of the five insert icons.
Expected: each creates its card at viewport centre and leaves it selected — identical to the pre-refactor behaviour, since Task 1 moved the logic without editing it.

- [ ] **Step 6: Commit any fixes**

If steps 3-5 surfaced defects, fix them and commit. If everything passed, there is nothing to commit — say so rather than creating an empty commit.

---

## Self-Review

**Spec coverage** — every Phase A requirement maps to a task:

| Spec requirement | Task |
|---|---|
| Inserts merged into tldraw's toolbar as the leading group | 1, 4 |
| Insert behaviour unchanged (click-to-create, centre, select, disabled-until-ready) | 1, 4, 7 |
| Divider separating inserts from tools | 4 |
| Tool set trimmed to select/hand/arrow/text/draw/eraser | 2 |
| Dropped tools lose their keyboard shortcuts | 2, 7 |
| Overflow chevron disappears | 4, 7 |
| Style panel conditional on native selection or active tool | 3 |
| Tidy moves to QuickActions | 5 |
| Floating pill and its CSS deleted | 5 |
| Chat and FAB move to the right edge | 6 |
| Four corners each with one owner | 7 |

**Deferred deliberately:** the `alert()` at `CanvasInsertMenu.tsx:166` stays — it is Phase C's, and replacing it here would mix concerns across phases.

**Type consistency** — `useCanvasInsert` returns `{ insertCard, isReady }` in Tasks 1 and 4; `useCanvasTidy` returns `{ tidyCanvas, isReady }` in Task 5; `INSERT_OPTIONS`, `ComponentIcon` and `TidyIcon` keep the names they already have in the codebase. `KEPT_TOOL_IDS` in Task 2 and `TOOLBAR_TOOL_IDS` in Task 4 hold the same six ids — they are separate constants because one governs the registry and the other governs render order, and Task 7 step 4 checks they agree.

**Known risk:** Task 4 mocks `tldraw` wholesale, so it cannot catch a `DefaultToolbar` API change. Task 4 step 7 and Task 7 are the real check; do not skip the browser verification on the grounds that tests pass.
