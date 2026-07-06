# Custom Component Background Color Design

## Goal

Allow Hermes custom canvas components to use a configurable background color from both the canvas API and the in-canvas edit UI.

The change applies to the existing custom tldraw shape types:

- `todo_block`
- `task_card`
- `link_card`

## Current Behavior

Custom components are rendered by `src/canvas/tldraw/customShapeUtils.tsx`.
Their visual defaults are CSS class backgrounds:

- Todo block: `#fff8cc`
- Task card: `#dbeafe`
- Link card: `#dcfce7`

Creation helpers in `src/canvas/tldraw/customShape.types.ts` generate typed props for each component. The canvas action schema accepts dimensions and content fields, but not style fields for these helper actions.

## Selected Approach

Add an optional `backgroundColor` prop to each custom component type.

This keeps background color with the shape data, so it persists naturally through tldraw records, appears in observations, and can be updated through the existing `update_shape` action by patching `props.backgroundColor`.

## API Behavior

The typed create actions accept an optional `backgroundColor` string:

- `create_todo_block`
- `create_task_card`
- `create_link_card`

When omitted, the current default colors remain unchanged.

When provided, the color is stored in shape props and rendered as the component background.

The generic `update_shape` action can update an existing custom component with:

```json
{
  "type": "update_shape",
  "shapeId": "shape:task_1",
  "patch": {
    "props": {
      "backgroundColor": "#fef3c7"
    }
  }
}
```

## UI Behavior

Each custom component edit view gets a background color control.

The control includes:

- A native color input for picking hex colors.
- A text input for editing or pasting the same value.

Both inputs update `props.backgroundColor` with the entered value.

The rendered shape applies `backgroundColor` inline when the prop is present. If the prop is absent, the existing CSS class color is used.

## Validation

The create action schemas validate `backgroundColor` as a non-empty string when present. The renderer does not try to parse CSS colors because browser style handling already ignores invalid color values, and preserving the string keeps the API flexible.

## Tests

Add or update tests to cover:

- Prop helper defaults still use existing colors by omission.
- Prop helpers preserve an explicit `backgroundColor`.
- Create action schema accepts `backgroundColor` for all custom component create actions.
- The tldraw executor persists `backgroundColor` into created shape props.
- Rendered custom components apply the configured background color.
- Edit controls update `props.backgroundColor`.

## Out of Scope

- Foreground/text color customization.
- Per-task row or per-field color styling.
- Global themes or named color palettes.
- Automatic contrast adjustment.
