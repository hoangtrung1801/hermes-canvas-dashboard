# Manual Auto-Frame Size Design

**Status:** Approved design
**Date:** July 27, 2026
**Scope:** Preserve user-resized auto-frame dimensions while expanding only when content no longer fits

## Context

The auto-frame planner currently derives each managed frame's width and height from its current card grid on every reconciliation. This correctly fits newly added cards, but it also shrinks or overrides a frame after a user manually resizes it.

## Goals

- Preserve a user's manually selected auto-frame width and height.
- Expand a manually sized frame when newly added or resized content requires more space.
- Do not shrink a manually sized frame when cards are removed or become smaller.
- Persist the manual-size preference with the frame across reloads.
- Leave position, card layout, frame ownership, and API-only card eligibility unchanged.

## Chosen Approach

When the store observes a user-originated dimension change on a managed frame, add a persistent `hermesAutoFrameManualSize: true` metadata marker. Reconciliation writes made under its existing apply guard do not mark frames as manual.

The planner calculates the required grid dimensions as before. For an unmarked generated frame, the required dimensions remain authoritative. For a manually sized frame, planned dimensions are the maximum of the current frame dimensions and required content dimensions. This preserves the user's size while allowing expansion when content would otherwise exceed the frame.

The marker is separate from `hermesAutoFrame` ownership metadata, so frame kind parsing and generated-frame ownership remain unchanged.

## Data Flow

1. A user resizes a generated frame in tldraw.
2. The store listener detects a managed frame update whose width or height changed and marks its metadata as manually sized.
3. Debounced reconciliation reads the marker and preserves the current dimensions unless the planned card grid is larger.
4. Card deletion or shrinking produces a smaller required grid, but the frame keeps its current dimensions.
5. A later card addition that exceeds the current dimensions expands the frame and retains the marker.

## Testing

- Pure layout tests preserve a manually sized frame larger than the required grid.
- Pure layout tests expand a manually sized frame that is smaller than the required grid.
- Pure layout tests keep the manual dimensions after cards are removed.
- Reconciler subscription tests mark user-resized managed frames but ignore reconciler writes.
- Existing auto-frame, Tidy, persistence, direct-canvas, and Canvas API tests remain green.
