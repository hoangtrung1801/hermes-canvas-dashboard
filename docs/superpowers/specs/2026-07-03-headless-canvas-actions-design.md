# Headless Canvas Actions Design

## Context

Hermes agents currently send canvas actions through the Canvas Bridge WebSocket API. The gateway accepts Hermes connections as `role=hermes`, and the browser dashboard connects as `role=bridge`. Today the gateway only forwards action envelopes to the browser bridge. If the dashboard is not open, there is no bridge socket, so agent actions are dropped by the gateway and the agent-side tool eventually times out.

The repository already has the pieces needed for a headless fallback:

- `CanvasGateway` validates and routes WebSocket messages.
- `RoomManager` tracks per-canvas Hermes and bridge sockets.
- `CanvasFileStore` reads and writes persisted canvas snapshots under `data/`.
- `CanvasBridge` and `ActionExecutor` implement action execution.
- `ExcalidrawAdapter` implements `CanvasAdapter` over an `ExcalidrawApiLike` interface rather than directly depending on React.
- `canvasPersistence.ts` defines the persisted snapshot shape used by the dashboard.

## Goals

- Let agents send canvas actions without opening or activating the canvas dashboard.
- Keep the existing WebSocket action API and Python CLI contract unchanged.
- Preserve current live dashboard behavior when a dashboard bridge is connected.
- Mutate persisted canvas state when no dashboard bridge is connected.
- Auto-create a blank persisted canvas snapshot when no saved state exists.
- Return the same `canvas.result`, `canvas.observation`, and `canvas.error` envelope shapes in live and headless modes.
- Reuse existing action execution behavior instead of duplicating canvas action logic.

## Non-Goals

- Do not add a separate HTTP action endpoint.
- Do not require a hidden browser, Playwright process, or background dashboard tab.
- Do not replace the current browser bridge live path.
- Do not redesign the canvas action schema.
- Do not implement a full Excalidraw runtime on the server.

## Recommended Approach

Use the gateway as the single action entry point. When a dashboard bridge is connected, forward Hermes action envelopes to it exactly as today. When no bridge is connected, execute the action batch in the server process against the persisted snapshot.

The fallback should not create a second canvas action implementation. Instead, add a small headless implementation of `ExcalidrawApiLike` and reuse `ExcalidrawAdapter`, `CanvasBridge`, and `ActionExecutor`.

This approach keeps live and headless behavior aligned for the current action set because `ExcalidrawAdapter` already owns block ids, shape ids, todo normalization, text updates, moves, deletes, and snapshot export behavior. The real Excalidraw runtime is currently used by these actions as an element storage/update surface, not as a layout engine.

## Architecture

`RoomManager` remains responsible for room state and socket routing. It gains a bridge-presence query, for example `hasBridge(canvasId): boolean`, so the gateway can decide whether to route live or headless.

`CanvasGateway` keeps the existing WebSocket protocol. In the Hermes message branch, after validating a `canvas.action` envelope:

1. If `RoomManager` reports an attached bridge for the canvas, forward the raw message to that bridge.
2. If no bridge is attached, call a headless executor.
3. Send the generated bridge-style response envelopes back to the Hermes socket.

`HeadlessCanvasExecutor` is a new server-side module that owns the fallback workflow:

1. Load a snapshot from `CanvasFileStore`.
2. If no snapshot exists, create a blank snapshot.
3. Validate that any loaded snapshot has the expected persistence shape.
4. Build `HeadlessExcalidrawApi` from the snapshot elements.
5. Build `ExcalidrawAdapter(headlessApi, canvasId, snapshot.adapter)`.
6. Build `CanvasBridge(adapter)`.
7. Execute the validated action envelope through `CanvasBridge.handleActionEnvelope`.
8. Save the updated snapshot when execution reaches bridge result/observation output.
9. Return either `canvas.result` plus `canvas.observation`, or `canvas.error`.

`HeadlessExcalidrawApi` implements the existing `ExcalidrawApiLike` contract over plain in-memory data:

- `getSceneElements()` returns the current element array.
- `updateScene({ elements })` replaces the current element array when elements are supplied.
- `getAppState()` returns a simple default app state with no selected elements and a stable viewport.
- `scrollToContent()` is accepted but does not require real viewport calculation.

## Data Flow

Hermes continues sending:

```json
{
  "type": "canvas.action",
  "requestId": "req_001",
  "canvasId": "canvas_001",
  "actions": [{ "type": "read_canvas" }]
}
```

With a live dashboard open, the existing browser bridge handles the envelope and replies as it does today.

Without a live dashboard, the gateway fallback loads or creates:

```ts
{
  version: 1,
  canvasId,
  elements: [],
  adapter: {
    blocks: [],
    sequence: 0,
    todoTaskSequence: 0
  }
}
```

It then executes the envelope through the shared bridge/adapter path and saves:

```ts
createCanvasSnapshot({
  canvasId,
  elements: headlessApi.getSceneElements(),
  adapter: adapter.exportSnapshot()
})
```

The Hermes client receives the same response shape it already expects:

- `canvas.result`
- `canvas.observation`
- or `canvas.error`

## Correctness Notes

Headless execution is intended to match current dashboard action semantics, not full Excalidraw runtime behavior. This is correct for the current action set because block creation and mutation are implemented in `ExcalidrawAdapter` and depend only on `ExcalidrawApiLike`.

Viewport behavior is the main limitation. In headless mode, `zoom_to_fit` should succeed but should be treated as a no-op or simple app-state update. It should not fail because no visible dashboard exists.

There is one existing adapter behavior worth tightening while touching this path: `create_arrow` currently creates an arrow even when `fromBlockId` or `toBlockId` is missing, because missing block centers fall back to `{ x: 0, y: 0 }`. The implementation should either make `createArrow` return a failure when either endpoint is missing, or add executor-level validation before calling the adapter. This should be shared by live and headless mode so behavior remains consistent.

## Error Handling

Live mode remains the preferred path when a dashboard bridge is connected.

Headless mode should return normal bridge-style responses. Action-level failures, such as an unknown block, should remain inside `canvas.result` with `ok: false`, matching current `CanvasBridge` behavior.

The fallback should return `canvas.error` for:

- Invalid action envelopes rejected by the existing schema.
- Persisted snapshots that exist but do not match the expected snapshot shape.
- Corrupt JSON or unreadable state files.
- Store write failures.
- Unexpected executor failures.

If a snapshot file is missing, the fallback creates a blank snapshot. If a snapshot file exists but is invalid, the fallback must not overwrite it automatically because that could destroy user state.

## Testing

Add focused unit and integration coverage for:

- `RoomManager.hasBridge(canvasId)` reflects bridge attachment.
- Gateway still forwards to a live bridge when connected.
- Gateway executes headlessly when no bridge is connected.
- Headless `read_canvas` succeeds from a missing snapshot.
- Headless `create_text` persists both Excalidraw-like elements and adapter block state.
- Headless action-level failures return `canvas.result` with `ok: false` plus `canvas.observation`.
- Invalid or corrupt stored state returns `canvas.error` and does not overwrite the stored file.
- `zoom_to_fit` succeeds in headless mode.
- `create_arrow` missing endpoints fail consistently in both live and headless execution after the shared behavior is fixed.
- The existing Python CLI still succeeds because the response envelope shape is unchanged.

## Documentation Updates

Update the canvas dashboard skill and README/API notes to explain:

- Agents only need the gateway running for headless mutation.
- Opening the dashboard is optional for visual/live interaction.
- When the dashboard is open, it handles actions live as before.
- When the dashboard is closed, the gateway mutates the saved snapshot and the dashboard will show those changes the next time it loads the canvas.

## Acceptance Criteria

- With only `npm run server` running, the Python canvas dashboard tool can send `create_text` and receive `ok: true` with result and observation envelopes.
- The created block is written to `data/canvas_001.json`.
- Opening the dashboard after the headless action loads the persisted block.
- With the dashboard already connected as `role=bridge`, actions continue to flow through the live browser bridge.
- Missing saved state creates a blank snapshot automatically.
- Invalid existing saved state returns a structured error without overwriting the file.
