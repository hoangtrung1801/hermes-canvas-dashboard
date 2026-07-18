# Todo block task deletion and vertical resizing design

## Problem

Todo Blocks can be edited inline, but their task rows do not provide a way to remove a task. Todo Block shapes also enforce a 16:9 aspect ratio, so users cannot make a card taller without widening it.

## Goal

While a Todo Block is in edit mode, let users delete individual tasks with an accessible X control and resize the shape vertically without changing its width.

## Design

Add a delete button to each task row in the Todo Block edit renderer. The button is visible only in edit mode, marks pointer events as handled by tldraw, and updates the shape with the current task list minus the clicked task. Existing checkbox, inline text editing, add-task, and view-mode behavior remain unchanged.

Make the shared Hermes card shape utility report an unlocked aspect ratio. Keep the existing minimum width and height constraints, but update dimension normalization so resize results preserve independent width and height instead of restoring 16:9. The Todo Block migration should retain valid existing dimensions while no longer converting them to the aspect ratio on load.

## Testing

Add a Todo Block component test that renders edit mode, clicks a task's delete button, and verifies the persisted task list excludes only that task. Add shape utility/type tests that verify aspect-ratio locking is disabled and that a resize with a taller height returns the requested independent dimensions. Run focused tests, the full suite, type-checking, the production build, and `git diff --check`.

## Alternatives considered

1. Add a separate vertical-only resize handle. Rejected because tldraw already supplies shape resize handles and the Project Card uses independent resizing.
2. Keep the aspect ratio and add a height-only control. Rejected because it adds a second resizing model and does not make normal shape resizing vertical.

