# API-Only Auto-Frame Custom Components Design

**Status:** Approved design
**Date:** July 27, 2026
**Scope:** Prevent direct canvas inserts from entering automatic card frames while preserving Canvas API auto-framing

## Context

The canvas insert menu is a direct user-facing canvas action, but it currently calls the same `CanvasBridge` executor used by remote Canvas API messages. Custom component creation therefore has no persistent distinction between a toolbar insert and an API-created component. The auto-frame reconciler sees only the custom shape type and frames both.

## Goals

- Direct custom component inserts from the canvas toolbar remain page-level and are not automatically framed.
- Custom components created through the Canvas API continue to be automatically grouped by kind.
- The distinction survives reconciliation and canvas persistence/reload.
- Existing API-created components remain eligible through their existing Hermes metadata.
- Tidy continues to arrange only eligible API-created components.

## Non-Goals

- Do not change custom component types, dimensions, placement, selection, or editing behavior.
- Do not remove or redesign the insert menu.
- Do not alter the public Canvas API envelope format.
- Do not change manual frame behavior or frame ownership rules.

## Chosen Approach

Pass an internal origin option through `CanvasBridge.handleActionEnvelope`:

- Remote Canvas API and websocket calls use the default origin `api`.
- The canvas insert menu calls the bridge with origin `canvas`.

The executor stamps custom components created from the direct canvas origin with `meta.source: 'canvas'`. API-created custom components retain `meta.source: 'hermes'`, which is already assigned by the typed custom-component actions. The auto-frame planner treats only cards with `meta.source: 'hermes'` as eligible. Cards with another source, including direct inserts, are treated as unsupported for auto-frame purposes and remain untouched when they are page-level.

This keeps one creation pathway while making provenance explicit and persistent. A temporary reconciliation disable flag was rejected because it would be timing-dependent and would not survive reload. A separate UI executor was rejected because it would duplicate action behavior.

## Data Flow

1. The toolbar builds its existing create action and invokes `handleActionEnvelope(envelope, { origin: 'canvas' })`.
2. The bridge validates and executes the envelope with that origin.
3. Custom shape creation writes the origin-specific source metadata.
4. Remote API calls omit the option and default to API origin, preserving Hermes metadata.
5. The auto-frame planner filters supported card kinds by both shape classification and API provenance.
6. The reconciler creates, updates, and tidies frames only for eligible cards.

Updates to an existing direct canvas card do not make it eligible; provenance is assigned at creation and remains persisted with the shape.

## Architecture Changes

### Bridge boundary

Extend the internal bridge method with an optional origin argument. The network envelope schema remains unchanged. The websocket handler, simulator, inspector, and other existing callers continue to use the default API origin unless they explicitly represent direct canvas creation.

### Executor metadata

Thread the origin into the action executor. For typed custom component creation actions, use `source: 'canvas'` for direct toolbar creation and retain `source: 'hermes'` for API creation. Existing caller-supplied metadata for generic `create_shape` remains unchanged.

### Auto-frame eligibility

Update the pure auto-frame classification path and relevant-change detection to require Hermes/API provenance for supported cards. Managed generated frames remain identified by their existing `hermesAutoFrame` metadata. Direct cards are not moved into generated frames, reflowed, or counted by continuous reconciliation or Tidy.

## Error Handling

- Invalid envelopes continue to fail through the existing bridge validation path.
- An omitted origin defaults to `api`, preventing accidental loss of current API behavior.
- Unknown or missing source metadata is treated as ineligible for auto-framing.
- Existing reconciliation errors continue to be logged without publishing a new observation.

## Testing Strategy

- Bridge tests verify that the default origin creates Hermes-eligible custom components and the explicit canvas origin creates non-eligible components.
- Auto-frame planner/reconciler tests verify that API cards frame and direct cards remain page-level.
- Insert-menu tests verify that the toolbar passes the direct-canvas origin.
- Canvas surface regression tests verify that toolbar-created cards do not create frames while websocket/API-created cards still do.
- Existing layout, Tidy, action execution, and gateway tests remain green.

## Success Criteria

- Clicking any custom component insert button creates the component without creating or joining an auto-frame.
- Sending a supported custom component create action through the Canvas API still creates or updates the matching auto-frame.
- Tidy never captures direct toolbar-created components.
- The behavior remains correct after canvas reload because the source marker is persisted.
- No public Canvas API payload or custom component contract changes.
