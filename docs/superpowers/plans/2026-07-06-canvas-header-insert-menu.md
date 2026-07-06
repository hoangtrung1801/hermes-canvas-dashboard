# Canvas Floating Insert Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an icon-first floating canvas menu that inserts the existing Todo Block, Task Card, and Link Card custom components directly onto the tldraw dashboard.

**Architecture:** Create a focused `CanvasInsertMenu` component that reads the mounted bridge, adapter, and editor from `bridgeStore`. The component sends existing create actions through `CanvasBridge`, updates observation/log state, and selects the newly created shape. Render the component inside both standard and fullscreen canvas containers and style it as a fixed-size floating canvas control.

**Tech Stack:** React 19, Vite, TypeScript, tldraw, Zustand, Vitest, Testing Library, plain CSS.

---

### Task 1: Floating Insert Menu Tests

**Files:**
- Modify: `src/canvas/components/CanvasSurface.test.tsx`

- [ ] **Step 1: Write failing tests**

Add these tests inside the existing `describe('CanvasSurface', () => { ... })` block:

```tsx
  it('opens a floating canvas insert menu with existing custom components', async () => {
    render(<App />)

    const insertButton = await screen.findByRole('button', { name: 'Insert component' })
    expect(insertButton).toBeInTheDocument()
    expect(insertButton.closest('.canvas-container')).toBeInTheDocument()

    act(() => {
      insertButton.click()
    })

    expect(screen.getByRole('menuitem', { name: /Todo Block/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Task Card/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Link Card/ })).toBeInTheDocument()
  })

  it('inserts a task card from the floating canvas menu and selects it', async () => {
    render(<App />)

    const insertButton = await screen.findByRole('button', { name: 'Insert component' })
    act(() => {
      insertButton.click()
    })

    act(() => {
      screen.getByRole('menuitem', { name: /Task Card/ }).click()
    })

    await waitFor(() => {
      expect(useBridgeStore.getState().lastObservation?.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'task_card',
            props: expect.objectContaining({ title: 'New Task' })
          })
        ])
      )
    })

    expect(tldrawMock.editor.getSelectedShapeIds()).toHaveLength(1)
  })

  it('inserts todo and link cards from the floating canvas menu', async () => {
    render(<App />)

    const insertButton = await screen.findByRole('button', { name: 'Insert component' })
    act(() => {
      insertButton.click()
    })
    act(() => {
      screen.getByRole('menuitem', { name: /Todo Block/ }).click()
    })

    act(() => {
      insertButton.click()
    })
    act(() => {
      screen.getByRole('menuitem', { name: /Link Card/ }).click()
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

  it('shows the floating insert icon control in fullscreen canvas view', async () => {
    window.history.pushState({}, '', '/?view=canvas')

    render(<App />)

    const insertButton = await screen.findByRole('button', { name: 'Insert component' })
    expect(insertButton).toBeInTheDocument()
    expect(insertButton.closest('.fullscreen-canvas-container')).toBeInTheDocument()
  })
```

Also update the mocked editor in the same file so selection can be asserted:

```tsx
  const selectedShapeIds: string[] = []
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
      return selectedShapeIds
    },
    getCamera() {
      return { x: 0, y: 0, z: 1 }
    },
    getViewportPageBounds() {
      return { x: 0, y: 0, w: 1200, h: 800 }
    },
    setCamera() {},
    zoomToFit() {},
    select(...ids: string[]) {
      selectedShapeIds.splice(0, selectedShapeIds.length, ...ids)
    },
    selectNone() {
      selectedShapeIds.splice(0)
    }
  }
```

Reset `selectedShapeIds` in `beforeEach`:

```tsx
    tldrawMock.selectedShapeIds.splice(0)
```

- [ ] **Step 2: Run tests to verify red**

Run:

```bash
pnpm test src/canvas/components/CanvasSurface.test.tsx
```

Expected: FAIL because no floating `Insert component` button exists inside the canvas containers yet.

### Task 2: CanvasInsertMenu Component

**Files:**
- Create: `src/canvas/components/CanvasInsertMenu.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add minimal implementation**

Create `src/canvas/components/CanvasInsertMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useBridgeStore } from '../state/bridgeStore'

type ComponentKind = 'todo' | 'task' | 'link'

const INSERT_OPTIONS: Array<{ kind: ComponentKind; label: string; icon: string }> = [
  { kind: 'todo', label: 'Todo Block', icon: '☑' },
  { kind: 'task', label: 'Task Card', icon: '▣' },
  { kind: 'link', label: 'Link Card', icon: '↗' }
]

function nextInsertId(kind: ComponentKind) {
  return `shape:${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function getInsertPoint(editor: unknown) {
  const maybeEditor = editor as { getViewportPageBounds?: () => { x: number; y: number; w: number; h: number } }
  const bounds = maybeEditor.getViewportPageBounds?.()
  if (!bounds) return { x: 160, y: 160 }
  return {
    x: Math.round(bounds.x + bounds.w / 2 - 140),
    y: Math.round(bounds.y + bounds.h / 2 - 80)
  }
}

function buildCreateAction(kind: ComponentKind, id: string, x: number, y: number) {
  if (kind === 'todo') {
    return { type: 'create_todo_block' as const, id, title: 'Todo', tasks: [], x, y }
  }

  if (kind === 'task') {
    return {
      type: 'create_task_card' as const,
      id,
      title: 'New Task',
      body: '',
      status: 'todo',
      priority: 'medium',
      x,
      y
    }
  }

  return {
    type: 'create_link_card' as const,
    id,
    title: 'New Link',
    url: 'https://example.com',
    description: '',
    x,
    y
  }
}

export function CanvasInsertMenu() {
  const bridge = useBridgeStore((state) => state.bridge)
  const adapter = useBridgeStore((state) => state.adapter)
  const editor = useBridgeStore((state) => state.editor)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const addLog = useBridgeStore((state) => state.addLog)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isReady = Boolean(bridge && adapter && editor)

  useEffect(() => {
    if (!isOpen) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  const insertComponent = (kind: ComponentKind) => {
    if (!bridge || !adapter || !editor) return

    const point = getInsertPoint(editor)
    const shapeId = nextInsertId(kind)
    const action = buildCreateAction(kind, shapeId, point.x, point.y)
    const envelope = {
      type: 'canvas.action' as const,
      requestId: 'insert_' + Math.random().toString(36).substring(2, 9),
      canvasId: adapter.canvasId,
      actions: [action]
    }

    addLog('in', 'canvas.action (Insert Component)', envelope)
    const response = bridge.handleActionEnvelope(envelope)
    setIsOpen(false)

    if ('error' in response) {
      addLog('error', 'canvas.error (Insert Component)', response.error)
      alert(`Error inserting component: ${response.error.message}`)
      return
    }

    editor.select(shapeId as never)
    setObservation(response.observation.state)
    addLog('out', 'canvas.result (Insert Component)', response.result)
    addLog('out', 'canvas.observation (Insert Component)', response.observation)
  }

  return (
    <div className="canvas-insert-menu" ref={menuRef}>
      <button
        type="button"
        className="canvas-icon-button"
        aria-label="Insert component"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={!isReady}
        title={isReady ? 'Insert component' : 'Canvas is still loading'}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span aria-hidden="true">＋</span>
      </button>

      {isOpen && (
        <div className="canvas-insert-popover" role="menu" aria-label="Insert component">
          {INSERT_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              className="canvas-insert-option"
              role="menuitem"
              onClick={() => insertComponent(option.kind)}
            >
              <span className="canvas-insert-option-icon" aria-hidden="true">
                {option.icon}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

Modify `src/App.tsx`:

```tsx
import { CanvasInsertMenu } from './canvas/components/CanvasInsertMenu'
```

Render `<CanvasInsertMenu />` inside `.fullscreen-canvas-container` before `<CanvasSurface />`, and inside `.canvas-container` before `<CanvasSurface />`.

- [ ] **Step 2: Run tests to verify green**

Run:

```bash
pnpm test src/canvas/components/CanvasSurface.test.tsx
```

Expected: PASS.

### Task 3: Floating Menu Styling

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add CSS for the floating icon menu**

Add styles near the existing canvas header styles:

```css
.canvas-insert-menu {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.canvas-container > .canvas-insert-menu,
.fullscreen-canvas-container > .canvas-insert-menu {
  position: absolute;
  bottom: 14px;
  right: 14px;
  z-index: 1100;
}

.canvas-icon-button {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.72);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}

.canvas-icon-button:hover:not(:disabled),
.canvas-icon-button:focus-visible:not(:disabled) {
  background: rgba(56, 189, 248, 0.14);
  border-color: rgba(56, 189, 248, 0.5);
  outline: none;
}

.canvas-icon-button:active:not(:disabled) {
  transform: translateY(1px);
}

.canvas-icon-button:disabled {
  cursor: not-allowed;
  color: var(--text-muted);
  opacity: 0.56;
}

.canvas-insert-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 50;
  width: 180px;
  padding: 6px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  background: rgba(8, 15, 28, 0.96);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.36);
}

.canvas-insert-option {
  width: 100%;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.canvas-insert-option:hover,
.canvas-insert-option:focus-visible {
  background: rgba(56, 189, 248, 0.12);
  outline: none;
}

.canvas-insert-option-icon {
  width: 18px;
  flex: 0 0 18px;
  color: var(--color-primary);
  text-align: center;
  font-size: 14px;
}
```

- [ ] **Step 2: Run type checks and targeted tests**

Run:

```bash
pnpm lint:types
pnpm test src/canvas/components/CanvasSurface.test.tsx
```

Expected: both commands exit 0.

### Task 4: Full Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
pnpm test
pnpm lint:types
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 2: Inspect final diff**

Run:

```bash
git diff --stat
git diff -- src/App.tsx src/canvas/components/CanvasInsertMenu.tsx src/canvas/components/CanvasSurface.test.tsx src/styles.css
```

Expected: diff only contains the insert menu component, header integration, tests, and styles.
