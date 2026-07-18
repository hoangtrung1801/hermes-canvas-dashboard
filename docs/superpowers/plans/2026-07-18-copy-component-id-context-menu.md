# Copy Component ID Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Copy ID` action to the existing tldraw right-click menu that copies the exact selected shape ID to the clipboard.

**Architecture:** Create a focused `CanvasContextMenu` wrapper that renders tldraw's `DefaultContextMenu`, `DefaultContextMenuContent`, and a trailing project-owned menu group. The wrapper uses tldraw's editor selection and toast contexts, while `CanvasSurface` supplies it through the existing `components.ContextMenu` extension point. No shape records, bridge actions, or persistence code changes.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, tldraw 5.2.2.

## Global Constraints

- Preserve every existing tldraw context-menu action and append the new action group.
- Apply the action to custom Hermes components and native tldraw shapes.
- Copy the exact shape ID string, including its tldraw prefix.
- Render `Copy ID` only when exactly one shape is selected.
- Use tldraw's native menu item, icon, focus, keyboard, and toast primitives.
- Do not change shape records, IDs, persistence, or the canvas action protocol.
- Clipboard failure must show an error toast and must not mutate the canvas.

---

### Task 1: Add failing tests for the context-menu action

**Files:**
- Create: `src/canvas/components/CanvasContextMenu.test.tsx`

**Interfaces:**
- Consumes: the planned `CanvasContextMenu` component and tldraw UI primitives.
- Produces: regression coverage for menu visibility, clipboard success, and clipboard failure.

- [ ] **Step 1: Write the failing test file**

Create a focused test double for the tldraw hooks and primitives, then exercise the real project component. The test double should expose the menu item as a regular button so the behavior can be verified without mounting the full tldraw editor.

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasContextMenu } from './CanvasContextMenu'

const tldrawMock = vi.hoisted(() => ({
  selectedShape: null as { id: string } | null,
  selectedShapeCount: 0,
  writeText: vi.fn(),
  addToast: vi.fn()
}))

vi.mock('tldraw', () => ({
  DefaultContextMenu: ({ children }: { children?: ReactNode }) => (
    <div data-testid="default-context-menu">{children}</div>
  ),
  DefaultContextMenuContent: () => <div data-testid="default-context-menu-content" />,
  TldrawUiMenuGroup: ({ children }: { children: ReactNode }) => (
    <div data-testid="menu-group">{children}</div>
  ),
  TldrawUiMenuItem: ({ label, onSelect }: { label?: string; onSelect: (source: string) => void }) => (
    <button onClick={() => onSelect('context-menu' as never)}>{label}</button>
  ),
  useEditor: () => ({
    getOnlySelectedShape: () => tldrawMock.selectedShape,
    getSelectedShapeIds: () => Array.from({ length: tldrawMock.selectedShapeCount }, (_, index) => `shape:${index}`),
    getContainer: () => ({
      ownerDocument: {
        defaultView: { navigator: { clipboard: { writeText: tldrawMock.writeText } } }
      }
    })
  }),
  useValue: (_name: string, getValue: () => boolean) => getValue(),
  useToasts: () => ({ addToast: tldrawMock.addToast })
}))

describe('CanvasContextMenu', () => {
  beforeEach(() => {
    tldrawMock.selectedShape = null
    tldrawMock.selectedShapeCount = 0
    tldrawMock.writeText.mockReset()
    tldrawMock.writeText.mockResolvedValue(undefined)
    tldrawMock.addToast.mockReset()
  })

  it('keeps the default menu and copies the selected shape id', async () => {
    tldrawMock.selectedShape = { id: 'shape:todo_123' }
    tldrawMock.selectedShapeCount = 1

    render(<CanvasContextMenu />)

    expect(screen.getByTestId('default-context-menu-content')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy ID' }))

    await vi.waitFor(() => expect(tldrawMock.writeText).toHaveBeenCalledWith('shape:todo_123'))
    expect(tldrawMock.addToast).toHaveBeenCalledWith({
      title: 'Component ID copied',
      description: 'shape:todo_123',
      severity: 'success',
      icon: 'clipboard-copied'
    })
  })

  it('hides Copy ID without exactly one selected shape', () => {
    render(<CanvasContextMenu />)
    expect(screen.queryByRole('button', { name: 'Copy ID' })).not.toBeInTheDocument()

    tldrawMock.selectedShape = { id: 'shape:one' }
    tldrawMock.selectedShapeCount = 2
    render(<CanvasContextMenu />)
    expect(screen.queryByRole('button', { name: 'Copy ID' })).not.toBeInTheDocument()
  })

  it('shows an error toast when clipboard access fails', async () => {
    tldrawMock.selectedShape = { id: 'shape:docs_456' }
    tldrawMock.selectedShapeCount = 1
    tldrawMock.writeText.mockRejectedValue(new Error('denied'))

    render(<CanvasContextMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy ID' }))

    await vi.waitFor(() =>
      expect(tldrawMock.addToast).toHaveBeenCalledWith({
        title: 'Could not copy component ID',
        description: 'Clipboard access was denied.',
        severity: 'error',
        icon: 'clipboard-copy'
      })
    )
  })
})
```

If the project test environment needs the `React` namespace for the mock prop types, import `type ReactNode` from `react` and use that type instead of relying on a global JSX namespace.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- src/canvas/components/CanvasContextMenu.test.tsx
```

Expected: FAIL because `src/canvas/components/CanvasContextMenu.tsx` does not exist yet. Do not proceed until the failure is caused by the missing implementation rather than a test syntax or environment error.

### Task 2: Implement the focused context-menu wrapper

**Files:**
- Create: `src/canvas/components/CanvasContextMenu.tsx`
- Test: `src/canvas/components/CanvasContextMenu.test.tsx`

**Interfaces:**
- Consumes: tldraw `TLUiContextMenuProps`, `Editor`, selection state, and toast context.
- Produces: `CanvasContextMenu` as a drop-in `ContextMenu` component for `<Tldraw components={...} />`.

- [ ] **Step 1: Implement the minimal wrapper**

Use the public tldraw APIs and keep the item in the default menu tree:

```tsx
import {
  DefaultContextMenu,
  DefaultContextMenuContent,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  useEditor,
  useToasts,
  useValue,
  type TLUiContextMenuProps
} from 'tldraw'

export function CanvasContextMenu(props: TLUiContextMenuProps) {
  const editor = useEditor()
  const { addToast } = useToasts()
  const hasSingleSelectedShape = useValue(
    'has single selected shape for copy id',
    () => editor.getSelectedShapeIds().length === 1,
    [editor]
  )

  const copySelectedShapeId = async () => {
    const shape = editor.getOnlySelectedShape()
    const containerWindow = editor.getContainer().ownerDocument.defaultView
    const writeText = containerWindow?.navigator.clipboard?.writeText

    if (!shape || !writeText) {
      addToast({
        title: 'Could not copy component ID',
        description: 'Clipboard access was denied.',
        severity: 'error',
        icon: 'clipboard-copy'
      })
      return
    }

    try {
      await writeText.call(containerWindow?.navigator.clipboard, shape.id)
      addToast({
        title: 'Component ID copied',
        description: shape.id,
        severity: 'success',
        icon: 'clipboard-copied'
      })
    } catch {
      addToast({
        title: 'Could not copy component ID',
        description: 'Clipboard access was denied.',
        severity: 'error',
        icon: 'clipboard-copy'
      })
    }
  }

  return (
    <DefaultContextMenu {...props}>
      <DefaultContextMenuContent />
      {hasSingleSelectedShape && (
        <TldrawUiMenuGroup id="hermes-component-actions">
          <TldrawUiMenuItem
            id="copy-component-id"
            label="Copy ID"
            icon="clipboard-copy"
            onSelect={copySelectedShapeId}
          />
        </TldrawUiMenuGroup>
      )}
    </DefaultContextMenu>
  )
}
```

The implementation may use a small local `showCopyError` helper to avoid duplicating the error toast object, but it must keep the exact user-visible strings and icon IDs above. Do not add a fallback `document.execCommand` path; the spec requires a clear error when the Clipboard API is unavailable.

- [ ] **Step 2: Run the focused tests to verify they pass**

Run:

```bash
npm test -- src/canvas/components/CanvasContextMenu.test.tsx
```

Expected: PASS for all three tests, with no unhandled promise rejection.

- [ ] **Step 3: Commit the isolated menu behavior**

Run:

```bash
git add src/canvas/components/CanvasContextMenu.tsx src/canvas/components/CanvasContextMenu.test.tsx
git commit -m "feat: add copy component id context action"
```

### Task 3: Wire the wrapper into the live canvas

**Files:**
- Modify: `src/canvas/components/CanvasSurface.tsx:1-20,100-135`
- Modify: `src/canvas/components/CanvasSurface.test.tsx:1-230, tests near the existing tldraw props assertions`

**Interfaces:**
- Consumes: `CanvasContextMenu` from Task 2.
- Produces: `<Tldraw>` receives `components={{ ContextMenu: CanvasContextMenu }}` while keeping all current shape-utils and mount behavior.

- [ ] **Step 1: Write the failing integration assertion**

In `CanvasSurface.test.tsx`, extend the tldraw mock export with a `props.components`-compatible path if needed, then add this test:

```tsx
it('uses the Hermes context menu wrapper', async () => {
  render(<App />)

  await waitFor(() => expect(tldrawMock.props).toBeTruthy())
  expect(tldrawMock.props.components.ContextMenu).toBeDefined()
  expect(tldrawMock.props.components.ContextMenu.name).toBe('CanvasContextMenu')
})
```

If the test runner changes the function name through a wrapper, assert identity against an imported `CanvasContextMenu` instead:

```tsx
expect(tldrawMock.props.components.ContextMenu).toBe(CanvasContextMenu)
```

Add the import at the top of the test if using identity comparison. The existing `Tldraw` mock will capture `props`, so no browser context-menu simulation is needed in this integration test.

- [ ] **Step 2: Run the integration test to verify it fails**

Run:

```bash
npm test -- src/canvas/components/CanvasSurface.test.tsx -t "uses the Hermes context menu wrapper"
```

Expected: FAIL because `CanvasSurface` currently does not pass a `components` override to tldraw.

- [ ] **Step 3: Wire the component in `CanvasSurface`**

Add:

```tsx
import { CanvasContextMenu } from './CanvasContextMenu'

const tldrawComponents = {
  ContextMenu: CanvasContextMenu
}
```

Then pass the stable object to the existing `Tldraw` element:

```tsx
<Tldraw
  store={store}
  shapeUtils={[...hermesShapeUtils, ColoredFrameShapeUtil]}
  components={tldrawComponents}
  onMount={...}
/>
```

Keep the `onMount` implementation, store, sync shape utils, theme setup, and bridge setup unchanged.

- [ ] **Step 4: Run the integration test to verify it passes**

Run:

```bash
npm test -- src/canvas/components/CanvasSurface.test.tsx -t "uses the Hermes context menu wrapper"
```

Expected: PASS.

- [ ] **Step 5: Commit the canvas wiring**

Run:

```bash
git add src/canvas/components/CanvasContextMenu.tsx src/canvas/components/CanvasSurface.tsx src/canvas/components/CanvasSurface.test.tsx
git commit -m "feat: wire canvas context menu override"
```

### Task 4: Run the complete verification suite

**Files:**
- No source changes expected; only fix issues discovered by verification.

**Interfaces:**
- Consumes: the completed implementation from Tasks 1–3.
- Produces: verified tests, type-check, production build, and clean diff.

- [ ] **Step 1: Run the focused tests together**

Run:

```bash
npm test -- src/canvas/components/CanvasContextMenu.test.tsx src/canvas/components/CanvasSurface.test.tsx
```

Expected: PASS with no warnings or unhandled rejections.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS for the complete Vitest suite.

- [ ] **Step 3: Run type-checking**

Run:

```bash
npm run lint:types
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: exit code 0 and a generated `dist/` bundle.

- [ ] **Step 5: Check the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Only the intended implementation files and the already committed spec/plan should be present.

- [ ] **Step 6: Commit any verification-only fixes**

If verification reveals an implementation defect, add the minimal fix and its regression test, rerun the failed command, then commit it with:

```bash
git add src/canvas/components/CanvasContextMenu.tsx src/canvas/components/CanvasContextMenu.test.tsx src/canvas/components/CanvasSurface.tsx src/canvas/components/CanvasSurface.test.tsx
git commit -m "fix: verify copy component id action"
```

## Self-review

- Spec coverage: the plan covers preserving default actions, exact IDs, single-selection visibility, success/error feedback, accessibility through tldraw primitives, no canvas mutation, focused tests, full tests, type-checking, build, and diff validation.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation step is used; every code change includes file paths, concrete APIs, and commands.
- Type consistency: `CanvasContextMenu` is the named component produced by Task 2 and consumed by `CanvasSurface` in Task 3; tldraw `TLUiContextMenuProps`, `TldrawUiMenuItem`, `useEditor`, `useValue`, and `useToasts` are the installed public APIs.
