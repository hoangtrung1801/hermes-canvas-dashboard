---
name: canvas-dashboard
description: Operate a user-managed Hermes Canvas Gateway from an agent workflow. Use when Codex needs to send tldraw canvas.action batches over WebSocket, read canvas.result/canvas.observation responses, update shapes, inspect errors, or interact with canvas state using the bundled Python API tool.
---

# Canvas Dashboard

Use this skill to interact with a running Hermes Canvas Gateway. The gateway applies actions live through a browser bridge when one is connected, or headlessly against the same tldraw sync room when no browser bridge is connected. Canvas state is persisted by tldraw sync, usually to the gateway SQLite database.

Do not start, stop, build, or modify the user's canvas server unless the user explicitly asks.

## Connection

Default local URL:

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py \
  --url 'ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes' \
  --canvasId canvas_001 \
  --actions '[{"type":"read_canvas"}]'
```

Environment defaults:

```bash
export CANVAS_DASHBOARD_URL='ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes'
export CANVAS_DASHBOARD_CANVAS_ID='canvas_001'
export CANVAS_DASHBOARD_TIMEOUT_MS='5000'
```

When using the Hermes `canvas_action` plugin tool, the plugin automatically prepends `{"type":"read_canvas"}` before any non-read action batch. The standalone CLI sends exactly the actions you provide.

## Response Handling

Read `canvas.result.results[]` for per-action ids and errors. Read `canvas.observation.state.shapes[]` for the current canvas state. Use returned `createdShapeIds`, `updatedShapeIds`, and `deletedShapeIds` for follow-up actions.

Stop and inspect the JSON if:

- The tool exits non-zero.
- `ok` is `false`.
- Any result item contains `error`.
- A `canvas.error` envelope appears.

## Actions

### create_task_card

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_task_card","id":"shape:sprint_task","title":"Design UI System","body":"Build the tldraw-powered Hermes canvas workflow.","status":"in_progress","priority":"high","x":100,"y":150}]'
```

### create_todo_block

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_todo_block","id":"shape:launch_checklist","title":"Launch Checklist","x":100,"y":150,"tasks":[{"id":"task_copy","text":"Write launch copy"},{"id":"task_assets","text":"Prepare screenshots","done":true}]}]'
```

### todo task mutations

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"append_todo_task","shapeId":"shape:launch_checklist","taskId":"task_ship","text":"Ship feature"},{"type":"set_todo_task_done","shapeId":"shape:launch_checklist","taskId":"task_copy","done":true},{"type":"remove_todo_task","shapeId":"shape:launch_checklist","taskId":"task_assets"}]'
```

### create_link_card

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_link_card","id":"shape:tldraw_docs","title":"tldraw Sync Docs","url":"https://tldraw.dev/docs/sync","description":"Sync server and client setup","x":100,"y":350}]'
```

### create_shape

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_shape","shape":{"id":"shape:geo_box","type":"geo","x":450,"y":160,"props":{"geo":"rectangle","w":260,"h":140,"color":"blue","fill":"solid","dash":"draw","size":"m"}}}]'
```

### update_shape

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"update_shape","shapeId":"shape:sprint_task","patch":{"props":{"title":"Updated title"}}}]'
```

### move_shapes

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"move_shapes","shapeIds":["shape:sprint_task"],"dx":40,"dy":20}]'
```

### delete_shapes

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"delete_shapes","shapeIds":["shape:sprint_task"]}]'
```

### read_canvas

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]'
```

### zoom_to_fit

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"zoom_to_fit"}]'
```

## Batch Example

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_task_card","id":"shape:plan","title":"Plan","body":"Dashboard plan","x":80,"y":80},{"type":"create_todo_block","id":"shape:next_steps","title":"Next Steps","x":120,"y":250,"tasks":[{"id":"task_read","text":"Read current canvas"},{"id":"task_update","text":"Update task status"}]},{"type":"zoom_to_fit"},{"type":"read_canvas"}]'
```

## Troubleshooting

- Missing `websocket-client`: run with `uv run --with websocket-client ...` or vendor it once with `uv pip install --target vendor websocket-client`.
- Unable to connect: ask the user for the active gateway WebSocket URL and verify `--url`.
- Timeout waiting for `canvas.observation`: confirm the gateway is running for the selected `canvasId`.
- Result item contains `error`: the envelope was valid, but that action failed; inspect shape ids and action payloads.
