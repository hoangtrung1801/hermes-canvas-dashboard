---
name: canvas-dashboard
description: Operate a user-managed Hermes Canvas Dashboard or Canvas Bridge API from an agent workflow. Use when Codex needs to send canvas.action batches over WebSocket, read canvas.result/canvas.observation responses, update dashboard blocks, inspect errors, or interact with canvas state using the bundled Python API tool.
---

# Canvas Dashboard

Use this skill to interact with a running Canvas Dashboard API. The user is responsible for starting and managing the dashboard, gateway, browser bridge, auth tunnel, or any other server-side process. The agent's job is to call the API, inspect responses, and choose follow-up actions.

Do not start, stop, build, or modify the user's canvas server unless the user explicitly asks for that. Do not assume this skill is being used inside the canvas source repository.

## Connection

Ask the user for the WebSocket URL and canvas id when they are not already available. The tool defaults to a local development endpoint, but production or shared dashboards should pass explicit connection settings.

Use `uv` so the WebSocket dependency is available without relying on system `pip`:

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py \
  --url 'ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes' \
  --canvasId canvas_001 \
  --actions '[{"type":"read_canvas"}]'
```

If you prefer to vendor the dependency into the plugin once instead of resolving it per run:

```bash
uv pip install --target vendor websocket-client
```

Configure the connection with CLI flags:

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py \
  --url 'ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes' \
  --canvasId canvas_001 \
  --actions '[{"type":"read_canvas"}]'
```

Run commands from the `canvas-dashboard` skill directory, or use an absolute path to this skill's bundled `scripts/canvas_dashboard_tool.py`.

Or configure the same defaults through environment variables:

```bash
export CANVAS_DASHBOARD_URL='ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes'
export CANVAS_DASHBOARD_CANVAS_ID='canvas_001'
export CANVAS_DASHBOARD_TIMEOUT_MS='5000'
```

Useful options:

- `--actions`: required JSON array of Canvas API actions.
- `--url`: dashboard WebSocket URL. Overrides `CANVAS_DASHBOARD_URL`.
- `--canvasId`: canvas id. Overrides `CANVAS_DASHBOARD_CANVAS_ID`.
- `--requestId`: stable request id for correlation.
- `--timeoutMs`: timeout in milliseconds. Overrides `CANVAS_DASHBOARD_TIMEOUT_MS`.

When using the Hermes `canvas_action` plugin tool, the plugin automatically prepends `{"type":"read_canvas"}` before any non-read action batch so the agent catches up on current canvas context before changing anything. The standalone `scripts/canvas_dashboard_tool.py` CLI sends exactly the actions you provide.

The tool prints a single JSON object. On success, `ok` is `true` and `responses` contains the received `canvas.result` and `canvas.observation` envelopes. On failure, `ok` is `false` and `error` explains the failure.

## Response Handling

Read `canvas.result.results[]` for per-action ids and errors. Read the following `canvas.observation.state.blocks[]` for the current canvas state. Use returned `createdBlockIds`, `matchedBlockIds`, and task ids for follow-up actions.

Stop and inspect the JSON if:

- The tool exits non-zero.
- `ok` is `false`.
- Any result item contains `error`.
- A `canvas.error` envelope appears.

## Actions

### create_text

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_text","text":"Hello from Hermes","x":100,"y":120,"name":"Greeting"}]'
```

### create_box

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_box","name":"Container","text":"Planning area","x":80,"y":80,"w":650,"h":420}]'
```

### create_note

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_note","text":"Architecture note","x":450,"y":150,"name":"Note"}]'
```

### create_todo_block

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_todo_block","name":"Launch Checklist","x":100,"y":150,"tasks":[{"id":"task_copy","text":"Write launch copy"},{"id":"task_assets","text":"Prepare screenshots","done":true},"Ship release"],"props":{"priority":"high"}}]'
```

### create_task_card

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_task_card","name":"Design import modal","text":"Create modern modal UI","x":100,"y":120,"props":{"status":"todo","priority":"medium","assignee":"Hermes"}}]'
```

### create_link_card

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_link_card","name":"Excalidraw Documentation","url":"https://docs.excalidraw.com","x":100,"y":350,"props":{"category":"docs"}}]'
```

### create_arrow

Use block ids returned by previous create or lookup actions.

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_arrow","fromBlockId":"block_0001","toBlockId":"block_0002","label":"depends on"}]'
```

### update_text

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"update_text","blockId":"block_0001","text":"Updated text"}]'
```

### append_todo_task

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"append_todo_task","blockId":"block_0001","taskId":"task_review","text":"Review implementation"}]'
```

### set_todo_task_done

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"set_todo_task_done","blockId":"block_0001","taskId":"task_review","done":true}]'
```

### remove_todo_task

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"remove_todo_task","blockId":"block_0001","taskId":"task_review"}]'
```

### move_block

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"move_block","blockId":"block_0001","x":240,"y":320}]'
```

### delete_block

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"delete_block","blockId":"block_0001"}]'
```

### get_block_by_name

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"get_block_by_name","name":"Launch Checklist"}]'
```

### get_todo_block_data

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"get_todo_block_data","blockId":"block_0001"}]'
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
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_box","name":"Plan","text":"Dashboard plan","x":80,"y":80,"w":500,"h":280},{"type":"create_todo_block","name":"Next Steps","x":120,"y":150,"tasks":["Read current canvas","Update task status"]},{"type":"zoom_to_fit"},{"type":"read_canvas"}]'
```

## Source of Truth

The running Canvas Dashboard API is authoritative. The Python tool does lightweight preflight validation only; the bridge performs authoritative validation and returns `canvas.error` or per-action result errors for invalid or impossible actions.

## Troubleshooting

- `Missing Python dependency websocket-client`: run `uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]'` or vendor it once with `uv pip install --target vendor websocket-client`.
- `Unable to connect`: ask the user for the active dashboard WebSocket URL and verify `--url`.
- Timeout waiting for `canvas.observation`: ask the user to confirm the canvas dashboard and bridge are running for the selected `canvasId`.
- `canvas.error`: fix the action payload according to the API response and the action examples in this skill.
- Result item contains `error`: the envelope was valid, but that action failed; inspect ids and block types.
