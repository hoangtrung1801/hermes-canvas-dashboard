# Hermes Canvas Productivity — Product Requirements Document

**Document status:** Baseline PRD  
**Product stage:** Local-first MVP / active development  
**Version:** 0.1  
**Last updated:** July 12, 2026  
**Code baseline reviewed:** `f96af61`, including the working-tree PDF persistence foundation

## 1. Product summary

Hermes Canvas Productivity is a local-first visual workspace where a person and a Hermes agent can work on the same persistent infinite canvas. A person edits the canvas directly through tldraw. Hermes uses a small, typed action protocol to create, inspect, move, update, and remove canvas content without controlling the browser UI.

The defining product promise is continuity: agent actions must still modify the durable canvas when the browser is closed. A gateway routes actions through the live browser editor when it is connected and executes supported record-level actions headlessly when it is not. Both paths write to the same tldraw sync room and SQLite-backed state.

The current product is intended for one person, one trusted machine or private network, and one primary canvas. It is not yet an authenticated, multi-tenant collaboration service.

## 2. Problem statement

Chat is effective for generating plans, tasks, references, and summaries, but it is a poor long-lived workspace. Important context becomes buried in a transcript, related items cannot be organized spatially, and an agent cannot reliably update a visual plan without fragile browser automation.

Users need a workspace that:

- gives them a familiar, direct-manipulation infinite canvas;
- lets an agent act through structured, validated intent rather than pixel control;
- persists the same state whether changes come from the person or the agent;
- remains writable by the agent when the UI is not open; and
- returns enough structured state for the agent to verify what happened.

## 3. Vision and product principles

### Vision

Make the canvas a durable shared working memory for a person and their agent: visual for the person, structured for the agent, and available independently of either interface.

### Principles

1. **One shared source of truth.** Human edits and agent actions operate on the same tldraw records and sync room.
2. **Intent over UI automation.** Agents send typed actions and receive typed results instead of driving the browser.
3. **Observable automation.** Every action batch returns itemized results and a normalized canvas observation.
4. **Local-first by default.** Core data remains on the user's machine and the system can run as a small local service.
5. **Human control remains primary.** Agent-created content is visible, selectable, editable, and removable through the normal canvas UI.
6. **Progressive operational complexity.** The MVP optimizes for a trusted personal deployment; hosted-service controls are introduced only with an explicit product decision.

## 4. Target users and jobs

### Primary user: agent-assisted knowledge worker

A developer, researcher, operator, or planner who wants an agent to maintain a visible working board while retaining direct control over its layout and content.

Key jobs:

- turn a conversation or goal into visible notes and checklists;
- collect useful links with enough context to revisit them;
- inspect and reorganize agent-produced work spatially;
- let the agent update status or add information while the dashboard is closed; and
- reopen the workspace later without reconstructing it from chat history.

### Secondary user: local operator or integrator

The person who runs the gateway, connects Hermes or another compatible client, diagnoses action traffic, and manages local persistence.

Key jobs:

- start the frontend and gateway reliably;
- confirm bridge, action, and sync behavior;
- send action batches through a plugin, CLI, or WebSocket client;
- inspect validation and execution errors; and
- back up and restore the local canvas database.

## 5. Goals and non-goals

### MVP goals

- Provide a fullscreen tldraw workspace for direct human editing.
- Provide first-class project cards, todo blocks, link cards, and note cards.
- Allow Hermes to read and mutate the canvas through validated action batches.
- Persist canvas state in a local SQLite-backed tldraw sync room.
- Execute supported agent actions even when no browser bridge is connected.
- Give Hermes deterministic per-action results plus an observation after every valid batch.
- Provide a debug interface for integration and troubleshooting.
- Support repeatable local development and Linux service installation.

### Current non-goals

- Public internet exposure without a trusted reverse proxy.
- Multi-tenant accounts, teams, roles, billing, or organization administration.
- End-to-end encryption or encrypted local canvas storage.
- A general workflow engine, autonomous scheduler, or agent task queue.
- Server-side PDF storage or agent access to locally imported PDFs.
- Guaranteed compatibility with every arbitrary tldraw shape or binding payload.
- Mobile-native applications or offline browser editing while the gateway is unavailable.

## 6. Current scope and delivery status

| Capability | Status | Product note |
| --- | --- | --- |
| Fullscreen infinite canvas | Shipped | Default application view; debug UI is hidden unless `?debug=true` is present. |
| Native tldraw editing | Shipped | Selection, drawing, camera, styling, and standard tldraw interactions remain available. |
| Project cards | Shipped | One project per card with explicit status, priority, optional due date, derived progress, and independently mutable actions. |
| Todo blocks | Shipped | Structured title and task rows with append, completion, and removal actions. |
| Link cards | Shipped | Title, validated URL, optional description, dimensions, position, and background color. |
| Note cards | Shipped | Native tldraw rectangle with rich-text title, tag, and content. |
| Floating insert menu | Shipped | Inserts project, todo, link, or note content near the viewport center and selects it. |
| Hermes action WebSocket | Shipped | Validated batch input with result, observation, and request-level error envelopes. |
| Headless action execution | Shipped with limits | Record mutations and reads work without a browser; editor-only actions do not. |
| tldraw sync and SQLite persistence | Shipped | One SQLite database stores sync-room records. |
| Canvas Dashboard plugin and CLI | Shipped | Sends action batches to the gateway and reports structured responses. |
| Debug simulator and inspector | Shipped | Exposed in `?debug=true` mode with connection status and protocol logs. |
| Linux systemd artifacts | Shipped | Development and production-style gateway/frontend services. |
| Local PDF persistence/controller | In progress | File validation, IndexedDB storage, restore, clear, and viewer-state foundations exist. |
| Docked PDF viewer UI | Planned | Import/drop UI, pdf.js rendering, toolbar, and App integration are not yet shipped. |
| Authentication and authorization | Not started | Required before operation outside a trusted boundary. |
| Multi-client room membership | Not started | Current gateway retains one active browser bridge and one Hermes socket per canvas. |

## 7. Core user journeys

### 7.1 Human creates and edits a workspace

1. The user opens the application and sees the fullscreen canvas.
2. The user uses standard tldraw tools or the floating insert menu.
3. An inserted productivity component appears near the viewport center and is selected.
4. The user edits, moves, recolors, resizes, or deletes content directly.
5. Changes synchronize to the gateway's room and persist without a manual save action.
6. Reloading the application restores the canvas.

### 7.2 Hermes updates an open canvas

1. Hermes connects to the action endpoint for a canvas ID.
2. The browser bridge is connected and has announced readiness.
3. Hermes sends a non-empty `canvas.action` batch with a unique request ID.
4. The gateway validates and forwards the batch to the browser bridge.
5. The bridge executes actions against the mounted editor.
6. Hermes receives a `canvas.result` followed by a `canvas.observation`.
7. The user sees the changes immediately through tldraw sync/editor state.

### 7.3 Hermes updates a closed canvas

1. Hermes connects while no browser bridge is present.
2. The gateway validates the batch and selects the headless route.
3. The headless executor loads the current room records and applies supported mutations.
4. Updated records are committed to the same persistent sync room.
5. Hermes receives an itemized result and observation.
6. The changes appear when the user next opens the canvas.

### 7.4 Operator diagnoses integration behavior

1. The operator opens the application with `?debug=true`.
2. The UI shows bridge status, an action simulator, protocol logs, the canvas, and an inspector.
3. The operator sends a sample batch or observes gateway traffic.
4. Invalid envelopes surface as request errors; valid but unsuccessful operations surface as action-level errors.

### 7.5 User reads a local PDF beside the canvas (target journey)

1. The user chooses **Import PDF** or drops a PDF on the workspace.
2. The app validates and stores the most recently imported file in IndexedDB.
3. A docked right-side viewer opens without replacing the canvas.
4. The user navigates pages and adjusts zoom while continuing to edit the canvas.
5. Reloading restores the document and viewer state; clearing removes both runtime and persisted state.

This journey is a roadmap requirement until the viewer components and application integration ship.

## 8. Functional requirements

### 8.1 Canvas experience

- **CAN-01:** The default route shall render the canvas as the primary fullscreen surface.
- **CAN-02:** The canvas shall support standard tldraw creation, selection, movement, resizing, styling, camera, and deletion behavior.
- **CAN-03:** The application shall use the Hermes pastel theme and enable the grid by default.
- **CAN-04:** The insert control shall remain available above the canvas without replacing native tldraw controls.
- **CAN-05:** The insert menu shall offer Project Card, Todo Block, Link Card, and Note Card.
- **CAN-06:** Inserted content shall be placed relative to the visible viewport, assigned a unique shape ID, and selected after creation.
- **CAN-07:** The debug layout shall be opt-in through `?debug=true` and shall not alter the underlying canvas data.
- **CAN-08:** A canvas loading or bridge delay shall disable insertion until an editor and action bridge are ready.

### 8.2 Productivity components

- **CMP-01:** A todo block shall contain a non-empty title and zero or more tasks.
- **CMP-02:** Each todo task shall have an ID, non-empty text, and completion state.
- **CMP-03:** Users or agents shall be able to append, complete/uncomplete, and remove todo tasks without replacing the whole block.
- **CMP-04:** A link card shall contain a non-empty title and valid absolute URL, with optional description.
- **CMP-05:** Todo and link cards may specify a positive width/height and an initial background color.
- **CMP-06:** A note-card action shall accept a non-empty title and tag, optional content, a supported tldraw color, and size.
- **CMP-07:** Note cards shall be stored as native tldraw rectangle shapes with rich text so normal tldraw editing remains available.
- **CMP-08:** Productivity components shall appear in normalized observations with stable IDs, type, position, dimensions where available, props, and metadata.
- **CMP-09:** A project card shall represent one project with a non-empty title, explicit status, priority, optional real calendar due date, and zero or more actions.
- **CMP-10:** Project status shall be one of planned, active, blocked, or done; priority shall be low, medium, or high.
- **CMP-11:** Project progress shall be derived from completed actions, report 0% when no actions exist, and shall not implicitly change the explicit project status.
- **CMP-12:** Each project action shall have a stable ID, non-empty text, and completion state, and shall support append, text update, completion update, and removal operations.
- **CMP-13:** Project cards shall support direct title, status, priority, due-date, and action-text editing; action checkboxes shall remain directly operable while the card is selected.
- **CMP-14:** Project cards shall use a bounded, scrollable action area and visually distinguish an overdue due date unless the project status is done.

### 8.3 Agent action protocol

- **API-01:** The gateway shall expose separate WebSocket roles for Hermes actions and the browser bridge, plus a tldraw sync endpoint per room.
- **API-02:** Every action request shall contain `type: canvas.action`, a non-empty request ID, canvas ID, and at least one schema-valid action.
- **API-03:** Supported actions shall include generic shape create/update/move/delete, todo and card operations, camera operations, selection operations, and canvas read.
- **API-04:** The gateway shall reject malformed JSON or invalid envelopes with `canvas.error` and a correlatable request ID.
- **API-05:** A valid batch shall return `canvas.result` with overall status and one result item per requested action.
- **API-06:** Action result items shall identify affected shapes/bindings or provide an action-specific error.
- **API-07:** A valid batch shall also return `canvas.observation` containing canvas ID, page ID, selection, camera, and normalized shape summaries.
- **API-08:** One failed action shall not erase the result context for the remainder of a valid batch.
- **API-09:** The same action contract shall be used for browser-backed and headless execution; unsupported route-specific behavior shall return an explicit action-level error.
- **API-10:** `select_shapes` shall be treated as browser-editor-only until headless selection semantics are intentionally defined.
- **API-11:** Binding create/delete actions shall not be advertised as complete product capabilities until execution is implemented and verified on both applicable paths.
- **API-12:** Agent clients should read the canvas before mutation and verify the final observation after mutation.

The canonical wire examples and field-level contract remain in `CANVAS_API.md`.

### 8.4 Routing, synchronization, and persistence

- **SYN-01:** When a browser bridge is connected for the requested canvas, the gateway shall route Hermes actions to that bridge.
- **SYN-02:** When no bridge is connected, the gateway shall execute supported actions against the persistent room headlessly.
- **SYN-03:** Browser and headless paths shall use the same tldraw schema and record model.
- **SYN-04:** Headless writes shall preserve required tldraw record fields and become visible after a client connects.
- **SYN-05:** Canvas persistence shall be automatic; no separate application JSON snapshot/save API shall be required.
- **SYN-06:** Sync room state shall persist to local SQLite storage under the configured gateway data directory.
- **SYN-07:** The gateway shall reuse active room instances and close room storage during graceful shutdown.
- **SYN-08:** The gateway shall expose a health endpoint suitable for a local service check.
- **SYN-09:** The product shall document backup and restoration of the SQLite database before a production-readiness claim.

### 8.5 Debugging and integration

- **DBG-01:** Debug mode shall expose bridge state as disconnected, ready, or error.
- **DBG-02:** Debug mode shall record inbound, outbound, informational, and error events with enough data to correlate action requests and responses.
- **DBG-03:** The simulator shall allow an operator to exercise representative actions against the mounted canvas.
- **DBG-04:** The Canvas Dashboard plugin and CLI shall support configurable gateway URL, canvas ID, and response timeout.
- **DBG-05:** Gateway logs shall record canvas ID, request ID, selected route, and action types without requiring canvas-content logging.

### 8.6 PDF side panel (next release)

- **PDF-01:** The app shall import PDFs through a file picker and workspace drag-and-drop.
- **PDF-02:** Non-PDF or unreadable files shall fail visibly without replacing the current stored document.
- **PDF-03:** The app shall retain only the last imported PDF in browser IndexedDB.
- **PDF-04:** A valid import shall open a docked viewer while preserving canvas interaction and sync.
- **PDF-05:** The viewer shall provide previous/next page, page position, zoom in/out, fit width, close/reopen, and clear controls.
- **PDF-06:** The app shall restore the saved PDF, page, zoom, and open panel state after reload.
- **PDF-07:** Clear shall remove the saved binary and viewer metadata and reset the UI.
- **PDF-08:** PDF state shall remain client-local and separate from tldraw sync and the Hermes action protocol.
- **PDF-09:** Load, persistence, worker, and render failures shall appear inside the PDF experience and shall not crash or block the canvas.

## 9. User experience requirements

- The canvas is the visual focus; integration controls must not permanently consume space in the default experience.
- Insertion should require no coordinate knowledge from the user.
- Human edits and agent changes should look and behave like ordinary canvas content, with no separate agent-only representation.
- System state must be explicit in debug mode, especially when the bridge is disconnected or an action failed.
- Destructive actions initiated from the UI should follow native tldraw expectations; API deletion must require explicit shape IDs.
- Keyboard and pointer interaction must remain usable through tldraw. Custom menus and future PDF controls must have accessible labels, focus behavior, and Escape/outside-click dismissal where applicable.
- Errors must identify whether the request was invalid, the action failed, persistence failed, or a route lacks the required editor capability.

## 10. Non-functional requirements

### Reliability and data integrity

- Action envelopes and responses must be schema-validated at trust boundaries.
- A browser disconnect must not make record-level agent writes unavailable.
- Restarting the frontend must not lose synchronized canvas state.
- Restarting the gateway must restore existing room state from SQLite.
- Shutdown must close sync storage cleanly and safely handle repeated close requests.
- Database format/runtime upgrades must be validated against a backup because the implementation currently depends on Node's experimental `node:sqlite` API.

### Performance targets for release validation

These are product targets to instrument and validate; the current repository does not yet report production telemetry.

- A local `read_canvas` request should complete within 500 ms at p95 for a canvas with up to 1,000 shapes.
- A local batch of up to 25 ordinary mutations should return result and observation within 1 second at p95.
- The default canvas should become interactive within 3 seconds on a supported development-class machine with an existing 1,000-shape room.
- UI interactions should remain responsive while sync traffic or PDF page rendering is active.

### Compatibility and deployment

- Supported development workflow: current Node/npm-compatible environment used by the repository, Vite, and a modern browser with WebSocket and IndexedDB support.
- The repository shall provide development scripts and production build commands.
- Linux deployments shall have install/uninstall flows for development and production-style systemd services.
- Gateway, app, sync, and plugin connection settings shall be configurable through documented environment variables.

### Accessibility

- Custom controls shall expose accessible names and correct menu/button state.
- Status and error information shall not rely on color alone.
- New panels shall preserve reasonable keyboard navigation and visible focus.
- Product-specific UI should target WCAG 2.2 AA; tldraw-owned behavior is constrained by the upstream component.

## 11. Security and privacy requirements

### Current trust model

The MVP is trusted-environment software. The gateway currently binds on `0.0.0.0`, documented local connections use unencrypted WebSockets, and action/sync endpoints do not authenticate clients. Canvas data is stored unencrypted in SQLite, and planned PDF data is stored unencrypted in the browser's IndexedDB.

### Required controls before shared or public deployment

- **SEC-01:** Terminate TLS and use secure WebSockets.
- **SEC-02:** Authenticate browser, agent, and sync clients.
- **SEC-03:** Authorize each identity for a specific canvas and role.
- **SEC-04:** Enforce request size, action count, connection, and rate limits.
- **SEC-05:** Validate allowed origins and reject unknown roles rather than treating them as Hermes clients.
- **SEC-06:** Provide structured security/audit events for connections and mutations without leaking sensitive canvas bodies by default.
- **SEC-07:** Define data retention, backup protection, restore, and deletion procedures.
- **SEC-08:** Define safe URL handling for link cards and content-handling boundaries for imported PDFs.
- **SEC-09:** Provide a private-bind option and secure deployment guidance even when a reverse proxy is used.

No deployment may be described as internet-ready until these controls are implemented and verified.

## 12. Success metrics

Because the MVP is local-first and has no telemetry, initial metrics should be collected through opt-in local diagnostics or structured test runs.

### Product outcomes

- At least 95% of valid supported action batches complete without an action-level error in a controlled reliability run.
- 100% of successful mutation runs are confirmed by the returned final observation.
- Canvas state survives frontend reload and gateway restart in 100 consecutive persistence cycles without record loss.
- Headless-created content is visible and editable after browser reconnection in 100% of compatibility scenarios.
- A new operator can install, start, connect, and send a verified demo action using only repository documentation.

### Quality gates

- Type checking and production build pass.
- All non-environment-dependent automated tests pass.
- Gateway integration tests pass in an environment that permits loopback listeners.
- No advertised API action is silently ignored; it succeeds or returns an explicit error.
- Backup and recovery are exercised before a production-style release.

## 13. Release acceptance criteria

### MVP baseline

The MVP is accepted when:

1. A user can open, edit, and reload the default canvas without losing content.
2. A user can insert and directly edit project, todo, link, and note content.
3. Hermes can create, update, move, delete, and read supported content with the browser open.
4. Supported record-level mutations also work with the browser closed and appear after reconnection.
5. Every valid action batch returns itemized results and a canvas observation.
6. Invalid messages and unsupported actions fail visibly and specifically.
7. Debug mode supports connection and protocol diagnosis without changing the default experience.
8. Local development and documented Linux service flows are reproducible.
9. The automated baseline is green outside explicitly documented environment restrictions.

### PDF release

The PDF increment is accepted only when all requirements `PDF-01` through `PDF-09` pass component/integration tests and manual rendering verification, including restore, replacement, clear, and canvas-interaction scenarios.

## 14. Roadmap and priorities

### P0 — Stabilize the existing baseline

- Reconcile the failing pastel-theme expectation with the intended visual design.
- Correct the browser title/branding mismatch.
- Run and pass gateway integration tests in an environment with loopback access.
- Keep type checking and build green.
- Document and exercise SQLite backup/recovery.
- Align the public API with implemented binding behavior.

### P1 — Complete the local PDF workspace

- Build the import button and drag/drop overlay.
- Build and visually verify the pdf.js viewer panel and toolbar.
- Wire restore, reopen, replace, clear, and inline errors into both default and debug layouts.
- Add component/integration coverage while keeping PDF state separate from canvas sync.

### P2 — Harden trusted deployments

- Add structured operational logs and health detail.
- Add message/action limits, role validation, origin policy, private binding, and documented reverse-proxy configuration.
- Establish release packaging and tested service upgrade/rollback procedures.

### P3 — Decide the collaboration product boundary

Before implementation, decide whether the product remains personal/local or becomes a shared service. A shared-service direction requires identity, per-canvas authorization, multiple concurrent clients, conflict/ownership policy, retention, auditability, and a database architecture review.

## 15. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Unauthenticated gateway is reachable beyond the trusted host | Unauthorized reads or mutations | Bind privately, restrict the network, add TLS/auth before shared deployment. |
| Browser and headless executors diverge | Actions behave differently depending on UI presence | Share schemas/action logic and maintain parity tests with explicit route exceptions. |
| tldraw schema or Node SQLite changes | Persisted rooms become unreadable or corrupt | Pin versions, back up before upgrades, and run migration/recovery tests. |
| One bridge/Hermes socket is overwritten by another | Messages route to the wrong or latest client | Preserve the single-client scope now; design explicit membership/routing before collaboration. |
| Large observations grow with every batch | Latency and memory increase on complex canvases | Measure payload size, introduce pagination/filtering or incremental observations when needed. |
| Arbitrary shape payloads bypass product expectations | Invalid or unstable records | Keep schema validation, constrain advertised shapes, and test supported payload families. |
| PDF binaries exhaust browser storage | Import/restore fails or degrades the UI | Add size guidance/limits, storage-error handling, and a clear-data path. |
| Local-only telemetry hides reliability regressions | Failures are discovered late | Use deterministic soak tests and opt-in local diagnostics before adding remote analytics. |

## 16. Open product decisions

1. Is `canvas_001` intentionally the permanent single workspace, or should users create and switch canvases in the UI?
2. Should more than one Hermes client or browser bridge be allowed in a room, and how should responses be routed?
3. Should generic `create_shape` remain public, or should the supported API be limited to product-owned actions and a vetted subset of tldraw shapes?
4. Should binding actions be completed, marked experimental, or removed from the public contract?
5. What PDF file-size limit is appropriate for IndexedDB persistence and expected target devices?
6. Should PDF content ever become observable to Hermes, or remain a strictly private local reference panel?
7. Is the long-term deployment model a desktop/local companion, a private team service, or a hosted product?
8. What event and diagnostic data may be collected, retained, or exported without violating the local-first promise?

## 17. Source-of-truth references

- `README.md` — local development, examples, and Linux service operation.
- `CANVAS_API.md` — current action WebSocket contract and examples.
- `src/canvas/actions/canvasAction.schema.ts` — executable action validation.
- `src/canvas/protocol/canvasMessages.ts` — executable message-envelope validation.
- `src/canvas/tldraw/tldrawActionExecutor.ts` — browser/editor action semantics.
- `server/canvas/tldrawHeadlessExecutor.ts` — headless action semantics.
- `server/canvas/canvasGateway.ts` — routing and gateway endpoints.
- `server/canvas/tldrawSyncServer.ts` — room persistence behavior.
- `docs/superpowers/specs/` — feature-level design history.

Where this PRD and implementation differ, the discrepancy must be classified as either an implementation defect, an unshipped requirement, or an intentional PRD revision. The executable schemas are the authority for payload acceptance until the implementation and documentation are updated together.
