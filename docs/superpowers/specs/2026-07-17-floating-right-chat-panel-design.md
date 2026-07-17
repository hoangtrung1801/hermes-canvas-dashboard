# Floating Right Chat Panel Design

**Date:** 2026-07-17
**Status:** Approved design
**Scope:** Reposition the existing canvas assistant as an inset floating overlay on the right side of the fullscreen canvas

## Summary

The canvas assistant will change from a flex sibling that reduces the tldraw viewport to an inset floating panel over the canvas's right edge. Opening or closing chat must not resize the canvas, move shapes, or change the canvas camera. Chat behavior and data flow remain unchanged.

## Goals

- Match the annotated reference: a narrow, full-height floating panel on the right.
- Keep the canvas at the full workspace width underneath the panel.
- Preserve conversation selection, streaming, cancellation, errors, and collapse behavior.
- Keep the panel usable at desktop, tablet, and mobile viewport sizes.
- Preserve keyboard focus indicators and minimum touch target sizes.

## Non-goals

- Draggable or resizable chat.
- Changing the chat theme or reorganizing chat content.
- Changing the Python agent, API, persistence, or tldraw behavior.
- Moving chat into the debug dashboard.

## Layout

The fullscreen workspace becomes the positioning context. Its canvas container continues to fill the entire workspace. The chat sidebar is removed from flex sizing and positioned over the canvas with a higher stacking level than tldraw.

At desktop widths above 760px, the expanded panel uses:

- `position: absolute` within the fullscreen workspace.
- Top, right, and bottom insets of 14px.
- Width `clamp(300px, 28vw, 360px)`.
- Height derived from the top and bottom insets.
- Rounded outer corners, a subtle border, and an elevated shadow.
- Existing internal overflow behavior so only the message timeline scrolls.

The canvas remains `width: 100%` and is not given padding or margin for chat. Overlaying right-side tldraw controls is intentional while chat is open and matches the supplied reference.

## Collapse and responsive behavior

On desktop, collapsing the assistant replaces the panel with the existing compact AI control positioned as a floating button near the right edge. Expanding restores the inset panel without changing canvas dimensions.

At 760px and below, the current mobile drawer behavior remains: the expanded assistant occupies the viewport height and uses `min(92vw, 360px)`. The collapsed control remains a floating button above the bottom safe area. Mobile text inputs retain 16px text to avoid browser zoom.

## Components and data flow

No component or store boundary changes are required:

- `App` continues to render `CanvasSurface` and `ChatSidebar` in the fullscreen workspace.
- `ChatSidebar` continues to own only local collapsed and composer state.
- `useChatStore`, the streaming API, conversations, tool activity, and errors are unchanged.
- CSS alone establishes the new overlay geometry and visual container treatment.

## Accessibility

- The sidebar remains an `aside` labelled “Canvas assistant.”
- Collapse and expand controls keep their current accessible names.
- Focus-visible outlines and 44px interactive targets remain intact.
- Reduced-motion behavior remains unchanged.

## Testing and verification

- Add a CSS regression test proving the desktop sidebar is absolutely positioned with right/top/bottom insets and a responsive clamped width.
- Add a regression proving the fullscreen canvas remains full width and is not offset for chat.
- Keep the existing collapse/expand component test.
- Run the full Vitest suite, TypeScript production build, Python tests, and Ruff checks.
- Verify desktop expanded, desktop collapsed, and mobile layouts in the local browser. Confirm the canvas does not resize when the assistant toggles.

## Acceptance criteria

- The assistant appears as a rounded floating panel on the right side of the fullscreen canvas.
- Opening and closing the assistant does not alter the canvas container dimensions.
- Expanded chat fits within the viewport without clipping its header or composer.
- Collapse and expand remain keyboard accessible.
- Mobile drawer behavior remains usable and unchanged in intent.
- No chat, agent, canvas-action, or debug-dashboard regression is introduced.
