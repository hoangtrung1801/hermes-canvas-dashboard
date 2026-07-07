# Note Card Rectangle Design

## Goal

Keep the public `create_note_card` action, but stop creating tldraw native `note` shapes. New note-card actions should create a built-in tldraw `geo` rectangle with text inside.

## Design

- Preserve the existing `create_note_card` request fields: `title`, `tag`, `content`, `x`, `y`, optional `id`, `color`, and `size`.
- Replace the note-shape prop helper with a rectangle/geo prop helper.
- Map `create_note_card` to a tldraw shape with `type: "geo"` and `props.geo: "rectangle"`.
- Store title, tag, and content in `props.richText`; title and tag remain bold paragraphs and content remains normal text.
- Keep the UI/menu/API name as Note Card for compatibility with Hermes and plugin callers.
- Update tests and active docs to expect a built-in rectangle shape instead of a native note shape.

## Verification

- Unit tests cover rich text generation and default rectangle props.
- Executor, bridge, headless, gateway, and docs/plugin tests expect `create_note_card` to produce `type: "geo"`.
- Type checking and full test suite must pass.
