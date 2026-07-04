# tldraw Canvas Replacement Design

## Context

The current canvas app is built around Excalidraw. The frontend mounts `@excalidraw/excalidraw` in `CanvasSurface`, wraps it with `ExcalidrawAdapter`, persists Excalidraw element snapshots through `/canvas-state/:canvasId`, and uses `HeadlessExcalidrawApi` for server-side fallback action execution.

The repository already has useful boundaries:

- `CanvasGateway` owns Hermes and browser bridge WebSocket routing.
- `RoomManager` tracks bridge and Hermes sockets per canvas.
- `CanvasBridge` and `ActionExecutor` own action execution.
- `bridgeStore` shares editor, bridge, observation, status, and log state with the React UI.
- Existing tests cover action schemas, bridge behavior, persistence, and headless execution.

The replacement should remove Excalidraw completely, start from a blank tldraw room, and use tldraw sync for persisted canvas state.

The current stable `tldraw` package is `5.2.2`. The official tldraw sync documentation describes a frontend `useSync` client from `@tldraw/sync`, a server-side `TLSocketRoom` from `@tldraw/sync-core`, and SQLite persistence through `SQLiteSyncStorage` plus `NodeSqliteWrapper` for Node.js deployments. The docs also require client and server tldraw versions to match and require custom shape schemas to be known to both the sync client and server.

## Goals

- Replace Excalidraw with tldraw as the only drawing engine.
- Host tldraw sync inside the existing Node gateway server.
- Persist canvas room state to local SQLite.
- Start from a blank tldraw canvas; do not migrate existing Excalidraw JSON snapshots.
- Redesign the Hermes canvas action API to match tldraw records and editor/store operations.
- Keep the current project custom shape set in the first pass: `todo_block`, `task_card`, and `link_card`.
- Preserve Hermes gateway behavior: live browser bridge when open, server-side fallback when the dashboard is closed.
- Keep status, logs, simulator, and inspector workflows working against the new tldraw model.

## Non-Goals

- Do not keep Excalidraw as a selectable engine.
- Do not build an Excalidraw-to-tldraw scene converter.
- Do not support `file_card` or `job_panel` in this migration.
- Do not deploy the Cloudflare Durable Objects tldraw sync template.
- Do not add URL unfurling for link cards in the first pass.
- Do not preserve the old `/canvas-state/:canvasId` JSON snapshot API as the active persistence path.

## Recommended Approach

Use a full tldraw-native replacement.

The frontend will mount `<Tldraw />` with a synced store created by `useSync`. The existing Node gateway will also expose a tldraw sync endpoint backed by one `TLSocketRoom` per canvas room. Room state will persist through local SQLite. Hermes actions will be redefined around tldraw shapes, bindings, camera state, and custom shape props.

This avoids carrying forward Excalidraw-shaped persistence or the current semantic adapter as the long-term model. The only compatibility boundary is the existing gateway envelope pattern, so Hermes clients still receive `canvas.result`, `canvas.observation`, and `canvas.error` style responses.

## Architecture

### Frontend

`CanvasSurface` becomes a tldraw surface:

1. Build a sync URI from `VITE_TLDRAW_SYNC_URL` or the gateway host, targeting `/sync/:roomId`.
2. Create a tldraw store with `useSync({ uri, assets, shapeUtils, bindingUtils })`.
3. Render `<Tldraw store={store} shapeUtils={customShapeUtils} bindingUtils={customBindingUtils} />`.
4. Register the mounted `Editor` in `bridgeStore`.
5. Create the live `CanvasBridge` around a tldraw action executor rather than `ExcalidrawAdapter`.
6. Remove Excalidraw-specific snapshot loading, snapshot saving, and scene mutation code.

The first pass can use a minimal asset store because the custom shapes are text/data shapes. Image and video asset upload can be added later.

### Server

The existing gateway server remains the single local server process.

It will expose:

- `/canvas?canvasId=canvas_001&role=bridge|hermes` for Hermes action routing.
- `/sync/:roomId` for tldraw sync clients.

The sync subsystem will own:

- A local SQLite database, for example `data/tldraw-sync.sqlite`.
- A room registry that guarantees one `TLSocketRoom` per room id inside the process.
- `SQLiteSyncStorage` with `NodeSqliteWrapper` for persisted document state.
- A shared tldraw schema that includes default tldraw shapes plus the custom project shapes.

The gateway should fail startup if the SQLite sync store cannot initialize. It should not silently fall back to volatile in-memory persistence.

### Shared Shape Model

The client and server will share shape prop definitions for:

- tldraw built-in shapes and bindings.
- `todo_block`
- `task_card`
- `link_card`

The client registers `ShapeUtil` classes so the custom shapes render and interact correctly. The server registers matching schema definitions so tldraw sync can validate and migrate room data consistently.

## Hermes Action API

The new API should be tldraw-oriented. It should keep the existing envelope shape but replace the old action union.

Core actions:

- `create_shape`: create one native or custom tldraw shape.
- `update_shape`: update a shape by id with partial shape data or partial props.
- `delete_shapes`: delete one or more shape ids.
- `move_shapes`: move one or more shapes by absolute coordinates or deltas.
- `create_binding`: create a tldraw binding, primarily for arrows.
- `delete_bindings`: delete one or more bindings.
- `set_camera`: set viewport camera state when an editor is available.
- `zoom_to_fit`: fit the current page content when an editor is available.
- `select_shapes`: select one or more shape ids when an editor is available.
- `clear_selection`: clear selection when an editor is available.
- `read_canvas`: return a tldraw observation snapshot.

Convenience custom-shape actions:

- `create_todo_block`
- `append_todo_task`
- `set_todo_task_done`
- `remove_todo_task`
- `create_task_card`
- `create_link_card`

The convenience actions are not a separate adapter model. They update real tldraw custom shape records and props. They exist because Hermes productivity flows should not have to construct verbose custom shape payloads for common operations.

## Data Flow

### Browser Open

1. The dashboard connects to the tldraw sync endpoint and loads the room from SQLite-backed sync state.
2. The dashboard connects to `/canvas` as `role=bridge`.
3. Hermes sends a `canvas.action` envelope to `/canvas` as `role=hermes`.
4. The gateway forwards the envelope to the browser bridge.
5. The browser bridge executes actions through the mounted tldraw `Editor`.
6. tldraw sync persists the changed store to SQLite.
7. The browser bridge returns `canvas.result` and `canvas.observation` to Hermes through the gateway.

### Browser Closed

1. Hermes sends a `canvas.action` envelope to `/canvas` as `role=hermes`.
2. The gateway detects that no browser bridge is attached.
3. The server executes supported headless actions through a record-level executor connected to the room's sync storage.
4. SQLite sync storage persists the changed room state.
5. The gateway returns `canvas.result` and `canvas.observation`, or `canvas.error`.

Headless execution should support record-level actions first: create, update, delete, move, custom-shape prop mutations, and `read_canvas`. It does not need a browser `Editor`. Browser-only editor behavior, such as viewport-only selection effects, should return explicit unsupported-action errors if it cannot be performed safely without a mounted editor.

## Custom Shapes

### `todo_block`

Props:

- `w`
- `h`
- `title`
- `tasks`

Each task has:

- `id`
- `text`
- `done`

The shape renders as an HTML custom shape with a compact title and task rows. Task mutations update shape props directly.

### `task_card`

Props:

- `w`
- `h`
- `title`
- `body`
- `status`
- `priority`

The shape renders as an HTML custom card. Status and priority stay structured so Hermes can query and update them later.

### `link_card`

Props:

- `w`
- `h`
- `title`
- `url`
- `description`

The first pass stores and displays the URL directly. URL unfurling can be added later through tldraw external asset handling.

## Persistence And Migration

tldraw sync becomes the only persisted canvas state path.

The frontend will no longer call `GET /canvas-state/:canvasId` or `PUT /canvas-state/:canvasId`. Saving happens through sync. Existing Excalidraw JSON files under `data/` are ignored by the new runtime. A room starts blank when no SQLite state exists.

The implementation should remove or retire:

- `canvasPersistence.ts`
- `CanvasFileStore` usage for live canvas state
- `ExcalidrawAdapter`
- `HeadlessExcalidrawApi`
- `headlessExcalidrawApi` tests
- Excalidraw-specific element types
- `@excalidraw/excalidraw` dependency

The implementation should add:

- `tldraw`
- `@tldraw/sync`
- `@tldraw/sync-core`
- A Node SQLite driver compatible with `NodeSqliteWrapper`

Client and server tldraw package versions must be kept in lockstep because tldraw sync does not guarantee indefinite server backward compatibility across client versions.

## Error Handling

Validation errors return `canvas.error` with schema details.

Action-level failures return `canvas.result` entries with `ok: false` or per-action errors, matching the current gateway style.

Expected action failures include:

- Unknown shape ids.
- Unknown binding ids.
- Invalid custom shape props.
- Unsupported headless-only editor behavior.
- Attempts to mutate shapes with incompatible shape types.

Gateway startup fails if:

- SQLite cannot open.
- tldraw sync schema registration fails.
- Required sync dependencies are missing.

Sync connection failures should be visible in the dashboard status/log UI. The dashboard should not pretend the canvas is saved when the sync client is disconnected.

## Testing

Add focused coverage for:

- New tldraw action schema validation.
- Custom shape prop defaults and invalid prop rejection.
- `create_shape`, `update_shape`, `delete_shapes`, `move_shapes`, and `read_canvas`.
- Custom helper actions for todo blocks, task cards, and link cards.
- Browser bridge execution through a mounted tldraw editor.
- Headless execution when no browser bridge is connected.
- SQLite sync store initialization.
- Room reuse so only one `TLSocketRoom` exists per room id in the gateway process.
- Blank-room startup when no SQLite data exists.
- Failure behavior when SQLite initialization fails.
- Typecheck/build coverage for client and server tldraw APIs.

## Documentation Updates

Update README and `CANVAS_API.md` to describe:

- The tldraw sync endpoint.
- Required server and frontend environment variables.
- Local SQLite persistence location.
- The new tldraw-oriented Hermes action schema.
- The custom shape payloads and helper actions.
- The fact that existing Excalidraw JSON snapshots are not migrated.

Update plugin and skill documentation if they currently show old Excalidraw-style action examples.

## Acceptance Criteria

- `npm run server` starts the Hermes gateway and tldraw sync server with local SQLite persistence.
- `npm run dev` opens a dashboard powered by tldraw, not Excalidraw.
- Creating and editing shapes in the browser persists through tldraw sync and survives server/browser restart.
- Hermes can create, update, delete, move, and read tldraw shapes.
- Hermes can create and update `todo_block`, `task_card`, and `link_card` custom shapes.
- Hermes actions still work when the browser dashboard is closed for supported store-level operations.
- Existing Excalidraw dependencies, adapters, and persistence code are removed or replaced.
- Tests, typecheck, and build pass.
