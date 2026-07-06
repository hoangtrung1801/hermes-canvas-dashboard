# Custom Component Background Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add configurable background colors to Hermes custom canvas components through both API actions and in-canvas edit controls.

**Architecture:** Store `backgroundColor?: string` on each existing custom shape prop object. The create helpers and action schema accept the value, the tldraw executor persists it, and the React shape utilities render and edit it.

**Tech Stack:** TypeScript, React, tldraw custom `ShapeUtil`, Zod, Vitest, Testing Library.

---

## File Structure

- Modify `src/canvas/tldraw/customShape.types.ts` to add `backgroundColor` to custom prop types and create helpers.
- Modify `src/canvas/actions/canvasAction.types.ts` to add `backgroundColor` to typed create actions.
- Modify `src/canvas/actions/canvasAction.schema.ts` to validate optional `backgroundColor`.
- Modify `src/canvas/tldraw/customShapeUtils.tsx` to render inline background colors and expose edit controls.
- Modify `src/canvas/tldraw/customShape.types.test.ts` for helper defaults and explicit colors.
- Modify `src/canvas/actions/canvasAction.schema.test.ts` for create-action schema coverage.
- Modify `src/canvas/tldraw/tldrawActionExecutor.test.ts` for executor persistence.
- Modify `src/canvas/tldraw/customShapeUtils.test.tsx` for rendering and edit controls.
- Modify `CANVAS_API.md` examples to document `backgroundColor`.

## Task 1: Prop Helpers And Action Schema

**Files:**
- Test: `src/canvas/tldraw/customShape.types.test.ts`
- Test: `src/canvas/actions/canvasAction.schema.test.ts`
- Modify: `src/canvas/tldraw/customShape.types.ts`
- Modify: `src/canvas/actions/canvasAction.types.ts`
- Modify: `src/canvas/actions/canvasAction.schema.ts`

- [x] **Step 1: Write failing helper tests**

Add expectations that explicit colors are preserved:

```ts
expect(createTaskCardProps({ title: 'Design', backgroundColor: '#fef3c7' })).toMatchObject({
  backgroundColor: '#fef3c7'
})
expect(createTodoBlockProps({ title: 'Launch', backgroundColor: '#fee2e2' })).toMatchObject({
  backgroundColor: '#fee2e2'
})
expect(createLinkCardProps({ title: 'Docs', url: 'https://tldraw.dev', backgroundColor: '#ecfccb' })).toMatchObject({
  backgroundColor: '#ecfccb'
})
```

- [x] **Step 2: Write failing schema tests**

Add create action parsing assertions for all three custom actions with `backgroundColor`.

- [x] **Step 3: Run tests to verify red**

Run: `npm test -- src/canvas/tldraw/customShape.types.test.ts src/canvas/actions/canvasAction.schema.test.ts`

Expected: FAIL because `backgroundColor` is not part of the helper input types or Zod schema yet.

- [x] **Step 4: Implement minimal prop and schema support**

Add `backgroundColor?: string` to the three prop types and create-action types, pass it through create helpers only when provided, and add `backgroundColor: z.string().min(1).optional()` to the three create action schemas.

- [x] **Step 5: Run tests to verify green**

Run: `npm test -- src/canvas/tldraw/customShape.types.test.ts src/canvas/actions/canvasAction.schema.test.ts`

Expected: PASS.

## Task 2: Executor Persistence

**Files:**
- Test: `src/canvas/tldraw/tldrawActionExecutor.test.ts`
- Modify: `src/canvas/tldraw/customShape.types.ts`

- [x] **Step 1: Write failing executor test**

Extend the create-task-card test action with `backgroundColor: '#fef3c7'` and expect the observation props to include `backgroundColor: '#fef3c7'`.

- [x] **Step 2: Run test to verify red if Task 1 is not complete**

Run: `npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts`

Expected before implementation: FAIL because helper output does not preserve the value. Expected after Task 1: PASS.

- [x] **Step 3: Keep implementation minimal**

No new executor branch is needed if Task 1 passes `backgroundColor` through create helpers.

- [x] **Step 4: Run test to verify green**

Run: `npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts`

Expected: PASS.

## Task 3: Renderer And Edit Controls

**Files:**
- Test: `src/canvas/tldraw/customShapeUtils.test.tsx`
- Modify: `src/canvas/tldraw/customShapeUtils.tsx`

- [x] **Step 1: Write failing render test**

Add assertions that a rendered custom component with `props.backgroundColor: '#fef3c7'` has inline `background-color: rgb(254, 243, 199)` or the equivalent Testing Library style assertion.

- [x] **Step 2: Write failing edit-control test**

In edit mode, change the `Background color` text input to `#fef3c7` and expect:

```ts
expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
  id: 'shape:task_1',
  type: 'task_card',
  props: { backgroundColor: '#fef3c7' }
})
```

- [x] **Step 3: Run tests to verify red**

Run: `npm test -- src/canvas/tldraw/customShapeUtils.test.tsx`

Expected: FAIL because inline styles and edit controls do not exist.

- [x] **Step 4: Implement renderer support**

Create helper functions in `customShapeUtils.tsx` for card style and color editing, then use them in all three custom shape components:

```ts
function cardStyle(props: { w: number; h: number; backgroundColor?: string }) {
  return {
    width: props.w,
    height: props.h,
    ...(props.backgroundColor ? { backgroundColor: props.backgroundColor } : {})
  }
}
```

- [x] **Step 5: Implement edit controls**

Add a shared `BackgroundColorField` component with `aria-label="Background color"` and `aria-label="Background color picker"` that updates `props.backgroundColor`.

- [x] **Step 6: Run tests to verify green**

Run: `npm test -- src/canvas/tldraw/customShapeUtils.test.tsx`

Expected: PASS.

## Task 4: Documentation And Full Verification

**Files:**
- Modify: `CANVAS_API.md`

- [x] **Step 1: Update API examples**

Add `backgroundColor` to the three custom helper action examples in `CANVAS_API.md`.

- [x] **Step 2: Run focused tests**

Run: `npm test -- src/canvas/tldraw/customShape.types.test.ts src/canvas/actions/canvasAction.schema.test.ts src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/tldraw/customShapeUtils.test.tsx`

Expected: PASS.

- [x] **Step 3: Run type checks**

Run: `npm run lint:types`

Expected: PASS.

- [x] **Step 4: Run full test suite**

Run: `npm test`

Expected: PASS.
