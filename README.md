# Canvas for Hermes

Hermes sends validated `canvas.action` messages to a browser-resident Canvas Bridge. The bridge applies those actions to a tldraw canvas and replies with `canvas.result` and `canvas.observation`.

## Local development

1. Install dependencies: `npm install`
2. Start the gateway: `npm run server`
3. Start the frontend: `VITE_CANVAS_GATEWAY_URL="ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge" npm run dev`
4. Run tests: `npm test`

The frontend can also run without the WebSocket gateway. When `VITE_CANVAS_GATEWAY_URL` is not set, the local canvas and action simulator stay active and the app does not attempt a WebSocket connection.

## MVP message flow

1. The browser sends `canvas.ready` to `ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge` when the canvas is mounted.
2. Hermes sends a `canvas.action` envelope to `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`.
3. The gateway forwards the action to the active bridge client for that canvas.
4. The browser validates the action, executes it through `CanvasBridge`, and returns either `canvas.error` or the `canvas.result` plus `canvas.observation` pair.
5. The gateway forwards the bridge response back to the Hermes client.

## Built-in blocks

### Todo block

Create a Todo block with a display name and optional initial tasks:

```json
{
  "type": "create_todo_block",
  "name": "Launch Checklist",
  "x": 100,
  "y": 150,
  "tasks": [
    { "id": "task_copy", "text": "Write launch copy" },
    { "id": "task_assets", "text": "Prepare screenshots", "done": true }
  ]
}
```

The bridge returns `createdBlockIds` and `createdTaskIds`. Use the returned block id for follow-up task actions:

```json
[
  { "type": "append_todo_task", "blockId": "block_0001", "taskId": "task_ship", "text": "Ship feature" },
  { "type": "set_todo_task_done", "blockId": "block_0001", "taskId": "task_copy", "done": true },
  { "type": "remove_todo_task", "blockId": "block_0001", "taskId": "task_assets" }
]
```

### Link card

Create a Link card with a title and URL:

```json
{
  "type": "create_link_card",
  "name": "tldraw Documentation",
  "url": "https://tldraw.dev",
  "x": 100,
  "y": 350
}
```
