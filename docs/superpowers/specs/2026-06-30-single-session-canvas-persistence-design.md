# Single-Session Canvas Persistence Design

## Context

The app uses one fixed Excalidraw-backed canvas, `canvas_001`. `CanvasSurface` creates a fresh `ExcalidrawAdapter` on mount and stores the bridge in Zustand. The adapter keeps structured block data in memory, while Excalidraw keeps visual elements in its scene. Reloading the page currently creates a new adapter and loses both the adapter block registry and the rendered scene.

## Goal

Persist one machine-local canvas session so reloading or reopening the app restores the same `canvas_001` workspace from a JSON file.

## Scope

- Keep a single fixed canvas session: `canvas_001`.
- Persist on the machine as `data/canvas_001.json`.
- Restore both Excalidraw scene elements and adapter block metadata.
- Do not add a session picker, multiple canvas IDs, database persistence, or cross-device sync.

## Architecture

Add adapter snapshot support to `ExcalidrawAdapter`. A snapshot contains:

- `blocks`: the structured `CanvasBlock[]` registry Hermes actions depend on.
- `sequence`: the current block/element ID counter.
- `todoTaskSequence`: the current todo task ID counter.

Add a focused server-side file store. The gateway process serves both the existing WebSocket gateway and a local HTTP file API:

- `GET /canvas-state/canvas_001`: load the saved JSON snapshot.
- `PUT /canvas-state/canvas_001`: atomically write the JSON snapshot to `data/canvas_001.json`.

The frontend persistence helper talks to this API. The stored payload contains:

- `version`: numeric schema version.
- `canvasId`: `canvas_001`.
- `elements`: Excalidraw scene elements.
- `adapter`: adapter snapshot.

`CanvasSurface` asynchronously loads the saved payload when Excalidraw provides its API, restores saved elements with `updateScene`, constructs the adapter with saved metadata, registers the bridge, and writes the initial observation. After Hermes actions mutate canvas state, `CanvasSurface` saves the current scene and adapter snapshot. Excalidraw `onChange` also saves visual changes so user edits survive reloads.

## Error Handling

If the local server is unavailable, the file is missing, the payload is malformed, the payload is for another canvas ID, or a future unsupported version is returned, the app starts with an empty canvas and logs no fatal error. Save failures are ignored so drawing and Hermes actions still work.

## Testing

- Adapter tests verify snapshot export/import preserves blocks and continues ID generation without collisions.
- File store tests verify snapshots are saved and loaded from JSON files.
- Gateway integration tests verify `GET` and `PUT /canvas-state/canvas_001`.
- Canvas surface tests verify a saved payload restores Excalidraw elements and adapter state.
- Canvas surface tests verify action handling saves the changed canvas snapshot through the HTTP file API.
