# Get Todo Block Data Action Design

## Context

Hermes can already create and mutate `todo_block` canvas blocks. Todo tasks are stored on each block as structured data in `block.props.tasks`, and `read_canvas` exposes the full canvas observation. Hermes needs a smaller action that returns the todo data for one known block id without requiring clients to filter the entire canvas state.

## Action Contract

Add a new canvas action:

```json
{ "type": "get_todo_block_data", "blockId": "block_0001" }
```

The action requires a non-empty `blockId`. It does not mutate the canvas.

## Result Contract

The matching `canvas.result.results[]` item returns:

```ts
{
  actionType: 'get_todo_block_data'
  matchedBlockIds: string[]
  todoBlock: {
    id: string
    name?: string
    tasks: TodoTask[]
  }
}
```

`TodoTask` keeps the existing shape: `{ id: string; text: string; done: boolean }`.

## Error Handling

If `blockId` does not exist, return an action result with `error: "Unknown block <blockId>"`.

If the block exists but is not a `todo_block`, return an action result with `error: "Block <blockId> is not a todo block"`.

The bridge keeps current batch behavior: it executes every action, sets `canvas.result.ok` to `false` if any action result has an error, and still returns a `canvas.observation`.

## Implementation Notes

- Add `GetTodoBlockDataAction` to the canvas action union.
- Add zod validation for the new discriminated action.
- Extend `ActionExecutionResult` and protocol result validation with `todoBlock` and the existing task-id result fields.
- Resolve the data from `adapter.getBlockById(blockId)` inside `ActionExecutor`; no adapter method is required.
- Keep `canvas.observation` unchanged.
- Add a simulator preset for manual use.
- Document the action in `CANVAS_API.md`.

## Tests

- Schema accepts `get_todo_block_data` with `blockId`.
- Bridge returns structured todo data for a todo block id.
- Bridge returns an error for an unknown block id.
- Bridge returns an error when the block id points to a non-todo block.
- Protocol schema accepts `todoBlock`, `createdTaskIds`, `updatedTaskIds`, and `deletedTaskIds` in result items.
