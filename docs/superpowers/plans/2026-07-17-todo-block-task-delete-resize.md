# Todo block task deletion and vertical resizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an edit-mode X control for deleting Todo Block tasks and allow Todo Block shapes to resize to independent vertical dimensions.

**Architecture:** Keep task deletion inside `TodoBlockShapeUtil.component`, using the existing `updateShapeProps` and `controlHandlers` helpers so changes persist through tldraw and pointer events do not escape to the canvas. Change the shared Hermes card shape utility’s resize policy to unlock the aspect ratio and let `resizeBox`’s min dimensions be the only resize constraint; preserve the existing 16:9 defaults and migrations for new/legacy card data.

**Tech Stack:** React 19, TypeScript, tldraw 5.2, Vitest, Testing Library, Vite, CSS.

## Global Constraints

- Delete controls are visible only in Todo Block edit mode.
- Deleting one task preserves every other task and its `done` state.
- Todo Block resize must preserve independent width and height values.
- Preserve the existing minimum dimensions: 320px wide and 180px high.
- Preserve existing view-mode, checkbox, inline text editing, add-task, and link-card behavior.
- Write and observe a failing test before production changes.

## File Map

- Modify `src/canvas/tldraw/customShapeUtils.test.tsx`: focused component and shape-resize regression coverage.
- Modify `src/canvas/tldraw/customShapeUtils.tsx`: edit-mode delete action and unlocked Hermes card resize behavior.
- Modify `src/styles.css`: Todo task delete-button layout, hover, and focus treatment.

### Task 1: Add failing tests for Todo task deletion and independent resize

**Files:**
- Modify: `src/canvas/tldraw/customShapeUtils.test.tsx` near the Todo edit tests and resize tests.

**Interfaces:**
- Consumes: `TodoBlockShapeUtil`, the existing `tldrawMock.editor`, and the existing `resizeBox` test double.
- Produces: tests that fail against the current missing delete control and locked/aspect-normalized resize implementation.

- [ ] **Step 1: Write the failing deletion test**

Set `tldrawMock.editingShapeId = 'shape:todo_1'`, render a Todo Block with `Write copy` and `Ship`, click the button named `Delete task: Write copy`, and assert the editor receives only the remaining task:

```tsx
  it('deletes a task from the todo edit controls', () => {
    tldrawMock.editingShapeId = 'shape:todo_1'
    const util = new TodoBlockShapeUtil({} as any)
    render(
      util.component({
        id: 'shape:todo_1',
        type: 'todo_block',
        props: {
          w: 320,
          h: 220,
          title: 'Launch',
          tasks: [
            { id: 'task_copy', text: 'Write copy', done: false },
            { id: 'task_ship', text: 'Ship', done: true }
          ]
        }
      } as any)
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete task: Write copy' }))

    expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
      id: 'shape:todo_1',
      type: 'todo_block',
      props: {
        tasks: [{ id: 'task_ship', text: 'Ship', done: true }]
      }
    })
  })
```

- [ ] **Step 2: Run the deletion test and verify it fails for the missing button**

Run:

```bash
pnpm exec vitest run src/canvas/tldraw/customShapeUtils.test.tsx -t "deletes a task from the todo edit controls"
```

Expected: FAIL because no button with accessible name `Delete task: Write copy` exists yet.

- [ ] **Step 3: Update the resize expectation to expose independent height**

Change the test double’s returned dimensions from `{ w: 480, h: 260 }` to `{ w: 480, h: 400 }`, change the resize expectation to `{ props: { w: 480, h: 400 } }`, and replace the aspect-ratio test with the required unlocked policy:

```tsx
  it('allows custom cards to resize independently', () => {
    expect(new TodoBlockShapeUtil({} as any).isAspectRatioLocked()).toBe(false)
    expect(new LinkCardShapeUtil({} as any).isAspectRatioLocked()).toBe(false)
  })
```

- [ ] **Step 4: Run the resize test and verify it fails for the locked/base behavior**

Run:

```bash
pnpm exec vitest run src/canvas/tldraw/customShapeUtils.test.tsx -t "resizes custom card shapes|allows custom cards to resize independently"
```

Expected: FAIL because the shared Hermes card utility currently reports a locked aspect ratio and normalizes the mocked taller height back to the 16:9 height.

### Task 2: Implement edit-mode task deletion and free vertical resize

**Files:**
- Modify: `src/canvas/tldraw/customShapeUtils.tsx:71-111, 177-302`.

**Interfaces:**
- Consumes: the failing tests from Task 1, `updateShapeProps`, `controlHandlers`, `CloseIcon`, `HERMES_CARD_MIN_WIDTH`, and `HERMES_CARD_MIN_HEIGHT`.
- Produces: `Delete task: <task text>` buttons in Todo Block edit mode and independent `w`/`h` resize patches for all Hermes cards.

- [ ] **Step 1: Implement the minimal delete callback**

Inside `TodoBlockShapeUtil.component`, add:

```tsx
    const deleteTask = (taskId: string, event: MouseEvent<HTMLButtonElement>) => {
      editor.markEventAsHandled(event)
      updateShapeProps(editor, shape, {
        tasks: shape.props.tasks.filter((task) => task.id !== taskId)
      })
    }
```

- [ ] **Step 2: Render the edit-mode X button for every task**

In the edit-mode task row, keep the checkbox and text input, then add:

```tsx
              <button
                type="button"
                aria-label={`Delete task: ${task.text}`}
                title={`Delete task: ${task.text}`}
                className="hermes-task-delete"
                onClick={(event) => deleteTask(task.id, event)}
                {...handlers}
              >
                <CloseIcon />
              </button>
```

The button is inside the `isEditing` branch only, so view mode has no task-delete affordance.

- [ ] **Step 3: Unlock the shared Hermes card resize policy**

Update `BaseHermesCardUtil` as follows:

```tsx
  override isAspectRatioLocked = () => false

  override onResize(shape: Shape, info: TLResizeInfo<Shape>) {
    const { id: _id, type: _type, ...patch } = resizeBox(shape as any, info as any, {
      minWidth: HERMES_CARD_MIN_WIDTH,
      minHeight: HERMES_CARD_MIN_HEIGHT
    })

    return patch
  }
```

Do not change `fitHermesCardDimensions`, default props, migrations, or link-card component behavior; those preserve the established initial 16:9 card dimensions while resize patches now retain the user’s chosen height.

- [ ] **Step 4: Run focused tests and fix only implementation issues**

Run:

```bash
pnpm exec vitest run src/canvas/tldraw/customShapeUtils.test.tsx src/canvas/tldraw/customShape.types.test.ts
```

Expected: PASS, including the new deletion assertion, the independent resize assertion, existing Todo Block editing/add-task tests, existing link-card tests, and existing dimension/migration tests.

### Task 3: Style and verify the new control

**Files:**
- Modify: `src/styles.css` near `.hermes-task-row` and `.hermes-add-task-button`.

**Interfaces:**
- Consumes: the `hermes-task-delete` class emitted by the Todo Block edit renderer.
- Produces: a compact, keyboard-focusable X control that does not collapse the task input.

- [ ] **Step 1: Add delete-button styles**

Add:

```css
.hermes-task-delete {
  display: grid;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  margin: -1px 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #718070;
  cursor: pointer;
}

.hermes-task-delete svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.hermes-task-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
}

.hermes-task-delete:focus-visible {
  outline: 2px solid #6c5ce7;
  outline-offset: 1px;
}
```

- [ ] **Step 2: Run the complete verification set**

Run:

```bash
pnpm test
pnpm run lint:types
pnpm run build
git diff --check
```

Expected: all Vitest tests pass, TypeScript exits with code 0, Vite produces a production bundle, and `git diff --check` reports no whitespace errors.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff -- src/canvas/tldraw/customShapeUtils.tsx src/canvas/tldraw/customShapeUtils.test.tsx src/styles.css
git status --short
```

Confirm the implementation is limited to edit-mode Todo task deletion, shared free resize behavior, the focused tests, and control styling. Preserve the pre-existing untracked `__pycache__` files.

