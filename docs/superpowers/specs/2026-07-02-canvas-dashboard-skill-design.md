# Canvas Dashboard Skill Design

## Context

This repository already exposes a Hermes Canvas Bridge. The browser connects to the WebSocket gateway as `role=bridge`, Hermes connects as `role=hermes`, and Hermes sends validated `canvas.action` batches that the browser applies to the Excalidraw-backed canvas. `CANVAS_API.md` is the protocol reference, and `server/canvas/hermesCanvasClient.ts` is a demo-oriented TypeScript client.

Hermes needs a repo-local `canvas-dashboard` skill that explains how to operate the existing bridge and a Python command-line tool that makes action batches easy to send from an agent workflow.

## Goals

- Add a repo-local operational skill at `skills/canvas-dashboard/SKILL.md`.
- Cover the full current Canvas API from `CANVAS_API.md`, including every action and response envelope.
- Add a Python CLI at `scripts/canvas_dashboard_tool.py`.
- Make the CLI suitable for agent use by emitting stable machine-readable JSON.
- Keep the existing bridge protocol unchanged.

## Non-Goals

- Do not add or change canvas actions.
- Do not add dashboard UI guidance.
- Do not add a new HTTP bridge API.
- Do not install the skill outside this repository.
- Do not replace the existing TypeScript demo client.

## Skill Contract

The `canvas-dashboard` skill is agent-facing documentation for operating this existing canvas bridge. It should tell Hermes how to:

- Start or expect the existing gateway and browser bridge processes.
- Send action batches through the Python CLI.
- Read and interpret `canvas.result`, `canvas.observation`, and `canvas.error`.
- Use every action documented in `CANVAS_API.md`.
- Choose practical action sequences for creating, reading, updating, moving, deleting, and fitting dashboard blocks.
- Handle common failures, including an unavailable gateway, no browser bridge connected, invalid action payloads, and bridge-side action errors.

The skill should avoid UI implementation guidance. Its scope is operating the bridge API, not designing or extending dashboard screens.

## Python CLI Contract

Add `scripts/canvas_dashboard_tool.py` as a standalone Python script invoked with:

```bash
python3 scripts/canvas_dashboard_tool.py --actions '[{"type":"read_canvas"}]'
```

The script supports:

- `--actions`: required JSON action array.
- `--url`: optional gateway URL. Defaults to `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`.
- `--canvasId`: optional canvas id. Defaults to `canvas_001`.
- `--requestId`: optional request id. Defaults to a generated id.
- `--timeoutMs`: optional timeout in milliseconds. Defaults to `5000`.

The script normalizes any supplied URL so `canvasId` and `role=hermes` are set consistently.

The script depends on a Python WebSocket package. Use `websocket-client` because it provides a straightforward synchronous client for CLI use. Document installation in the skill, for example:

```bash
python3 -m pip install websocket-client
```

## Data Flow

1. Hermes reads `skills/canvas-dashboard/SKILL.md`.
2. Hermes ensures the gateway is running with `npm run server`.
3. Hermes ensures the browser canvas is open and connected as `role=bridge`.
4. Hermes calls `python3 scripts/canvas_dashboard_tool.py --actions '<json action array>'`.
5. The script parses CLI options, lightly validates the action array, builds a `canvas.action` envelope, and connects to the gateway as `role=hermes`.
6. The script sends the action envelope and records response envelopes for the matching request id.
7. The script exits successfully after receiving the matching `canvas.observation`.
8. The script exits with failure on invalid input, connection failure, timeout, or `canvas.error`.

## Output Format

On success, print one JSON object to stdout:

```json
{
  "ok": true,
  "request": {
    "type": "canvas.action",
    "requestId": "req_canvas_dashboard_123",
    "canvasId": "canvas_001",
    "actions": [{ "type": "read_canvas" }]
  },
  "responses": [
    {
      "type": "canvas.result",
      "requestId": "req_canvas_dashboard_123",
      "ok": true,
      "results": [{ "actionType": "read_canvas" }]
    },
    {
      "type": "canvas.observation",
      "requestId": "req_canvas_dashboard_123",
      "canvasId": "canvas_001",
      "state": {
        "canvasId": "canvas_001",
        "selectedShapeIds": [],
        "viewport": { "x": 0, "y": 0, "w": 1200, "h": 800 },
        "blocks": []
      }
    }
  ]
}
```

`responses` contains the received `canvas.result` and `canvas.observation` envelopes, in arrival order.

On failure, print one JSON object to stdout:

```json
{
  "ok": false,
  "error": "Timed out after 5000ms waiting for canvas.observation from ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes. Ensure the frontend bridge is connected as role=bridge.",
  "request": {
    "type": "canvas.action",
    "requestId": "req_canvas_dashboard_123",
    "canvasId": "canvas_001",
    "actions": [{ "type": "read_canvas" }]
  },
  "responses": []
}
```

The script must return exit code `0` for success and non-zero for failure.

## Validation

The TypeScript zod schemas remain the source of truth for action validation. The Python script performs lightweight preflight validation only:

- `--actions` must be valid JSON.
- The parsed actions value must be a non-empty list.
- Each item must be an object with a non-empty string `type`.
- `--timeoutMs` must be a positive integer.
- `--url`, when provided, must parse as a URL.

Bridge-side validation errors are surfaced through `canvas.error` and should be included in the script response object.

## Error Handling

The script should produce stable JSON errors for:

- Missing `--actions`.
- Invalid `--actions` JSON.
- Empty or incorrectly shaped action arrays.
- Invalid timeout values.
- Invalid gateway URL.
- Missing Python WebSocket dependency.
- WebSocket connection failure.
- Timeout before a matching `canvas.observation`.
- Received `canvas.error` for the matching request.

Connection and timeout errors should include the attempted gateway URL. Timeout errors should include a hint that the frontend bridge must be connected as `role=bridge`.

## Testing

Use Python standard-library `unittest` so the repository does not need pytest. Add focused tests for:

- CLI argument parsing.
- URL normalization.
- Request envelope construction.
- Lightweight action validation.
- Response completion logic.
- Failure formatting.

Unit tests should not require a live WebSocket server. Live verification can remain a documented manual command in the skill.

## Implementation Notes

- Keep the script logic split into small functions so unit tests can cover behavior without opening sockets.
- Use snake_case file names for the Python script and tests.
- Keep stdout machine-readable. Human-oriented details belong in the JSON `error` field, not in extra print lines.
- Do not duplicate the full Canvas API schema in Python.
- Link from the skill to `CANVAS_API.md` as the source of truth while still including examples for all actions.
