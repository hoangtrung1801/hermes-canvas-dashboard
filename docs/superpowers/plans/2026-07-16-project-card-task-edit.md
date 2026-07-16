# Project card task editing fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make project-card task text reliably enter inline edit mode in the live tldraw canvas while preserving task-row drag and drop.

**Architecture:** Keep the custom editor in `ProjectCardBoard`. Add a task-text interaction island that marks its pointer events as handled by tldraw and is ignored by the row's drag-start handler. Persist edits through the existing `onTasksChange` callback and tldraw shape adapter.

**Tech Stack:** React 19, TypeScript, tldraw 5.2, Vitest, Testing Library, Vite.

## Global Constraints

- Preserve existing project-card editing semantics: double-click opens, Enter/blur saves, Escape cancels.
- Preserve dragging from non-text portions of a task row.
- Do not change tldraw global editing mode or unrelated project-card behavior.
- Add the regression test before changing production code.

---

### Task 1: Add a failing pointer-sequence regression test

**Files:**
- Modify: `src/canvas/tldraw/ProjectCardBoard.test.tsx` near the existing task editing tests.

**Interfaces:**
- Consumes: `ProjectCardBoard`'s current draggable task rendering and `Harness` test fixture.
- Produces: A regression test proving pointer movement that begins on task text is not treated as a drag and that the task edit input opens.

- [ ] **Step 1: Write the failing test**

Add this test after the existing `edits task text` test:

```tsx
  it('keeps task text pointer sequences available for inline editing', () => {
    render(<Harness />)

    const taskText = screen.getByText('Draft')
    fireEvent.pointerDown(taskText, {
      pointerId: 4,
      button: 0,
      clientX: 50,
      clientY: 80
    })
    fireEvent.pointerMove(taskText, {
      pointerId: 4,
      clientX: 70,
      clientY: 100
    })

    expect(screen.queryByRole('status', { name: 'Draft task' })).not.toBeInTheDocument()

    fireEvent.pointerUp(taskText, {
      pointerId: 4,
      clientX: 70,
      clientY: 100
    })
    fireEvent.doubleClick(taskText)

    expect(screen.getByRole('textbox', { name: 'Task text' })).toHaveFocus()
  })
```

- [ ] **Step 2: Run the regression test and verify it fails**

Run:

```bash
pnpm exec vitest run src/canvas/tldraw/ProjectCardBoard.test.tsx -t "keeps task text pointer sequences available for inline editing"
```

Expected: FAIL because the current row handler starts a drag after the pointer moves from the task text, so the drag preview with accessible name `Draft task` is present.

### Task 2: Isolate task text from row drag handling

**Files:**
- Modify: `src/canvas/tldraw/ProjectCardBoard.tsx` in `startPointerDrag` and the non-editing task-text span.

**Interfaces:**
- Consumes: `onInteraction: (event: SyntheticEvent) => void` and the existing row drag handlers.
- Produces: Task text pointer events marked as handled and excluded from row drag sessions; existing `startTaskEdit` still owns opening the input.

- [ ] **Step 1: Update row drag start to ignore task text**

In `startPointerDrag`, expand the target guard so task text is treated like the existing button/input controls:

```tsx
    const target = event.target as HTMLElement
    if (target.closest('button,input,[data-project-task-text]')) return
```

Keep the existing left-button check before this guard and keep all other drag behavior unchanged.

- [ ] **Step 2: Mark the task text pointer sequence as handled**

Replace the non-editing task span with:

```tsx
                        <span
                          data-project-task-text
                          onPointerDown={onInteraction}
                          onPointerUp={onInteraction}
                          onDoubleClick={(event) => startTaskEdit(task, event)}
                        >
                          {task.text}
                        </span>
```

The child pointer handlers prevent tldraw from claiming the browser double-click sequence, while the parent guard prevents a task edit attempt from creating a drag session.

- [ ] **Step 3: Run the focused tests and verify they pass**

Run:

```bash
pnpm exec vitest run src/canvas/tldraw/ProjectCardBoard.test.tsx src/canvas/tldraw/projectCardUtils.test.tsx
```

Expected: Both project-card test files pass, including the new regression test and the existing save/cancel, title, add, delete, and drag tests.

### Task 3: Verify the repository change

**Files:**
- Inspect: `src/canvas/tldraw/ProjectCardBoard.tsx`
- Inspect: `src/canvas/tldraw/ProjectCardBoard.test.tsx`

- [ ] **Step 1: Run type-checking**

Run:

```bash
pnpm run lint:types
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 2: Run the production build**

Run:

```bash
pnpm run build
```

Expected: exit code 0 after TypeScript compilation and Vite bundling.

- [ ] **Step 3: Review the diff**

Run:

```bash
git diff --check
git diff -- src/canvas/tldraw/ProjectCardBoard.tsx src/canvas/tldraw/ProjectCardBoard.test.tsx
```

Expected: only the focused task-text event isolation and its regression test are changed; no unrelated formatting or behavior changes appear.

- [ ] **Step 4: Commit the implementation**

Run:

```bash
git add src/canvas/tldraw/ProjectCardBoard.tsx src/canvas/tldraw/ProjectCardBoard.test.tsx
git commit -m "fix: allow project card task editing"
```

Expected: a new implementation commit is created with the focused source and test changes.
