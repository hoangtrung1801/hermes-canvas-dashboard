# tldraw Canvas Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Excalidraw canvas with tldraw, tldraw sync, SQLite persistence, tldraw-native Hermes actions, and the current project custom shapes.

**Architecture:** Introduce a shared tldraw canvas domain (`src/canvas/tldraw`) that defines action schemas, observation summaries, custom shape props, and custom ShapeUtils. The browser executes Hermes actions through a mounted tldraw `Editor`; the Node gateway hosts `/sync/:roomId` with `TLSocketRoom` and executes supported headless actions through the same record-level action executor.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, `tldraw@5.2.2`, `@tldraw/sync@5.2.2`, `@tldraw/sync-core@5.2.2`, `@tldraw/tlschema@5.2.2`, Node `http`, `ws`, Node SQLite via `node:sqlite`, Zustand.

---

## File Structure

- Modify `package.json` and lockfiles: remove `@excalidraw/excalidraw`; add `tldraw@5.2.2`, `@tldraw/sync@5.2.2`, `@tldraw/sync-core@5.2.2`, and `@tldraw/tlschema@5.2.2`.
- Create `src/canvas/tldraw/customShape.types.ts`: shared custom shape prop types, task types, constants, and default factories.
- Create `src/canvas/tldraw/customShapeUtils.tsx`: client-side `ShapeUtil` classes for `todo_block`, `task_card`, and `link_card`.
- Create `src/canvas/tldraw/tldrawSchema.ts`: shared tldraw sync schema factory for default and custom shapes.
- Create `src/canvas/tldraw/tldrawObservation.ts`: convert a tldraw editor/store snapshot into a stable Hermes observation.
- Create `src/canvas/tldraw/tldrawActionExecutor.ts`: execute validated tldraw Hermes actions against either a browser `Editor` or a record-level store adapter.
- Create `src/canvas/tldraw/tldrawActionExecutor.test.ts`: action executor tests.
- Replace `src/canvas/actions/canvasAction.types.ts`: tldraw-oriented action union.
- Replace `src/canvas/actions/canvasAction.schema.ts`: zod validation for the new action union.
- Modify `src/canvas/protocol/canvasMessages.ts`: keep envelope names but point `actions` to the new action schema.
- Modify `src/canvas/blocks/block.types.ts`: replace block observation types with tldraw observation types, or re-export from `tldrawObservation.ts`.
- Modify `src/canvas/bridge/ActionExecutor.ts`: either remove it or turn it into a compatibility wrapper around `executeTldrawAction`.
- Modify `src/canvas/bridge/CanvasBridge.ts`: accept a tldraw executor target instead of a `CanvasAdapter`.
- Modify `src/canvas/state/bridgeStore.ts`: store `Editor | null`, `CanvasBridge | null`, `canvasId`, and tldraw observation state; remove `CanvasAdapter`.
- Modify `src/canvas/components/CanvasSurface.tsx`: render `<Tldraw />` with `useSync`; register bridge/editor; remove Excalidraw persistence.
- Modify `src/canvas/components/Simulator.tsx`: update presets and local action execution for the new tldraw action API.
- Modify `src/canvas/components/Inspector.tsx`: read `lastObservation.shapes`; update delete/edit/focus actions.
- Create `server/canvas/tldrawSyncServer.ts`: one `TLSocketRoom` per room and `/sync/:roomId` websocket handling.
- Create `server/canvas/tldrawHeadlessExecutor.ts`: execute supported actions when no browser bridge is attached.
- Modify `server/canvas/canvasGateway.ts`: route `/sync/:roomId`; use tldraw headless executor instead of JSON snapshot executor.
- Modify `server/index.ts`: log the sync endpoint and SQLite persistence location.
- Delete after replacement is passing: `src/canvas/adapters/ExcalidrawAdapter.ts`, `src/canvas/adapters/canvasAdapter.ts`, `src/canvas/state/canvasPersistence.ts`, `server/canvas/headlessExcalidrawApi.ts`, `server/canvas/headlessCanvasExecutor.ts`, and Excalidraw-specific tests.
- Update docs: `README.md`, `CANVAS_API.md`, `skills/canvas-dashboard/SKILL.md`, and `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`.

## Task 1: Install tldraw Dependencies And Remove Excalidraw

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install the exact tldraw packages**

Run:

```bash
npm install tldraw@5.2.2 @tldraw/sync@5.2.2 @tldraw/sync-core@5.2.2 @tldraw/tlschema@5.2.2
```

Expected: `package.json`, `package-lock.json`, and possibly `pnpm-lock.yaml` record the new packages at `5.2.2`.

- [ ] **Step 2: Remove Excalidraw**

Run:

```bash
npm uninstall @excalidraw/excalidraw
```

Expected: `@excalidraw/excalidraw` is absent from `dependencies`.

- [ ] **Step 3: Verify dependency metadata**

Run:

```bash
node -e "const p=require('./package.json'); console.log({tldraw:p.dependencies.tldraw,sync:p.dependencies['@tldraw/sync'],syncCore:p.dependencies['@tldraw/sync-core'],tlschema:p.dependencies['@tldraw/tlschema'],excalidraw:p.dependencies['@excalidraw/excalidraw']})"
```

Expected output:

```text
{ tldraw: '^5.2.2', sync: '^5.2.2', syncCore: '^5.2.2', tlschema: '^5.2.2', excalidraw: undefined }
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json pnpm-lock.yaml
git commit -m "chore: install tldraw sync dependencies"
```

## Task 2: Define tldraw Custom Shape Types

**Files:**
- Create: `src/canvas/tldraw/customShape.types.ts`
- Test: `src/canvas/tldraw/customShape.types.test.ts`

- [ ] **Step 1: Write failing tests for default props and task normalization**

Create `src/canvas/tldraw/customShape.types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createLinkCardProps,
  createTaskCardProps,
  createTodoBlockProps,
  normalizeTodoTasks
} from './customShape.types'

describe('custom tldraw shape types', () => {
  it('normalizes todo tasks with generated ids and done defaults', () => {
    expect(
      normalizeTodoTasks([
        'Write copy',
        { id: 'task_assets', text: 'Prepare assets', done: true }
      ])
    ).toEqual([
      { id: 'task_0001', text: 'Write copy', done: false },
      { id: 'task_assets', text: 'Prepare assets', done: true }
    ])
  })

  it('creates stable default props for todo blocks', () => {
    expect(createTodoBlockProps({ title: 'Launch', tasks: ['Ship'] })).toEqual({
      w: 320,
      h: 220,
      title: 'Launch',
      tasks: [{ id: 'task_0001', text: 'Ship', done: false }]
    })
  })

  it('creates stable default props for task and link cards', () => {
    expect(createTaskCardProps({ title: 'Design', body: 'Build UI' })).toEqual({
      w: 280,
      h: 160,
      title: 'Design',
      body: 'Build UI',
      status: 'todo',
      priority: 'medium'
    })
    expect(createLinkCardProps({ title: 'Docs', url: 'https://tldraw.dev' })).toEqual({
      w: 300,
      h: 120,
      title: 'Docs',
      url: 'https://tldraw.dev',
      description: ''
    })
  })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- src/canvas/tldraw/customShape.types.test.ts
```

Expected: FAIL because `customShape.types.ts` does not exist.

- [ ] **Step 3: Implement the shared custom shape types**

Create `src/canvas/tldraw/customShape.types.ts`:

```ts
export const TODO_BLOCK_TYPE = 'todo_block'
export const TASK_CARD_TYPE = 'task_card'
export const LINK_CARD_TYPE = 'link_card'

export type TodoTask = {
  id: string
  text: string
  done: boolean
}

export type TodoTaskInput =
  | string
  | {
      id?: string
      text: string
      done?: boolean
    }

export type TodoBlockProps = {
  w: number
  h: number
  title: string
  tasks: TodoTask[]
}

export type TaskCardProps = {
  w: number
  h: number
  title: string
  body: string
  status: string
  priority: string
}

export type LinkCardProps = {
  w: number
  h: number
  title: string
  url: string
  description: string
}

export type HermesCustomShapeType =
  | typeof TODO_BLOCK_TYPE
  | typeof TASK_CARD_TYPE
  | typeof LINK_CARD_TYPE

export function normalizeTodoTasks(tasks: TodoTaskInput[] = []): TodoTask[] {
  let generated = 0
  return tasks.map((task) => {
    if (typeof task === 'string') {
      generated += 1
      return {
        id: `task_${String(generated).padStart(4, '0')}`,
        text: task,
        done: false
      }
    }

    return {
      id: task.id ?? `task_${String(++generated).padStart(4, '0')}`,
      text: task.text,
      done: task.done ?? false
    }
  })
}

export function createTodoBlockProps(input: {
  title: string
  tasks?: TodoTaskInput[]
  w?: number
  h?: number
}): TodoBlockProps {
  return {
    w: input.w ?? 320,
    h: input.h ?? 220,
    title: input.title,
    tasks: normalizeTodoTasks(input.tasks ?? [])
  }
}

export function createTaskCardProps(input: {
  title: string
  body?: string
  status?: string
  priority?: string
  w?: number
  h?: number
}): TaskCardProps {
  return {
    w: input.w ?? 280,
    h: input.h ?? 160,
    title: input.title,
    body: input.body ?? '',
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium'
  }
}

export function createLinkCardProps(input: {
  title: string
  url: string
  description?: string
  w?: number
  h?: number
}): LinkCardProps {
  return {
    w: input.w ?? 300,
    h: input.h ?? 120,
    title: input.title,
    url: input.url,
    description: input.description ?? ''
  }
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
npm test -- src/canvas/tldraw/customShape.types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/tldraw/customShape.types.ts src/canvas/tldraw/customShape.types.test.ts
git commit -m "feat: define tldraw custom shape props"
```

## Task 3: Replace The Canvas Action Schema

**Files:**
- Modify: `src/canvas/actions/canvasAction.types.ts`
- Modify: `src/canvas/actions/canvasAction.schema.ts`
- Modify: `src/canvas/actions/canvasAction.schema.test.ts`

- [ ] **Step 1: Replace schema tests with tldraw action coverage**

Replace `src/canvas/actions/canvasAction.schema.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { canvasActionBatchSchema, canvasActionSchema } from './canvasAction.schema'

describe('tldraw canvas action schema', () => {
  it('accepts core tldraw shape actions', () => {
    expect(
      canvasActionBatchSchema.parse([
        {
          type: 'create_shape',
          shape: {
            id: 'shape:box_1',
            type: 'geo',
            x: 100,
            y: 120,
            props: { w: 240, h: 140, geo: 'rectangle' }
          }
        },
        {
          type: 'update_shape',
          shapeId: 'shape:box_1',
          patch: { x: 140, props: { w: 300 } }
        },
        {
          type: 'delete_shapes',
          shapeIds: ['shape:box_1']
        }
      ])
    ).toHaveLength(3)
  })

  it('accepts project custom shape helper actions', () => {
    expect(
      canvasActionSchema.parse({
        type: 'create_todo_block',
        id: 'shape:todo_1',
        x: 80,
        y: 100,
        title: 'Launch',
        tasks: [{ id: 'task_copy', text: 'Write copy', done: false }]
      })
    ).toMatchObject({ type: 'create_todo_block', title: 'Launch' })
  })

  it('rejects empty action batches and malformed urls', () => {
    expect(() => canvasActionBatchSchema.parse([])).toThrow()
    expect(() =>
      canvasActionSchema.parse({
        type: 'create_link_card',
        title: 'Bad',
        url: 'not a url',
        x: 0,
        y: 0
      })
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run the schema tests and verify failure**

Run:

```bash
npm test -- src/canvas/actions/canvasAction.schema.test.ts
```

Expected: FAIL because the old schema does not know `create_shape` or custom tldraw helper fields.

- [ ] **Step 3: Replace the action TypeScript union**

Replace `src/canvas/actions/canvasAction.types.ts` with:

```ts
import type { TodoTaskInput } from '../tldraw/customShape.types'

export type TldrawShapePayload = {
  id?: string
  type: string
  x?: number
  y?: number
  rotation?: number
  opacity?: number
  props?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export type CreateShapeAction = {
  type: 'create_shape'
  shape: TldrawShapePayload
}

export type UpdateShapeAction = {
  type: 'update_shape'
  shapeId: string
  patch: Partial<TldrawShapePayload>
}

export type DeleteShapesAction = {
  type: 'delete_shapes'
  shapeIds: string[]
}

export type MoveShapesAction = {
  type: 'move_shapes'
  shapeIds: string[]
  x?: number
  y?: number
  dx?: number
  dy?: number
}

export type CreateBindingAction = {
  type: 'create_binding'
  binding: Record<string, unknown>
}

export type DeleteBindingsAction = {
  type: 'delete_bindings'
  bindingIds: string[]
}

export type SetCameraAction = {
  type: 'set_camera'
  x: number
  y: number
  z?: number
}

export type ZoomToFitAction = {
  type: 'zoom_to_fit'
}

export type SelectShapesAction = {
  type: 'select_shapes'
  shapeIds: string[]
}

export type ClearSelectionAction = {
  type: 'clear_selection'
}

export type ReadCanvasAction = {
  type: 'read_canvas'
}

export type CreateTodoBlockAction = {
  type: 'create_todo_block'
  id?: string
  x: number
  y: number
  title: string
  tasks?: TodoTaskInput[]
  w?: number
  h?: number
}

export type AppendTodoTaskAction = {
  type: 'append_todo_task'
  shapeId: string
  text: string
  taskId?: string
}

export type SetTodoTaskDoneAction = {
  type: 'set_todo_task_done'
  shapeId: string
  taskId: string
  done: boolean
}

export type RemoveTodoTaskAction = {
  type: 'remove_todo_task'
  shapeId: string
  taskId: string
}

export type CreateTaskCardAction = {
  type: 'create_task_card'
  id?: string
  x: number
  y: number
  title: string
  body?: string
  status?: string
  priority?: string
  w?: number
  h?: number
}

export type CreateLinkCardAction = {
  type: 'create_link_card'
  id?: string
  x: number
  y: number
  title: string
  url: string
  description?: string
  w?: number
  h?: number
}

export type CanvasAction =
  | CreateShapeAction
  | UpdateShapeAction
  | DeleteShapesAction
  | MoveShapesAction
  | CreateBindingAction
  | DeleteBindingsAction
  | SetCameraAction
  | ZoomToFitAction
  | SelectShapesAction
  | ClearSelectionAction
  | ReadCanvasAction
  | CreateTodoBlockAction
  | AppendTodoTaskAction
  | SetTodoTaskDoneAction
  | RemoveTodoTaskAction
  | CreateTaskCardAction
  | CreateLinkCardAction
```

- [ ] **Step 4: Replace zod validation**

Replace `src/canvas/actions/canvasAction.schema.ts` with:

```ts
import { z } from 'zod'

const position = {
  x: z.number(),
  y: z.number()
}

const shapeId = z.string().min(1)
const shapeIdList = z.array(shapeId).min(1)
const record = z.record(z.unknown())

const tldrawShapePayloadSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  props: record.optional(),
  meta: record.optional()
})

const todoTaskInputSchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1).optional(),
    text: z.string().min(1),
    done: z.boolean().optional()
  })
])

export const canvasActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_shape'), shape: tldrawShapePayloadSchema }),
  z.object({
    type: z.literal('update_shape'),
    shapeId,
    patch: tldrawShapePayloadSchema.partial().refine((value) => Object.keys(value).length > 0, {
      message: 'patch must contain at least one field'
    })
  }),
  z.object({ type: z.literal('delete_shapes'), shapeIds: shapeIdList }),
  z.object({
    type: z.literal('move_shapes'),
    shapeIds: shapeIdList,
    x: z.number().optional(),
    y: z.number().optional(),
    dx: z.number().optional(),
    dy: z.number().optional()
  }).refine((value) => value.x !== undefined || value.y !== undefined || value.dx !== undefined || value.dy !== undefined, {
    message: 'move_shapes requires x, y, dx, or dy'
  }),
  z.object({ type: z.literal('create_binding'), binding: record }),
  z.object({ type: z.literal('delete_bindings'), bindingIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('set_camera'), x: z.number(), y: z.number(), z: z.number().positive().optional() }),
  z.object({ type: z.literal('zoom_to_fit') }),
  z.object({ type: z.literal('select_shapes'), shapeIds: shapeIdList }),
  z.object({ type: z.literal('clear_selection') }),
  z.object({ type: z.literal('read_canvas') }),
  z.object({
    type: z.literal('create_todo_block'),
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    tasks: z.array(todoTaskInputSchema).optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    ...position
  }),
  z.object({
    type: z.literal('append_todo_task'),
    shapeId,
    text: z.string().min(1),
    taskId: z.string().min(1).optional()
  }),
  z.object({
    type: z.literal('set_todo_task_done'),
    shapeId,
    taskId: z.string().min(1),
    done: z.boolean()
  }),
  z.object({
    type: z.literal('remove_todo_task'),
    shapeId,
    taskId: z.string().min(1)
  }),
  z.object({
    type: z.literal('create_task_card'),
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    status: z.string().min(1).optional(),
    priority: z.string().min(1).optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    ...position
  }),
  z.object({
    type: z.literal('create_link_card'),
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    url: z.string().url(),
    description: z.string().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    ...position
  })
])

export const canvasActionBatchSchema = z.array(canvasActionSchema).min(1)

export type CanvasActionInput = z.infer<typeof canvasActionSchema>
```

- [ ] **Step 5: Run schema tests and verify pass**

Run:

```bash
npm test -- src/canvas/actions/canvasAction.schema.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/actions/canvasAction.types.ts src/canvas/actions/canvasAction.schema.ts src/canvas/actions/canvasAction.schema.test.ts
git commit -m "feat: define tldraw canvas action schema"
```

## Task 4: Define tldraw Observations

**Files:**
- Create: `src/canvas/tldraw/tldrawObservation.ts`
- Modify: `src/canvas/blocks/block.types.ts`
- Test: `src/canvas/tldraw/tldrawObservation.test.ts`

- [ ] **Step 1: Write failing observation tests**

Create `src/canvas/tldraw/tldrawObservation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createCanvasObservationFromRecords } from './tldrawObservation'

describe('tldraw observation', () => {
  it('summarizes shapes, selection, and camera for Hermes', () => {
    const observation = createCanvasObservationFromRecords({
      canvasId: 'canvas_001',
      pageId: 'page:page',
      selectedShapeIds: ['shape:task_1'],
      camera: { x: 10, y: 20, z: 1.5 },
      shapes: [
        {
          id: 'shape:task_1',
          type: 'task_card',
          x: 100,
          y: 120,
          props: { w: 280, h: 160, title: 'Task', body: 'Body' },
          meta: { source: 'hermes' }
        }
      ]
    })

    expect(observation).toEqual({
      canvasId: 'canvas_001',
      pageId: 'page:page',
      selectedShapeIds: ['shape:task_1'],
      camera: { x: 10, y: 20, z: 1.5 },
      shapes: [
        {
          id: 'shape:task_1',
          type: 'task_card',
          x: 100,
          y: 120,
          w: 280,
          h: 160,
          props: { w: 280, h: 160, title: 'Task', body: 'Body' },
          meta: { source: 'hermes' }
        }
      ]
    })
  })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- src/canvas/tldraw/tldrawObservation.test.ts
```

Expected: FAIL because `tldrawObservation.ts` does not exist.

- [ ] **Step 3: Implement observation types and helpers**

Create `src/canvas/tldraw/tldrawObservation.ts`:

```ts
export type CanvasCamera = {
  x: number
  y: number
  z: number
}

export type CanvasShapeSummary = {
  id: string
  type: string
  x: number
  y: number
  w?: number
  h?: number
  props: Record<string, unknown>
  meta: Record<string, unknown>
}

export type CanvasObservationState = {
  canvasId: string
  pageId: string
  selectedShapeIds: string[]
  camera: CanvasCamera
  shapes: CanvasShapeSummary[]
}

type ShapeRecordLike = {
  id: string
  type: string
  x?: number
  y?: number
  props?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export function createCanvasObservationFromRecords(input: {
  canvasId: string
  pageId: string
  selectedShapeIds?: string[]
  camera?: Partial<CanvasCamera>
  shapes: ShapeRecordLike[]
}): CanvasObservationState {
  return {
    canvasId: input.canvasId,
    pageId: input.pageId,
    selectedShapeIds: input.selectedShapeIds ?? [],
    camera: {
      x: input.camera?.x ?? 0,
      y: input.camera?.y ?? 0,
      z: input.camera?.z ?? 1
    },
    shapes: input.shapes.map((shape) => ({
      id: shape.id,
      type: shape.type,
      x: shape.x ?? 0,
      y: shape.y ?? 0,
      w: numberProp(shape.props, 'w'),
      h: numberProp(shape.props, 'h'),
      props: { ...(shape.props ?? {}) },
      meta: { ...(shape.meta ?? {}) }
    }))
  }
}

function numberProp(props: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = props?.[key]
  return typeof value === 'number' ? value : undefined
}
```

Replace `src/canvas/blocks/block.types.ts` with:

```ts
export type {
  CanvasCamera,
  CanvasObservationState,
  CanvasShapeSummary
} from '../tldraw/tldrawObservation'

export type { TodoTask, TodoTaskInput } from '../tldraw/customShape.types'
```

- [ ] **Step 4: Run observation tests and verify pass**

Run:

```bash
npm test -- src/canvas/tldraw/tldrawObservation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/tldraw/tldrawObservation.ts src/canvas/tldraw/tldrawObservation.test.ts src/canvas/blocks/block.types.ts
git commit -m "feat: add tldraw canvas observations"
```

## Task 5: Implement Custom Shape Utilities

**Files:**
- Create: `src/canvas/tldraw/customShapeUtils.tsx`
- Create: `src/canvas/tldraw/customShapeUtils.test.tsx`

- [ ] **Step 1: Write failing render tests**

Create `src/canvas/tldraw/customShapeUtils.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LinkCardShapeUtil, TaskCardShapeUtil, TodoBlockShapeUtil } from './customShapeUtils'

describe('custom tldraw ShapeUtils', () => {
  it('renders todo block content', () => {
    const util = new TodoBlockShapeUtil({} as any)
    render(
      util.component({
        id: 'shape:todo_1',
        type: 'todo_block',
        x: 0,
        y: 0,
        rotation: 0,
        index: 'a1',
        parentId: 'page:page',
        isLocked: false,
        opacity: 1,
        meta: {},
        props: {
          w: 320,
          h: 220,
          title: 'Launch',
          tasks: [{ id: 'task_copy', text: 'Write copy', done: true }]
        }
      } as any)
    )

    expect(screen.getByText('Launch')).toBeInTheDocument()
    expect(screen.getByText('Write copy')).toBeInTheDocument()
  })

  it('renders task and link cards', () => {
    const taskUtil = new TaskCardShapeUtil({} as any)
    const linkUtil = new LinkCardShapeUtil({} as any)

    render(
      <>
        {taskUtil.component({
          id: 'shape:task_1',
          type: 'task_card',
          x: 0,
          y: 0,
          rotation: 0,
          index: 'a1',
          parentId: 'page:page',
          isLocked: false,
          opacity: 1,
          meta: {},
          props: { w: 280, h: 160, title: 'Design', body: 'Build UI', status: 'todo', priority: 'high' }
        } as any)}
        {linkUtil.component({
          id: 'shape:link_1',
          type: 'link_card',
          x: 0,
          y: 0,
          rotation: 0,
          index: 'a2',
          parentId: 'page:page',
          isLocked: false,
          opacity: 1,
          meta: {},
          props: { w: 300, h: 120, title: 'Docs', url: 'https://tldraw.dev', description: 'SDK docs' }
        } as any)}
      </>
    )

    expect(screen.getByText('Design')).toBeInTheDocument()
    expect(screen.getByText('https://tldraw.dev')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run render tests and verify failure**

Run:

```bash
npm test -- src/canvas/tldraw/customShapeUtils.test.tsx
```

Expected: FAIL because `customShapeUtils.tsx` does not exist.

- [ ] **Step 3: Implement ShapeUtils**

Create `src/canvas/tldraw/customShapeUtils.tsx` with these exports and classes:

```tsx
import { HTMLContainer, Rectangle2d, ShapeUtil, type TLShape } from 'tldraw'
import {
  LINK_CARD_TYPE,
  TASK_CARD_TYPE,
  TODO_BLOCK_TYPE,
  type LinkCardProps,
  type TaskCardProps,
  type TodoBlockProps
} from './customShape.types'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [TODO_BLOCK_TYPE]: TodoBlockProps
    [TASK_CARD_TYPE]: TaskCardProps
    [LINK_CARD_TYPE]: LinkCardProps
  }
}

export type TodoBlockShape = TLShape<typeof TODO_BLOCK_TYPE>
export type TaskCardShape = TLShape<typeof TASK_CARD_TYPE>
export type LinkCardShape = TLShape<typeof LINK_CARD_TYPE>

class BaseHermesCardUtil<T extends TLShape> extends ShapeUtil<T> {
  override canEdit = () => false
  override canResize = () => true
  override isAspectRatioLocked = () => false

  getGeometry(shape: T) {
    const props = shape.props as Record<string, unknown>
    return new Rectangle2d({
      width: typeof props.w === 'number' ? props.w : 240,
      height: typeof props.h === 'number' ? props.h : 140,
      isFilled: true
    })
  }

  getIndicatorPath(shape: T) {
    const props = shape.props as Record<string, unknown>
    const path = new Path2D()
    path.roundRect(0, 0, Number(props.w ?? 240), Number(props.h ?? 140), 8)
    return path
  }
}

export class TodoBlockShapeUtil extends BaseHermesCardUtil<TodoBlockShape> {
  static override type = TODO_BLOCK_TYPE

  getDefaultProps(): TodoBlockProps {
    return { w: 320, h: 220, title: 'Todo', tasks: [] }
  }

  component(shape: TodoBlockShape) {
    return (
      <HTMLContainer className="hermes-shape hermes-todo-block" style={{ width: shape.props.w, height: shape.props.h }}>
        <strong>{shape.props.title}</strong>
        <div className="hermes-task-list">
          {shape.props.tasks.map((task) => (
            <div key={task.id} className="hermes-task-row">
              <span>{task.done ? '[x]' : '[ ]'}</span>
              <span>{task.text}</span>
            </div>
          ))}
        </div>
      </HTMLContainer>
    )
  }
}

export class TaskCardShapeUtil extends BaseHermesCardUtil<TaskCardShape> {
  static override type = TASK_CARD_TYPE

  getDefaultProps(): TaskCardProps {
    return { w: 280, h: 160, title: 'Task', body: '', status: 'todo', priority: 'medium' }
  }

  component(shape: TaskCardShape) {
    return (
      <HTMLContainer className="hermes-shape hermes-task-card" style={{ width: shape.props.w, height: shape.props.h }}>
        <div className="hermes-card-kicker">{shape.props.status} · {shape.props.priority}</div>
        <strong>{shape.props.title}</strong>
        {shape.props.body && <p>{shape.props.body}</p>}
      </HTMLContainer>
    )
  }
}

export class LinkCardShapeUtil extends BaseHermesCardUtil<LinkCardShape> {
  static override type = LINK_CARD_TYPE

  getDefaultProps(): LinkCardProps {
    return { w: 300, h: 120, title: 'Link', url: '', description: '' }
  }

  component(shape: LinkCardShape) {
    return (
      <HTMLContainer className="hermes-shape hermes-link-card" style={{ width: shape.props.w, height: shape.props.h }}>
        <strong>{shape.props.title}</strong>
        <span>{shape.props.url}</span>
        {shape.props.description && <p>{shape.props.description}</p>}
      </HTMLContainer>
    )
  }
}

export const hermesShapeUtils = [
  TodoBlockShapeUtil,
  TaskCardShapeUtil,
  LinkCardShapeUtil
]
```

- [ ] **Step 4: Add CSS for custom shapes**

Append to `src/styles.css`:

```css
.hermes-shape {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid #1f2937;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font: 14px/1.35 system-ui, sans-serif;
  padding: 12px;
}

.hermes-todo-block {
  background: #fff8cc;
}

.hermes-task-card {
  background: #dbeafe;
}

.hermes-link-card {
  background: #dcfce7;
}

.hermes-card-kicker {
  color: #4b5563;
  font-size: 12px;
  text-transform: uppercase;
}

.hermes-task-list {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.hermes-task-row {
  display: flex;
  gap: 6px;
}
```

- [ ] **Step 5: Run tests and verify pass**

Run:

```bash
npm test -- src/canvas/tldraw/customShapeUtils.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/tldraw/customShapeUtils.tsx src/canvas/tldraw/customShapeUtils.test.tsx src/styles.css
git commit -m "feat: render tldraw custom shapes"
```

## Task 6: Implement The tldraw Action Executor

**Files:**
- Create: `src/canvas/tldraw/tldrawActionExecutor.ts`
- Create: `src/canvas/tldraw/tldrawActionExecutor.test.ts`
- Modify: `src/canvas/bridge/CanvasBridge.ts`
- Modify: `src/canvas/bridge/CanvasBridge.test.ts`

- [ ] **Step 1: Write failing executor tests**

Create `src/canvas/tldraw/tldrawActionExecutor.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { CanvasAction } from '../actions/canvasAction.types'
import { createMemoryTldrawTarget, executeTldrawAction, readTldrawObservation } from './tldrawActionExecutor'

describe('tldraw action executor', () => {
  it('creates, updates, moves, deletes, and reads shapes', () => {
    const target = createMemoryTldrawTarget('canvas_001')
    const actions: CanvasAction[] = [
      { type: 'create_task_card', id: 'shape:task_1', title: 'Task', body: 'Body', x: 100, y: 120 },
      { type: 'update_shape', shapeId: 'shape:task_1', patch: { props: { priority: 'high' } } },
      { type: 'move_shapes', shapeIds: ['shape:task_1'], dx: 20, dy: 10 },
      { type: 'read_canvas' }
    ]

    const results = actions.map((action) => executeTldrawAction(target, action))

    expect(results).toEqual([
      { actionType: 'create_task_card', createdShapeIds: ['shape:task_1'] },
      { actionType: 'update_shape', updatedShapeIds: ['shape:task_1'] },
      { actionType: 'move_shapes', updatedShapeIds: ['shape:task_1'] },
      { actionType: 'read_canvas' }
    ])
    expect(readTldrawObservation(target)).toMatchObject({
      canvasId: 'canvas_001',
      shapes: [
        {
          id: 'shape:task_1',
          type: 'task_card',
          x: 120,
          y: 130,
          props: { title: 'Task', body: 'Body', priority: 'high' }
        }
      ]
    })
  })

  it('returns action-level errors for unknown shapes and unsupported headless editor actions', () => {
    const target = createMemoryTldrawTarget('canvas_001')

    expect(executeTldrawAction(target, { type: 'delete_shapes', shapeIds: ['shape:missing'] })).toEqual({
      actionType: 'delete_shapes',
      error: 'Unknown shape shape:missing'
    })
    expect(executeTldrawAction(target, { type: 'select_shapes', shapeIds: ['shape:missing'] })).toEqual({
      actionType: 'select_shapes',
      error: 'select_shapes requires a mounted tldraw editor'
    })
  })
})
```

- [ ] **Step 2: Run executor tests and verify failure**

Run:

```bash
npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts
```

Expected: FAIL because `tldrawActionExecutor.ts` does not exist.

- [ ] **Step 3: Implement memory/browser target executor**

Create `src/canvas/tldraw/tldrawActionExecutor.ts` with:

```ts
import type { Editor } from 'tldraw'
import type { CanvasAction } from '../actions/canvasAction.types'
import {
  LINK_CARD_TYPE,
  TASK_CARD_TYPE,
  TODO_BLOCK_TYPE,
  createLinkCardProps,
  createTaskCardProps,
  createTodoBlockProps,
  type TodoTask
} from './customShape.types'
import {
  createCanvasObservationFromRecords,
  type CanvasObservationState,
  type CanvasShapeSummary
} from './tldrawObservation'

export type TldrawActionResult = {
  actionType: CanvasAction['type']
  createdShapeIds?: string[]
  updatedShapeIds?: string[]
  deletedShapeIds?: string[]
  createdBindingIds?: string[]
  deletedBindingIds?: string[]
  error?: string
}

type ShapeRecord = {
  id: string
  type: string
  x: number
  y: number
  props: Record<string, unknown>
  meta: Record<string, unknown>
}

export type TldrawExecutorTarget = {
  canvasId: string
  pageId: string
  editor?: Editor
  shapes: Map<string, ShapeRecord>
  selectedShapeIds: string[]
  camera: { x: number; y: number; z: number }
}

export function createMemoryTldrawTarget(canvasId: string): TldrawExecutorTarget {
  return {
    canvasId,
    pageId: 'page:page',
    shapes: new Map(),
    selectedShapeIds: [],
    camera: { x: 0, y: 0, z: 1 }
  }
}

export function executeTldrawAction(target: TldrawExecutorTarget, action: CanvasAction): TldrawActionResult {
  switch (action.type) {
    case 'create_shape': {
      const id = action.shape.id ?? nextShapeId(target, action.shape.type)
      target.shapes.set(id, {
        id,
        type: action.shape.type,
        x: action.shape.x ?? 0,
        y: action.shape.y ?? 0,
        props: { ...(action.shape.props ?? {}) },
        meta: { ...(action.shape.meta ?? {}) }
      })
      target.editor?.createShape({ id: id as any, type: action.shape.type as any, x: action.shape.x, y: action.shape.y, props: action.shape.props as any })
      return { actionType: action.type, createdShapeIds: [id] }
    }
    case 'create_todo_block': {
      const id = action.id ?? nextShapeId(target, TODO_BLOCK_TYPE)
      target.shapes.set(id, {
        id,
        type: TODO_BLOCK_TYPE,
        x: action.x,
        y: action.y,
        props: createTodoBlockProps(action),
        meta: { source: 'hermes' }
      })
      target.editor?.createShape({ id: id as any, type: TODO_BLOCK_TYPE, x: action.x, y: action.y, props: createTodoBlockProps(action) as any })
      return { actionType: action.type, createdShapeIds: [id] }
    }
    case 'create_task_card': {
      const id = action.id ?? nextShapeId(target, TASK_CARD_TYPE)
      target.shapes.set(id, {
        id,
        type: TASK_CARD_TYPE,
        x: action.x,
        y: action.y,
        props: createTaskCardProps(action),
        meta: { source: 'hermes' }
      })
      target.editor?.createShape({ id: id as any, type: TASK_CARD_TYPE, x: action.x, y: action.y, props: createTaskCardProps(action) as any })
      return { actionType: action.type, createdShapeIds: [id] }
    }
    case 'create_link_card': {
      const id = action.id ?? nextShapeId(target, LINK_CARD_TYPE)
      target.shapes.set(id, {
        id,
        type: LINK_CARD_TYPE,
        x: action.x,
        y: action.y,
        props: createLinkCardProps(action),
        meta: { source: 'hermes' }
      })
      target.editor?.createShape({ id: id as any, type: LINK_CARD_TYPE, x: action.x, y: action.y, props: createLinkCardProps(action) as any })
      return { actionType: action.type, createdShapeIds: [id] }
    }
    case 'update_shape': {
      const existing = target.shapes.get(action.shapeId)
      if (!existing) return { actionType: action.type, error: `Unknown shape ${action.shapeId}` }
      const next = {
        ...existing,
        x: action.patch.x ?? existing.x,
        y: action.patch.y ?? existing.y,
        props: { ...existing.props, ...(action.patch.props ?? {}) },
        meta: { ...existing.meta, ...(action.patch.meta ?? {}) }
      }
      target.shapes.set(action.shapeId, next)
      target.editor?.updateShape({ id: action.shapeId as any, type: next.type as any, x: next.x, y: next.y, props: next.props as any })
      return { actionType: action.type, updatedShapeIds: [action.shapeId] }
    }
    case 'move_shapes': {
      const missing = action.shapeIds.find((shapeId) => !target.shapes.has(shapeId))
      if (missing) return { actionType: action.type, error: `Unknown shape ${missing}` }
      for (const shapeId of action.shapeIds) {
        const existing = target.shapes.get(shapeId)!
        const next = {
          ...existing,
          x: action.x ?? existing.x + (action.dx ?? 0),
          y: action.y ?? existing.y + (action.dy ?? 0)
        }
        target.shapes.set(shapeId, next)
        target.editor?.updateShape({ id: shapeId as any, type: next.type as any, x: next.x, y: next.y })
      }
      return { actionType: action.type, updatedShapeIds: action.shapeIds }
    }
    case 'delete_shapes': {
      const missing = action.shapeIds.find((shapeId) => !target.shapes.has(shapeId))
      if (missing) return { actionType: action.type, error: `Unknown shape ${missing}` }
      action.shapeIds.forEach((shapeId) => target.shapes.delete(shapeId))
      target.editor?.deleteShapes(action.shapeIds as any)
      return { actionType: action.type, deletedShapeIds: action.shapeIds }
    }
    case 'append_todo_task':
    case 'set_todo_task_done':
    case 'remove_todo_task':
      return mutateTodoShape(target, action)
    case 'set_camera':
      target.camera = { x: action.x, y: action.y, z: action.z ?? target.camera.z }
      target.editor?.setCamera(target.camera)
      return { actionType: action.type }
    case 'zoom_to_fit':
      target.editor?.zoomToFit()
      return { actionType: action.type }
    case 'select_shapes':
      if (!target.editor) return { actionType: action.type, error: 'select_shapes requires a mounted tldraw editor' }
      target.selectedShapeIds = action.shapeIds
      target.editor.select(...(action.shapeIds as any))
      return { actionType: action.type, updatedShapeIds: action.shapeIds }
    case 'clear_selection':
      target.selectedShapeIds = []
      target.editor?.selectNone()
      return { actionType: action.type }
    case 'read_canvas':
      return { actionType: action.type }
    case 'create_binding':
      return { actionType: action.type, error: 'create_binding is not implemented in the first executor pass' }
    case 'delete_bindings':
      return { actionType: action.type, error: 'delete_bindings is not implemented in the first executor pass' }
  }
}

export function readTldrawObservation(target: TldrawExecutorTarget): CanvasObservationState {
  const editorShapes = target.editor
    ? target.editor.getCurrentPageShapesSorted().map((shape) => ({
        id: String(shape.id),
        type: shape.type,
        x: shape.x,
        y: shape.y,
        props: shape.props as Record<string, unknown>,
        meta: shape.meta as Record<string, unknown>
      }))
    : [...target.shapes.values()]

  return createCanvasObservationFromRecords({
    canvasId: target.canvasId,
    pageId: target.pageId,
    selectedShapeIds: target.editor ? target.editor.getSelectedShapeIds().map(String) : target.selectedShapeIds,
    camera: target.editor ? target.editor.getCamera() : target.camera,
    shapes: editorShapes
  })
}

function mutateTodoShape(target: TldrawExecutorTarget, action: Extract<CanvasAction, { type: 'append_todo_task' | 'set_todo_task_done' | 'remove_todo_task' }>): TldrawActionResult {
  const existing = target.shapes.get(action.shapeId)
  if (!existing || existing.type !== TODO_BLOCK_TYPE) {
    return { actionType: action.type, error: `Unknown todo block ${action.shapeId}` }
  }
  const tasks = Array.isArray(existing.props.tasks) ? existing.props.tasks as TodoTask[] : []
  if (action.type === 'append_todo_task') {
    const task = { id: action.taskId ?? `task_${String(tasks.length + 1).padStart(4, '0')}`, text: action.text, done: false }
    return updateTodoTasks(target, existing, [...tasks, task], action.type)
  }
  if (action.type === 'set_todo_task_done') {
    if (!tasks.some((task) => task.id === action.taskId)) return { actionType: action.type, error: `Unknown todo task ${action.taskId}` }
    return updateTodoTasks(target, existing, tasks.map((task) => task.id === action.taskId ? { ...task, done: action.done } : task), action.type)
  }
  if (!tasks.some((task) => task.id === action.taskId)) return { actionType: action.type, error: `Unknown todo task ${action.taskId}` }
  return updateTodoTasks(target, existing, tasks.filter((task) => task.id !== action.taskId), action.type)
}

function updateTodoTasks(target: TldrawExecutorTarget, shape: ShapeRecord, tasks: TodoTask[], actionType: CanvasAction['type']): TldrawActionResult {
  const next = { ...shape, props: { ...shape.props, tasks } }
  target.shapes.set(shape.id, next)
  target.editor?.updateShape({ id: shape.id as any, type: TODO_BLOCK_TYPE, props: next.props as any })
  return { actionType, updatedShapeIds: [shape.id] }
}

function nextShapeId(target: TldrawExecutorTarget, type: string): string {
  return `shape:${type}_${String(target.shapes.size + 1).padStart(4, '0')}`
}
```

- [ ] **Step 4: Run executor tests and verify pass**

Run:

```bash
npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update `CanvasBridge` to use tldraw targets**

Replace `src/canvas/bridge/CanvasBridge.ts` with:

```ts
import type { CanvasAction } from '../actions/canvasAction.types'
import { canvasActionEnvelopeSchema } from '../protocol/canvasMessages'
import {
  executeTldrawAction,
  readTldrawObservation,
  type TldrawActionResult,
  type TldrawExecutorTarget
} from '../tldraw/tldrawActionExecutor'
import type { CanvasObservationState } from '../tldraw/tldrawObservation'

type ActionEnvelope = {
  type: 'canvas.action'
  requestId: string
  canvasId: string
  actions: CanvasAction[]
}

type BridgeResponse = {
  result: {
    type: 'canvas.result'
    requestId: string
    ok: boolean
    results: TldrawActionResult[]
  }
  observation: {
    type: 'canvas.observation'
    requestId: string
    canvasId: string
    state: CanvasObservationState
  }
}

type BridgeErrorResponse = {
  error: {
    type: 'canvas.error'
    requestId: string
    message: string
  }
}

export class CanvasBridge {
  constructor(private readonly target: TldrawExecutorTarget) {}

  handleActionEnvelope(envelope: ActionEnvelope): BridgeResponse | BridgeErrorResponse {
    try {
      const validated = canvasActionEnvelopeSchema.parse(envelope)
      const results = validated.actions.map((action) => executeTldrawAction(this.target, action))
      const ok = results.every((result) => !result.error)
      const observationState = readTldrawObservation(this.target)

      return {
        result: {
          type: 'canvas.result',
          requestId: validated.requestId,
          ok,
          results
        },
        observation: {
          type: 'canvas.observation',
          requestId: validated.requestId,
          canvasId: this.target.canvasId,
          state: observationState
        }
      }
    } catch (error) {
      return {
        error: {
          type: 'canvas.error',
          requestId: envelope.requestId,
          message: error instanceof Error ? error.message : 'Canvas action handling failed'
        }
      }
    }
  }
}
```

- [ ] **Step 6: Update bridge tests**

Replace any adapter construction in `src/canvas/bridge/CanvasBridge.test.ts` with:

```ts
import { createMemoryTldrawTarget } from '../tldraw/tldrawActionExecutor'

const target = createMemoryTldrawTarget('canvas_001')
const bridge = new CanvasBridge(target)
```

Update expected action names and result fields to `createdShapeIds`, `updatedShapeIds`, and `deletedShapeIds`.

- [ ] **Step 7: Run bridge and executor tests**

Run:

```bash
npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/bridge/CanvasBridge.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/canvas/tldraw/tldrawActionExecutor.ts src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/bridge/CanvasBridge.ts src/canvas/bridge/CanvasBridge.test.ts
git commit -m "feat: execute tldraw canvas actions"
```

## Task 7: Add tldraw Sync Server

**Files:**
- Create: `server/canvas/tldrawSyncServer.ts`
- Create: `server/canvas/tldrawSyncServer.test.ts`
- Modify: `server/canvas/canvasGateway.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Write failing sync server tests**

Create `server/canvas/tldrawSyncServer.test.ts`:

```ts
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TldrawSyncRoomManager } from './tldrawSyncServer'

describe('TldrawSyncRoomManager', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hermes-tldraw-sync-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reuses one room per room id', () => {
    const manager = new TldrawSyncRoomManager({ dataDir: dir })

    expect(manager.getOrCreateRoom('canvas_001')).toBe(manager.getOrCreateRoom('canvas_001'))
    expect(manager.getOrCreateRoom('canvas_001')).not.toBe(manager.getOrCreateRoom('canvas_002'))

    manager.close()
  })

  it('exposes the sqlite database path', () => {
    const manager = new TldrawSyncRoomManager({ dataDir: dir })

    expect(manager.databasePath).toBe(join(dir, 'tldraw-sync.sqlite'))

    manager.close()
  })
})
```

- [ ] **Step 2: Run sync server tests and verify failure**

Run:

```bash
npm test -- server/canvas/tldrawSyncServer.test.ts
```

Expected: FAIL because `tldrawSyncServer.ts` does not exist.

- [ ] **Step 3: Implement sync room manager and websocket handler**

Create `server/canvas/tldrawSyncServer.ts`:

```ts
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { NodeSqliteWrapper, SQLiteSyncStorage, TLSocketRoom } from '@tldraw/sync-core'
import type { WebSocket } from 'ws'
import { createHermesTldrawSchema } from '../../src/canvas/tldraw/tldrawSchema'

type SyncOptions = {
  dataDir: string
}

type SyncSocket = WebSocket & {
  sessionId?: string
}

export class TldrawSyncRoomManager {
  private readonly rooms = new Map<string, TLSocketRoom>()
  private readonly db: DatabaseSync
  readonly databasePath: string

  constructor(options: SyncOptions) {
    mkdirSync(options.dataDir, { recursive: true })
    this.databasePath = join(options.dataDir, 'tldraw-sync.sqlite')
    this.db = new DatabaseSync(this.databasePath)
  }

  getOrCreateRoom(roomId: string): TLSocketRoom {
    const existing = this.rooms.get(roomId)
    if (existing) return existing

    const sql = new NodeSqliteWrapper(this.db as any, { tablePrefix: `room_${sanitizeRoomId(roomId)}_` })
    const storage = new SQLiteSyncStorage({ sql })
    const room = new TLSocketRoom({ schema: createHermesTldrawSchema(), storage })
    this.rooms.set(roomId, room)
    return room
  }

  connectSocket(roomId: string, sessionId: string, socket: SyncSocket): void {
    socket.sessionId = sessionId
    const room = this.getOrCreateRoom(roomId)
    room.handleSocketConnect({ sessionId, socket: socket as any })
    socket.on('message', (message) => room.handleSocketMessage(sessionId, message as any))
    socket.on('close', () => room.handleSocketClose(sessionId))
    socket.on('error', () => room.handleSocketError(sessionId))
  }

  close(): void {
    this.rooms.clear()
    this.db.close()
  }
}

function sanitizeRoomId(roomId: string): string {
  return roomId.replace(/[^a-zA-Z0-9_]/g, '_')
}
```

- [ ] **Step 4: Add shared sync schema factory**

Create `src/canvas/tldraw/tldrawSchema.ts`:

```ts
import { createTLSchema, defaultBindingSchemas, defaultShapeSchemas } from '@tldraw/tlschema'

export function createHermesTldrawSchema() {
  return createTLSchema({
    shapes: {
      ...defaultShapeSchemas,
      todo_block: {},
      task_card: {},
      link_card: {}
    },
    bindings: defaultBindingSchemas
  })
}
```

- [ ] **Step 5: Wire `/sync/:roomId` into the gateway**

In `server/canvas/canvasGateway.ts`, add this import:

```ts
import { randomUUID } from 'node:crypto'
```

Create the manager beside `rooms`:

```ts
const syncRooms = new TldrawSyncRoomManager({ dataDir: options.dataDir ?? join(process.cwd(), 'data') })
```

Before the existing `/canvas` connection handler logic, add a second WebSocket server:

```ts
const syncWss = new WebSocketServer({ noServer: true })

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const match = /^\/sync\/([^/]+)$/.exec(url.pathname)
  if (!match) return

  syncWss.handleUpgrade(request, socket, head, (ws) => {
    const roomId = decodeURIComponent(match[1])
    const sessionId = url.searchParams.get('sessionId') ?? randomUUID()
    syncRooms.connectSocket(roomId, sessionId, ws)
  })
})
```

Add `syncRooms.close()` inside the gateway `close` callback before closing the HTTP server.

- [ ] **Step 6: Update server logs**

In `server/index.ts`, add:

```ts
console.log(`tldraw sync listening on ws://localhost:${port}/sync/canvas_001`)
console.log(`tldraw SQLite state stored under ${process.cwd()}/data/tldraw-sync.sqlite`)
```

- [ ] **Step 7: Run sync tests and typecheck**

Run:

```bash
npm test -- server/canvas/tldrawSyncServer.test.ts
npm run lint:types
```

Expected: PASS. If TypeScript reports `node:sqlite` type gaps, add the narrow local declaration in `src/types/node-sqlite.d.ts`:

```ts
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string)
    close(): void
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add server/canvas/tldrawSyncServer.ts server/canvas/tldrawSyncServer.test.ts server/canvas/canvasGateway.ts server/index.ts src/canvas/tldraw/tldrawSchema.ts src/types/node-sqlite.d.ts
git commit -m "feat: host tldraw sync in canvas gateway"
```

## Task 8: Replace Headless Execution With tldraw Record Execution

**Files:**
- Create: `server/canvas/tldrawHeadlessExecutor.ts`
- Create: `server/canvas/tldrawHeadlessExecutor.test.ts`
- Modify: `server/canvas/canvasGateway.ts`

- [ ] **Step 1: Write failing headless tests**

Create `server/canvas/tldrawHeadlessExecutor.test.ts`:

```ts
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { executeHeadlessTldrawAction } from './tldrawHeadlessExecutor'
import { TldrawSyncRoomManager } from './tldrawSyncServer'

describe('executeHeadlessTldrawAction', () => {
  let dir: string
  let syncRooms: TldrawSyncRoomManager

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hermes-tldraw-headless-'))
    syncRooms = new TldrawSyncRoomManager({ dataDir: dir })
  })

  afterEach(async () => {
    syncRooms.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('executes supported store-level actions into the sync room snapshot', async () => {
    const responses = await executeHeadlessTldrawAction(syncRooms, {
      type: 'canvas.action',
      requestId: 'req_create',
      canvasId: 'canvas_001',
      actions: [
        { type: 'create_task_card', id: 'shape:task_1', title: 'Task', body: 'Body', x: 100, y: 120 },
        { type: 'read_canvas' }
      ]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_create',
      ok: true,
      results: [
        { actionType: 'create_task_card', createdShapeIds: ['shape:task_1'] },
        { actionType: 'read_canvas' }
      ]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      canvasId: 'canvas_001',
      state: {
        canvasId: 'canvas_001',
        shapes: [{ id: 'shape:task_1', type: 'task_card' }]
      }
    })

    const snapshot = syncRooms.getOrCreateRoom('canvas_001').getCurrentSnapshot()
    expect(snapshot.documents.map((document) => document.state.id)).toContain('shape:task_1')
  })

  it('returns unsupported errors for browser-only selection', async () => {
    const responses = await executeHeadlessTldrawAction(syncRooms, {
      type: 'canvas.action',
      requestId: 'req_select',
      canvasId: 'canvas_001',
      actions: [{ type: 'select_shapes', shapeIds: ['shape:task_1'] }]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_select',
      ok: false,
      results: [{ actionType: 'select_shapes', error: 'select_shapes requires a mounted tldraw editor' }]
    })
  })
})
```

- [ ] **Step 2: Run headless tests and verify failure**

Run:

```bash
npm test -- server/canvas/tldrawHeadlessExecutor.test.ts
```

Expected: FAIL because `tldrawHeadlessExecutor.ts` does not exist.

- [ ] **Step 3: Implement headless executor**

Create `server/canvas/tldrawHeadlessExecutor.ts`:

```ts
import type { CanvasAction } from '../../src/canvas/actions/canvasAction.types'
import type { CanvasObservationState } from '../../src/canvas/tldraw/tldrawObservation'
import {
  createMemoryTldrawTarget,
  executeTldrawAction,
  readTldrawObservation,
  type TldrawActionResult
} from '../../src/canvas/tldraw/tldrawActionExecutor'
import type { TldrawSyncRoomManager } from './tldrawSyncServer'

type ActionEnvelope = {
  type: 'canvas.action'
  requestId: string
  canvasId: string
  actions: CanvasAction[]
}

type HeadlessResponse =
  | {
      type: 'canvas.result'
      requestId: string
      ok: boolean
      results: TldrawActionResult[]
    }
  | {
      type: 'canvas.observation'
      requestId: string
      canvasId: string
      state: CanvasObservationState
    }
  | {
      type: 'canvas.error'
      requestId: string
      message: string
    }

export async function executeHeadlessTldrawAction(
  syncRooms: TldrawSyncRoomManager,
  envelope: ActionEnvelope
): Promise<HeadlessResponse[]> {
  try {
    const room = syncRooms.getOrCreateRoom(envelope.canvasId)
    const target = createMemoryTldrawTarget(envelope.canvasId)
    const before = room.getCurrentSnapshot()
    for (const document of before.documents) {
      const record = document.state as Record<string, unknown>
      if (record.typeName === 'shape') {
        target.shapes.set(String(record.id), {
          id: String(record.id),
          type: String(record.type),
          x: typeof record.x === 'number' ? record.x : 0,
          y: typeof record.y === 'number' ? record.y : 0,
          props: isRecord(record.props) ? record.props : {},
          meta: isRecord(record.meta) ? record.meta : {}
        })
      }
    }

    const results = envelope.actions.map((action) => executeTldrawAction(target, action))
    await room.updateStore((store) => {
      for (const shape of target.shapes.values()) {
        store.put(toTldrawShapeRecord(shape) as any)
      }
    })
    const observation = readTldrawObservation(target)
    return [
      {
        type: 'canvas.result',
        requestId: envelope.requestId,
        ok: results.every((result) => !result.error),
        results
      },
      {
        type: 'canvas.observation',
        requestId: envelope.requestId,
        canvasId: envelope.canvasId,
        state: observation
      }
    ]
  } catch (error) {
    return [
      {
        type: 'canvas.error',
        requestId: envelope.requestId,
        message: error instanceof Error ? error.message : String(error)
      }
    ]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toTldrawShapeRecord(shape: {
  id: string
  type: string
  x: number
  y: number
  props: Record<string, unknown>
  meta: Record<string, unknown>
}) {
  return {
    id: shape.id,
    typeName: 'shape',
    type: shape.type,
    x: shape.x,
    y: shape.y,
    rotation: 0,
    index: 'a1',
    parentId: 'page:page',
    isLocked: false,
    opacity: 1,
    props: shape.props,
    meta: shape.meta
  }
}
```

- [ ] **Step 4: Replace gateway fallback import and call**

In `server/canvas/canvasGateway.ts`, replace:

```ts
import { executeHeadlessCanvasAction } from './headlessCanvasExecutor'
```

with:

```ts
import { executeHeadlessTldrawAction } from './tldrawHeadlessExecutor'
```

Replace the fallback call:

```ts
void executeHeadlessTldrawAction(syncRooms, validated.data).then((responses) => {
  responses.forEach((responseEnvelope) => {
    socket.send(JSON.stringify(responseEnvelope))
  })
})
```

- [ ] **Step 5: Run headless and gateway tests**

Run:

```bash
npm test -- server/canvas/tldrawHeadlessExecutor.test.ts server/canvas/canvasGateway.test.ts
```

Expected: PASS after updating gateway test expected action names to the new tldraw schema.

- [ ] **Step 6: Commit**

```bash
git add server/canvas/tldrawHeadlessExecutor.ts server/canvas/tldrawHeadlessExecutor.test.ts server/canvas/canvasGateway.ts server/canvas/canvasGateway.test.ts
git commit -m "feat: execute tldraw actions headlessly"
```

## Task 9: Replace CanvasSurface With tldraw

**Files:**
- Modify: `src/canvas/components/CanvasSurface.tsx`
- Modify: `src/canvas/components/CanvasSurface.test.tsx`
- Modify: `src/canvas/state/bridgeStore.ts`
- Create: `src/canvas/bridge/syncConfig.ts`

- [ ] **Step 1: Replace frontend mount tests**

Replace `src/canvas/components/CanvasSurface.test.tsx` with tests that mock `tldraw` and `@tldraw/sync`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { useBridgeStore } from '../state/bridgeStore'

const socketSpies = vi.hoisted(() => ({ connect: vi.fn(), send: vi.fn() }))
const syncMock = vi.hoisted(() => ({ uri: '', store: { kind: 'mock-store' } }))
const editorMock = vi.hoisted(() => ({
  getCurrentPageShapesSorted: vi.fn(() => []),
  getSelectedShapeIds: vi.fn(() => []),
  getCamera: vi.fn(() => ({ x: 0, y: 0, z: 1 })),
  createShape: vi.fn(),
  updateShape: vi.fn(),
  deleteShapes: vi.fn(),
  setCamera: vi.fn(),
  zoomToFit: vi.fn(),
  select: vi.fn(),
  selectNone: vi.fn()
}))

vi.mock('../bridge/websocketClient', () => ({
  BridgeWebSocketClient: class {
    connect = socketSpies.connect
    send = socketSpies.send
  }
}))

vi.mock('@tldraw/sync', () => ({
  useSync: (input: { uri: string }) => {
    syncMock.uri = input.uri
    return syncMock.store
  }
}))

vi.mock('tldraw', () => ({
  Tldraw: ({ onMount }: { onMount(editor: unknown): void }) => {
    useEffect(() => onMount(editorMock), [onMount])
    return <div data-testid="tldraw-root">tldraw mounted</div>
  },
  defaultBindingUtils: [],
  defaultShapeUtils: [],
  HTMLContainer: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Rectangle2d: class {
    constructor(public props: unknown) {}
  },
  ShapeUtil: class {}
}))

describe('CanvasSurface', () => {
  beforeEach(() => {
    socketSpies.connect.mockClear()
    socketSpies.send.mockClear()
    syncMock.uri = ''
    useBridgeStore.setState({
      bridge: null,
      editor: null,
      canvasId: 'canvas_001',
      status: 'disconnected',
      lastObservation: null,
      logs: []
    } as any)
  })

  it('renders tldraw and registers a bridge editor target', async () => {
    render(<App />)

    expect(screen.getByTestId('tldraw-root')).toBeInTheDocument()
    await waitFor(() => expect(useBridgeStore.getState().editor).toBe(editorMock))
    expect(useBridgeStore.getState().bridge).not.toBeNull()
  })

  it('connects useSync to the local sync room', () => {
    render(<App />)

    expect(syncMock.uri).toContain('/sync/canvas_001')
  })
})
```

- [ ] **Step 2: Run frontend mount tests and verify failure**

Run:

```bash
npm test -- src/canvas/components/CanvasSurface.test.tsx
```

Expected: FAIL because `CanvasSurface` still imports Excalidraw.

- [ ] **Step 3: Update bridge store**

Replace `src/canvas/state/bridgeStore.ts` with:

```ts
import { create } from 'zustand'
import type { Editor } from 'tldraw'
import type { CanvasBridge } from '../bridge/CanvasBridge'
import type { CanvasObservationState } from '../tldraw/tldrawObservation'

export type BridgeStatus = 'disconnected' | 'ready' | 'error'

export type LogEntry = {
  id: string
  timestamp: string
  direction: 'in' | 'out' | 'info' | 'error'
  type: string
  payload: unknown
}

type BridgeStore = {
  bridge: CanvasBridge | null
  editor: Editor | null
  canvasId: string
  status: BridgeStatus
  lastObservation: CanvasObservationState | null
  logs: LogEntry[]
  setBridge(bridge: CanvasBridge, editor: Editor): void
  setStatus(status: BridgeStatus): void
  setObservation(state: CanvasObservationState): void
  addLog(direction: LogEntry['direction'], type: string, payload: unknown): void
  clearLogs(): void
}

export const useBridgeStore = create<BridgeStore>((set) => ({
  bridge: null,
  editor: null,
  canvasId: 'canvas_001',
  status: 'disconnected',
  lastObservation: null,
  logs: [],
  setBridge: (bridge, editor) => set({ bridge, editor, status: 'ready' }),
  setStatus: (status) => set({ status }),
  setObservation: (lastObservation) => set({ lastObservation }),
  addLog: (direction, type, payload) =>
    set((state) => ({
      logs: [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          direction,
          type,
          payload
        },
        ...state.logs.slice(0, 99)
      ]
    })),
  clearLogs: () => set({ logs: [] })
}))
```

- [ ] **Step 4: Add sync URL config**

Create `src/canvas/bridge/syncConfig.ts`:

```ts
type SyncEnv = {
  VITE_TLDRAW_SYNC_URL?: string
}

export function getTldrawSyncUrl(canvasId: string, env: SyncEnv = import.meta.env): string {
  const configured = env.VITE_TLDRAW_SYNC_URL?.trim()
  if (configured) return `${configured.replace(/\/$/, '')}/${encodeURIComponent(canvasId)}`
  return `ws://localhost:8787/sync/${encodeURIComponent(canvasId)}`
}
```

- [ ] **Step 5: Replace `CanvasSurface`**

Replace `src/canvas/components/CanvasSurface.tsx` with:

```tsx
import { useMemo } from 'react'
import { Tldraw, defaultBindingUtils, defaultShapeUtils, type Editor, type TLAssetStore } from 'tldraw'
import { useSync } from '@tldraw/sync'
import { CanvasBridge } from '../bridge/CanvasBridge'
import { getCanvasGatewayUrl } from '../bridge/gatewayConfig'
import { getTldrawSyncUrl } from '../bridge/syncConfig'
import { BridgeWebSocketClient } from '../bridge/websocketClient'
import {
  canvasActionEnvelopeSchema,
  canvasErrorEnvelopeSchema,
  canvasObservationEnvelopeSchema,
  canvasResultEnvelopeSchema
} from '../protocol/canvasMessages'
import { useBridgeStore } from '../state/bridgeStore'
import { hermesShapeUtils } from '../tldraw/customShapeUtils'
import { createMemoryTldrawTarget, readTldrawObservation } from '../tldraw/tldrawActionExecutor'

const socket = new BridgeWebSocketClient()
const CANVAS_ID = 'canvas_001'

const emptyAssetStore: TLAssetStore = {
  upload: async () => {
    throw new Error('Asset uploads are not enabled')
  },
  resolve: (asset) => asset.props.src
}

export function CanvasSurface() {
  const setBridge = useBridgeStore((state) => state.setBridge)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const setStatus = useBridgeStore((state) => state.setStatus)
  const addLog = useBridgeStore((state) => state.addLog)
  const shapeUtils = useMemo(() => [...hermesShapeUtils, ...defaultShapeUtils], [])
  const bindingUtils = useMemo(() => [...defaultBindingUtils], [])
  const store = useSync({
    uri: getTldrawSyncUrl(CANVAS_ID),
    assets: emptyAssetStore,
    shapeUtils,
    bindingUtils
  })

  function handleMount(editor: Editor) {
    const target = createMemoryTldrawTarget(CANVAS_ID)
    target.editor = editor
    const bridge = new CanvasBridge(target)
    setBridge(bridge, editor)
    setObservation(readTldrawObservation(target))

    const gatewayUrl = getCanvasGatewayUrl()
    if (!gatewayUrl) {
      addLog('info', 'gateway_disabled', 'WebSocket gateway disabled. Set VITE_CANVAS_GATEWAY_URL to connect Hermes.')
      return
    }

    socket.connect(gatewayUrl, {
      onOpen() {
        setStatus('ready')
        const readyPayload = { type: 'canvas.ready' as const, canvasId: CANVAS_ID, roomId: 'room_001' }
        socket.send(readyPayload)
        addLog('out', 'canvas.ready', readyPayload)
      },
      onClose() {
        setStatus('disconnected')
        addLog('info', 'connection_closed', 'Websocket connection disconnected')
      },
      onError() {
        setStatus('error')
        addLog('error', 'connection_error', 'Websocket connection error')
      },
      onMessage(data) {
        let payload: unknown
        try {
          payload = JSON.parse(data)
        } catch (error) {
          addLog('error', 'parse_error', { raw: data, error: String(error) })
          return
        }

        const record = payload as { type?: string }
        if (record.type === 'canvas.action') {
          addLog('in', 'canvas.action', payload)
          const validated = canvasActionEnvelopeSchema.parse(payload)
          const response = bridge.handleActionEnvelope(validated)
          if ('error' in response) {
            socket.send(response.error)
            addLog('out', 'canvas.error', response.error)
            return
          }
          setObservation(response.observation.state)
          socket.send(response.result)
          socket.send(response.observation)
          addLog('out', 'canvas.result', response.result)
          addLog('out', 'canvas.observation', response.observation)
          return
        }

        if (record.type === 'canvas.result') {
          addLog('in', 'canvas.result', payload)
          canvasResultEnvelopeSchema.parse(payload)
          return
        }

        if (record.type === 'canvas.observation') {
          addLog('in', 'canvas.observation', payload)
          const observation = canvasObservationEnvelopeSchema.parse(payload)
          setObservation(observation.state)
          return
        }

        if (record.type === 'canvas.error') {
          addLog('in', 'canvas.error', payload)
          canvasErrorEnvelopeSchema.parse(payload)
          setStatus('error')
        }
      }
    })
  }

  return <Tldraw store={store} shapeUtils={hermesShapeUtils} bindingUtils={[]} onMount={handleMount} />
}
```

- [ ] **Step 6: Run frontend tests**

Run:

```bash
npm test -- src/canvas/components/CanvasSurface.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/canvas/components/CanvasSurface.tsx src/canvas/components/CanvasSurface.test.tsx src/canvas/state/bridgeStore.ts src/canvas/bridge/syncConfig.ts
git commit -m "feat: render synced tldraw canvas surface"
```

## Task 10: Update Simulator And Inspector For tldraw Actions

**Files:**
- Modify: `src/canvas/components/Simulator.tsx`
- Modify: `src/canvas/components/Inspector.tsx`
- Modify: `src/canvas/components/CanvasSurface.test.tsx`

- [ ] **Step 1: Update simulator presets**

In `src/canvas/components/Simulator.tsx`, replace old presets with:

```ts
const PRESETS = [
  {
    name: 'Todo Block',
    value: {
      type: 'create_todo_block',
      id: 'shape:todo_1',
      title: 'Launch Checklist',
      x: 100,
      y: 150,
      tasks: [
        { id: 'task_copy', text: 'Write launch copy' },
        { id: 'task_assets', text: 'Prepare product screenshots', done: true }
      ]
    }
  },
  {
    name: 'Task Card',
    value: {
      type: 'create_task_card',
      id: 'shape:task_1',
      title: 'Design New UI System',
      body: 'Create a tldraw-based canvas dashboard.',
      x: 100,
      y: 150,
      status: 'in_progress',
      priority: 'high'
    }
  },
  {
    name: 'Link Card',
    value: {
      type: 'create_link_card',
      id: 'shape:link_1',
      title: 'tldraw Documentation',
      url: 'https://tldraw.dev/docs',
      x: 100,
      y: 350
    }
  },
  {
    name: 'Native Geo Shape',
    value: {
      type: 'create_shape',
      shape: {
        id: 'shape:box_1',
        type: 'geo',
        x: 80,
        y: 80,
        props: { w: 320, h: 180, geo: 'rectangle' }
      }
    }
  }
]
```

Then replace every `adapter` reference with `canvasId` from `useBridgeStore`. Use `canvasId` in envelopes. Replace `clearCanvas` with delete actions over `lastObservation.shapes`.

- [ ] **Step 2: Update inspector shape rendering**

In `src/canvas/components/Inspector.tsx`:

- Replace `blocks` with `shapes`.
- Replace `delete_block` with `delete_shapes`.
- Replace `update_text` with `update_shape`.
- Replace focus logic with `editor.select(shape.id as any)` and `editor.zoomToFit()`.
- Remove `file_card` and `job_panel` filter options.

Use this envelope for delete:

```ts
const envelope = {
  type: 'canvas.action' as const,
  requestId: 'insp_del_' + Math.random().toString(36).substring(2, 9),
  canvasId,
  actions: [{ type: 'delete_shapes' as const, shapeIds: [shapeId] }]
}
```

Use this envelope for text-like edits:

```ts
const envelope = {
  type: 'canvas.action' as const,
  requestId: 'insp_edit_' + Math.random().toString(36).substring(2, 9),
  canvasId,
  actions: [{ type: 'update_shape' as const, shapeId, patch: { props: { title: editText } } }]
}
```

- [ ] **Step 3: Run component tests and typecheck**

Run:

```bash
npm test -- src/canvas/components/CanvasSurface.test.tsx
npm run lint:types
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/components/Simulator.tsx src/canvas/components/Inspector.tsx src/canvas/components/CanvasSurface.test.tsx
git commit -m "feat: update dashboard controls for tldraw actions"
```

## Task 11: Remove Excalidraw Persistence And Adapter Code

**Files:**
- Delete: `src/canvas/adapters/ExcalidrawAdapter.ts`
- Delete: `src/canvas/adapters/ExcalidrawAdapter.test.ts`
- Delete: `src/canvas/adapters/canvasAdapter.ts`
- Delete: `src/canvas/state/canvasPersistence.ts`
- Delete: `src/canvas/state/canvasPersistence.test.ts`
- Delete: `server/canvas/headlessExcalidrawApi.ts`
- Delete: `server/canvas/headlessExcalidrawApi.test.ts`
- Delete: `server/canvas/headlessCanvasExecutor.ts`
- Delete: `server/canvas/headlessCanvasExecutor.test.ts`
- Delete or retire: `server/canvas/canvasFileStore.ts`
- Delete or retire: `server/canvas/canvasFileStore.test.ts`

- [ ] **Step 1: Search for Excalidraw references**

Run:

```bash
rg -n "Excalidraw|excalidraw|canvasPersistence|CanvasAdapter|CanvasFileStore|headlessCanvasExecutor|headlessExcalidrawApi" src server
```

Expected: references remain in files scheduled for deletion and possibly tests/docs.

- [ ] **Step 2: Delete obsolete source and test files**

Run:

```bash
git rm src/canvas/adapters/ExcalidrawAdapter.ts src/canvas/adapters/ExcalidrawAdapter.test.ts src/canvas/adapters/canvasAdapter.ts src/canvas/state/canvasPersistence.ts src/canvas/state/canvasPersistence.test.ts server/canvas/headlessExcalidrawApi.ts server/canvas/headlessExcalidrawApi.test.ts server/canvas/headlessCanvasExecutor.ts server/canvas/headlessCanvasExecutor.test.ts server/canvas/canvasFileStore.ts server/canvas/canvasFileStore.test.ts
```

Expected: files are staged for deletion.

- [ ] **Step 3: Fix imports exposed by deletion**

Run:

```bash
npm run lint:types
```

Expected: FAIL lists remaining imports. Replace those imports with tldraw modules created in earlier tasks. If a file only exists to test deleted behavior, remove it with `git rm`.

- [ ] **Step 4: Verify no Excalidraw runtime references remain**

Run:

```bash
rg -n "Excalidraw|excalidraw|@excalidraw/excalidraw" src server package.json
```

Expected: no matches.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test
npm run lint:types
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src server package.json package-lock.json pnpm-lock.yaml
git commit -m "refactor: remove excalidraw canvas implementation"
```

## Task 12: Update API Docs And Plugin Examples

**Files:**
- Modify: `README.md`
- Modify: `CANVAS_API.md`
- Modify: `skills/canvas-dashboard/SKILL.md`
- Modify: `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`

- [ ] **Step 1: Update README local development section**

Replace Excalidraw and `/canvas-state` descriptions with:

```markdown
The gateway exposes two canvas capabilities:

- Hermes action WebSocket API: `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`
- tldraw sync WebSocket API: `ws://localhost:8787/sync/canvas_001`

Canvas document state is persisted by tldraw sync in `data/tldraw-sync.sqlite`. The old Excalidraw JSON snapshot files are not migrated and are ignored by the tldraw runtime.
```

- [ ] **Step 2: Update `CANVAS_API.md` action examples**

Add examples for:

```json
{
  "type": "create_task_card",
  "id": "shape:task_1",
  "title": "Design API",
  "body": "Document tldraw actions",
  "x": 100,
  "y": 120,
  "status": "todo",
  "priority": "high"
}
```

```json
{
  "type": "create_shape",
  "shape": {
    "id": "shape:box_1",
    "type": "geo",
    "x": 80,
    "y": 80,
    "props": { "w": 320, "h": 180, "geo": "rectangle" }
  }
}
```

- [ ] **Step 3: Update skill docs examples**

In both skill docs, replace old `blockId` examples with `shapeId` examples:

```json
[
  { "type": "create_todo_block", "id": "shape:todo_1", "title": "Launch Checklist", "x": 100, "y": 150 },
  { "type": "append_todo_task", "shapeId": "shape:todo_1", "taskId": "task_ship", "text": "Ship feature" },
  { "type": "set_todo_task_done", "shapeId": "shape:todo_1", "taskId": "task_ship", "done": true }
]
```

- [ ] **Step 4: Run doc reference scan**

Run:

```bash
rg -n "Excalidraw|excalidraw|canvas-state|blockId|create_box|create_note|update_text|delete_block" README.md CANVAS_API.md skills plugins
```

Expected: no active user-facing references to old APIs. Historical spec/plan docs may still mention Excalidraw and do not need edits.

- [ ] **Step 5: Commit**

```bash
git add README.md CANVAS_API.md skills/canvas-dashboard/SKILL.md plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md
git commit -m "docs: document tldraw canvas api"
```

## Task 13: Final Verification

**Files:**
- Modify any file reported by verification failures.

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
npm test
npm run lint:types
npm run build
```

Expected: all commands pass.

- [ ] **Step 2: Start the gateway**

Run:

```bash
npm run server
```

Expected output includes:

```text
Canvas gateway listening on ws://localhost:8787/canvas
tldraw sync listening on ws://localhost:8787/sync/canvas_001
```

- [ ] **Step 3: In another terminal, start the frontend**

Run:

```bash
VITE_TLDRAW_SYNC_URL="ws://localhost:8787/sync" VITE_CANVAS_GATEWAY_URL="ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge" npm run dev
```

Expected: Vite prints a local URL and the dashboard shows a tldraw canvas.

- [ ] **Step 4: Send a Hermes-style action**

Run:

```bash
npm run hermes:demo -- --actions '[{"type":"create_task_card","id":"shape:task_verify","title":"Verification Task","body":"Created through Hermes","x":100,"y":120}]'
```

Expected: command prints `canvas.result` with `ok: true` and `createdShapeIds` containing `shape:task_verify`.

- [ ] **Step 5: Verify persistence**

Stop and restart both server and frontend. Expected: the tldraw room still contains `Verification Task`, and `data/tldraw-sync.sqlite` exists.

- [ ] **Step 6: Final reference scan**

Run:

```bash
rg -n "Excalidraw|excalidraw|@excalidraw/excalidraw|canvas-state" src server package.json README.md CANVAS_API.md
```

Expected: no matches.

- [ ] **Step 7: Final commit if verification required fixes**

If Step 1 through Step 6 required fixes, commit them:

```bash
git add .
git commit -m "fix: complete tldraw canvas replacement verification"
```

If no fixes were required, do not create an empty commit.
