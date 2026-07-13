# Project Card Design

**Status:** Approved design
**Date:** July 13, 2026
**Scope:** One self-contained Project card per project on the Hermes canvas

## Context

Hermes Canvas already provides custom Todo and Link shapes, native Note cards, a typed canvas action protocol, browser and headless execution, normalized observations, tldraw sync persistence, and a floating insert menu. The new component should help a user scan multiple projects and act on each project's immediate work without turning the canvas into a full project-management system.

## Goals

- Represent one project per canvas card.
- Make project status, priority, due date, action progress, and immediate actions easy to scan.
- Allow direct human editing and typed Hermes mutations.
- Preserve equivalent browser-backed and headless behavior.
- Keep the card compact even when it contains more actions than it can show at once.
- Follow the existing custom-shape, action-validation, observation, and persistence patterns.

## Non-goals

The first version does not include linked Todo Blocks, action reordering, project dependencies, owners, tags, milestones, attachments, recurring actions, kanban views, notifications, a portfolio container, or automatic status transitions.

## Chosen Approach

Add a dedicated `project_card` tldraw shape with project-specific properties and typed actions. The underscore naming follows the existing `todo_block` and `link_card` shape identifiers. Checklist implementation patterns may be shared with Todo Blocks, but the shapes retain separate data contracts and product meanings.

This was selected over extending Todo Blocks because a project has distinct metadata and lifecycle semantics. A generic schema-driven card framework was rejected because no second use case currently justifies that abstraction.

## Architecture

The feature consists of five bounded parts:

1. **Project shape model:** defines property types, defaults, dimension constraints, validation, and migrations.
2. **Project shape utility:** renders normal and edit modes and applies direct human edits through the tldraw editor.
3. **Canvas action contract:** defines validated operations for creating and mutating Project cards.
4. **Browser and headless executors:** implement the same operations against live editor state or persisted room records.
5. **Canvas integration:** registers the shape, exposes it through observations, and adds it to the insert toolbar.

Project state remains entirely in the tldraw shape record. There is no separate project store or relationship to a Todo shape. Existing tldraw sync and SQLite room persistence remain the source of truth.

## Data Model

A Project card has these properties:

```ts
type ProjectStatus = 'planned' | 'active' | 'blocked' | 'done'
type ProjectPriority = 'low' | 'medium' | 'high'

type ProjectAction = {
  id: string
  text: string
  done: boolean
}

type ProjectCardProps = {
  w: number
  h: number
  title: string
  status: ProjectStatus
  priority: ProjectPriority
  dueDate?: string
  actions: ProjectAction[]
  color: string // a supported tldraw color value
}
```

`dueDate`, when present, is an ISO calendar date in `YYYY-MM-DD` form. It intentionally has no time or timezone semantics.

Each action ID is stable and unique within its Project card. Actions retain insertion order. The list has no five-item data limit: the UI shows roughly five rows at the default card size and scrolls for additional items.

Progress is derived rather than stored:

- With one or more actions, progress is `completed actions / total actions`.
- With no actions, progress is 0% and the count is `0/0`.

Derived progress prevents stored percentage and checklist state from becoming inconsistent. Project status remains independent and changes only through an explicit human or Hermes edit. Completing every current action does not automatically mark the project Done.

Defaults are:

- Status: Planned
- Priority: Medium
- Due date: absent
- Actions: empty
- Dimensions: 360 by 320 canvas units
- Minimum dimensions: 320 by 240 canvas units
- Color: `light-violet`, using the standard Hermes pastel card treatment

The Project shape receives its own migration sequence so future property changes can be applied without affecting Todo or Link records.

## Card Layout and Interaction

### Normal mode

The card is arranged vertically:

1. Header with project icon, title, and status badge
2. Metadata row with priority and optional due date
3. Progress bar with completed/total count
4. Scrollable action viewport

Completed actions show a checked control and subdued, struck-through text. Action checkboxes remain interactive in normal mode.

A due date earlier than the user's current local calendar date receives an overdue warning treatment unless status is Done. A due date equal to today is not overdue.

The card does not grow when actions are appended. The action viewport scrolls instead. Manual canvas resizing remains available down to 320 by 240 canvas units. Width and height may be adjusted independently; resizing changes the space available to the action viewport without changing project data. Wheel events over the action viewport scroll its content instead of panning or zooming the canvas.

### Focused edit mode

Double-clicking the card enters edit mode. In edit mode:

- Title and action text use inline text inputs.
- Status and priority use fixed-value selectors.
- Due date uses a date input and can be cleared.
- Actions can be appended or removed.
- Checkboxes continue to update completion state.

Clicking outside the card or pressing Escape exits edit mode. Canvas pointer events originating from interactive controls are marked as handled so field editing does not accidentally move or deselect the shape. All controls receive explicit accessible names and visible keyboard focus styles.

## Canvas Actions

The typed action protocol adds these operations:

### `create_project_card`

Creates a card from:

- Optional shape ID
- Required non-empty title
- Optional status, priority, due date, and initial actions
- Position
- Optional dimensions and color

Omitted project fields use the defaults defined above.

Each initial action contains non-empty text, an optional ID, and an optional completion value. All caller-supplied IDs are reserved first; omitted IDs are then generated deterministically as `action_0001`, `action_0002`, and so on, skipping reserved or previously generated IDs. Stored titles and action text are trimmed.

### `update_project_card`

Updates one or more project metadata fields: title, status, priority, or due date. At least one field is required. `dueDate: null` explicitly removes the date; an omitted field remains unchanged.

### `append_project_action`

Appends a new action with a caller-supplied unique action ID, non-empty text, and an optional completion value that defaults to false. Direct UI insertion generates the next unused `action_NNNN` ID locally.

### `update_project_action_text`

Replaces the text of one existing action while retaining its ID, order, and completion state.

### `set_project_action_done`

Sets the completion state of one existing action.

### `remove_project_action`

Removes one existing action by ID.

Action reordering is not part of this version. Existing generic shape movement, resizing, coloring, and deletion operations continue to apply where supported by the current protocol.

## Data Flow

### Human path

1. The user inserts a Project card or edits an existing one.
2. The Project shape utility applies property changes through the mounted tldraw editor.
3. tldraw sync persists the updated shape record to the current room.
4. Other connected views receive the normal sync update.

The insert toolbar creates a default Project card near the viewport center and selects it, matching existing insert behavior.

### Hermes path

1. Hermes sends a validated `canvas.action` envelope.
2. The gateway routes it to the browser bridge when available or to the headless executor otherwise.
3. The selected executor applies Project operations sequentially using the same domain rules.
4. Updated records persist to the same sync room.
5. Hermes receives one result per requested action followed by a normalized observation.

Project observations include the stable shape ID, type, position, dimensions, and complete Project properties needed to inspect status, priority, due date, progress inputs, and individual actions. Progress may be computed by consumers from the action list and is not persisted as an additional property.

## Validation and Error Handling

- Titles and action text must contain at least one non-whitespace character after trimming.
- Status must be Planned, Active, Blocked, or Done using the protocol's lowercase enum values.
- Priority must be Low, Medium, or High using the protocol's lowercase enum values.
- Due dates must be real calendar dates formatted exactly as `YYYY-MM-DD`.
- Initial and appended action IDs must be non-empty.
- Action IDs must be unique within a Project card.
- Dimensions must be positive and are normalized to the Project card's UI minimums.
- Color, when supplied, must be one of the tldraw colors supported by the existing custom-card schema.
- Project-specific mutations reject missing shapes and shapes whose type is not `project_card`.
- Action-specific mutations reject unknown action IDs.

Validation failures use the existing request-level error behavior when an envelope is invalid. Execution failures use action-level errors and do not discard the result context for the remaining actions in a valid batch. Neither route partially mutates a single failing operation.

The browser and headless implementations must return equivalent success and error semantics. Hermes clients should read before mutation and verify the final observation, following the existing API guidance.

## Testing Strategy

### Model and schema tests

- Defaults and property creation
- Minimum dimension fitting
- Migration compatibility
- Progress for empty, partial, and complete action lists
- Exact status and priority enums
- Valid, invalid, and impossible calendar dates
- Trimming and non-empty constraints
- Duplicate action ID rejection

### Shape utility tests

- Normal-mode header, metadata, progress, and actions
- Approximately five visible rows at default size with overflow scrolling
- Checkbox mutation in normal and edit modes
- Double-click entry and Escape/blur exit behavior
- Editing each metadata field and action text
- Appending and removing actions
- Overdue, due-today, future, and Done-state date treatment
- Accessible control names and handled pointer events
- Manual resize behavior and minimum dimensions

### Executor and observation tests

- Every Project operation through the browser executor
- Equivalent operations through the headless executor
- Sequential batches with successful and failed items
- Wrong shape types, missing shapes, and missing action IDs
- Persisted Project records loading through the shared tldraw schema
- Complete Project data in normalized observations

### Integration and regression tests

- Insert toolbar creation and selection
- Browser/headless parity against the shared action contract
- Existing Todo, Link, and Note behavior remains unchanged
- Type checking, the full test suite, and the production build pass

## Success Criteria

The feature is complete when a user can place multiple Project cards on the canvas and quickly see each project's status, priority, due date, automatic action progress, and immediate actions; directly edit those fields through a focused mode; check actions without entering edit mode; and scroll longer action lists without cards expanding. Hermes must be able to create and mutate the same cards with equivalent results whether or not the browser is connected, and all state must persist through the existing tldraw sync room.
