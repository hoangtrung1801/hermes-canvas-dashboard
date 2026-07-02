---
name: canvas-dashboard
description: Operate the Hermes Canvas Bridge from an agent workflow using the repo-local Python canvas dashboard tool.
---

# Canvas Dashboard

Use this skill when Hermes needs to read or write the existing Canvas Bridge workspace. This skill is for operations only: send actions, read observations, inspect results, and recover from bridge errors. Do not use it for designing or extending UI.

## Prerequisites

From the repository root, the gateway must be running:

```bash
npm run server
```

The browser canvas must also be open with the frontend connected as `role=bridge`, for example:

```bash
VITE_CANVAS_GATEWAY_URL="ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge" npm run dev
```

Install the Python WebSocket dependency once if it is missing:

```bash
python3 -m pip install websocket-client
```

## Tool Command

Send actions with:

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]'
```

Useful options:

- `--actions`: required JSON array of Canvas API actions.
- `--url`: gateway WebSocket URL. Defaults to `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`.
- `--canvasId`: canvas id. Defaults to `canvas_001`.
- `--requestId`: stable request id for correlation.
- `--timeoutMs`: timeout in milliseconds. Defaults to `5000`.

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
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"create_text","text":"Hello from Hermes","x":100,"y":120,"name":"Greeting"}]'
```

### create_box

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"create_box","name":"Container","text":"Planning area","x":80,"y":80,"w":650,"h":420}]'
```

### create_note

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"create_note","text":"Architecture note","x":450,"y":150,"name":"Note"}]'
```

### create_todo_block

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"create_todo_block","name":"Launch Checklist","x":100,"y":150,"tasks":[{"id":"task_copy","text":"Write launch copy"},{"id":"task_assets","text":"Prepare screenshots","done":true},"Ship release"],"props":{"priority":"high"}}]'
```

### create_task_card

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"create_task_card","name":"Design import modal","text":"Create modern modal UI","x":100,"y":120,"props":{"status":"todo","priority":"medium","assignee":"Hermes"}}]'
```

### create_link_card

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"create_link_card","name":"Excalidraw Documentation","url":"https://docs.excalidraw.com","x":100,"y":350,"props":{"category":"docs"}}]'
```

### create_arrow

Use block ids returned by previous create or lookup actions.

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"create_arrow","fromBlockId":"block_0001","toBlockId":"block_0002","label":"depends on"}]'
```

### update_text

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"update_text","blockId":"block_0001","text":"Updated text"}]'
```

### append_todo_task

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"append_todo_task","blockId":"block_0001","taskId":"task_review","text":"Review implementation"}]'
```

### set_todo_task_done

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"set_todo_task_done","blockId":"block_0001","taskId":"task_review","done":true}]'
```

### remove_todo_task

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"remove_todo_task","blockId":"block_0001","taskId":"task_review"}]'
```

### move_block

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"move_block","blockId":"block_0001","x":240,"y":320}]'
```

### delete_block

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"delete_block","blockId":"block_0001"}]'
```

### get_block_by_name

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"get_block_by_name","name":"Launch Checklist"}]'
```

### get_todo_block_data

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"get_todo_block_data","blockId":"block_0001"}]'
```

### read_canvas

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]'
```

### zoom_to_fit

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"zoom_to_fit"}]'
```

## Batch Example

```bash
python3 skills/canvas-dashboard/canvas_dashboard_tool.py --actions '[{"type":"create_box","name":"Plan","text":"Dashboard plan","x":80,"y":80,"w":500,"h":280},{"type":"create_todo_block","name":"Next Steps","x":120,"y":150,"tasks":["Read current canvas","Update task status"]},{"type":"zoom_to_fit"},{"type":"read_canvas"}]'
```

## Source of Truth

Use `CANVAS_API.md` for exact protocol and action schemas. The Python tool does lightweight preflight validation only; the bridge performs authoritative validation.

## Troubleshooting

- `Missing Python dependency websocket-client`: run `python3 -m pip install websocket-client`.
- `Unable to connect`: start `npm run server` and check `--url`.
- Timeout waiting for `canvas.observation`: open the frontend with `role=bridge`.
- `canvas.error`: fix the action payload according to `CANVAS_API.md`.
- Result item contains `error`: the envelope was valid, but that action failed; inspect ids and block types.
