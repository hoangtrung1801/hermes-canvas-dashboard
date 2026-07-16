# Project card task editing design

## Problem

Existing project-card task text cannot reliably enter inline edit mode in the live tldraw canvas. Task rows are draggable, and their pointer handlers can cause tldraw to claim the pointer sequence before the task text's native double-click handler runs. The isolated component tests currently exercise a synthetic `doubleClick`, but do not cover the real pointer sequence through the draggable row.

## Goal

Allow users to double-click a task's text and edit it inline in the canvas while preserving task-row drag and drop behavior.

## Design

Treat the task text as a small interaction island inside the draggable task row:

- Mark task-text pointer down/up events as handled by tldraw so the canvas does not interfere with the browser double-click sequence.
- Make the row drag handler ignore pointer-down events originating from the task-text island, so editing does not start a drag session.
- Keep the existing editing semantics: double-click opens the input, Enter or blur saves the trimmed text, and Escape cancels.
- Leave task deletion, add-task behavior, status movement, and title editing unchanged.

The change stays within `ProjectCardBoard`; the shape adapter continues to persist task updates through `editor.updateShape`.

## Testing

Add a regression test at the board component level that sends the pointer sequence used by a real double-click to task text and verifies that the task input appears. Retain the existing save/cancel test to cover the edit lifecycle. Run the focused project-card tests, type-check, and the production build.

## Alternatives considered

1. Make the whole task row enter edit mode. Rejected because it conflicts with dragging.
2. Enable tldraw shape editing for the project card. Rejected because the card already owns custom inline title/task editors and tldraw shape editing would broaden the interaction model unnecessarily.
