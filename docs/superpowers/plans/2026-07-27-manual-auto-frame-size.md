# Manual Auto-Frame Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve manually resized auto-frame dimensions while expanding frames only when eligible content needs more space.

**Architecture:** Add a persistent `hermesAutoFrameManualSize` marker to managed frames when the store observes a user-originated width/height change. Extend the pure planner to preserve marked frame dimensions with `max(current, required)` sizing. Keep the existing reconciliation apply guard so automatic writes do not mark frames as manual.

**Tech Stack:** TypeScript, tldraw, Vitest.

## Global Constraints

- Do not change frame ownership metadata or API-only card eligibility.
- Do not shrink a manually sized frame after cards are removed or resized smaller.
- Expand a manually sized frame only when required content dimensions exceed its current dimensions.
- Preserve existing automatic sizing for unmarked generated frames.
- Follow TDD: write and observe failing tests before production changes.

---

### Task 1: Preserve manual frame dimensions in the pure planner

**Files:**
- Modify: `src/canvas/tldraw/autoFrameLayout.ts`
- Modify: `src/canvas/tldraw/autoFrameLayout.test.ts`

**Interfaces:**
- Add and export `AUTO_FRAME_MANUAL_SIZE_META_KEY = 'hermesAutoFrameManualSize'`.
- Existing generated frames with `meta[AUTO_FRAME_MANUAL_SIZE_META_KEY] === true` retain at least their current `props.w` and `props.h`.

- [ ] **Step 1: Write failing planner tests**

Add three tests using an existing generated Todo frame with `meta: { hermesAutoFrame: { version: 1, kind: 'todo' }, hermesAutoFrameManualSize: true }`:

1. A frame larger than the required grid keeps its current width and height.
2. A frame smaller than the required grid expands to the required width and height.
3. Removing cards leaves the current manual frame dimensions unchanged.

- [ ] **Step 2: Run the focused planner tests and verify they fail**

```bash
pnpm vitest run src/canvas/tldraw/autoFrameLayout.test.ts
```

Expected: FAIL because existing-frame planning always replaces dimensions with the card grid dimensions.

- [ ] **Step 3: Implement manual-size planning**

Import no new runtime dependency. In the existing-frame branch, read the current frame dimensions first, calculate the required grid dimensions as today, include unsupported children as today, then use:

```ts
if (existing?.meta[AUTO_FRAME_MANUAL_SIZE_META_KEY] === true) {
  w = Math.max(w, dimension(existing, 'w', FRAME_MIN_WIDTH))
  h = Math.max(h, dimension(existing, 'h', FRAME_MIN_HEIGHT))
}
```

Keep the manual marker in `plannedFrame.meta` by spreading existing metadata. Do not change new-frame sizing or Tidy positioning.

- [ ] **Step 4: Run planner tests and verify they pass**

```bash
pnpm vitest run src/canvas/tldraw/autoFrameLayout.test.ts
```

Expected: PASS, including all existing layout and idempotence tests.

### Task 2: Mark user-resized managed frames in the reconciler subscription

**Files:**
- Modify: `src/canvas/tldraw/autoFrameReconciler.ts`
- Modify: `src/canvas/tldraw/autoFrameReconciler.test.ts`

**Interfaces:**
- Add a store-listener helper that identifies an updated managed frame whose `props.w` or `props.h` changed.
- User-originated dimension changes add `meta[AUTO_FRAME_MANUAL_SIZE_META_KEY] = true` before scheduling reconciliation.
- Changes emitted while `applyingEditors` contains the editor do not mark frames.

- [ ] **Step 1: Write failing subscription tests**

Add a test that emits a managed-frame update with `source: 'user'`, changing width from `400` to `520`, then asserts the editor store receives an update preserving the frame and adding `hermesAutoFrameManualSize: true`.

Add a test that emits the same dimension update with `source: 'remote'` and asserts no manual marker is added. Add a regression assertion that an automatic reconciliation write does not recursively mark its own frame.

- [ ] **Step 2: Run reconciler tests and verify they fail**

```bash
pnpm vitest run src/canvas/tldraw/autoFrameReconciler.test.ts
```

Expected: FAIL because the subscription currently only debounces reconciliation and never records manual sizing.

- [ ] **Step 3: Implement guarded manual-size marking**

Extend `StoreChangeEntry` with optional `source`. Add a helper that checks the `updated` pairs for a managed frame whose before/after dimensions differ and whose entry source is `user`. Use `editor.store.update` to clone the record and set the manual-size metadata, wrapped by `applyingEditors.add/delete` so the marker write is ignored by the listener. Run this helper before `isAutoFrameRelevantChange` and then keep the existing debounce behavior.

- [ ] **Step 4: Run reconciler tests and verify they pass**

```bash
pnpm vitest run src/canvas/tldraw/autoFrameReconciler.test.ts src/canvas/tldraw/autoFrameLayout.test.ts
```

Expected: PASS with manual marker detection, frame recovery, debounce, and planner preservation green.

### Task 3: Verify integrated behavior and repository checks

**Files:**
- Modify: `src/canvas/components/CanvasSurface.test.tsx` only if an integrated manual-resize regression is needed by the existing test double.

- [ ] **Step 1: Add an integrated regression if supported by the existing mock**

If the CanvasSurface test double can emit a managed-frame user update, add a test that resizes a generated frame, emits a larger card set, and asserts the frame expands only when the content exceeds the manual size. Otherwise, rely on the pure planner and reconciler tests because those cover the state transitions without a browser-specific resize implementation.

- [ ] **Step 2: Run focused and non-network verification**

```bash
pnpm vitest run src/canvas/tldraw/autoFrameLayout.test.ts src/canvas/tldraw/autoFrameReconciler.test.ts src/canvas/components/CanvasSurface.test.tsx
pnpm run lint:types
pnpm vitest run --exclude server/canvas/canvasGateway.integration.test.ts
```

Expected: all commands pass. The server integration suite may remain blocked by sandbox localhost `listen/fetch EPERM` restrictions.

- [ ] **Step 3: Inspect the diff**

```bash
git diff --check
git status --short
```

Confirm only the approved manual-size spec/plan and the auto-frame implementation/test files changed.
