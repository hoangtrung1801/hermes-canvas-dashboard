# Hermes Canvas Productivity

## A local-first visual workspace for agent-directed work

**Project white paper**  
**Version reviewed:** `main` at `f96af61`  
**Review date:** July 12, 2026

## Executive summary

Hermes Canvas Productivity is a local-first visual workspace in which people and Hermes agents can create, inspect, and organize work on an infinite tldraw canvas. Its differentiating idea is a small, validated action protocol: an agent expresses intent as a batch of typed canvas actions, rather than attempting to manipulate the browser UI directly. The same actions work while the dashboard is open and when it is closed, preserving a reliable automation path.

The system combines a React/tldraw client, a Node.js WebSocket gateway, and tldraw's SQLite-backed sync rooms. A connected browser applies actions through the live tldraw editor and participates in real-time sync. When no browser is connected, the gateway applies supported record-level operations directly to the same persisted room. Hermes receives a result for each requested operation plus a normalized observation of the canvas state.

The project is well suited to a single-user or trusted local-network productivity environment: planning boards, agent-produced checklists, visual notes, and link collections. It is not yet a multi-tenant or internet-facing collaboration service. The gateway has no authentication or authorization layer, listens on all interfaces by default, and stores state in a local SQLite file. Production use beyond a trusted boundary therefore requires access controls, TLS termination, backup and recovery practices, and operational monitoring.

## The problem

Agents can produce useful plans, tasks, links, and summaries, but a chat transcript is a weak medium for spatial planning and ongoing execution. A useful workspace needs to let humans and agents share a durable visual model without requiring the agent to drive pixels in a browser.

Hermes Canvas addresses this by providing:

- an interactive, free-form visual canvas for people;
- a structured action surface for Hermes and automation;
- durable canvas persistence independent of a browser session; and
- a compact observation format agents can use to understand the resulting canvas.

The design intentionally moves away from application-specific JSON snapshots and uses tldraw records and sync as the source of truth. This reduces the gap between what people edit and what automation changes.

## Product capabilities

Today, the canvas supports native tldraw shapes alongside the following productivity-oriented components:

- Todo blocks, with a title and structured task rows. Hermes can create a block, append a task, mark a task complete, or remove one.
- Link cards, which hold a title, URL, and optional description.
- Note cards, represented as native tldraw rectangles with rich-text title, tag, and body content.
- General shape operations: create, update, move, delete, select, clear selection, set camera, zoom to fit, and read the current canvas.

The normal user experience is a fullscreen tldraw workspace with a floating insert menu and a pastel theme. A query-parameter debug mode exposes the bridge status, action simulator, event logs, and inspector for development and operator troubleshooting.

The repository also includes a Canvas Dashboard plugin and Python CLI for sending action batches to a running gateway. They offer a practical integration point for Hermes-capable clients and automation.

## Architecture

```text
                 canvas.action batches
  Hermes/CLI  ---------------------------->  Node / Fastify gateway
                                                  |           |
                                   bridge present |           | no bridge
                                                  v           v
                                            Browser bridge  Headless executor
                                            (tldraw Editor) (tldraw records)
                                                  \           /
                                                   \         /
                                             tldraw sync room
                                                    |
                                            SQLite persistence
                                                    |
                         canvas.result + canvas.observation returned to Hermes
```

### Client

The Vite/React frontend mounts tldraw with `useSync`, connecting to `/sync/:canvasId`. It registers the project custom shape utilities and shared schema, applies the project theme, and keeps a mounted tldraw editor available to the `CanvasBridge`. The bridge validates inbound action envelopes, executes them against that editor, and returns both per-action results and an observation.

The frontend separates connection and canvas state from feature-specific state. `bridgeStore` owns bridge status, editor references, observations, and debug logs. This separation is already being followed by the in-progress PDF work, which has its own Zustand store and IndexedDB persistence adapter.

### Gateway and protocol

The Fastify gateway exposes a health endpoint and two WebSocket families:

| Endpoint | Purpose |
| --- | --- |
| `/canvas?canvasId=…&role=hermes` | Receives validated Hermes action batches. |
| `/canvas?canvasId=…&role=bridge` | Connects the active browser bridge. |
| `/sync/:roomId` | Hosts the tldraw sync socket for a room. |

An action envelope has a `requestId`, a `canvasId`, and a non-empty list of actions. The gateway parses Hermes traffic with Zod before routing it. If a bridge is connected for the canvas, it forwards the raw validated request to that browser. Otherwise it invokes the headless executor. Browser responses are likewise validated before being sent back to Hermes.

The response contract is intentionally observable and machine-friendly:

- `canvas.result` reports overall success and an itemized result for each action, including created, updated, or deleted identifiers and action-level errors.
- `canvas.observation` returns canvas/page identifiers, selected shapes, camera state, and normalized shape summaries.
- `canvas.error` represents malformed envelopes or other request-level failures.

This distinction matters: a batch can be valid yet contain an operation that cannot be completed, such as changing an unknown shape. In that case Hermes receives a result with `ok: false` and a specific failed item rather than losing the rest of the response context.

### Persistence and headless continuity

Each canvas maps to a tldraw `TLSocketRoom`. The room manager reuses rooms within the gateway process and backs them with `SQLiteSyncStorage` through Node's SQLite driver. By default, state lives at `data/tldraw-sync.sqlite`.

When the user is editing in a browser, normal tldraw sync persists changes. When the browser is absent, the headless executor rebuilds a lightweight action target from the room's current records, runs the shared action bridge, and commits changed shape records back to the same room. It preserves required tldraw record fields such as page parent, index, rotation, lock status, and opacity. Consequently, agent writes do not depend on an open dashboard and appear when the user reconnects.

Not every action has equivalent headless semantics. Record-level create, update, move, delete, todo mutations, and reads are supported. Browser-editor behavior such as `select_shapes` explicitly requires a mounted editor. Binding creation and deletion are validated protocol members but are not implemented by the first executor pass; they return an action-level error.

## Why this approach

The architecture makes three deliberate tradeoffs.

First, it treats the visual canvas as a shared data model, not a screenshot or a browser-only artifact. The tldraw record model enables real-time human editing and deterministic automation against the same durable state.

Second, it preserves a narrow protocol boundary. Hermes clients need only generate JSON action batches and interpret results/observations. They do not need direct access to the browser, the tldraw editor API, or the SQLite database.

Third, it favors local simplicity over distributed service infrastructure. A single Node process and a local SQLite database are straightforward to run, test, and install as Linux systemd services. This is appropriate for a personal workspace or a small trusted deployment, while leaving room for a future hosted topology.

## Deployment and operation

For local development, the gateway runs with `npm run server` and the frontend with `npm run dev`. The client can derive its tldraw sync address from `VITE_CANVAS_GATEWAY_URL`, or use `VITE_TLDRAW_SYNC_URL` explicitly. The default canvas is `canvas_001`; the protocol and room design support other canvas identifiers.

The repository provides production and development systemd templates and installer scripts. Production mode serves the built frontend from `dist/` and runs the gateway as a separate service. Environment variables configure gateway and app ports, static content location, sync URL, and client/CLI connection targets.

The operational data to protect is the SQLite sync database. At minimum, deployments should back up `data/tldraw-sync.sqlite` consistently, test recovery, and ensure the service account has appropriate directory permissions. The project uses Node's experimental `node:sqlite` API, so the deployed Node runtime must support it and upgrades should be validated against a backup copy of the database.

## Security and trust boundary

The current implementation should be treated as trusted-environment software.

- The gateway binds to `0.0.0.0` and the documented defaults use unencrypted `ws://` endpoints.
- The action and sync endpoints have schema validation but no identity, authentication, role-based authorization, rate limiting, or per-canvas access policy.
- Anyone who can reach the Hermes WebSocket may issue canvas actions for a known canvas ID. Anyone who can reach the sync endpoint may attempt to join its room.
- Canvas contents, including URLs and notes, are stored unencrypted in the local SQLite file. The in-progress PDF feature stores a local document in the browser's IndexedDB.

Before exposing the service outside a private host or network, place it behind TLS and an authenticated reverse proxy, restrict network access, bind privately where possible, introduce server-side identity and canvas authorization, set request/message limits, and add audit logging. A future multi-user deployment should also define conflict, ownership, and retention policies rather than relying only on tldraw synchronization.

## Current maturity and quality evidence

The codebase has focused unit and component coverage for action validation, protocol envelopes, tldraw execution, custom shapes, observations, SQLite room behavior, headless action execution, client configuration, Linux service artifacts, the CLI, and PDF persistence/controller logic.

This review ran `npm test` on July 12, 2026. Of 94 tests, 84 passed. The gateway integration suite could not bind local ports in the constrained review environment (`EPERM`), so its eight failures do not establish an application failure; those tests need to be rerun in an environment that permits loopback listeners. Two non-environmental assertions also failed:

- The pastel theme test expects the yellow light theme values to include a `solid` fill and a yellow `noteFill`, while the current theme does not match that expectation.
- The branding metadata test expects the document title `Hermes Canvas Productivity | Visual Workspace`, but `index.html` currently uses `Htu Dashboard`.

These issues should be resolved before calling the current main branch fully green. Type checking and production build were not reached because the combined verification command stopped after the failing test suite.

## In-progress PDF workspace feature

The current branch contains an implemented foundation for local PDF persistence: PDF-file validation, binary reading, an IndexedDB record for the most recently opened document, restoration, viewer page/zoom state persistence, clearing, and controller tests. It is deliberately isolated from canvas sync and bridge state.

The designed user feature is larger: an Import PDF command, drag-and-drop overlay, a docked pdf.js viewer panel, page controls, zoom controls, and visible failure states. Those UI components are not yet wired into `App.tsx` or `CanvasSurface`; therefore a persisted PDF cannot yet be viewed through the application interface. The white paper treats PDF viewing as planned/in progress, not as a shipped product capability.

## Recommended next steps

1. Complete the PDF viewer UI and integration tests, then verify that it remains strictly client-local and does not disrupt canvas sync.
2. Restore a green baseline by reconciling the pastel-theme expectation and the browser title assertion; rerun gateway integration tests where local port binding is allowed.
3. Decide whether the product is strictly local/trusted or intended for shared deployment. If shared, prioritize authenticated WebSockets, TLS, private binding or reverse-proxy controls, rate limits, audit logs, and backup/recovery documentation.
4. Complete or remove unsupported binding actions from the public API so the contract reflects implemented behavior.
5. Add operational metrics and structured error logging for sync-room initialization, headless execution failures, disconnected bridges, database health, and backup status.

## Conclusion

Hermes Canvas Productivity establishes a strong foundation for human-agent visual collaboration: a real canvas for people, a typed and observable command surface for agents, and persistence that survives the absence of the UI. Its local-first design keeps the system understandable and practical, while its protocol and shared tldraw model offer a credible path to richer automation and collaboration. The next stage is less about broadening the canvas itself and more about hardening the operational and security boundary, closing the current PDF feature loop, and maintaining a verified release baseline.
