# Project Task Board Card Design

**Status:** Approved revised design
**Date:** July 13, 2026
**Scope:** One four-column task board per Project card on the Hermes canvas

## Context

Hermes Canvas already has a dedicated `project_card` tldraw shape with project-level status, priority, due date, progress, and checklist actions. The required product model has changed: a project no longer has a status or other metadata. Instead, each Project card is a compact task board whose tasks move through Todo, Doing, Done, and Blocked columns.

The existing canvas action protocol, browser and headless executors, normalized observations, tldraw sync persistence, insert toolbar, and tidy-layout behavior remain the integration foundation.

## Goals

- Represent one project per canvas card.
- Keep the project itself to a title and its tasks.
- Show Todo, Doing, Done, and Blocked columns simultaneously.
- Allow tasks to be reordered within a column and moved between columns by dragging.
- Make task creation, text editing, and deletion direct and compact.
- Provide deterministic typed Hermes operations with browser/headless parity.
- Persist the task board as one tldraw shape record.

## Non-goals

This revision does not include project-level status, priority, due dates, progress, owners, tags, milestones, attachments, task descriptions, task due dates, dependencies, subtasks, recurring tasks, notifications, column customization, column reordering, drag autoscroll, or links to Todo Blocks. It does not preserve the meaning of legacy Project-card fields or checklist actions.

## Chosen Approach

Keep one dedicated `project_card` shape containing a flat ordered task list. Each task stores a stable ID, text, and status. Array order is the canonical ordering: filtering the array by one status yields that column's ordered tasks.

This approach was selected over four separate arrays because a move remains one remove-and-insert operation on a single collection and the agent contract addresses one stable task namespace. Independent tldraw task shapes were rejected because containment, grouped movement, resize behavior, and multi-record synchronization add complexity without improving the requested card experience.

The UI uses a small pointer-based drag layer backed by pure task-reordering functions. It does not add a drag-and-drop dependency.

## Architecture

The feature remains divided into bounded parts:

1. **Project task-board model:** types, validators, defaults, task ID allocation, dimensions, legacy-field cleanup, and pure task mutations.
2. **Project shape utility:** renders the header, board columns, task rows, editing controls, and drag feedback.
3. **Drag controller:** turns pointer movement into a destination status and insertion target, then calls the pure move operation on drop.
4. **Canvas action contract:** validates project creation, title updates, and task append/edit/move/remove operations.
5. **Browser and headless execution:** applies the same task operations to live or persisted shape records.
6. **Canvas integration and documentation:** retains schema registration, observations, insertion, tidy layout, and published workflow guidance.

Project state remains entirely in the tldraw shape record. There is no secondary store and no relationship to Todo shapes.

## Data Model

```ts
type ProjectTaskStatus = 'todo' | 'doing' | 'done' | 'blocked'

type ProjectTask = {
  id: string
  text: string
  status: ProjectTaskStatus
}

type ProjectTaskInput = {
  id?: string
  text: string
  status?: ProjectTaskStatus
}

type ProjectCardProps = {
  w: number
  h: number
  title: string
  tasks: ProjectTask[]
  color: string
}
```

The fixed column order is:

1. Todo (`todo`)
2. Doing (`doing`)
3. Done (`done`)
4. Blocked (`blocked`)

Task IDs are stable and unique within a Project card. Initial tasks without IDs receive deterministic IDs in `task_0001`, `task_0002`, and subsequent order, skipping reserved IDs. Direct UI creation uses the same next-unused-ID rule.

Stored titles and task text are trimmed and non-empty. A missing initial task status defaults to `todo`. The canonical task array preserves relative order within every status. Moving a task removes it from its old position and inserts it immediately before a requested task in the destination column, or after the last destination task when no insertion target is supplied.

Defaults are:

- Title: `New Project`
- Tasks: empty
- Dimensions: 960 by 480 canvas units
- Minimum dimensions: 760 by 320 canvas units
- Color: `light-violet`

The next shape-props migration removes legacy `status`, `priority`, `dueDate`, and `actions` fields and initializes `tasks` to an empty array. It intentionally does not translate old checklist data. Users should delete legacy Project cards before adopting this revision if they do not want empty migrated cards.

## Card Layout

The card uses three vertical regions:

1. A header containing the project icon and title
2. A four-column board that consumes the available body height
3. A footer containing one Plus button

All four equal-width columns remain visible at the default size and minimum width. The card does not use horizontal scrolling. Each column has a fixed header with its display name and current task count, followed by an independently scrollable task viewport. Column scrolling stops propagation so wheel input does not pan or zoom the canvas.

Task status is communicated by column placement. Done tasks use subdued text and surface styling. Blocked tasks use a warning accent. Todo and Doing use neutral and active treatments. The task layout remains legible when the card is resized to its minimum dimensions.

## Editing Interactions

Double-clicking the project title replaces it with an inline input. Double-clicking a task replaces that task label with an inline input. Enter trims and saves the draft, Escape restores the prior value, and blur trims and saves. If committed task text is empty, it becomes `New task`; if a committed project title is empty, it becomes `Untitled Project`.

The footer Plus button:

1. Generates the next unused task ID.
2. Appends `{ text: "New task", status: "todo" }` to the end of Todo.
3. Scrolls the Todo column to the new row.
4. Immediately opens the new task's text input with its text selected.

Escape during the new task's initial edit keeps the task with its default `New task` text. Each task row has a small delete button with an explicit accessible name. Deletion is immediate and removes only that task.

Interactive controls mark pointer events as handled so editing, adding, deleting, and scrolling do not move or deselect the canvas shape. Inputs and buttons have visible keyboard focus states.

## Drag-and-Drop Interaction

Dragging begins from a task row, excluding its input and delete button. A small movement threshold distinguishes dragging from clicks and double-clicks. Once active, the drag controller captures the pointer, marks the event handled for tldraw, and displays a lightweight task preview.

Column and task-row bounds determine the destination status and insertion slot. The UI highlights the destination column and draws an insertion marker before the target task. It supports drops:

- At the beginning, middle, or end of a populated column
- Into an empty column
- Within the source column to reorder
- Across columns to change status and order

The shape record changes only on a valid drop. Dropping outside the board, pressing Escape, or losing pointer capture cancels the drag without mutation. Moving a task to its existing effective position is a no-op. Drag autoscroll is intentionally not included in this revision.

## Canvas Actions

The old project status and checklist-action operations are removed from the public contract and replaced with task-board operations.

### `create_project_card`

Creates a card from an optional shape ID, required non-empty title, optional initial tasks, position, optional dimensions, and optional color. Initial tasks accept optional IDs and statuses. Omitted statuses default to `todo`.

### `update_project_card`

Updates the non-empty project title. No project-level status, priority, or due-date fields are accepted.

### `append_project_task`

Appends a task with a caller-supplied unique `taskId`, non-empty text, and optional status. The status defaults to `todo`.

### `update_project_task_text`

Replaces one task's text while retaining its ID, status, and position.

### `move_project_task`

Moves one task to a required destination `status`. An optional `beforeTaskId` identifies the destination task before which it is inserted. Omitting `beforeTaskId`, or sending it as `null`, appends the task to the destination column.

```json
{
  "type": "move_project_task",
  "shapeId": "shape:website",
  "taskId": "task_copy",
  "status": "doing",
  "beforeTaskId": "task_review"
}
```

The `beforeTaskId` task must exist, differ from the moving task, and already have the requested destination status. Validation is evaluated after logically removing the moving task from its old position.

### `remove_project_task`

Removes one task by stable task ID.

Existing generic shape movement, resizing, coloring, selection, and deletion operations continue to apply where already supported.

## Data Flow

### Human path

1. The user inserts or opens a Project card.
2. Text, add, delete, or drop interactions call a focused pure task mutation.
3. The shape utility writes the resulting properties through the mounted tldraw editor.
4. tldraw sync persists the single updated shape record and distributes it to connected views.

The insert toolbar creates a default 960 by 480 Project card near the viewport center and selects it. Tidy layout continues placing Project cards in the first component column and uses their wider dimensions when calculating later columns.

### Hermes path

1. Hermes sends a validated `canvas.action` envelope.
2. The gateway routes it to the browser bridge when available or the headless executor otherwise.
3. The selected executor loads the target Project card and applies the same pure task mutation rules.
4. Updated records persist to the current tldraw sync room.
5. Hermes receives one result per action followed by a normalized observation.

Project observations include the stable shape ID, type, position, dimensions, title, complete ordered task list, and color. Column membership and order can be reconstructed without additional stored state.

## Validation and Error Handling

- Project titles and task text must contain non-whitespace text after trimming.
- Task status must be `todo`, `doing`, `done`, or `blocked`.
- Initial and appended task IDs must be non-empty and unique within the card.
- Dimensions must be finite and positive, then normalize to the card minimums.
- Color must be a supported tldraw color.
- Project-specific mutations reject missing shapes and non-`project_card` shapes.
- Task mutations reject missing task IDs.
- Move operations reject a missing insertion target, a target in another status, or the moving task as its own target.
- A no-op reorder succeeds without rewriting unrelated task data.

Envelope validation failures use the existing request-level error behavior. Execution failures use action-level errors and do not stop later actions in a valid batch. A failing operation does not partially mutate its Project card. Browser and headless routes return equivalent results and observations.

## Testing Strategy

### Model and schema

- New defaults, fixed status enum, deterministic IDs, trimming, and dimension fitting
- Shape migration removes legacy fields and initializes an empty task list
- Duplicate IDs and invalid statuses are rejected
- Pure append, text update, removal, and move operations preserve unrelated data
- Beginning, middle, end, empty-column, same-column, and cross-column moves
- Invalid and no-op insertion targets

### Shape utility and drag controller

- Header, fixed column order, task counts, and empty columns
- Independent vertical overflow and wheel-event containment
- Done and Blocked visual treatments
- Plus creation, Todo placement, scroll into view, and immediate edit focus
- Title and task double-click editing, Enter, Escape, blur, and empty-text fallback
- Accessible delete controls and task deletion
- Drag activation threshold, preview, destination highlight, insertion marker, and cancellation
- Reordering within a column and movement across all four columns
- Canvas movement suppression during interactive operations
- Independent resizing and minimum dimensions

### Actions, persistence, and integration

- Validation and execution of all six Project operations
- Equivalent browser and headless success/error semantics
- Sequential batches continue after one action-level failure
- Persisted task boards reload through the shared tldraw schema
- Normalized observations retain complete ordered task data
- Insert toolbar creates and selects the wider default card
- Tidy layout accounts for the wider Project column
- Todo, Link, Note, selection, sync, and gateway regressions remain green
- Public API, README, PRD, and Canvas Dashboard skill describe the task-board contract

## Success Criteria

The revision is complete when a user can create a wide Project card, see Todo, Doing, Done, and Blocked simultaneously, add a Todo task from the single footer Plus button, edit its text immediately or later by double-clicking, reorder it within a column, drag it through every status, delete it, and reload without losing state or ordering.

Hermes must be able to create the same board and append, edit, move, reorder, and remove tasks with identical behavior whether the browser is open or closed. The previous project-level lifecycle and checklist-completion contract must no longer appear in the UI, action schema, observations for newly created cards, or published documentation.
