# Single-Session Canvas Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reloading or reopening the browser restores the same fixed `canvas_001` canvas.

**Architecture:** Add snapshot import/export to `ExcalidrawAdapter`, add a server-side JSON file store exposed through `GET` and `PUT /canvas-state/canvas_001`, and wire `CanvasSurface` to restore once on mount and save after actions or Excalidraw changes. The persisted payload stores both visual elements and the adapter block registry.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Excalidraw, Zustand, Node HTTP server, JSON file storage.

---

## File Structure

- Modify `src/canvas/adapters/ExcalidrawAdapter.ts`: add snapshot types plus constructor hydration/export methods.
- Modify `src/canvas/adapters/canvasAdapter.ts`: expose optional snapshot support through the concrete adapter only, not the shared adapter interface.
- Create `server/canvas/canvasFileStore.ts`: save/load one versioned `canvas_001` payload from `data/canvas_001.json`.
- Modify `server/canvas/canvasGateway.ts`: serve `GET` and `PUT /canvas-state/canvas_001` alongside the existing WebSocket gateway.
- Create `src/canvas/state/canvasPersistence.ts`: load/save one versioned `canvas_001` payload through the HTTP file API.
- Test `src/canvas/state/canvasPersistence.test.ts`: verify endpoint generation, malformed, missing, mismatched, and valid payload behavior.
- Modify `src/canvas/components/CanvasSurface.tsx`: restore saved scene, save on change/action, keep `canvas_001`.
- Modify `src/canvas/components/CanvasSurface.test.tsx`: verify restore and save behavior.
- Modify `src/canvas/adapters/ExcalidrawAdapter.test.ts`: verify adapter snapshot round trip.

### Task 1: Adapter Snapshots

- [ ] Write a failing test in `src/canvas/adapters/ExcalidrawAdapter.test.ts` that creates a todo block, exports a snapshot, constructs a new adapter with that snapshot, verifies `getCanvasState().blocks`, and creates another block whose ID does not collide.
- [ ] Run `npm test -- src/canvas/adapters/ExcalidrawAdapter.test.ts` and confirm the new test fails because snapshot support does not exist.
- [ ] Add `ExcalidrawAdapterSnapshot` and constructor hydration support to `src/canvas/adapters/ExcalidrawAdapter.ts`.
- [ ] Run `npm test -- src/canvas/adapters/ExcalidrawAdapter.test.ts` and confirm the adapter tests pass.

### Task 2: Persistence Helper

- [ ] Create failing tests in `server/canvas/canvasFileStore.test.ts` and `src/canvas/state/canvasPersistence.test.ts` for JSON file save/load, HTTP endpoint generation, loading valid payloads, ignoring missing/malformed/mismatched snapshots, and saving payloads through `PUT`.
- [ ] Run `npm test -- src/canvas/state/canvasPersistence.test.ts` and confirm the file fails because the helper does not exist.
- [ ] Create `server/canvas/canvasFileStore.ts` and update `src/canvas/state/canvasPersistence.ts` with `loadCanvasSnapshot` and `saveCanvasSnapshot`.
- [ ] Run `npm test -- src/canvas/state/canvasPersistence.test.ts` and confirm the persistence tests pass.

### Task 3: CanvasSurface Restore And Save

- [ ] Extend `src/canvas/components/CanvasSurface.test.tsx` with a failing restore test that mocks the HTTP file API, mounts the app, and expects Excalidraw `updateScene` to receive saved elements.
- [ ] Add a failing save test that sends a `canvas.action` through the mocked WebSocket and expects a `PUT /canvas-state/canvas_001` payload containing adapter blocks after the action.
- [ ] Run `npm test -- src/canvas/components/CanvasSurface.test.tsx` and confirm the new tests fail for missing restore/save wiring.
- [ ] Wire `CanvasSurface` to load the snapshot in `excalidrawAPI`, hydrate `ExcalidrawAdapter`, save in `onChange`, and save after successful action handling.
- [ ] Run `npm test -- src/canvas/components/CanvasSurface.test.tsx` and confirm the component tests pass.

### Task 4: Full Verification

- [ ] Run `npm test -- src/canvas/adapters/ExcalidrawAdapter.test.ts src/canvas/state/canvasPersistence.test.ts src/canvas/components/CanvasSurface.test.tsx`.
- [ ] Run `npm run lint:types`.
- [ ] Review `git diff --stat` and `git diff -- src/canvas/adapters/ExcalidrawAdapter.ts src/canvas/state/canvasPersistence.ts src/canvas/components/CanvasSurface.tsx` for accidental unrelated edits.
