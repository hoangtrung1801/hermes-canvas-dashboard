# Canvas API

This document describes the Hermes action WebSocket. Canvas persistence is handled by tldraw sync at `/sync/:canvasId`; do not use the removed JSON snapshot API for saving canvas state.

## Connections

Hermes action channel:

```text
ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes
```

Browser bridge channel:

```text
ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge
```

tldraw sync channel:

```text
ws://localhost:8787/sync/canvas_001
```

## Envelopes

Hermes sends:

```json
{
  "type": "canvas.action",
  "requestId": "req_001",
  "canvasId": "canvas_001",
  "actions": [{ "type": "read_canvas" }]
}
```

The bridge or headless executor returns:

```json
{
  "type": "canvas.result",
  "requestId": "req_001",
  "ok": true,
  "results": [{ "actionType": "read_canvas" }]
}
```

and:

```json
{
  "type": "canvas.observation",
  "requestId": "req_001",
  "canvasId": "canvas_001",
  "state": {
    "canvasId": "canvas_001",
    "pageId": "page:page",
    "selectedShapeIds": [],
    "camera": { "x": 0, "y": 0, "z": 1 },
    "shapes": []
  }
}
```

Errors use:

```json
{
  "type": "canvas.error",
  "requestId": "req_001",
  "message": "Invalid action"
}
```

## Result Item

```ts
type TldrawActionResult = {
  actionType: CanvasAction['type']
  createdShapeIds?: string[]
  updatedShapeIds?: string[]
  deletedShapeIds?: string[]
  createdBindingIds?: string[]
  deletedBindingIds?: string[]
  error?: string
}
```

## Observation Shape

```ts
type CanvasShapeSummary = {
  id: string
  type: string
  x: number
  y: number
  w?: number
  h?: number
  props: Record<string, unknown>
  meta: Record<string, unknown>
}
```

## Actions

### create_shape

Creates any tldraw shape record supported by the current schema.

```json
{
  "type": "create_shape",
  "shape": {
    "id": "shape:geo_box",
    "type": "geo",
    "x": 100,
    "y": 120,
    "props": { "geo": "rectangle", "w": 240, "h": 140 },
    "meta": { "source": "hermes" }
  }
}
```

### update_shape

```json
{
  "type": "update_shape",
  "shapeId": "shape:geo_box",
  "patch": {
    "x": 140,
    "props": { "w": 320 }
  }
}
```

### move_shapes

Move shapes by absolute coordinates or a delta.

```json
{
  "type": "move_shapes",
  "shapeIds": ["shape:geo_box"],
  "dx": 40,
  "dy": 20
}
```

### delete_shapes

```json
{
  "type": "delete_shapes",
  "shapeIds": ["shape:geo_box"]
}
```

### create_todo_block

```json
{
  "type": "create_todo_block",
  "id": "shape:launch_checklist",
  "title": "Launch Checklist",
  "x": 100,
  "y": 150,
  "backgroundColor": "#fff8cc",
  "tasks": [
    { "id": "task_copy", "text": "Write launch copy" },
    { "id": "task_assets", "text": "Prepare screenshots", "done": true }
  ]
}
```

### append_todo_task

```json
{
  "type": "append_todo_task",
  "shapeId": "shape:launch_checklist",
  "taskId": "task_ship",
  "text": "Ship feature"
}
```

### set_todo_task_done

```json
{
  "type": "set_todo_task_done",
  "shapeId": "shape:launch_checklist",
  "taskId": "task_copy",
  "done": true
}
```

### remove_todo_task

```json
{
  "type": "remove_todo_task",
  "shapeId": "shape:launch_checklist",
  "taskId": "task_assets"
}
```

### create_link_card

```json
{
  "type": "create_link_card",
  "id": "shape:tldraw_docs",
  "title": "tldraw Sync Docs",
  "url": "https://tldraw.dev/docs/sync",
  "description": "Sync server and client setup",
  "imageUrl": "https://example.com/tldraw-sync-preview.png",
  "backgroundColor": "#dcfce7",
  "w": 360,
  "h": 300,
  "x": 100,
  "y": 350
}
```

`imageUrl` optionally displays a browsed page screenshot or representative image inside the card. It accepts an HTTP(S) image URL or image data URI. Cards can also be recolored directly in the canvas dashboard by selecting the card and using tldraw's built-in color toolbar. API-created cards may still set `backgroundColor` for an explicit initial background.

### create_note_card

Creates a built-in tldraw rectangle with text inside. Hermes sends separate `title`, `tag`, and `content` fields; the bridge converts them into the rectangle shape's rich text in `[TAG]`, `[Title]`, `[Description]` order. The second line (the title) is bold; the tag and content remain normal text.

```json
{
  "type": "create_note_card",
  "id": "shape:idea_capture",
  "title": "Offline Sync",
  "tag": "Idea",
  "content": "Queue writes locally\nFlush when online",
  "color": "yellow",
  "size": "m",
  "x": 140,
  "y": 220
}
```

The created shape appears in observations as `type: "geo"` with `props.geo: "rectangle"` and standard tldraw `props.richText`.

### set_camera

```json
{
  "type": "set_camera",
  "x": 0,
  "y": 0,
  "z": 1
}
```

### zoom_to_fit

```json
{ "type": "zoom_to_fit" }
```

### select_shapes

Browser-editor only.

```json
{
  "type": "select_shapes",
  "shapeIds": ["shape:tldraw_docs"]
}
```

### clear_selection

```json
{ "type": "clear_selection" }
```

### read_canvas

Returns the current observation without changing records.

```json
{ "type": "read_canvas" }
```
