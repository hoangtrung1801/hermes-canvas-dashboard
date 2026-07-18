# Copy component ID from the canvas context menu

**Status:** Approved design
**Date:** July 18, 2026
**Scope:** Add a `Copy ID` action to the existing tldraw right-click menu

## Problem

Canvas components have stable tldraw shape IDs, but users currently need to inspect the debug Inspector or another data surface to retrieve an ID. The canvas right-click menu is the natural place for a quick copy action.

## Goal

Let a user right-click a selected canvas shape, choose `Copy ID`, and receive the exact shape ID in the system clipboard. The action applies to custom Hermes components and native tldraw shapes while preserving all existing tldraw context-menu actions.

## Non-goals

- Do not change shape records, IDs, persistence, or the canvas action protocol.
- Do not add a new component-specific menu to each custom shape.
- Do not replace or reorder tldraw's existing context-menu actions beyond appending the new action group.
- Do not add a new visible ID field to component renderers or the Inspector.

## Chosen approach

Wrap tldraw's public `DefaultContextMenu` component and pass through its default content, then append a project-owned `Copy ID` menu item. This uses the installed tldraw 5.2.2 component extension API, keeps built-in Cut/Copy/Delete/Arrange actions intact, and centralizes the behavior for all shapes.

The wrapper reads the current selection through `editor.getOnlySelectedShape()`. The item is rendered only when exactly one shape is selected, which prevents ambiguity when the canvas has no selection or multiple selected shapes. The copied value is the shape's exact `id` string, including its tldraw prefix.

## Components and data flow

Add a focused `CanvasContextMenu` component under `src/canvas/components/`. It will:

1. Receive tldraw's `TLUiContextMenuProps`.
2. Render `<DefaultContextMenu {...props}>` with the existing `DefaultContextMenuContent` and a trailing `TldrawUiMenuGroup` containing the new item.
3. Use `useEditor()` and a reactive `useValue()` subscription to the selected-shape state so the item visibility is correct when the menu opens.
4. On selection, call `editor.getContainerWindow().navigator.clipboard.writeText(shape.id)`.
5. On success, add a short success toast through tldraw's `useToasts()` context.
6. On rejection or unavailable clipboard access, add an error toast and leave the canvas unchanged.

Pass the wrapper as the `ContextMenu` entry in the existing `<Tldraw components={...} />` configuration. The components object will be defined or memoized in `CanvasSurface` so tldraw does not receive a new component map on every render.

## User interaction

- Right-clicking a single selected shape exposes `Copy ID` in the context menu.
- Choosing `Copy ID` copies the exact shape ID and closes the menu using tldraw's normal menu-item behavior.
- The success toast says `Component ID copied` and includes the ID as its description.
- If the browser denies clipboard access, the error toast says `Could not copy component ID`; no fallback mutation or prompt is shown.
- Keyboard navigation uses tldraw's native menu item semantics and focus behavior.

## Accessibility and visual behavior

Use tldraw's public `TldrawUiMenuItem` primitive and the existing menu group so the new action inherits the current menu styling, keyboard behavior, focus treatment, and touch/long-press behavior. Use the existing `clipboard-copy` icon from tldraw's icon set. The label is provided through a project translation override so it remains a normal visible menu label rather than an untranslated action key.

## Testing strategy

Add focused component tests for the custom menu wrapper:

- `Copy ID` appears when one shape is selected while the default context-menu content remains present.
- Selecting the item writes the exact selected shape ID to `navigator.clipboard.writeText` and emits the success toast.
- The item is absent when no shape or multiple shapes are selected.
- Clipboard rejection emits the error toast without throwing out of the menu interaction.

Run the focused test file, the full Vitest suite, type-checking, the production build, and `git diff --check` before implementation is reported complete.

## Definition of done

A user can right-click any single component or shape on the canvas, choose `Copy ID`, paste the exact tldraw ID elsewhere, and receive clear success or failure feedback. Existing tldraw context-menu actions and all current canvas behavior remain available.
