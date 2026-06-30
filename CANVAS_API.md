# Canvas API

This document describes the WebSocket protocol and action payloads used by the Hermes Canvas Bridge.

## Connection

Gateway URL:

```text
ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes
```

Roles:

- `role=hermes`: sends `canvas.action` envelopes to the browser bridge.
- `role=bridge`: browser client receives actions and sends results/observations back.

The `canvasId` query parameter selects the canvas room. The same `canvasId` must be used by both Hermes and the browser bridge.

## Hermes To Canvas Envelope

Hermes sends exactly one envelope type: `canvas.action`.

```json
{
  "type": "canvas.action",
  "requestId": "req_001",
  "canvasId": "canvas_001",
  "actions": [
    { "type": "read_canvas" }
  ]
}
```

Schema:

```ts
type CanvasActionEnvelope = {
  type: 'canvas.action'
  requestId: string
  canvasId: string
  actions: CanvasAction[] // min length: 1
}
```

## Canvas To Hermes Envelopes

### canvas.ready

Sent by the browser bridge when the canvas is mounted.

```json
{
  "type": "canvas.ready",
  "canvasId": "canvas_001",
  "roomId": "room_001"
}
```

### canvas.result

Sent after an action batch is executed.

```json
{
  "type": "canvas.result",
  "requestId": "req_001",
  "ok": true,
  "results": [
    {
      "actionType": "create_todo_block",
      "createdBlockIds": ["block_0001"],
      "createdShapeIds": ["element_0002", "element_0003"],
      "createdTaskIds": ["task_docs"]
    }
  ]
}
```

Runtime result item fields:

```ts
type ActionExecutionResult = {
  actionType: CanvasAction['type']
  createdBlockIds?: string[]
  updatedBlockIds?: string[]
  deletedBlockIds?: string[]
  createdShapeIds?: string[]
  createdTaskIds?: string[]
  updatedTaskIds?: string[]
  deletedTaskIds?: string[]
  matchedBlockIds?: string[]
  error?: string
}
```

### canvas.observation

Sent after a successful action batch, including `read_canvas`.

```json
{
  "type": "canvas.observation",
  "requestId": "req_001",
  "canvasId": "canvas_001",
  "state": {
    "canvasId": "canvas_001",
    "selectedShapeIds": [],
    "viewport": { "x": 0, "y": 0, "w": 1200, "h": 800 },
    "blocks": []
  }
}
```

Schema:

```ts
type CanvasObservation = {
  type: 'canvas.observation'
  requestId: string
  canvasId: string
  state: {
    canvasId: string
    selectedShapeIds: string[]
    viewport: { x: number; y: number; w: number; h: number }
    blocks: CanvasBlock[]
  }
}
```

### canvas.error

Sent when the gateway or bridge rejects a message/action.

```json
{
  "type": "canvas.error",
  "requestId": "req_001",
  "message": "Unknown block block_9999"
}
```

## Shared Types

```ts
type CanvasBlockType =
  | 'text'
  | 'box'
  | 'note'
  | 'todo_block'
  | 'task_card'
  | 'link_card'
  | 'file_card'
  | 'job_panel'

type CanvasBlock = {
  id: string
  name?: string
  type: CanvasBlockType
  x: number
  y: number
  w?: number
  h?: number
  text?: string
  props?: Record<string, unknown>
  shapeIds: string[]
}

type TodoTask = {
  id: string
  text: string
  done: boolean
}

type TodoTaskInput =
  | string
  | {
      id?: string
      text: string
      done?: boolean
    }
```

Validation notes:

- `x`, `y`: any number.
- `w`, `h`: optional positive numbers.
- Required string ids/text/name fields must be non-empty where noted.
- `url` must be a valid URL.
- `actions` must contain at least one action.
- Unknown or invalid messages are returned as `canvas.error`.

## Actions

### create_text

Creates a text block.

```json
{
  "type": "create_text",
  "text": "Hello from Hermes",
  "x": 100,
  "y": 120,
  "name": "Greeting"
}
```

Schema:

```ts
type CreateTextAction = {
  type: 'create_text'
  text: string // non-empty
  x: number
  y: number
  name?: string
}
```

Result fields:

- `createdBlockIds`
- `createdShapeIds`

### create_box

Creates a rectangular block. If `text` is provided, it is rendered inside the block.

```json
{
  "type": "create_box",
  "name": "Container",
  "text": "Planning area",
  "x": 80,
  "y": 80,
  "w": 650,
  "h": 420
}
```

Schema:

```ts
type CreateBoxAction = {
  type: 'create_box'
  x: number
  y: number
  w?: number // positive
  h?: number // positive
  name?: string
  text?: string
}
```

Result fields:

- `createdBlockIds`
- `createdShapeIds`

### create_note

Creates a note block.

```json
{
  "type": "create_note",
  "text": "Architecture note",
  "x": 450,
  "y": 150,
  "name": "Note"
}
```

Schema:

```ts
type CreateNoteAction = {
  type: 'create_note'
  x: number
  y: number
  text: string // non-empty
  name?: string
}
```

Result fields:

- `createdBlockIds`
- `createdShapeIds`

### create_todo_block

Creates a todo block with optional initial tasks.

```json
{
  "type": "create_todo_block",
  "name": "Launch Checklist",
  "x": 100,
  "y": 150,
  "tasks": [
    { "id": "task_copy", "text": "Write launch copy" },
    { "id": "task_assets", "text": "Prepare screenshots", "done": true },
    "Ship release"
  ],
  "props": {
    "priority": "high"
  }
}
```

Schema:

```ts
type CreateTodoBlockAction = {
  type: 'create_todo_block'
  x: number
  y: number
  name: string // non-empty
  tasks?: TodoTaskInput[]
  props?: Record<string, unknown>
}
```

Result fields:

- `createdBlockIds`
- `createdShapeIds`
- `createdTaskIds`

### create_task_card

Creates a task card. If `text` is provided, it is rendered inside the card.

```json
{
  "type": "create_task_card",
  "name": "Design import modal",
  "text": "Create modern modal UI",
  "x": 100,
  "y": 120,
  "props": {
    "status": "todo",
    "priority": "medium",
    "assignee": "Hermes"
  }
}
```

Schema:

```ts
type CreateTaskCardAction = {
  type: 'create_task_card'
  x: number
  y: number
  name: string // non-empty
  text?: string
  props?: Record<string, unknown>
}
```

Result fields:

- `createdBlockIds`
- `createdShapeIds`

### create_link_card

Creates a link card. The visible text includes the name and URL.

```json
{
  "type": "create_link_card",
  "name": "Excalidraw Documentation",
  "url": "https://docs.excalidraw.com",
  "x": 100,
  "y": 350,
  "props": {
    "category": "docs"
  }
}
```

Schema:

```ts
type CreateLinkCardAction = {
  type: 'create_link_card'
  x: number
  y: number
  name: string // non-empty
  url: string // valid URL
  props?: Record<string, unknown>
}
```

Result fields:

- `createdBlockIds`
- `createdShapeIds`

### create_arrow

Creates an arrow between two existing blocks.

```json
{
  "type": "create_arrow",
  "fromBlockId": "block_0001",
  "toBlockId": "block_0002",
  "label": "depends on"
}
```

Schema:

```ts
type CreateArrowAction = {
  type: 'create_arrow'
  fromBlockId: string // non-empty
  toBlockId: string // non-empty
  label?: string
}
```

Result fields:

- `createdBlockIds`
- `createdShapeIds`

### update_text

Updates the text for an existing block.

```json
{
  "type": "update_text",
  "blockId": "block_0001",
  "text": "Updated text"
}
```

Schema:

```ts
type UpdateTextAction = {
  type: 'update_text'
  blockId: string // non-empty
  text: string // non-empty
}
```

Result fields:

- `updatedBlockIds`
- `error` if the block is unknown.

### append_todo_task

Appends a task to an existing todo block.

```json
{
  "type": "append_todo_task",
  "blockId": "block_0001",
  "taskId": "task_review",
  "text": "Review implementation"
}
```

`taskId` is optional. If omitted, the bridge generates one.

Schema:

```ts
type AppendTodoTaskAction = {
  type: 'append_todo_task'
  blockId: string // non-empty
  text: string // non-empty
  taskId?: string // non-empty if provided
}
```

Result fields:

- `updatedBlockIds`
- `createdTaskIds`
- `error` if the todo block is unknown or the task id is duplicated.

### set_todo_task_done

Marks a todo task done or not done.

```json
{
  "type": "set_todo_task_done",
  "blockId": "block_0001",
  "taskId": "task_review",
  "done": true
}
```

Schema:

```ts
type SetTodoTaskDoneAction = {
  type: 'set_todo_task_done'
  blockId: string // non-empty
  taskId: string // non-empty
  done: boolean
}
```

Result fields:

- `updatedBlockIds`
- `updatedTaskIds`
- `error` if the todo block or task is unknown.

### remove_todo_task

Removes a task from a todo block.

```json
{
  "type": "remove_todo_task",
  "blockId": "block_0001",
  "taskId": "task_review"
}
```

Schema:

```ts
type RemoveTodoTaskAction = {
  type: 'remove_todo_task'
  blockId: string // non-empty
  taskId: string // non-empty
}
```

Result fields:

- `updatedBlockIds`
- `deletedTaskIds`
- `error` if the todo block or task is unknown.

### move_block

Moves an existing block to an absolute canvas position.

```json
{
  "type": "move_block",
  "blockId": "block_0001",
  "x": 240,
  "y": 320
}
```

Schema:

```ts
type MoveBlockAction = {
  type: 'move_block'
  blockId: string // non-empty
  x: number
  y: number
}
```

Result fields:

- `updatedBlockIds`
- `error` if the block is unknown.

### delete_block

Deletes an existing block.

```json
{
  "type": "delete_block",
  "blockId": "block_0001"
}
```

Schema:

```ts
type DeleteBlockAction = {
  type: 'delete_block'
  blockId: string // non-empty
}
```

Result fields:

- `deletedBlockIds`
- `error` if the block is unknown.

### get_block_by_name

Finds a block by exact `name`.

```json
{
  "type": "get_block_by_name",
  "name": "Launch Checklist"
}
```

Schema:

```ts
type GetBlockByNameAction = {
  type: 'get_block_by_name'
  name: string // non-empty
}
```

Result fields:

- `matchedBlockIds`
- `error` if no block has that name.

### read_canvas

Returns the current canvas state in a `canvas.observation`.

```json
{
  "type": "read_canvas"
}
```

Schema:

```ts
type ReadCanvasAction = {
  type: 'read_canvas'
}
```

Result fields:

- Only `actionType` in `canvas.result`.
- Full canvas state in the following `canvas.observation`.

### zoom_to_fit

Requests the browser bridge to fit the canvas content in view.

```json
{
  "type": "zoom_to_fit"
}
```

Schema:

```ts
type ZoomToFitAction = {
  type: 'zoom_to_fit'
}
```

Result fields:

- Only `actionType`.

## Batch Examples

### Create a todo block, add a task, and observe

```json
{
  "type": "canvas.action",
  "requestId": "req_todo_flow_001",
  "canvasId": "canvas_001",
  "actions": [
    {
      "type": "create_todo_block",
      "name": "Launch Checklist",
      "x": 100,
      "y": 150,
      "tasks": [
        { "id": "task_copy", "text": "Write launch copy" }
      ]
    },
    {
      "type": "read_canvas"
    }
  ]
}
```

### Mark a task done

```json
{
  "type": "canvas.action",
  "requestId": "req_mark_done_001",
  "canvasId": "canvas_001",
  "actions": [
    {
      "type": "set_todo_task_done",
      "blockId": "block_0001",
      "taskId": "task_copy",
      "done": true
    }
  ]
}
```

### Read/observe the canvas

```json
{
  "type": "canvas.action",
  "requestId": "req_read_canvas_001",
  "canvasId": "canvas_001",
  "actions": [
    { "type": "read_canvas" }
  ]
}
```

## Demo Client

The repo includes a Hermes-style demo client:

```bash
npm run hermes:demo
```

Custom actions can be sent as JSON:

```bash
npm run hermes:demo -- --actions '[{"type":"create_text","text":"Hello from Hermes","x":120,"y":160}]'
```
