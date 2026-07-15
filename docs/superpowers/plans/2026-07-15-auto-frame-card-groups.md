# Auto-Frame Card Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically place supported canvas cards inside one managed native tldraw frame per card kind, continuously reconcile those frames, and make Tidy repack them.

**Architecture:** A pure planner owns classification and deterministic geometry. An editor reconciler adapts live tldraw records to the planner and applies minimal guarded transactions. A React lifecycle hook subscribes to document changes, while the existing Tidy button calls the same reconciler in explicit packing mode.

**Tech Stack:** TypeScript 5.5, React 19, tldraw 5.2, Zustand 5, Vitest 2, Testing Library

## Global Constraints

- Manage only `project_card`, `todo_block`, rectangular `geo`, and `link_card` shapes.
- Exclude every supported card that belongs to a user-created frame.
- Generated frames are owned only through `meta.hermesAutoFrame`; title, color, and position never imply ownership.
- Project frames use one card column; Todo, Note, and Link frames use at most two.
- Continuous reconciliation preserves existing frame origins and uses ignored history.
- Explicit Tidy repacks frames in Projects, Todos, Notes, Links order and remains undoable.
- Do not add runtime dependencies.
- Preserve existing canvas actions, sync, selection, editing, resizing, and gateway behavior.

---

## File Structure

- Create `src/canvas/tldraw/autoFrameLayout.ts`: pure card classification, metadata parsing, grid geometry, duplicate/empty recovery, and outer frame packing.
- Create `src/canvas/tldraw/autoFrameLayout.test.ts`: exhaustive pure planner contract.
- Create `src/canvas/tldraw/autoFrameReconciler.ts`: editor snapshot adapter, guarded plan application, adapter synchronization, relevance filtering, and debounced subscription.
- Create `src/canvas/tldraw/autoFrameReconciler.test.ts`: mocked-editor reconciliation and listener tests.
- Create `src/canvas/components/useCanvasAutoFrames.ts`: mount-time reconciliation and subscription lifecycle.
- Modify `src/canvas/components/CanvasSurface.tsx`: activate the lifecycle hook.
- Modify `src/canvas/components/CanvasTidyButton.tsx`: call explicit auto-frame reconciliation instead of the legacy column layout.
- Modify `src/canvas/components/CanvasSurface.test.tsx`: extend the tldraw mock and verify live/Tidy integration.
- Delete `src/canvas/tldraw/tidyCardLayout.ts` and `src/canvas/tldraw/tidyCardLayout.test.ts`: remove the superseded layout implementation.
- Modify `README.md`: describe automatic frames and the new Tidy behavior.

---

### Task 1: Pure Auto-Frame Layout Planner

**Files:**
- Create: `src/canvas/tldraw/autoFrameLayout.ts`
- Create: `src/canvas/tldraw/autoFrameLayout.test.ts`

**Interfaces:**
- Consumes: existing `PROJECT_CARD_TYPE`, `TODO_BLOCK_TYPE`, and `LINK_CARD_TYPE` constants.
- Produces: `planAutoFrameLayout(input: AutoFrameLayoutInput): AutoFramePlan`, `AUTO_FRAME_META_KEY`, `AUTO_FRAME_KIND_ORDER`, `readAutoFrameKind(meta)`, and exported planner input/plan types.

- [ ] **Step 1: Write failing classification and ownership tests**

Create fixtures with `id`, `type`, `parentId`, `x`, `y`, `pageX`, `pageY`, `props`, and `meta`. Assert that one page-level card of each supported type creates frames titled Projects, Todos, Notes, and Links; unsupported ellipses are ignored; and a supported card parented to an untagged frame produces no managed frame.

```ts
expect(planAutoFrameLayout({ pageId: 'page:page', shapes, mode: 'continuous' }).frames)
  .toMatchObject([
    { kind: 'project', title: 'Projects' },
    { kind: 'todo', title: 'Todos' },
    { kind: 'note', title: 'Notes' },
    { kind: 'link', title: 'Links' }
  ])
expect(manualFramePlan.cardUpdates).toEqual([])
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- src/canvas/tldraw/autoFrameLayout.test.ts`

Expected: FAIL because `./autoFrameLayout` does not exist.

- [ ] **Step 3: Add planner types, constants, classification, and metadata parsing**

Define these public contracts and stable constants:

```ts
export type AutoFrameCardKind = 'project' | 'todo' | 'note' | 'link'
export type AutoFrameMode = 'continuous' | 'tidy'

export type AutoFrameLayoutShape = {
  id: string
  type: string
  parentId: string
  x: number
  y: number
  pageX: number
  pageY: number
  props: Record<string, unknown>
  meta: Record<string, unknown>
}

export type PlannedFrame = {
  id: string
  kind: AutoFrameCardKind
  title: string
  color: string
  x: number
  y: number
  w: number
  h: number
  create: boolean
  meta: Record<string, unknown>
}

export type AutoFramePlan = {
  frames: PlannedFrame[]
  cardUpdates: Array<{ id: string; type: string; parentId: string; x: number; y: number }>
  deleteFrameIds: string[]
  demoteFrameIds: string[]
}

export const AUTO_FRAME_META_KEY = 'hermesAutoFrame'
export const AUTO_FRAME_KIND_ORDER = ['project', 'todo', 'note', 'link'] as const
```

Use metadata shaped as `{ version: 1, kind }`. `readAutoFrameKind` returns a kind only for an object with exactly a supported `kind` and numeric version `1`. Map titles to Projects, Todos, Notes, Links and colors to `light-violet`, `yellow`, `green`, and `light-blue`.

- [ ] **Step 4: Write failing inner-grid geometry tests**

Assert a Project frame has one column; three Todo cards produce a two-column, two-row grid; visual order is `pageY`, `pageX`, then ID; card updates use the generated frame ID and local coordinates; and frame bounds equal the grid plus constants.

```ts
expect(todoPlan.cardUpdates).toEqual([
  expect.objectContaining({ id: 'shape:todo_a', x: 32, y: 64 }),
  expect.objectContaining({ id: 'shape:todo_b', x: 376, y: 64 }),
  expect.objectContaining({ id: 'shape:todo_c', x: 32, y: 268 })
])
expect(todoPlan.frames[0]).toMatchObject({ w: 728, h: 480 })
```

Use `FRAME_PADDING = 32`, `FRAME_CONTENT_TOP = 64`, `CARD_GAP = 24`, safe fallback `w = 320`, `h = 180`, and frame minimums `w = 400`, `h = 240`.

- [ ] **Step 5: Implement deterministic inner-frame layout**

Sort managed cards by `pageY || pageX || id`. Use one column for Projects, otherwise `Math.min(2, cards.length)`. Compute each column's maximum width and each row's maximum height, accumulated with a 24-unit gap. Emit exact local card patches and a tight frame size with the minimums above. Treat invalid dimensions as the safe fallback without emitting dimension updates.

- [ ] **Step 6: Write failing lifecycle-recovery and Tidy packing tests**

Cover these cases with exact assertions:

```ts
expect(emptyPlan.deleteFrameIds).toEqual(['shape:auto-todo'])
expect(duplicatePlan.deleteFrameIds).toEqual(['shape:auto-todo-copy'])
expect(unsupportedChildPlan.demoteFrameIds).toEqual(['shape:auto-todo'])
expect(settledPlan.cardUpdates).toEqual([])
expect(settledPlan.frames.every((frame) => !frame.create)).toBe(true)
expect(tidyPlan.frames.map(({ kind }) => kind)).toEqual(['project', 'todo', 'note', 'link'])
expect(tidyPlan.frames[3].y).toBeGreaterThan(tidyPlan.frames[0].y)
```

Also assert continuous mode keeps an existing frame's `x` and `y`, a missing frame starts near its card-group origin without overlapping existing generated frames, and a deterministic ID collision receives a numeric suffix.

- [ ] **Step 7: Implement recovery, idempotence, and outer packing**

Choose the canonical tagged frame by deterministic ID first and lexical ID second. Delete empty or duplicate generated frames only when they contain no unsupported children. Put a frame with unsupported remaining children in `demoteFrameIds`. Generate IDs from `shape:hermes-auto-frame-${sanitizedPageId}-${kind}` and append `-2`, `-3`, and onward on collision.

For continuous mode, preserve canonical frame origins. Place a new frame at its cards' minimum page coordinates, shifting right by `frame.w + 64` until it does not intersect an occupied generated-frame rectangle. For Tidy mode, pack frame rectangles row-major from the managed-content minimum origin with `OUTER_GAP = 64` and `MAX_FRAME_ROW_WIDTH = 3200`.

Do not emit a card update when its parent and coordinates already match. The plan always describes each canonical frame; the reconciler compares frame position, dimensions, title, color, and ownership metadata before issuing an editor update.

- [ ] **Step 8: Run planner tests and type checking**

Run: `npm test -- src/canvas/tldraw/autoFrameLayout.test.ts && npm run lint:types`

Expected: planner tests PASS and TypeScript exits 0.

- [ ] **Step 9: Commit the planner**

```bash
git add src/canvas/tldraw/autoFrameLayout.ts src/canvas/tldraw/autoFrameLayout.test.ts
git commit -m "feat: plan automatic card group frames"
```

---

### Task 2: Editor Reconciler and Live Subscription

**Files:**
- Create: `src/canvas/tldraw/autoFrameReconciler.ts`
- Create: `src/canvas/tldraw/autoFrameReconciler.test.ts`
- Modify: `src/canvas/tldraw/tldrawActionExecutor.ts`

**Interfaces:**
- Consumes: `planAutoFrameLayout`, its exported types/constants, `Editor`, `TldrawExecutorTarget`, `readTldrawObservation`.
- Produces: `reconcileAutoFrames(options): AutoFrameReconcileResult`, `subscribeToAutoFrameChanges(options): () => void`, and `isAutoFrameRelevantChange(entry): boolean`.

- [ ] **Step 1: Write failing reconcile-apply tests**

Build a small editor double supporting `getCurrentPageId`, `getCurrentPageShapesSorted`, `getShapePageBounds`, `createShapes`, `updateShapes`, `deleteShapes`, `run`, and `store.update`. Start with two Todo cards and assert one reconciliation:

```ts
expect(editor.createShapes).toHaveBeenCalledWith([
  expect.objectContaining({ type: 'frame', props: expect.objectContaining({ name: 'Todos' }) })
])
expect(editor.updateShapes).toHaveBeenCalledWith([
  expect.objectContaining({ id: 'shape:todo_1', parentId: expect.stringContaining('auto-frame') }),
  expect.objectContaining({ id: 'shape:todo_2', parentId: expect.stringContaining('auto-frame') })
])
expect(editor.run).toHaveBeenCalledWith(expect.any(Function), { history: 'ignore' })
```

Assert the returned result reports card/frame counts and that the target adapter map and observation callback contain the created frame and local card positions.

- [ ] **Step 2: Run the focused reconciler test to verify RED**

Run: `npm test -- src/canvas/tldraw/autoFrameReconciler.test.ts`

Expected: FAIL because `./autoFrameReconciler` does not exist.

- [ ] **Step 3: Implement snapshot normalization and guarded plan application**

Expose this signature:

```ts
export function reconcileAutoFrames(options: {
  editor: Editor
  adapter: TldrawExecutorTarget
  mode?: AutoFrameMode
  setObservation?: (state: CanvasObservationState) => void
  addLog?: (direction: 'info' | 'error', type: string, payload: unknown) => void
}): AutoFrameReconcileResult
```

Normalize each current-page shape with its `parentId`, local position, props, meta, and page position from `editor.getShapePageBounds(shape.id)`. Apply creation, frame updates, card updates, ownership demotion, and safe deletion within one `editor.run`; use `{ history: 'ignore' }` in continuous mode and `{ history: 'record' }` in Tidy mode. For demotion, call `editor.store.update` with a cloned metadata object that omits `AUTO_FRAME_META_KEY`.

After a successful apply, rebuild `adapter.shapes` from the editor's current page shapes, including optional `parentId`, and call `setObservation(readTldrawObservation(adapter))`. On failure, log `canvas.auto_frame_failed` and do not publish a new observation.

- [ ] **Step 4: Extend executor records with parent IDs**

Update `ShapeRecord` to include `parentId?: string`. Populate it when synchronizing live editor records. Existing headless actions may omit it, preserving their current page-level behavior.

- [ ] **Step 5: Write failing relevance, debounce, and loop-guard tests**

Use fake timers and a mocked `editor.store.listen`. Assert:

- A supported shape add schedules one reconciliation after 80 ms.
- Five relevant updates within 80 ms still reconcile once.
- Camera, instance, and unsupported arrow records do not schedule work.
- A tagged frame update schedules work.
- The listener receives `{ source: 'all', scope: 'document' }`.
- Calling the unsubscribe function clears the timer and removes the store listener.
- Synchronous change notifications emitted during apply do not recursively reconcile.

- [ ] **Step 6: Implement relevant-change filtering and subscription**

Expose:

```ts
export function subscribeToAutoFrameChanges(options: {
  editor: Editor
  reconcile: () => void
  debounceMs?: number
}): () => void
```

Inspect `entry.changes.added`, both sides of `updated`, and `removed`. A record is relevant only when `typeName === 'shape'` and it is a supported card, a `frame` carrying valid auto-frame metadata, or an update whose previous value met either condition. Use one `setTimeout` with default `80`; reset it for each relevant event. Keep an apply guard in `reconcileAutoFrames` in a `WeakSet<Editor>` so writes made during a reconciliation are ignored.

- [ ] **Step 7: Run reconciler tests and type checking**

Run: `npm test -- src/canvas/tldraw/autoFrameReconciler.test.ts && npm run lint:types`

Expected: reconciler tests PASS and TypeScript exits 0.

- [ ] **Step 8: Commit the reconciler**

```bash
git add src/canvas/tldraw/autoFrameReconciler.ts src/canvas/tldraw/autoFrameReconciler.test.ts src/canvas/tldraw/tldrawActionExecutor.ts
git commit -m "feat: reconcile automatic canvas frames"
```

---

### Task 3: Canvas Lifecycle and Tidy Integration

**Files:**
- Create: `src/canvas/components/useCanvasAutoFrames.ts`
- Modify: `src/canvas/components/CanvasSurface.tsx`
- Modify: `src/canvas/components/CanvasTidyButton.tsx`
- Modify: `src/canvas/components/CanvasSurface.test.tsx`
- Delete: `src/canvas/tldraw/tidyCardLayout.ts`
- Delete: `src/canvas/tldraw/tidyCardLayout.test.ts`

**Interfaces:**
- Consumes: `reconcileAutoFrames`, `subscribeToAutoFrameChanges`, and existing bridge-store editor/adapter/log/observation state.
- Produces: automatic mount/live behavior and explicit Tidy frame packing.

- [ ] **Step 1: Write failing lifecycle integration tests**

Extend the tldraw test double with `store.listen`, `store.update`, `getCurrentPageId`, `getShapePageBounds`, `createShapes`, and `run`. Emit document shape changes from mock create/update/delete methods. With fake timers, insert two Todo cards and assert one generated frame appears after 80 ms, both cards have the frame as `parentId`, and the frame contains metadata `{ hermesAutoFrame: { version: 1, kind: 'todo' } }`.

Unmount the app, emit another relevant change, advance timers, and assert no new frame update occurs.

- [ ] **Step 2: Implement the lifecycle hook**

```ts
export function useCanvasAutoFrames() {
  const editor = useBridgeStore((state) => state.editor)
  const adapter = useBridgeStore((state) => state.adapter)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const addLog = useBridgeStore((state) => state.addLog)

  useEffect(() => {
    if (!editor || !adapter) return
    const reconcile = () => reconcileAutoFrames({ editor, adapter, setObservation, addLog })
    reconcile()
    return subscribeToAutoFrameChanges({ editor, reconcile })
  }, [editor, adapter, setObservation, addLog])
}
```

Call `useCanvasAutoFrames()` inside `CanvasSurface` after reading bridge-store state so it becomes active after `onMount` installs the editor and adapter.

- [ ] **Step 3: Write the failing explicit Tidy integration test**

Replace the legacy column assertion with frames. Create all four card kinds, let continuous reconciliation settle, manually separate generated-frame origins, then click `Tidy cards by type`. Assert frame titles are ordered Projects, Todos, Notes, Links; their rectangles do not overlap and follow row-major positions; every card's `parentId` matches its kind frame; history is marked `tidy auto frames`; `zoomToFit` is called; and the log reports both card and frame counts.

- [ ] **Step 4: Replace Tidy with explicit frame reconciliation**

In `CanvasTidyButton`, call:

```ts
const result = reconcileAutoFrames({
  editor,
  adapter,
  mode: 'tidy',
  setObservation,
  addLog
})
editor.markHistoryStoppingPoint('tidy auto frames')
editor.zoomToFit({ animation: { duration: 250 } })
addLog('info', 'canvas.tidy', `Arranged ${result.cardCount} cards in ${result.frameCount} frames`)
```

When `result.cardCount === 0`, log `No card components to frame` and do not zoom. Remove the legacy `createTidyCardLayout` import and delete its source and test after all references are gone.

- [ ] **Step 5: Run integration and complete canvas tests**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/autoFrameLayout.test.ts src/canvas/tldraw/autoFrameReconciler.test.ts`

Expected: all selected suites PASS.

- [ ] **Step 6: Commit canvas integration**

```bash
git add src/canvas/components/useCanvasAutoFrames.ts src/canvas/components/CanvasSurface.tsx src/canvas/components/CanvasTidyButton.tsx src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/tidyCardLayout.ts src/canvas/tldraw/tidyCardLayout.test.ts
git commit -m "feat: auto-frame cards on the live canvas"
```

---

### Task 4: Documentation and Final Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: completed auto-frame behavior.
- Produces: user-facing workflow documentation and verified release evidence.

- [ ] **Step 1: Update the canvas workflow documentation**

In the README canvas capability list, state that Project, Todo, Note, and Link cards are automatically grouped in managed native frames; manual frames are excluded; and Tidy immediately repacks generated frames while continuous mode preserves frame origins.

- [ ] **Step 2: Run formatting and static checks**

Run: `git diff --check && npm run lint:types && npm run build`

Expected: no whitespace errors, TypeScript exits 0, and Vite reports a successful production build.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test`

Expected: all Vitest suites pass with zero failed tests.

- [ ] **Step 4: Visually verify in the in-app browser**

Start the app and server with their existing development commands, open the local canvas, create at least two Todos plus one Project, Note, and Link, and verify:

- Four native frames appear with the correct titles and pastel colors.
- Both Todos share one frame and form a two-column row.
- The Project uses one wide column.
- Moving a generated frame moves its cards.
- Adding and deleting a card resizes its frame.
- Moving a card into a manual frame leaves it there.
- Tidy repacks generated frames and zooms to fit.
- No frame flicker or repeated movement occurs after the canvas settles.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md
git commit -m "docs: explain automatic canvas frames"
```

- [ ] **Step 6: Review final diff and report evidence**

Run: `git status --short && git log -5 --oneline`

Expected: working tree clean, with separate planner, reconciler, integration, and documentation commits visible.
