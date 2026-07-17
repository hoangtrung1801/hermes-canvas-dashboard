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

## AI Canvas Assistant

The default canvas view includes a conversation sidebar backed by a Python LangChain agent. The agent reads the current tldraw state before each turn and can inspect or mutate built-in shapes plus Hermes Todo, Link, Note, Docs, and Project cards through typed tools. Conversation history and LangGraph checkpoints persist in SQLite.

### Configure the model

Copy the example environment file and set these required values for an OpenAI-compatible model that supports tool calling:

```bash
cp .env.example .env
```

- `AI_MODEL_BASE_URL`: OpenAI-compatible API base URL.
- `AI_MODEL_API_KEY`: provider API key; local providers may accept a placeholder.
- `AI_MODEL_NAME`: a model with reliable structured tool-calling support.

The remaining `AI_*` values in `.env.example` configure service binding, CORS, persistence, timeouts, and per-turn safety limits. `VITE_AI_SERVICE_URL` is embedded by Vite at build/start time.

### Start locally

Install both JavaScript and Python dependencies once:

```bash
npm install
uv sync --extra dev
```

Then start the gateway, agent service, and frontend in that order, each in a separate terminal:

```bash
npm run server
```

```bash
uv run python -m agent_service
```

```bash
VITE_AI_SERVICE_URL=http://127.0.0.1:8000 npm run dev
```

Open the Vite URL and use the **Canvas assistant** sidebar. The gateway remains responsible for applying validated canvas actions; when the browser bridge is absent, supported actions execute headlessly and appear after tldraw sync reconnects.

Check the services independently:

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8000/health
```

By default, tldraw sync state is stored at `data/tldraw-sync.sqlite`, while conversations, runs, and LangGraph checkpoints are stored at `data/agent-chat.sqlite`. Override these with `CANVAS_GATEWAY_DATA_DIR` and `AI_DATABASE_PATH` respectively.

Stopping a response prevents later agent tools from beginning once cancellation is observed. Canvas actions that were already confirmed are durable and are not rolled back.

### Verify the assistant stack

```bash
.venv/bin/ruff check agent_service tests
.venv/bin/python -m pytest -q
npm test
npm run lint:types
npm run build
```

### Automatic card frames

The live canvas automatically groups Project, Todo, Note, and Link cards into one native tldraw frame per card kind. Projects use one wide column; the other card kinds wrap into compact two-column grids. Generated frames resize as cards are created, deleted, or resized, and moving a generated frame moves its cards with it.

Only Hermes-generated frames are managed. Cards placed inside a user-created frame stay there and are excluded from automatic grouping. Continuous updates preserve the positions of existing generated frames; the bottom-right **Tidy cards by type** action immediately rebuilds the card layouts and repacks all generated frames into ordered rows.

If port `8787` is already in use:

```bash
CANVAS_GATEWAY_PORT=8788 npm run server
VITE_CANVAS_GATEWAY_URL="ws://localhost:8788/canvas?canvasId=canvas_001&role=bridge" VITE_TLDRAW_SYNC_URL="ws://localhost:8788/sync" npm run dev
```

## Linux Services

The repository includes systemd templates for running the gateway and frontend as Linux services. Run the installer from the repository checkout on the target machine.

Included files:

- `scripts/linux/install-systemd-services.sh`: installs the systemd unit files and creates `/etc/hermes-canvas/hermes-canvas.env` when missing.
- `scripts/linux/uninstall-systemd-services.sh`: stops, disables, and removes installed Hermes Canvas systemd unit files.
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

The installer resolves the package manager and Node paths on the target machine, then writes those absolute paths into the installed unit files. If `pnpm-lock.yaml` is present and `pnpm` is available, it uses `pnpm`; otherwise it uses `npm`. Override that choice when needed:

```bash
sudo HERMES_CANVAS_PACKAGE_MANAGER=pnpm scripts/linux/install-systemd-services.sh dev --enable --start
sudo HERMES_CANVAS_PACKAGE_MANAGER=npm scripts/linux/install-systemd-services.sh dev --enable --start
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

To uninstall services:

```bash
sudo scripts/linux/uninstall-systemd-services.sh dev
sudo scripts/linux/uninstall-systemd-services.sh prod
sudo scripts/linux/uninstall-systemd-services.sh all
```

The uninstall script keeps `/etc/hermes-canvas/hermes-canvas.env` by default. To remove that environment file too:

```bash
sudo scripts/linux/uninstall-systemd-services.sh all --purge-env
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
npm run hermes:demo -- --actions '[{"type":"create_note_card","title":"Hello","tag":"Note","content":"Created by Hermes","x":120,"y":160}]'
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

Create a project task board. Tasks default to the Todo column when `status` is omitted:

```json
{
  "type": "create_project_card",
  "id": "shape:website_launch",
  "title": "Website Launch",
  "x": 100,
  "y": 120,
  "tasks": [
    { "id": "task_copy", "text": "Finish copy" },
    { "id": "task_review", "text": "Review changes", "status": "doing" }
  ]
}
```

Track work without replacing the card. Task statuses are `todo`, `doing`, `done`, and `blocked`:

```json
[
  { "type": "move_project_task", "shapeId": "shape:website_launch", "taskId": "task_copy", "status": "doing" },
  { "type": "append_project_task", "shapeId": "shape:website_launch", "taskId": "task_publish", "text": "Publish announcement" },
  { "type": "update_project_task_text", "shapeId": "shape:website_launch", "taskId": "task_publish", "text": "Publish launch announcement" }
]
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
