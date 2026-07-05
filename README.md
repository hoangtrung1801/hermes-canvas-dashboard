# Canvas for Hermes

Hermes sends validated `canvas.action` messages to a Node gateway. The browser renders the canvas with tldraw, while tldraw sync persists room state to a local SQLite database in the gateway data directory.

## Local Development

1. Install dependencies: `npm install`
2. Start the gateway: `npm run server`
3. Start the frontend: `VITE_CANVAS_GATEWAY_URL="ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge" npm run dev`
4. Send a Hermes-style write batch: `npm run hermes:demo`
5. Run tests: `npm test`

The gateway exposes:

- Hermes action WebSocket: `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`
- Browser bridge WebSocket: `ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge`
- tldraw sync WebSocket: `ws://localhost:8787/sync/canvas_001`
- SQLite sync database: `data/tldraw-sync.sqlite`

When the frontend is open as `role=bridge`, Hermes actions are applied live to the mounted tldraw editor. When no browser bridge is connected, the gateway applies supported actions headlessly to the same tldraw sync room, so persisted state still lands in SQLite.

If port `8787` is already in use:

```bash
CANVAS_GATEWAY_PORT=8788 npm run server
VITE_CANVAS_GATEWAY_URL="ws://localhost:8788/canvas?canvasId=canvas_001&role=bridge" VITE_TLDRAW_SYNC_URL="ws://localhost:8788/sync" npm run dev
```

## Linux Services

The repository includes systemd templates for running the gateway and frontend as Linux services. Run the installer from the repository checkout on the target machine.

Included files:

- `scripts/linux/install-systemd-services.sh`: installs the systemd unit files and creates `/etc/hermes-canvas/hermes-canvas.env` when missing.
- `scripts/serve-dist.mjs`: serves the production `dist/` frontend for `hermes-canvas-app.service`.
- `systemd/hermes-canvas-server.service`: production gateway service.
- `systemd/hermes-canvas-app.service`: production frontend service.
- `systemd/hermes-canvas-server-dev.service`: development gateway service.
- `systemd/hermes-canvas-app-dev.service`: development Vite frontend service.
- `systemd/hermes-canvas.env.example`: default environment file template.

Development services run the same commands used locally:

```bash
sudo scripts/linux/install-systemd-services.sh dev --enable --start
```

Production-style services run the gateway and serve the built frontend from `dist/`:

```bash
npm install
npm run build
sudo scripts/linux/install-systemd-services.sh prod --enable --start
```

To install both dev and production service units:

```bash
sudo scripts/linux/install-systemd-services.sh all --enable --start
```

The installer creates `/etc/hermes-canvas/hermes-canvas.env` if it does not already exist. Edit that file to change the checkout path, ports, or Vite WebSocket URLs:

```bash
sudo editor /etc/hermes-canvas/hermes-canvas.env
sudo systemctl restart hermes-canvas-server.service hermes-canvas-app.service
```

Useful service commands:

```bash
sudo systemctl status hermes-canvas-server.service
sudo systemctl status hermes-canvas-app.service
sudo systemctl restart hermes-canvas-server.service hermes-canvas-app.service
journalctl -u hermes-canvas-server.service -f
journalctl -u hermes-canvas-app.service -f
```

Development units use `hermes-canvas-server-dev.service` and `hermes-canvas-app-dev.service`:

```bash
sudo systemctl status hermes-canvas-server-dev.service
sudo systemctl status hermes-canvas-app-dev.service
sudo systemctl restart hermes-canvas-server-dev.service hermes-canvas-app-dev.service
journalctl -u hermes-canvas-server-dev.service -f
journalctl -u hermes-canvas-app-dev.service -f
```

## Hermes Demo Client

With the gateway running:

```bash
npm run hermes:demo
```

To send custom actions:

```bash
npm run hermes:demo -- --actions '[{"type":"create_task_card","title":"Hello","body":"Created by Hermes","x":120,"y":160}]'
```

## Action Examples

Create a todo block:

```json
{
  "type": "create_todo_block",
  "id": "shape:launch_checklist",
  "title": "Launch Checklist",
  "x": 100,
  "y": 150,
  "tasks": [
    { "id": "task_copy", "text": "Write launch copy" },
    { "id": "task_assets", "text": "Prepare screenshots", "done": true }
  ]
}
```

Mutate todo tasks:

```json
[
  { "type": "append_todo_task", "shapeId": "shape:launch_checklist", "taskId": "task_ship", "text": "Ship feature" },
  { "type": "set_todo_task_done", "shapeId": "shape:launch_checklist", "taskId": "task_copy", "done": true },
  { "type": "remove_todo_task", "shapeId": "shape:launch_checklist", "taskId": "task_assets" }
]
```

Create a task card:

```json
{
  "type": "create_task_card",
  "id": "shape:sprint_task",
  "title": "Design UI System",
  "body": "Build the tldraw-powered Hermes canvas workflow.",
  "status": "in_progress",
  "priority": "high",
  "x": 100,
  "y": 150
}
```

Create a link card:

```json
{
  "type": "create_link_card",
  "id": "shape:tldraw_docs",
  "title": "tldraw Sync Docs",
  "url": "https://tldraw.dev/docs/sync",
  "description": "Sync server and client setup",
  "x": 100,
  "y": 350
}
```
