# Canvas for Hermes

Hermes sends validated `canvas.action` messages to the Canvas Gateway. When the dashboard is open, the browser bridge applies those actions live; when it is closed, the gateway applies them headlessly to the persisted canvas snapshot.

## Local development

1. Install dependencies: `npm install`
2. Start the gateway: `npm run server`
3. Optional: start the frontend for live visual editing: `VITE_CANVAS_GATEWAY_URL="ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge" npm run dev`
4. Send a Hermes-style write batch: `npm run hermes:demo`
5. Run tests: `npm test`

The gateway exposes two canvas capabilities:

- WebSocket action API: `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`
- Local file-backed canvas state API: `http://localhost:8787/canvas-state/canvas_001`

When the frontend dashboard is open and connected as `role=bridge`, actions are handled live by the browser bridge. When no dashboard bridge is connected, the gateway executes actions headlessly against `data/canvas_001.json`; if no snapshot exists, it creates a blank one. The next dashboard load restores that saved state.

If port `8787` is already in use, start the gateway on another port and point the frontend at it:

```bash
CANVAS_GATEWAY_PORT=8788 npm run server
VITE_CANVAS_STATE_URL="http://localhost:8788/canvas-state" VITE_CANVAS_GATEWAY_URL="ws://localhost:8788/canvas?canvasId=canvas_001&role=bridge" npm run dev
```

The frontend can run without `VITE_CANVAS_GATEWAY_URL`, so the local canvas and action simulator stay active without a WebSocket connection. Durable JSON-file persistence and headless action execution still require `npm run server` to be running.

## Install the Hermes plugin

The repo includes a Hermes plugin at `plugins/canvas-dashboard`. From a clone of this repo, install it into the current user's Hermes plugin directory with:

```bash
scripts/install-canvas-dashboard-plugin.sh
```

By default this copies the plugin to `~/.hermes/plugins/canvas-dashboard`. Use `--force` to replace an existing install, `--symlink` while developing against this checkout, or `--dest <dir>` to install into a different plugin root. Add `--install-deps` if the target Python environment still needs `websocket-client`.

## Hermes demo client

With the gateway running, execute:

```bash
npm run hermes:demo
```

The script connects as `role=hermes`, sends a `canvas.action` batch that writes blocks into the canvas, and prints `canvas.result` plus `canvas.observation` responses. To send custom actions:

```bash
npm run hermes:demo -- --actions '[{"type":"create_text","text":"Hello from Hermes","x":120,"y":160}]'
```

## MVP message flow

1. The browser sends `canvas.ready` to `ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge` when the canvas is mounted.
2. Hermes sends a `canvas.action` envelope to `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`.
3. If an active bridge client is connected for that canvas, the gateway forwards the action to it.
4. If no bridge client is connected, the gateway executes the action headlessly against the persisted snapshot.
5. The live bridge or headless executor returns either `canvas.error` or the `canvas.result` plus `canvas.observation` pair.
6. The browser or headless executor saves the latest canvas snapshot to `data/canvas_001.json`.

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
  "name": "Excalidraw Documentation",
  "url": "https://docs.excalidraw.com",
  "x": 100,
  "y": 350
}
```
