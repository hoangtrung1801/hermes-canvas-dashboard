# API-Only Auto-Frame Custom Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep toolbar-created custom components outside automatic frames while preserving automatic framing for Canvas API-created custom components.

**Architecture:** Carry an internal `origin` option through `CanvasBridge` into the typed custom-component creation actions. Direct toolbar inserts use `origin: 'canvas'` and receive `meta.source: 'canvas'`; all existing bridge callers default to `origin: 'api'` and retain `meta.source: 'hermes'`. Auto-frame eligibility is a pure layout concern that requires Hermes provenance, so persisted direct cards remain untouched by continuous reconciliation and Tidy.

**Tech Stack:** TypeScript, React, tldraw, Zustand, Vitest, Testing Library.

## Global Constraints

- Do not change the public Canvas API envelope format.
- Preserve the existing `meta.source: 'hermes'` marker for API-created typed custom components.
- Persist direct-canvas provenance on the shape so reloads do not change eligibility.
- Do not alter custom component placement, selection, dimensions, or editing behavior.
- Follow TDD: each behavior change gets a failing test before production code.

---

### Task 1: Add the internal bridge origin and mark toolbar inserts

**Files:**
- Modify: `src/canvas/bridge/CanvasBridge.ts`
- Modify: `src/canvas/bridge/CanvasBridge.test.ts`
- Modify: `src/canvas/components/CanvasInsertMenu.tsx`
- Modify: `src/canvas/components/CanvasInsertMenu.test.tsx`

**Interfaces:**
- Produce `CanvasActionOrigin = 'api' | 'canvas'` and an optional bridge argument `{ origin?: CanvasActionOrigin }`.
- `CanvasBridge.handleActionEnvelope(envelope, options?)` defaults omitted options to `{ origin: 'api' }` and passes the resolved origin to `executeTldrawAction`.
- The insert menu calls `handleActionEnvelope(envelope, { origin: 'canvas' })`.

- [ ] **Step 1: Write the failing bridge-origin tests**

Add a `create_todo_block` bridge test that calls `handleActionEnvelope` without options and expects the resulting stored shape metadata to contain `{ source: 'hermes' }`. Add a second assertion using `{ origin: 'canvas' }` and expect `{ source: 'canvas' }`.

Add an insert-menu test assertion after invoking `insertCard('todo')`:

```ts
expect(storeMock.bridge!.handleActionEnvelope).toHaveBeenCalledWith(
  expect.objectContaining({ actions: expect.any(Array) }),
  { origin: 'canvas' }
)
```

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run:

```bash
pnpm vitest run src/canvas/bridge/CanvasBridge.test.ts src/canvas/components/CanvasInsertMenu.test.tsx
```

Expected: FAIL because `handleActionEnvelope` does not yet accept or forward an origin and the insert menu only supplies the envelope.

- [ ] **Step 3: Implement the bridge boundary**

Define and export the origin type in `CanvasBridge.ts`. Extend `handleActionEnvelope` with an optional options parameter, resolve `options?.origin ?? 'api'`, and call `executeTldrawAction(this.target, action, { origin })`. Update `CanvasInsertMenu.tsx` to pass `{ origin: 'canvas' }`; leave websocket, simulator, inspector, and other callers unchanged so they use the API default.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```bash
pnpm vitest run src/canvas/bridge/CanvasBridge.test.ts src/canvas/components/CanvasInsertMenu.test.tsx
```

Expected: PASS with all existing bridge and insert-menu tests green.

- [ ] **Step 5: Commit the bridge-origin change**

```bash
git add src/canvas/bridge/CanvasBridge.ts src/canvas/bridge/CanvasBridge.test.ts src/canvas/components/CanvasInsertMenu.tsx src/canvas/components/CanvasInsertMenu.test.tsx
git commit -m "feat: track direct canvas action origin"
```

### Task 2: Thread origin into typed custom-component metadata

**Files:**
- Modify: `src/canvas/tldraw/tldrawActionExecutor.ts`
- Modify: `src/canvas/tldraw/tldrawActionExecutor.test.ts`

**Interfaces:**
- Produce `TldrawActionOrigin = 'api' | 'canvas'` and `TldrawActionContext = { origin?: TldrawActionOrigin }`.
- Extend `executeTldrawAction(target, action, context?)`; omitted context defaults to API origin.
- Typed `create_todo_block`, `create_link_card`, `create_note_card`, `create_docs_card`, and `create_project_card` write `meta.source` as `canvas` for canvas origin and `hermes` for API origin.
- Generic `create_shape` metadata remains caller-controlled.

- [ ] **Step 1: Write the failing executor tests**

Add a parameterized test for the five typed custom creation actions. For one representative action in the test, execute once with no context and once with `{ origin: 'canvas' }`, then assert the two stored shapes have `meta.source` values `hermes` and `canvas` respectively. Cover all five action types through the existing typed action fixtures or individual calls so every creation branch is protected.

- [ ] **Step 2: Run the focused executor test and verify it fails**

Run:

```bash
pnpm vitest run src/canvas/tldraw/tldrawActionExecutor.test.ts
```

Expected: FAIL because `executeTldrawAction` has no context parameter and all typed custom creation branches currently hard-code `source: 'hermes'`.

- [ ] **Step 3: Implement the minimal context and metadata helper**

Add the exported origin/context types and a small helper such as:

```ts
function customComponentMeta(origin: TldrawActionOrigin) {
  return { source: origin === 'canvas' ? 'canvas' : 'hermes' }
}
```

Resolve `const origin = context?.origin ?? 'api'` at the start of `executeTldrawAction`, pass it to each typed custom creation branch, and leave generic shapes unchanged.

- [ ] **Step 4: Run the executor tests and verify they pass**

Run:

```bash
pnpm vitest run src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/bridge/CanvasBridge.test.ts
```

Expected: PASS with API defaults, direct-origin metadata, and existing executor behavior all green.

- [ ] **Step 5: Commit the executor provenance change**

```bash
git add src/canvas/tldraw/tldrawActionExecutor.ts src/canvas/tldraw/tldrawActionExecutor.test.ts
git commit -m "feat: persist custom component creation provenance"
```

### Task 3: Restrict auto-frame eligibility to API-created cards

**Files:**
- Modify: `src/canvas/tldraw/autoFrameLayout.ts`
- Modify: `src/canvas/tldraw/autoFrameLayout.test.ts`
- Modify: `src/canvas/tldraw/autoFrameReconciler.ts`
- Modify: `src/canvas/tldraw/autoFrameReconciler.test.ts`

**Interfaces:**
- Produce `isAutoFrameEligibleCard(shape: AutoFrameLayoutShape): boolean`, which returns true only when the existing supported-card classifier returns a kind and `shape.meta.source === 'hermes'`.
- The planner, managed-card count, unsupported-child handling, and store-change relevance use this eligibility predicate.
- Managed frame ownership remains based on `meta.hermesAutoFrame` and is unaffected.

- [ ] **Step 1: Write failing layout and reconciler tests**

Add a planner test with one API card (`meta: { source: 'hermes' }`) and one direct card (`meta: { source: 'canvas' }`) of the same kind. Assert the plan contains one frame and only the API card appears in `cardUpdates`.

Add a reconciler test with a direct card and assert `reconcileAutoFrames` reports `cardCount: 0`, performs no frame creation, and leaves the card page-level. Add a relevance test asserting a direct card addition is ignored, while an API card addition remains relevant.

Update existing auto-frame card fixtures to include `meta: { source: 'hermes' }` so their current API-created behavior remains explicit.

- [ ] **Step 2: Run the focused auto-frame tests and verify they fail**

Run:

```bash
pnpm vitest run src/canvas/tldraw/autoFrameLayout.test.ts src/canvas/tldraw/autoFrameReconciler.test.ts
```

Expected: FAIL because the planner and reconciler currently classify supported cards without checking provenance.

- [ ] **Step 3: Implement the eligibility predicate and apply it consistently**

Add `isAutoFrameEligibleCard` beside the existing supported-card classifier. In `planAutoFrameLayout`, build `cards` from eligible cards only. When checking `unsupportedChildren`, treat every child that is not eligible—including a supported direct-canvas card—as unsupported so direct cards cannot be silently deleted or reflowed inside a generated frame. Update `countManagedCards` and `isRelevantRecord` in the reconciler to use the same predicate.

- [ ] **Step 4: Run the focused auto-frame tests and verify they pass**

Run:

```bash
pnpm vitest run src/canvas/tldraw/autoFrameLayout.test.ts src/canvas/tldraw/autoFrameReconciler.test.ts
```

Expected: PASS, including existing frame recovery, debounce, duplicate, and settled-state tests.

- [ ] **Step 5: Commit the eligibility change**

```bash
git add src/canvas/tldraw/autoFrameLayout.ts src/canvas/tldraw/autoFrameLayout.test.ts src/canvas/tldraw/autoFrameReconciler.ts src/canvas/tldraw/autoFrameReconciler.test.ts
git commit -m "fix: auto-frame only API-created cards"
```

### Task 4: Add end-to-end canvas-surface regressions and verify the repository

**Files:**
- Modify: `src/canvas/components/CanvasSurface.test.tsx`

**Interfaces:**
- Preserve `CanvasSurface` and `useCanvasAutoFrames` public behavior; this task only verifies the integrated bridge, editor store, subscription, and UI paths.

- [ ] **Step 1: Replace the obsolete direct-insert auto-frame expectation**

Change the existing test named `automatically groups newly inserted cards in a managed native frame` to assert that two toolbar-created Todo Blocks remain page-level and that no frame is created after the reconciliation debounce window. Keep assertions that both cards are present and selectable behavior unchanged in their existing tests.

- [ ] **Step 2: Add a failing remote API auto-frame regression**

Add a websocket callback test that sends two `create_todo_block` actions in one `canvas.action` message, waits for the two cards and the generated frame, and asserts the frame metadata is `{ hermesAutoFrame: { version: 1, kind: 'todo' } }` and both cards share that frame as parent. This must exercise the default bridge origin rather than calling the executor directly.

- [ ] **Step 3: Run the CanvasSurface test and verify the expected failure before implementation changes are complete**

Run:

```bash
pnpm vitest run src/canvas/components/CanvasSurface.test.tsx
```

Expected during the red phase: the updated direct-insert expectation fails against the current auto-framing behavior. After Tasks 1–3 are applied, the same command must pass.

- [ ] **Step 4: Run the complete TypeScript test suite and type checks**

Run:

```bash
pnpm vitest run
pnpm run lint:types
```

Expected: both commands exit successfully with zero failed tests and zero type errors.

- [ ] **Step 5: Inspect the final diff and commit the integrated regression coverage**

```bash
git diff --check
git status --short
git add src/canvas/components/CanvasSurface.test.tsx
git commit -m "test: cover API-only auto-framing in canvas surface"
```

Confirm the only changed files are the approved spec/plan and the bridge, executor, auto-frame, and focused test files listed above.
