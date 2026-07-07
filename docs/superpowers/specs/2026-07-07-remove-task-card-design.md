# Remove Task Card Design

## Context

Hermes Canvas currently supports several first-party component creation paths:

- Todo Block through `todo_block` and `create_todo_block`
- Task Card through `task_card` and `create_task_card`
- Link Card through `link_card` and `create_link_card`
- Native Note Card through tldraw `note` and `create_note_card`

The Task Card component should be removed from the application and from the canvas-dashboard plugin. Existing saved canvases that contain `task_card` records do not need compatibility. New `create_task_card` requests should be rejected.

## Goals

- Remove Task Card as a supported Hermes custom component.
- Reject new `create_task_card` actions through the existing action validation path.
- Remove Task Card from the floating insert menu and simulator presets.
- Remove Task Card from active user-facing docs.
- Remove Task Card guidance and examples from the `canvas-dashboard` plugin skill and tests.
- Preserve Todo Block, Link Card, and Native Note Card behavior.

## Non-Goals

- Do not migrate existing `task_card` records.
- Do not keep a compatibility renderer for old `task_card` shapes.
- Do not add a no-op or soft-deprecation path for `create_task_card`.
- Do not scrub historical specs and implementation plans under `docs/superpowers`.
- Do not remove todo task support; task-like todo items remain part of Todo Block.
- Do not add plugin-side duplicate validation for every allowed bridge action.

## Selected Approach

Hard remove Task Card support and let bridge schema validation reject new task-card creation.

This matches the desired behavior: old `task_card` records may become unsupported or ignored, and new `create_task_card` payloads should fail instead of being accepted silently.

## Architecture Changes

The supported component set becomes:

- `todo_block`, created by `create_todo_block`
- `link_card`, created by `create_link_card`
- native tldraw `note`, created by `create_note_card`

Remove `task_card` from:

- custom shape constants and type unions
- migration exports and schema registration
- custom shape utility registration
- default props and prop helper functions
- executor create-action routing
- tests that assert task-card behavior

Because `task_card` is no longer registered as a custom shape type, existing persisted records of that type are outside the supported behavior.

## API Behavior

Remove `CreateTaskCardAction` from `CanvasAction` and remove `create_task_card` from `canvasActionSchema`.

After removal, payloads like this are invalid:

```json
{
  "type": "create_task_card",
  "title": "Old task",
  "x": 100,
  "y": 120
}
```

The existing envelope validation path should reject the payload. No custom compatibility error is required.

Generic `create_shape` remains available for registered tldraw shapes and supported custom shapes. It is not a supported way to create `task_card` after the task-card custom shape type is removed.

## UI Behavior

Remove Task Card from:

- `CanvasInsertMenu`
- Action Simulator presets
- Inspector type filter
- task-card-specific badge styling

The insert menu should continue to offer:

- Todo Block
- Link Card
- Note Card

The simulator should keep useful examples for supported actions, including Todo Block, Todo actions, Link Card, Note Card, and generic tldraw shapes.

## Plugin Behavior

Update the `plugins/canvas-dashboard` active surfaces:

- Remove `task cards` from the skill "When to Use" text.
- Remove the `create_task_card` action section.
- Replace batch examples that use task cards with Note Card, Todo Block, or Link Card examples.
- Update plugin tests that currently use `create_task_card` payloads.

The plugin JSON schema currently accepts generic canvas action objects. Do not add a plugin-side allowlist for this change. The bridge action schema remains the source of truth and rejects unsupported action types.

## Active Documentation

Update active docs only:

- `README.md`
- `CANVAS_API.md`
- `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`

Historical planning and design files under `docs/superpowers` should remain unchanged.

## Testing

Add or update focused tests to prove:

- `canvasActionSchema` rejects `create_task_card`.
- Executor tests no longer create or observe `task_card`.
- Custom shape utility registration excludes Task Card.
- Tldraw schema registration excludes `task_card`.
- Insert menu no longer shows Task Card.
- Insert menu still creates Todo Block, Link Card, and Note Card.
- Simulator presets no longer include Sprint Task Card.
- Active docs and plugin skill text no longer mention `create_task_card` or Task Card as a supported component.
- Plugin tests no longer use `create_task_card` examples.
- Full test suite and TypeScript type checking pass.

## Implementation Notes

- Remove task-card code rather than hiding it behind feature flags.
- Keep todo task IDs and todo task actions intact.
- Be careful not to remove references to generic task items inside Todo Block examples.
- Keep historical docs untouched even though they mention past Task Card work.
