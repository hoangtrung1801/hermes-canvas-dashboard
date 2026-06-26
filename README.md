# Canvas for Hermes

Hermes sends validated `canvas.action` messages to a browser-resident Canvas Bridge. The bridge applies those actions to a tldraw canvas and replies with `canvas.result` and `canvas.observation`.

## Local development

1. Install dependencies: `npm install`
2. Start the gateway: `npm run server`
3. Start the frontend: `npm run dev`
4. Run tests: `npm test`

## MVP message flow

1. The browser sends `canvas.ready` to `ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge` when the canvas is mounted.
2. Hermes sends a `canvas.action` envelope to `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`.
3. The gateway forwards the action to the active bridge client for that canvas.
4. The browser validates the action, executes it through `CanvasBridge`, and returns either `canvas.error` or the `canvas.result` plus `canvas.observation` pair.
5. The gateway forwards the bridge response back to the Hermes client.
