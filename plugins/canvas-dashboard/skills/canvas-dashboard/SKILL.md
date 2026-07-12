---
name: canvas-dashboard
description: Operate Hermes tldraw Canvas Gateway action batches.
version: 0.1.0
metadata:
  hermes:
    tags: [canvas, tldraw, dashboard, productivity]
    category: productivity
---

# Canvas Dashboard

Use this skill to operate a running Hermes Canvas Gateway. The gateway applies actions live through a connected browser bridge, or headlessly against the same tldraw sync room when no browser bridge is connected. Canvas state persists through tldraw sync, usually into the gateway SQLite database.

## When to Use

Use this skill when the user asks to inspect or change the Hermes Canvas Dashboard, tldraw canvas, notes, todo blocks, checklist items, link cards, shapes, selections, or camera view.

Prefer the Hermes `canvas_action` plugin tool when it is available. Use the bundled CLI only when the tool is unavailable or when the user explicitly wants a terminal command. Do not use Hermes' session `todo` tool unless the user asks for the agent-local todo list.

Do not start, stop, build, or modify the user's canvas server unless the user explicitly asks.

## Procedure

1. Resolve the connection target. The default action channel is:

```text
ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes
```

Set overrides only when needed:

```bash
export CANVAS_DASHBOARD_URL='ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes'
export CANVAS_DASHBOARD_CANVAS_ID='canvas_001'
export CANVAS_DASHBOARD_TIMEOUT_MS='5000'
```

2. Read the canvas before changing it. With `canvas_action`, send:

```json
{"actions":[{"type":"read_canvas"}]}
```

With the CLI, run:

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]'
```

3. If the user's input is a link-only request, browse the page before writing to the canvas. Use the browsing skill or available browser/web metadata tool to fetch the page title, canonical URL, site name, and description. When the browsing tool supports screenshots, capture a useful page or hero screenshot; otherwise look for a representative page image such as `og:image`. Add the visual to the link card through `imageUrl`, using an HTTP(S) image URL or an image data URI when the screenshot tool exposes one. If no usable image is available, still create the link card without `imageUrl`. Never fail the link-card request only because browsing, screenshot capture, or image lookup failed.

4. Build one action batch. When using `canvas_action`, the plugin automatically prepends `{"type":"read_canvas"}` before any non-read batch. The standalone CLI sends exactly the actions passed through `--actions`.

5. Inspect the returned JSON. Read `canvas.result.results[]` for per-action ids and errors. Read `canvas.observation.state.shapes[]`, `selectedShapeIds`, and `camera` for current state. Use returned `createdShapeIds`, `updatedShapeIds`, `deletedShapeIds`, `createdBindingIds`, and `deletedBindingIds` for follow-up actions.

6. Verify writes from the final `canvas.observation`. If the requested visual result matters, finish with `zoom_to_fit` or `set_camera` and a final `read_canvas`.

## User Response

After a successful canvas action, respond with only a brief confirmation such as “Added it to the canvas.” Do not report action payloads, shape ids, canvas observations, fetched metadata, screenshot details, verification steps, or implementation details unless the user explicitly asks for them. If an action fails or only partially succeeds, state the problem and required next step concisely.

## Actions

### create_todo_block

```json
{"type":"create_todo_block","id":"shape:launch_checklist","title":"Launch Checklist","x":100,"y":150,"tasks":[{"id":"task_copy","text":"Write launch copy"},{"id":"task_assets","text":"Prepare screenshots","done":true}]}
```

### append_todo_task

```json
{"type":"append_todo_task","shapeId":"shape:launch_checklist","taskId":"task_ship","text":"Ship feature"}
```

### set_todo_task_done

```json
{"type":"set_todo_task_done","shapeId":"shape:launch_checklist","taskId":"task_copy","done":true}
```

### remove_todo_task

```json
{"type":"remove_todo_task","shapeId":"shape:launch_checklist","taskId":"task_assets"}
```

### create_link_card

Use this for URLs and link-only user requests after fetching browsing metadata when possible.

```json
{"type":"create_link_card","id":"shape:tldraw_docs","title":"tldraw Sync Docs","url":"https://tldraw.dev/docs/sync","description":"Sync server and client setup","imageUrl":"https://example.com/tldraw-sync-preview.png","w":360,"h":300,"x":100,"y":350}
```

### create_note_card

Creates a built-in tldraw rectangle with rich text. Always structure the visible card in this order:

```text
[TAG (Idea, Note, etc.)]
[Title]
[Description]
```

Map `tag` to the first line, `title` to the second line, and `content` to the description on the remaining line or lines. The square brackets above indicate placeholders; do not include them in the card text.

```json
{"type":"create_note_card","id":"shape:plan","title":"Plan","tag":"Note","content":"Dashboard plan","x":80,"y":80}
```

### create_shape

```json
{"type":"create_shape","shape":{"id":"shape:geo_box","type":"geo","x":450,"y":160,"props":{"geo":"rectangle","w":260,"h":140,"color":"blue","fill":"solid","dash":"draw","size":"m"},"meta":{"source":"hermes"}}}
```

### update_shape

```json
{"type":"update_shape","shapeId":"shape:plan","patch":{"props":{"title":"Updated title"}}}
```

### move_shapes

Move by a delta:

```json
{"type":"move_shapes","shapeIds":["shape:plan"],"dx":40,"dy":20}
```

Move by absolute coordinates when supported by the target shape/action payload:

```json
{"type":"move_shapes","shapeIds":["shape:plan"],"x":240,"y":320}
```

### delete_shapes

```json
{"type":"delete_shapes","shapeIds":["shape:plan"]}
```

### set_camera

```json
{"type":"set_camera","x":0,"y":0,"z":1}
```

### zoom_to_fit

```json
{"type":"zoom_to_fit"}
```

### select_shapes

Browser-editor only.

```json
{"type":"select_shapes","shapeIds":["shape:plan"]}
```

### clear_selection

```json
{"type":"clear_selection"}
```

### read_canvas

```json
{"type":"read_canvas"}
```

## Batch Example

With `canvas_action`:

```json
{"actions":[{"type":"create_note_card","id":"shape:plan","title":"Plan","tag":"Note","content":"Dashboard plan","x":80,"y":80},{"type":"create_todo_block","id":"shape:next_steps","title":"Next Steps","x":120,"y":250,"tasks":[{"id":"task_read","text":"Read current canvas"},{"id":"task_update","text":"Update task status"}]},{"type":"zoom_to_fit"},{"type":"read_canvas"}]}
```

With the CLI:

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_note_card","id":"shape:plan","title":"Plan","tag":"Note","content":"Dashboard plan","x":80,"y":80},{"type":"create_todo_block","id":"shape:next_steps","title":"Next Steps","x":120,"y":250,"tasks":[{"id":"task_read","text":"Read current canvas"},{"id":"task_update","text":"Update task status"}]},{"type":"zoom_to_fit"},{"type":"read_canvas"}]'
```

## Pitfalls

- Missing `websocket-client`: run with `uv run --with websocket-client ...` or vendor it once with `uv pip install --target vendor websocket-client`.
- Unable to connect: ask the user for the active gateway WebSocket URL and verify `--url`.
- Timeout waiting for `canvas.observation`: confirm the gateway is running for the selected `canvasId`.
- `select_shapes` does not work headlessly; it requires a browser editor bridge.
- Result item contains `error`: the envelope was valid, but that action failed. Inspect shape ids and action payloads before retrying.
- `ok` is `false` or a `canvas.error` envelope appears: stop and inspect the JSON before sending more writes.

## Verification

After every write, confirm:

- The tool returned `ok: true`.
- No item in `canvas.result.results[]` contains `error`.
- The final `canvas.observation.state.shapes[]` contains the expected shape ids and props.
- Deleted shape ids are absent from the final observation.
- Camera or selection actions are reflected in `state.camera` or `state.selectedShapeIds` when those fields are expected to change.
