# Auto-Frame Card Groups Design

**Status:** Approved design
**Date:** July 15, 2026
**Scope:** Automatically group supported canvas cards into managed native tldraw frames

## Context

Hermes Canvas supports Project, Todo, Note, and Link cards. The existing bottom-right Tidy action arranges these cards into type-based columns, but a busy canvas still has no durable visual containers. Users must identify a card's kind from its appearance, and moving an apparent group does not move its cards together.

The requested behavior is to create one frame for every populated card kind, place matching cards inside it, and keep the frame and its layout synchronized as the canvas changes. The behavior must run continuously and when the user explicitly invokes Tidy.

## Goals

- Create one native tldraw frame for each populated supported card kind.
- Parent matching cards to their frame so the frame and cards move together.
- Arrange cards in a compact, deterministic layout inside each frame.
- Resize managed frames to wrap their current cards.
- Reconcile automatically after relevant canvas changes.
- Let the existing Tidy action reconcile immediately and also repack managed frames.
- Remove a managed frame when its last card is removed.
- Preserve user-created frames and the cards deliberately placed inside them.

## Non-Goals

This feature does not group arrows, drawings, text, images, files, embeds, or unsupported geo shapes. It does not infer semantic topics within one card kind, support custom grouping rules, expose frame layout settings, let users rename generated frame categories, or convert manual frames into generated frames. It does not introduce a new custom container shape.

## Chosen Approach

Use native tldraw `frame` shapes as managed containers. Each generated frame carries Hermes metadata identifying it as an auto-frame and recording its card kind. Matching cards are reparented to that frame and receive frame-local coordinates.

This was selected over decorative background rectangles because native frames provide real containment and grouped movement. A new collection shape was rejected because it would duplicate tldraw container behavior and require a larger persistence and interaction redesign.

## Managed Card Kinds

The fixed kind order and frame titles are:

1. `project` — Projects
2. `todo` — Todos
3. `note` — Notes
4. `link` — Links

Classification follows the existing Tidy rules:

- `project_card` shapes are Projects.
- `todo_block` shapes are Todos.
- `geo` shapes whose `geo` prop is `rectangle` are Notes.
- `link_card` shapes are Links.

Other shapes are unsupported and remain unchanged.

## Ownership Boundary

The auto-frame system manages only:

- Supported cards whose parent is the current page
- Supported cards already parented to a Hermes-generated auto-frame
- Frames carrying valid Hermes auto-frame metadata

A supported card parented to any user-created frame is excluded. The reconciler never reparents it, moves it, resizes its frame, or otherwise changes that manual grouping. This rule is the deliberate opt-out mechanism: moving a card into a manual frame removes it from auto-frame management.

Generated frames use deterministic IDs per page and kind where possible, plus metadata rather than names or colors for ownership checks. A manual frame with the title `Projects`, `Todos`, `Notes`, or `Links` is still manual and remains untouched.

## Architecture

The feature is divided into three bounded units.

### Pure layout planner

The planner accepts a normalized snapshot of the current page's supported cards and frames. It returns a declarative plan containing:

- Generated frames to create
- Existing generated frames to update
- Card parent and local-position updates
- Duplicate or empty generated frames to delete
- Optional generated-frame positions for explicit Tidy repacking

The planner does not read or mutate the editor. It is deterministic and idempotent, which makes geometry and edge cases independently testable.

### Editor reconciler

The reconciler translates tldraw records into planner inputs and applies one plan as a single editor transaction. It uses a re-entrancy guard and compares desired values with current records before writing, so its own updates do not create a reconciliation loop and a settled canvas produces no additional changes.

It keeps the direct action adapter and normalized observation synchronized after applied changes, following the existing Tidy integration.

### Lifecycle integration

A canvas-level controller runs reconciliation once after the editor is mounted and listens for relevant shape-record changes. Create, delete, parent, position, or dimension changes involving supported cards or managed frames schedule a debounced continuous reconciliation. Camera, selection, instance-state, and unrelated-shape changes do not.

The existing Tidy button invokes the same reconciler immediately with frame repacking enabled. It does not maintain a separate layout implementation.

## Inner-Frame Layout

Cards are ordered by their current visual position: top-to-bottom, then left-to-right, then stable shape ID. This order is captured before reparenting and remains deterministic when coordinates tie.

Projects use one column because Project task boards are substantially wider than the other cards. Todos, Notes, and Links use one column for a single card and two columns for two or more cards. Cards fill rows from left to right.

Each grid column is as wide as the widest card assigned to it, and each row is as tall as the tallest card assigned to it. Consistent header clearance, frame padding, horizontal gap, and vertical gap separate the frame label and cards. A card's frame-local position is derived from the accumulated column widths and row heights. The frame width and height are then calculated from the exact grid bounds plus padding.

Missing, non-finite, or non-positive card dimensions use safe card-size fallbacks for planning. The planner does not modify a card's stored dimensions merely because a fallback was needed.

## Outer-Frame Layout

Continuous reconciliation preserves the page position of every existing generated frame. Moving a generated frame therefore moves its children normally and its new origin remains stable. Adding, deleting, or resizing a contained card only reflows that frame's children and updates its bounds.

A newly required frame starts at the visual top-left origin of its matching page-level cards. If that would overlap an existing generated frame, it is placed at the next available position in kind order.

Explicit Tidy reconciliation repacks all generated frames in rows, in the fixed Projects, Todos, Notes, Links order. Packing starts at the top-left origin of managed content, applies a consistent outer gap, and wraps before a fixed maximum row width in canvas units. The maximum is a deterministic layout constant rather than a screen-pixel or zoom-dependent value.

The explicit frame-position updates remain undoable. Continuous reconciliation does not independently reposition existing frames, so undoing a Tidy repack remains stable.

## Continuous Behavior

The controller debounces bursts of relevant changes into one reconciliation. Its behavior is:

- Creating a supported page-level card creates or updates its matching frame and places it in the canonical grid.
- Moving a managed card inside its generated frame is normalized back to the canonical grid.
- Resizing a managed card reflows siblings and resizes the frame.
- Deleting a card reflows the remaining cards.
- Deleting the last card of a kind removes that generated frame.
- Deleting a non-empty generated frame causes it to be recreated around its still-matching page-level cards.
- Moving a card into a manual frame opts it out and reflows its former generated frame.
- Moving a generated frame preserves its new page position.

Continuous housekeeping is applied without a separate undo entry. User content operations remain undoable, and reconciliation follows the resulting content state. Explicit Tidy uses a named history stopping point for its generated-frame position changes.

## Duplicate and Invalid State Recovery

If multiple valid generated frames claim the same kind, the planner chooses the deterministic canonical frame, reparents managed cards to it, and deletes only the extra generated frames. It never deletes an untagged manual frame.

Generated frames with unknown kind metadata are ignored instead of treated as owned. Unsupported shapes parented to a generated frame are not moved or deleted. Their presence does not prevent supported cards from being laid out, but the frame bounds must include all remaining children so reconciliation does not clip or cover unsupported content.

If no supported cards remain for a valid generated frame and it contains no unsupported children, the frame is deleted. If unsupported children remain, Hermes removes its ownership metadata and leaves it as a manual frame rather than deleting user content.

## Error Handling

- Planner inputs are normalized before geometry calculations.
- Unsupported records are skipped without aborting other kinds.
- Invalid generated metadata is treated as unowned.
- An apply failure leaves the adapter observation unchanged and is logged through the existing canvas log path.
- Reconciliation never deletes or mutates user-created frames based on title, color, or position.
- Repeated reconciliation of settled state is a no-op.

## Testing Strategy

### Pure planner

- Classifies all four supported kinds and ignores unsupported shapes.
- Excludes cards inside manual frames.
- Creates exactly one frame for each populated kind.
- Uses one Project column and up to two columns for other kinds.
- Preserves visual order with stable ID tie-breaking.
- Calculates card-local positions, padding, gaps, and exact frame bounds.
- Uses safe dimension fallbacks without rewriting card size.
- Removes empty generated frames.
- Recovers duplicate generated frames without touching manual frames.
- Preserves unsupported children by demoting otherwise-empty generated frames.
- Produces no updates for an already reconciled snapshot.
- Preserves existing frame origins in continuous mode.
- Packs generated frames in ordered rows in explicit Tidy mode.

### Reconciler and lifecycle

- Creates, updates, reparents, and deletes records in one guarded apply cycle.
- Does not respond recursively to its own editor writes.
- Debounces relevant store changes.
- Ignores camera, selection, and unrelated-shape changes.
- Reconciles once on mount.
- Synchronizes the action adapter and normalized observation after changes.
- Logs apply failures without publishing stale observation changes.

### UI and regressions

- The existing Tidy control triggers immediate reconciliation and frame repacking.
- Tidy reports the number of arranged cards and frames.
- The Tidy action is disabled until the editor and adapter are ready.
- Existing card creation, editing, drag, resize, selection, sync, action execution, and gateway tests remain green.

## Success Criteria

The feature is complete when a busy canvas automatically contains one clearly titled native frame for every populated supported card kind, every managed card is a child of the correct frame in a compact stable layout, and each frame wraps its contents. Creating, deleting, resizing, or regrouping cards updates this structure without manual cleanup or update loops.

The Tidy action must immediately produce the same valid grouping and additionally pack all generated frames into clean rows. Generated frames must move with their cards, disappear when truly empty, recover from accidental deletion while cards remain, and never take ownership of or mutate user-created frames.
