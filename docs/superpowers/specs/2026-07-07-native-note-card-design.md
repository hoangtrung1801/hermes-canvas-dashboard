# Native Note Card Design

## Context

Hermes Canvas currently supports custom tldraw components for todo blocks, task cards, and link cards. Those components use custom shape types, typed Hermes bridge actions, the floating insert menu, and tldraw sync persistence.

Users also need a lightweight place to capture random notes and ideas. This should feel like a native tldraw sticky note rather than another heavy custom widget. The note should include a separate title, a single short tag, and freeform content. Hermes must be able to create these notes through the bridge API.

## Goals

- Add a typed Hermes bridge action for creating note cards.
- Reuse tldraw's built-in `note` shape instead of creating a new custom note shape.
- Keep the Hermes API simple by accepting separate `title`, `tag`, and `content` fields.
- Render the title and tag as bold text at the top of the note.
- Preserve content line breaks in the generated note rich text.
- Add the note option to the floating insert menu in standard and fullscreen canvas views.
- Keep note editing, color, size, sync, and persistence behavior native to tldraw.

## Non-Goals

- Do not create a custom `note_card` tldraw shape type.
- Do not persist `title`, `tag`, and `content` as separate custom shape props.
- Do not build a custom note editor UI.
- Do not add multiple tags, tag filtering, search, or an inbox/list workflow.
- Do not replace existing Todo, Task, or Link custom components.

## Selected Approach

Add a typed action named `create_note_card`. The action executor translates that friendly Hermes API into a standard tldraw `note` shape.

This keeps the canvas-native behavior that users expect from tldraw notes while avoiding a brittle external API that requires callers to construct `props.richText` manually.

## Action Shape

The new action accepts:

```ts
{
  type: 'create_note_card'
  id?: string
  x: number
  y: number
  title: string
  tag: string
  content?: string
  color?: string
  size?: 's' | 'm' | 'l' | 'xl'
}
```

Validation rules:

- `title` is required and must be non-empty.
- `tag` is required and must be non-empty.
- `content` is optional and may be empty.
- `color`, when provided, must be one of tldraw's supported default color style values.
- `size`, when provided, must be one of tldraw's supported note size values.

## Generated Note Props

The executor creates a shape with `type: 'note'` and standard tldraw note props.

Default props:

- `color`: `yellow`
- `labelColor`: `black`
- `size`: `m`
- `font`: `draw`
- `fontSizeAdjustment`: `null`
- `align`: `start`
- `verticalAlign`: `start`
- `growY`: `0`
- `url`: empty string
- `scale`: `1`
- `textLastEditedBy`: `null`

The generated rich text contains:

1. First paragraph: bold title.
2. Second paragraph: bold tag.
3. Remaining paragraphs: normal content, split by line breaks.

For empty content, only the title and tag paragraphs are created.

## UI Behavior

The existing `CanvasInsertMenu` gets a fourth option: `Note Card`.

Selecting `Note Card` creates a native tldraw note through the same `CanvasBridge` action envelope used by Todo Block, Task Card, and Link Card insertion. The inserted note is placed near the current viewport center and selected immediately.

Menu defaults:

- title: `New Note`
- tag: `Idea`
- content: empty string

Users edit the note with tldraw's built-in note editing behavior. Users change visual style with tldraw's existing style toolbar.

## Data Flow

1. Hermes sends a `canvas.action` envelope containing `create_note_card`, or a user selects `Note Card` from the insert menu.
2. The action schema validates the input.
3. The executor converts `title`, `tag`, and `content` into tldraw rich text.
4. The executor creates a standard `note` shape in the mounted editor or the headless tldraw target.
5. The bridge returns the usual `canvas.result` and `canvas.observation` envelopes.
6. Observations show the note as `type: 'note'` with `props.richText`.

## Error Handling

- Invalid action payloads are rejected by the existing action schema path.
- Unknown style values fail validation before shape creation.
- Insert-menu failures are logged as `canvas.error (Insert Component)` and surfaced with the existing lightweight alert behavior.
- If selection fails because no editor is mounted, the note remains created and the observation still updates.

## Testing

Add focused tests for:

- `canvasActionSchema` accepts valid `create_note_card` payloads.
- `canvasActionSchema` rejects empty `title` and `tag`.
- The tldraw executor creates a `note` shape from `create_note_card`.
- Generated rich text contains bold title and bold tag paragraphs.
- Content line breaks become separate normal paragraphs.
- Mounted editor creation persists the note as `type: 'note'`.
- The floating insert menu shows `Note Card`.
- Clicking `Note Card` creates and selects one native note.
- `CANVAS_API.md` documents the new action.

## Implementation Notes

- Keep rich-text construction in a small helper with tests.
- Reuse the existing `createShape` executor path once note props are built.
- Do not add the note to `hermesShapeUtils`; built-in tldraw shape utils already include `note`.
- Preserve existing insert menu behavior for Todo Block, Task Card, and Link Card.
