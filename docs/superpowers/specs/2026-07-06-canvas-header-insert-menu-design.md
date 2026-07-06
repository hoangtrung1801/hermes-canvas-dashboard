# Canvas Floating Insert Menu Design

## Context

The canvas dashboard already supports three Hermes custom tldraw shapes:

- `todo_block`
- `task_card`
- `link_card`

Users can currently create these components through the Action Simulator JSON presets or through Hermes bridge actions. That path is useful for debugging and agent workflows, but it is too indirect for a person working in the dashboard. The dashboard should expose a direct insert control floating on the canvas.

## Goals

- Add an icon-first insert control that floats on the canvas dashboard.
- Let users insert the existing custom components: Todo Block, Task Card, and Link Card.
- Reuse the current tldraw custom shape types and existing `CanvasBridge` action execution path.
- Insert shapes near the current viewport center when the tldraw editor is mounted.
- Select the inserted shape after creation so the user can move, resize, or double-click edit it immediately.
- Keep the control available in both the standard dashboard canvas and the fullscreen canvas.
- Update observation and logs after insertion, matching existing simulator behavior.

## Non-Goals

- Do not add a component template editor.
- Do not add new custom shape types.
- Do not change the Hermes action protocol.
- Do not replace or remove the Action Simulator.
- Do not add a new UI framework or icon package for this change.

## Recommended Approach

Add a reusable `CanvasInsertMenu` React component and render it inside the standard and fullscreen canvas containers.

The visible floating control should be an icon button with an accessible label such as `Insert component`. Clicking it opens a compact menu with three icon-labeled options:

- Todo Block
- Task Card
- Link Card

Each option creates the corresponding custom shape through a `canvas.action` envelope handled by the existing `CanvasBridge`. This keeps direct user insertion behavior aligned with Hermes-created shapes and avoids a second shape creation pathway.

## UI Behavior

The floating control is icon-first. The icon button should sit at the bottom-right of the canvas area without resizing the canvas or header.

The menu opens on click and closes when:

- A component is inserted.
- The user clicks outside the menu.
- The user presses `Escape`.

The menu should use ordinary buttons for options so it remains keyboard reachable. Each option includes a small visual icon and a short text label. Icons can be inline CSS or Unicode-safe text symbols if no icon package exists in the repo.

The control should be disabled when the bridge, adapter, or editor is not mounted. A disabled title should explain that the canvas is still loading.

## Insert Defaults

Todo Block:

- title: `Todo`
- tasks: empty list
- size: default from `createTodoBlockProps`

Task Card:

- title: `New Task`
- body: empty string
- status: `todo`
- priority: `medium`
- size: default from `createTaskCardProps`

Link Card:

- title: `New Link`
- url: `https://example.com`
- description: empty string
- size: default from `createLinkCardProps`

## Placement

When an editor is mounted, compute the insertion point from the current viewport center in page coordinates. This makes insertion feel local to where the user is looking.

If viewport-to-page conversion is unavailable in tests or an older tldraw API path, fall back to a stable position such as `x: 160`, `y: 160`.

The component should generate unique ids using the current time and a short random suffix to avoid collisions with simulator presets and Hermes-created shapes.

## Data Flow

1. User opens the insert menu from the canvas header.
2. User selects Todo Block, Task Card, or Link Card.
3. `CanvasInsertMenu` builds one existing create action.
4. The action is wrapped in a `canvas.action` envelope using the current canvas id from the adapter.
5. The existing `CanvasBridge` handles the action.
6. On success, the component updates `lastObservation`, adds result and observation logs, and selects the created shape.
7. On failure, the component logs the error and leaves the menu closed.

## Error Handling

If the canvas bridge is not ready, the button remains disabled.

If insertion fails through the bridge, log a `canvas.error (Insert Component)` event. A lightweight browser alert is acceptable for parity with the current simulator behavior, but the primary diagnostic should be the existing log stream.

If shape selection fails because the editor is unavailable after insertion, keep the created shape and still update observation.

## Testing

Add focused React tests for:

- Rendering the insert icon control in the standard dashboard header.
- Opening the menu and showing the three custom component options.
- Clicking each option creates the expected custom shape type through the mounted tldraw editor.
- Created shapes appear in `lastObservation`.
- The insert control is also present in fullscreen canvas view.

Mocked tldraw editor tests can use the existing `CanvasSurface.test.tsx` pattern.

## Implementation Notes

- Keep `CanvasInsertMenu` small and colocated with canvas components.
- Prefer existing CSS class conventions in `src/styles.css`.
- Avoid nested cards or large decorative UI.
- Preserve existing header layout and do not change simulator or inspector behavior.
