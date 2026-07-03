---
name: canvas-dashboard
description: Operate a user-managed Hermes Canvas Dashboard or Canvas Bridge API from an agent workflow. Use when Codex needs to send canvas.action batches over WebSocket, read canvas.result/canvas.observation responses, update dashboard blocks, inspect errors, or interact with canvas state using the bundled Python API tool.
---

# Canvas Dashboard

Use this skill to interact with a running Canvas Gateway or Canvas Dashboard API. The user is responsible for starting and managing the gateway, dashboard, browser bridge, auth tunnel, or any other server-side process. The agent's job is to call the API, inspect responses, and choose follow-up actions.

Do not start, stop, build, or modify the user's canvas server unless the user explicitly asks for that. Do not assume this skill is being used inside the canvas source repository.

## Connection

Ask the user for the WebSocket URL and canvas id when they are not already available. The tool defaults to a local development endpoint, but production or shared dashboards should pass explicit connection settings.

The gateway must be running before using this skill. Opening the canvas dashboard is optional:

- If the dashboard is open and connected as `role=bridge`, actions execute live in the browser.
- If the dashboard is closed, the gateway executes the same action batch headlessly against the persisted snapshot and saves the result.
- If no snapshot exists yet, the gateway creates a blank canvas snapshot.

Install the Python WebSocket dependency once if it is missing:

```bash
python3 -m pip install websocket-client
```

Configure the connection with CLI flags:

```bash
python3 scripts/canvas_dashboard_tool.py \
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
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"create_text","text":"Hello from Hermes","x":100,"y":120,"name":"Greeting"}]'
```

### create_box

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"create_box","name":"Container","text":"Planning area","x":80,"y":80,"w":650,"h":420}]'
```

### create_note

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"create_note","text":"Architecture note","x":450,"y":150,"name":"Note"}]'
```

### create_todo_block

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"create_todo_block","name":"Launch Checklist","x":100,"y":150,"tasks":[{"id":"task_copy","text":"Write launch copy"},{"id":"task_assets","text":"Prepare screenshots","done":true},"Ship release"],"props":{"priority":"high"}}]'
```

### create_task_card

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"create_task_card","name":"Design import modal","text":"Create modern modal UI","x":100,"y":120,"props":{"status":"todo","priority":"medium","assignee":"Hermes"}}]'
```

### create_link_card

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"create_link_card","name":"Excalidraw Documentation","url":"https://docs.excalidraw.com","x":100,"y":350,"props":{"category":"docs"}}]'
```

### create_arrow

Use block ids returned by previous create or lookup actions.

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"create_arrow","fromBlockId":"block_0001","toBlockId":"block_0002","label":"depends on"}]'
```

### update_text

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"update_text","blockId":"block_0001","text":"Updated text"}]'
```

### append_todo_task

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"append_todo_task","blockId":"block_0001","taskId":"task_review","text":"Review implementation"}]'
```

### set_todo_task_done

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"set_todo_task_done","blockId":"block_0001","taskId":"task_review","done":true}]'
```

### remove_todo_task

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"remove_todo_task","blockId":"block_0001","taskId":"task_review"}]'
```

### move_block

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"move_block","blockId":"block_0001","x":240,"y":320}]'
```

### delete_block

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"delete_block","blockId":"block_0001"}]'
```

### get_block_by_name

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"get_block_by_name","name":"Launch Checklist"}]'
```

### get_todo_block_data

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"get_todo_block_data","blockId":"block_0001"}]'
```

### read_canvas

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]'
```

### zoom_to_fit

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"zoom_to_fit"}]'
```

## Batch Example

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"create_box","name":"Plan","text":"Dashboard plan","x":80,"y":80,"w":500,"h":280},{"type":"create_todo_block","name":"Next Steps","x":120,"y":150,"tasks":["Read current canvas","Update task status"]},{"type":"zoom_to_fit"},{"type":"read_canvas"}]'
```

## Source of Truth

The running Canvas Gateway API is authoritative. The Python tool does lightweight preflight validation only; the live bridge or headless executor performs authoritative validation and returns `canvas.error` or per-action result errors for invalid or impossible actions. The browser bridge is required only for live visual execution.

## Troubleshooting

- `Missing Python dependency websocket-client`: run `python3 -m pip install websocket-client`.
- `Unable to connect`: ask the user for the active gateway WebSocket URL and verify `--url`.
- Timeout waiting for `canvas.observation`: ask the user to confirm the gateway is running for the selected `canvasId`.
- `canvas.error`: fix the action payload according to the API response and the action examples in this skill.
- Result item contains `error`: the envelope was valid, but that action failed; inspect ids and block types.
