# Project Task Board Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Project card's project-level lifecycle checklist with a title-only, persistent four-column task board whose tasks can be created, edited, deleted, reordered, and dragged between statuses.

**Architecture:** Keep one `project_card` tldraw record with a flat ordered task array. Pure domain functions own every task mutation, a framework-free drop resolver converts pointer coordinates into deterministic insertion targets, and a focused React board component owns editing and drag interaction while the existing `ShapeUtil` remains a thin tldraw adapter. The browser and headless executors call the same domain functions.

**Tech Stack:** TypeScript, React 19, React DOM portals, tldraw 5.2, Zod 3, Vitest, Testing Library, Vite, tldraw sync, SQLite-backed sync rooms, plain CSS.

## Global Constraints

- Keep the internal shape identifier `project_card`.
- Project properties are exactly width, height, title, tasks, and color; do not retain project status, priority, due date, or progress.
- Task statuses are exactly `todo`, `doing`, `done`, and `blocked`, displayed in that order.
- Defaults are title `New Project`, no tasks, `960x480`, minimum `760x320`, and color `light-violet`.
- The only task-creation control is one footer Plus button; it appends to Todo and immediately edits the new text.
- Double-click edits project titles and task text; Enter/blur save, Escape restores, and blank committed values fall back to `Untitled Project` or `New task`.
- Support pointer dragging within and across columns, including empty columns and beginning/middle/end insertion; invalid/outside drops cancel.
- Do not add a drag-and-drop dependency or drag autoscroll.
- Do not semantically preserve old Project-card fields/actions; the v2 migration discards them and initializes an empty task list.
- Browser and headless routes must return equivalent results, errors, persistence, and observations.
- Preserve Todo, Link, Note, sync, selection, insert-menu, and tidy-layout behavior.

---

## File Structure

- Modify `src/canvas/tldraw/projectCard.types.ts`: replace legacy lifecycle fields with task-board types, migration, normalization, IDs, and pure mutations.
- Modify `src/canvas/tldraw/projectCard.types.test.ts`: cover defaults, migration, validation, and task ordering mutations.
- Modify `src/canvas/actions/canvasAction.types.ts`: replace checklist actions with six task-board operations.
- Modify `src/canvas/actions/canvasAction.schema.ts`: validate and trim the revised payloads.
- Modify `src/canvas/actions/canvasAction.schema.test.ts`: prove the revised contract and reject legacy fields/actions.
- Modify `src/canvas/tldraw/tldrawActionExecutor.ts`: call pure project-task mutations for both browser and headless targets.
- Modify `src/canvas/tldraw/tldrawActionExecutor.test.ts`: cover the complete lifecycle and action-level errors.
- Modify `src/canvas/bridge/CanvasBridge.test.ts`: cover sequential failure continuation.
- Modify `server/canvas/tldrawHeadlessExecutor.test.ts`: cover sync-room persistence and observations.
- Create `src/canvas/tldraw/projectCardDrag.ts`: resolve pointer coordinates to a status and `beforeTaskId` without DOM dependencies.
- Create `src/canvas/tldraw/projectCardDrag.test.ts`: cover drop geometry and empty columns.
- Create `src/canvas/tldraw/ProjectCardBoard.tsx`: render columns and own local edit/drag state.
- Create `src/canvas/tldraw/ProjectCardBoard.test.tsx`: cover rendering, editing, addition, deletion, and pointer dragging.
- Modify `src/canvas/tldraw/projectCardUtils.tsx`: reduce the shape utility to a tldraw adapter around `ProjectCardBoard`.
- Modify `src/canvas/tldraw/projectCardUtils.test.tsx`: cover defaults, adapter updates, color, and minimum resize.
- Modify `src/styles.css`: replace lifecycle/checklist rules with board, column, task, edit, drag, and focus rules.
- Modify `src/canvas/components/CanvasInsertMenu.tsx`: create and center a `960x480` Project board.
- Modify `src/canvas/components/CanvasSurface.test.tsx`: update default insertion assertions.
- Modify `src/canvas/tldraw/tidyCardLayout.test.ts`: account for the wider Project column.
- Modify `CANVAS_API.md`, `README.md`, `docs/PRD.md`, and `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`: replace the old lifecycle contract with task-board workflows.

---

### Task 1: Replace the Project Domain With Ordered Task Mutations

**Files:**
- Modify: `src/canvas/tldraw/projectCard.types.ts`
- Test: `src/canvas/tldraw/projectCard.types.test.ts`
- Verify: `src/canvas/tldraw/tldrawSchema.test.ts`

**Interfaces:**
- Produces: `PROJECT_TASK_STATUSES`, `ProjectTaskStatus`, `ProjectTask`, `ProjectTaskInput`, `ProjectCardProps`, `nextProjectTaskId()`, `normalizeProjectTasks()`, `appendProjectTask()`, `updateProjectTaskText()`, `moveProjectTask()`, `removeProjectTask()`, `fitProjectCardDimensions()`, and `createProjectCardProps()`.
- Preserves: `PROJECT_CARD_TYPE`, `projectCardMigrations`, and `projectCardProps` for the registered shared schema.

- [ ] **Step 1: Replace the domain tests with failing task-board cases**

Use these core assertions in `src/canvas/tldraw/projectCard.types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  appendProjectTask,
  createProjectCardProps,
  moveProjectTask,
  nextProjectTaskId,
  projectCardMigrations,
  removeProjectTask,
  updateProjectTaskText
} from './projectCard.types'

const tasks = [
  { id: 'task_a', text: 'A', status: 'todo' as const },
  { id: 'task_b', text: 'B', status: 'todo' as const },
  { id: 'task_c', text: 'C', status: 'doing' as const }
]

describe('project task-board domain', () => {
  it('creates wide defaults and reserves explicit task ids before generation', () => {
    expect(createProjectCardProps({
      title: '  Website launch  ',
      tasks: [
        { text: '  Draft copy  ' },
        { id: 'task_0001', text: 'Review', status: 'doing' },
        { text: 'Ship', status: 'blocked' }
      ]
    })).toEqual({
      w: 960,
      h: 480,
      title: 'Website launch',
      tasks: [
        { id: 'task_0002', text: 'Draft copy', status: 'todo' },
        { id: 'task_0001', text: 'Review', status: 'doing' },
        { id: 'task_0003', text: 'Ship', status: 'blocked' }
      ],
      color: 'light-violet'
    })
  })

  it('fits dimensions to 760 by 320 and allocates the first free task id', () => {
    expect(createProjectCardProps({ title: 'Small', w: 100, h: 100 })).toMatchObject({
      w: 760,
      h: 320
    })
    expect(nextProjectTaskId([{ id: 'task_0001' }, { id: 'task_0003' }])).toBe('task_0002')
  })

  it('discards legacy lifecycle fields in the task-board migration', () => {
    const migration = projectCardMigrations.sequence[1]
    if (!('up' in migration)) throw new Error('Expected task-board up migration')
    const props: Record<string, unknown> = {
      w: 360, h: 320, title: 'Legacy', color: 'light-violet',
      status: 'active', priority: 'high', dueDate: '2026-07-31',
      actions: [{ id: 'action_ship', text: 'Ship', done: false }]
    }
    migration.up(props)
    expect(props).toEqual({
      w: 760, h: 320, title: 'Legacy', color: 'light-violet', tasks: []
    })
  })

  it('appends, edits, and removes tasks without changing unrelated tasks', () => {
    const appended = appendProjectTask(tasks, { id: 'task_d', text: ' D ', status: 'done' })
    expect(appended.at(-1)).toEqual({ id: 'task_d', text: 'D', status: 'done' })
    expect(updateProjectTaskText(appended, 'task_d', '  Delivered  ').at(-1)?.text).toBe('Delivered')
    expect(removeProjectTask(appended, 'task_b').map((task) => task.id)).toEqual([
      'task_a', 'task_c', 'task_d'
    ])
  })

  it('moves across columns and before a destination task', () => {
    expect(moveProjectTask(tasks, 'task_b', 'doing', 'task_c')).toEqual([
      { id: 'task_a', text: 'A', status: 'todo' },
      { id: 'task_b', text: 'B', status: 'doing' },
      { id: 'task_c', text: 'C', status: 'doing' }
    ])
  })

  it('reorders within a column and appends to an empty column', () => {
    expect(moveProjectTask(tasks, 'task_b', 'todo', 'task_a').map((task) => task.id)).toEqual([
      'task_b', 'task_a', 'task_c'
    ])
    expect(moveProjectTask(tasks, 'task_a', 'blocked').at(-1)).toEqual({
      id: 'task_a', text: 'A', status: 'blocked'
    })
  })

  it('returns the original array for an effective no-op and rejects invalid targets', () => {
    expect(moveProjectTask(tasks, 'task_a', 'todo', 'task_b')).toBe(tasks)
    expect(() => moveProjectTask(tasks, 'missing', 'todo')).toThrow('Unknown project task missing')
    expect(() => moveProjectTask(tasks, 'task_a', 'doing', 'task_b')).toThrow(
      'Project task task_b is not in doing'
    )
    expect(() => moveProjectTask(tasks, 'task_a', 'todo', 'task_a')).toThrow(
      'Project task cannot move before itself'
    )
  })

  it('rejects blank text, duplicate ids, and invalid runtime status values', () => {
    expect(() => createProjectCardProps({ title: '   ' })).toThrow('Project title must not be empty')
    expect(() => createProjectCardProps({
      title: 'Launch',
      tasks: [{ id: 'same', text: 'A' }, { id: 'same', text: 'B' }]
    })).toThrow('Duplicate project task same')
    expect(() => appendProjectTask(tasks, {
      id: 'task_bad', text: 'Bad', status: 'paused' as never
    })).toThrow('Invalid project task status paused')
  })
})
```

- [ ] **Step 2: Run the domain tests and verify the red state**

Run: `npm test -- src/canvas/tldraw/projectCard.types.test.ts src/canvas/tldraw/tldrawSchema.test.ts`

Expected: FAIL because task-board exports and defaults do not exist.

- [ ] **Step 3: Replace the domain types, validators, and v2 migration**

In `src/canvas/tldraw/projectCard.types.ts`, retain the tldraw imports and replace the legacy model with:

```ts
export const PROJECT_CARD_TYPE = 'project_card'
export const PROJECT_CARD_DEFAULT_WIDTH = 960
export const PROJECT_CARD_DEFAULT_HEIGHT = 480
export const PROJECT_CARD_MIN_WIDTH = 760
export const PROJECT_CARD_MIN_HEIGHT = 320
export const DEFAULT_PROJECT_CARD_COLOR = 'light-violet'
export const PROJECT_TASK_STATUSES = ['todo', 'doing', 'done', 'blocked'] as const

export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number]
export type ProjectTask = { id: string; text: string; status: ProjectTaskStatus }
export type ProjectTaskInput = { id?: string; text: string; status?: ProjectTaskStatus }
export type ProjectCardProps = {
  w: number
  h: number
  title: string
  tasks: ProjectTask[]
  color: string
}

const projectCardVersions = createShapePropsMigrationIds(PROJECT_CARD_TYPE, {
  AddProjectFields: 1,
  TaskBoardFields: 2
})

export const projectCardMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: projectCardVersions.AddProjectFields,
      up: (props) => {
        props.status ??= 'planned'
        props.priority ??= 'medium'
        props.actions ??= []
        props.color ??= DEFAULT_PROJECT_CARD_COLOR
      },
      down: (props) => {
        delete props.status
        delete props.priority
        delete props.dueDate
        delete props.actions
        delete props.color
      }
    },
    {
      id: projectCardVersions.TaskBoardFields,
      up: (props) => {
        delete props.status
        delete props.priority
        delete props.dueDate
        delete props.actions
        props.tasks ??= []
        props.w = Math.max(PROJECT_CARD_MIN_WIDTH, Number(props.w) || PROJECT_CARD_DEFAULT_WIDTH)
        props.h = Math.max(PROJECT_CARD_MIN_HEIGHT, Number(props.h) || PROJECT_CARD_DEFAULT_HEIGHT)
      },
      down: (props) => {
        delete props.tasks
        props.status = 'planned'
        props.priority = 'medium'
        props.actions = []
      }
    }
  ]
})

const projectTaskValidator = T.object({
  id: T.string,
  text: T.string,
  status: T.literalEnum(...PROJECT_TASK_STATUSES)
})

export const projectCardProps = {
  w: T.number,
  h: T.number,
  title: T.string,
  tasks: T.arrayOf(projectTaskValidator),
  color: DefaultColorStyle
}
```

- [ ] **Step 4: Implement normalization and pure task mutations**

Add these concrete helpers in the same file:

```ts
function nonBlank(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} must not be empty`)
  return trimmed
}

function validStatus(status: string): status is ProjectTaskStatus {
  return (PROJECT_TASK_STATUSES as readonly string[]).includes(status)
}

export function nextProjectTaskId(tasks: Pick<ProjectTask, 'id'>[]) {
  const used = new Set(tasks.map((task) => task.id))
  for (let index = 1; ; index += 1) {
    const id = `task_${String(index).padStart(4, '0')}`
    if (!used.has(id)) return id
  }
}

export function normalizeProjectTasks(inputs: ProjectTaskInput[] = []): ProjectTask[] {
  const supplied = inputs.flatMap((task) => task.id ? [task.id] : [])
  const duplicate = supplied.find((id, index) => supplied.indexOf(id) !== index)
  if (duplicate) throw new Error(`Duplicate project task ${duplicate}`)
  const used = new Set(supplied)
  return inputs.map((input) => {
    let id = input.id
    if (!id) {
      id = nextProjectTaskId([...used].map((usedId) => ({ id: usedId })))
      used.add(id)
    }
    const status = input.status ?? 'todo'
    if (!validStatus(status)) throw new Error(`Invalid project task status ${status}`)
    return { id, text: nonBlank(input.text, 'Project task text'), status }
  })
}

export function appendProjectTask(tasks: ProjectTask[], task: ProjectTask): ProjectTask[] {
  if (tasks.some((item) => item.id === task.id)) throw new Error(`Duplicate project task ${task.id}`)
  if (!validStatus(task.status)) throw new Error(`Invalid project task status ${task.status}`)
  return [...tasks, { ...task, text: nonBlank(task.text, 'Project task text') }]
}

export function updateProjectTaskText(tasks: ProjectTask[], taskId: string, text: string) {
  if (!tasks.some((task) => task.id === taskId)) throw new Error(`Unknown project task ${taskId}`)
  const nextText = nonBlank(text, 'Project task text')
  return tasks.map((task) => task.id === taskId ? { ...task, text: nextText } : task)
}

export function removeProjectTask(tasks: ProjectTask[], taskId: string) {
  if (!tasks.some((task) => task.id === taskId)) throw new Error(`Unknown project task ${taskId}`)
  return tasks.filter((task) => task.id !== taskId)
}

export function moveProjectTask(
  tasks: ProjectTask[],
  taskId: string,
  status: ProjectTaskStatus,
  beforeTaskId?: string | null
) {
  if (!validStatus(status)) throw new Error(`Invalid project task status ${status}`)
  const moving = tasks.find((task) => task.id === taskId)
  if (!moving) throw new Error(`Unknown project task ${taskId}`)
  if (beforeTaskId === taskId) throw new Error('Project task cannot move before itself')
  const remaining = tasks.filter((task) => task.id !== taskId)
  let index: number
  if (beforeTaskId) {
    index = remaining.findIndex((task) => task.id === beforeTaskId)
    if (index < 0) throw new Error(`Unknown project task ${beforeTaskId}`)
    if (remaining[index].status !== status) throw new Error(`Project task ${beforeTaskId} is not in ${status}`)
  } else {
    const last = remaining.reduce((found, task, taskIndex) => task.status === status ? taskIndex : found, -1)
    index = last < 0 ? remaining.length : last + 1
  }
  const candidate = [
    ...remaining.slice(0, index),
    { ...moving, status },
    ...remaining.slice(index)
  ]
  const before = tasks.filter((task) => task.status === status).map((task) => task.id)
  const after = candidate.filter((task) => task.status === status).map((task) => task.id)
  return moving.status === status && before.join('\0') === after.join('\0') ? tasks : candidate
}

export function fitProjectCardDimensions(w?: number, h?: number) {
  const width = typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : PROJECT_CARD_DEFAULT_WIDTH
  const height = typeof h === 'number' && Number.isFinite(h) && h > 0 ? h : PROJECT_CARD_DEFAULT_HEIGHT
  return { w: Math.max(PROJECT_CARD_MIN_WIDTH, width), h: Math.max(PROJECT_CARD_MIN_HEIGHT, height) }
}

export function createProjectCardProps(input: {
  title: string
  tasks?: ProjectTaskInput[]
  w?: number
  h?: number
  color?: string
}): ProjectCardProps {
  return {
    ...fitProjectCardDimensions(input.w, input.h),
    title: nonBlank(input.title, 'Project title'),
    tasks: normalizeProjectTasks(input.tasks),
    color: input.color ?? DEFAULT_PROJECT_CARD_COLOR
  }
}
```

- [ ] **Step 5: Run tests and type checking**

Run: `npm test -- src/canvas/tldraw/projectCard.types.test.ts src/canvas/tldraw/tldrawSchema.test.ts && npm run lint:types`

Expected: both test files PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the domain slice**

```bash
git add src/canvas/tldraw/projectCard.types.ts src/canvas/tldraw/projectCard.types.test.ts
git commit -m "refactor: model project cards as task boards"
```

---

### Task 2: Replace the Canvas Action Contract

**Files:**
- Modify: `src/canvas/actions/canvasAction.types.ts`
- Modify: `src/canvas/actions/canvasAction.schema.ts`
- Test: `src/canvas/actions/canvasAction.schema.test.ts`
- Modify: `src/canvas/tldraw/tldrawActionExecutor.ts`
- Test: `src/canvas/tldraw/tldrawActionExecutor.test.ts`

**Interfaces:**
- Consumes: `ProjectTaskInput` and `ProjectTaskStatus` from Task 1.
- Produces: `create_project_card`, `update_project_card`, `append_project_task`, `update_project_task_text`, `move_project_task`, and `remove_project_task` action variants plus in-memory execution through the shared executor.

- [ ] **Step 1: Write failing accepted/rejected schema tests**

Replace the old Project action cases with:

```ts
it('accepts and trims the complete project task-board contract', () => {
  const parsed = canvasActionBatchSchema.parse([
    {
      type: 'create_project_card', id: 'shape:project_1', x: 40, y: 80,
      title: '  Website launch  ',
      tasks: [{ id: 'task_copy', text: '  Finish copy  ' }, { text: 'Review', status: 'doing' }],
      w: 1000, h: 520, color: 'light-violet'
    },
    { type: 'update_project_card', shapeId: 'shape:project_1', title: '  Release  ' },
    { type: 'append_project_task', shapeId: 'shape:project_1', taskId: 'task_ship', text: '  Ship  ' },
    { type: 'update_project_task_text', shapeId: 'shape:project_1', taskId: 'task_ship', text: '  Publish  ' },
    { type: 'move_project_task', shapeId: 'shape:project_1', taskId: 'task_ship', status: 'done', beforeTaskId: null },
    { type: 'remove_project_task', shapeId: 'shape:project_1', taskId: 'task_ship' }
  ])
  expect(parsed).toMatchObject([
    { type: 'create_project_card', title: 'Website launch', tasks: [{ text: 'Finish copy', status: 'todo' }, { text: 'Review', status: 'doing' }] },
    { type: 'update_project_card', title: 'Release' },
    { type: 'append_project_task', text: 'Ship', status: 'todo' },
    { type: 'update_project_task_text', text: 'Publish' },
    { type: 'move_project_task', status: 'done', beforeTaskId: null },
    { type: 'remove_project_task' }
  ])
})

it('rejects legacy project fields/actions and invalid task-board payloads', () => {
  const invalid = [
    { type: 'create_project_card', x: 0, y: 0, title: 'Project', status: 'active' },
    { type: 'create_project_card', x: 0, y: 0, title: 'Project', priority: 'high' },
    { type: 'create_project_card', x: 0, y: 0, title: 'Project', dueDate: '2026-07-31' },
    { type: 'create_project_card', x: 0, y: 0, title: 'Project', tasks: [{ text: 'A', status: 'paused' }] },
    { type: 'update_project_card', shapeId: 'shape:project_1', status: 'done' },
    { type: 'append_project_task', shapeId: 'shape:project_1', taskId: '', text: 'Ship' },
    { type: 'move_project_task', shapeId: 'shape:project_1', taskId: 'task_a', status: 'planned' },
    { type: 'append_project_action', shapeId: 'shape:project_1', actionId: 'a', text: 'Legacy' },
    { type: 'set_project_action_done', shapeId: 'shape:project_1', actionId: 'a', done: true }
  ]
  invalid.forEach((action) => expect(() => canvasActionSchema.parse(action)).toThrow())
})
```

Replace the old Project executor lifecycle test at the same time with:

```ts
it('creates and mutates an ordered project task board', () => {
  const target = createMemoryTldrawTarget('canvas_001')
  const actions: CanvasAction[] = [
    { type: 'create_project_card', id: 'shape:project_1', x: 40, y: 80, title: 'Launch', tasks: [{ id: 'task_copy', text: 'Write copy' }] },
    { type: 'append_project_task', shapeId: 'shape:project_1', taskId: 'task_ship', text: 'Ship' },
    { type: 'update_project_task_text', shapeId: 'shape:project_1', taskId: 'task_ship', text: 'Publish' },
    { type: 'move_project_task', shapeId: 'shape:project_1', taskId: 'task_ship', status: 'doing' },
    { type: 'update_project_card', shapeId: 'shape:project_1', title: 'Release' },
    { type: 'remove_project_task', shapeId: 'shape:project_1', taskId: 'task_copy' }
  ]
  expect(actions.map((action) => executeTldrawAction(target, action))).toEqual([
    { actionType: 'create_project_card', createdShapeIds: ['shape:project_1'] },
    { actionType: 'append_project_task', updatedShapeIds: ['shape:project_1'] },
    { actionType: 'update_project_task_text', updatedShapeIds: ['shape:project_1'] },
    { actionType: 'move_project_task', updatedShapeIds: ['shape:project_1'] },
    { actionType: 'update_project_card', updatedShapeIds: ['shape:project_1'] },
    { actionType: 'remove_project_task', updatedShapeIds: ['shape:project_1'] }
  ])
  expect(readTldrawObservation(target).shapes[0]).toMatchObject({
    id: 'shape:project_1', type: 'project_card', w: 960, h: 480,
    props: { title: 'Release', tasks: [{ id: 'task_ship', text: 'Publish', status: 'doing' }] }
  })
})
```

- [ ] **Step 2: Run schema tests and verify failure**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts src/canvas/tldraw/tldrawActionExecutor.test.ts`

Expected: FAIL because the old project lifecycle union and executor branches are still active.

- [ ] **Step 3: Replace Project action types**

Use these definitions in `canvasAction.types.ts` and add them to `CanvasAction`:

```ts
export type CreateProjectCardAction = {
  type: 'create_project_card'
  id?: string
  x: number
  y: number
  title: string
  tasks?: ProjectTaskInput[]
  w?: number
  h?: number
  color?: string
}
export type UpdateProjectCardAction = { type: 'update_project_card'; shapeId: string; title: string }
export type AppendProjectTaskAction = {
  type: 'append_project_task'; shapeId: string; taskId: string; text: string; status?: ProjectTaskStatus
}
export type UpdateProjectTaskTextAction = {
  type: 'update_project_task_text'; shapeId: string; taskId: string; text: string
}
export type MoveProjectTaskAction = {
  type: 'move_project_task'; shapeId: string; taskId: string; status: ProjectTaskStatus; beforeTaskId?: string | null
}
export type RemoveProjectTaskAction = { type: 'remove_project_task'; shapeId: string; taskId: string }
```

- [ ] **Step 4: Replace Project Zod variants**

Use `z.object(...).strict()` for all six Project variants so legacy project keys are rejected. Define `projectTaskStatus = z.enum(['todo', 'doing', 'done', 'blocked'])`, and use `nonBlank` for IDs/text/title. Transform optional initial task status to `todo` and optional appended status to `todo`:

```ts
const projectTaskInput = z.object({
  id: nonBlank.optional(),
  text: nonBlank,
  status: projectTaskStatus.default('todo')
}).strict()

z.object({
  type: z.literal('create_project_card'), id: nonBlank.optional(), title: nonBlank,
  tasks: z.array(projectTaskInput).optional(), w: z.number().finite().positive().optional(),
  h: z.number().finite().positive().optional(), color: tldrawDefaultColor.optional(), ...position
}).strict()

z.object({ type: z.literal('update_project_card'), shapeId, title: nonBlank }).strict()
z.object({
  type: z.literal('append_project_task'), shapeId, taskId: nonBlank, text: nonBlank,
  status: projectTaskStatus.default('todo')
}).strict()
z.object({ type: z.literal('update_project_task_text'), shapeId, taskId: nonBlank, text: nonBlank }).strict()
z.object({
  type: z.literal('move_project_task'), shapeId, taskId: nonBlank, status: projectTaskStatus,
  beforeTaskId: nonBlank.nullable().optional()
}).strict()
z.object({ type: z.literal('remove_project_task'), shapeId, taskId: nonBlank }).strict()
```

Keep the existing duplicate-ID `superRefine` on initial tasks, changing its message to `duplicate task id`.

- [ ] **Step 5: Replace executor branches and run the complete contract slice**

Route revised operations in `tldrawActionExecutor.ts`:

```ts
case 'update_project_card':
  return updateProjectTitle(target, action)
case 'append_project_task':
case 'update_project_task_text':
case 'move_project_task':
case 'remove_project_task':
  return mutateProjectTasks(target, action)
```

Delete the four legacy action cases and `updateProjectMetadata`/`mutateProjectActions`. Import the Task 1 domain helpers and add:

```ts
type ProjectTaskMutation = Extract<CanvasAction, {
  type: 'append_project_task' | 'update_project_task_text' | 'move_project_task' | 'remove_project_task'
}>

function updateProjectTitle(target: TldrawExecutorTarget, action: Extract<CanvasAction, { type: 'update_project_card' }>) {
  const shape = projectShape(target, action.shapeId)
  if (!shape) return { actionType: action.type, error: `Unknown project card ${action.shapeId}` }
  return updateProjectProps(target, shape, { ...shape.props, title: action.title }, action.type)
}

function mutateProjectTasks(target: TldrawExecutorTarget, action: ProjectTaskMutation) {
  const shape = projectShape(target, action.shapeId)
  if (!shape) return { actionType: action.type, error: `Unknown project card ${action.shapeId}` }
  const tasks = Array.isArray(shape.props.tasks) ? shape.props.tasks as ProjectTask[] : []
  try {
    const nextTasks = action.type === 'append_project_task'
      ? appendProjectTask(tasks, { id: action.taskId, text: action.text, status: action.status ?? 'todo' })
      : action.type === 'update_project_task_text'
        ? updateProjectTaskText(tasks, action.taskId, action.text)
        : action.type === 'move_project_task'
          ? moveProjectTask(tasks, action.taskId, action.status, action.beforeTaskId)
          : removeProjectTask(tasks, action.taskId)
    if (nextTasks === tasks) return { actionType: action.type, updatedShapeIds: [shape.id] }
    return updateProjectProps(target, shape, { ...shape.props, tasks: nextTasks }, action.type)
  } catch (error) {
    return { actionType: action.type, error: error instanceof Error ? error.message : String(error) }
  }
}
```

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts src/canvas/tldraw/tldrawActionExecutor.test.ts && npm run lint:types`

Expected: both test files PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the contract slice**

```bash
git add src/canvas/actions/canvasAction.types.ts src/canvas/actions/canvasAction.schema.ts src/canvas/actions/canvasAction.schema.test.ts src/canvas/tldraw/tldrawActionExecutor.ts src/canvas/tldraw/tldrawActionExecutor.test.ts
git commit -m "refactor: expose project task-board actions"
```

---

### Task 3: Execute and Persist Project Task Operations

**Files:**
- Test: `src/canvas/bridge/CanvasBridge.test.ts`
- Test: `server/canvas/tldrawHeadlessExecutor.test.ts`

**Interfaces:**
- Consumes: the tested shared executor from Task 2.
- Produces: sequential browser-bridge behavior and sync-room persistence with normalized task-board observations.

- [ ] **Step 1: Replace bridge and headless lifecycle tests with task-board batches**

Use this action sequence in the bridge and headless tests:

```ts
const actions: CanvasAction[] = [
  {
    type: 'create_project_card', id: 'shape:project_1', x: 40, y: 80,
    title: 'Launch', tasks: [{ id: 'task_copy', text: 'Write copy' }]
  },
  { type: 'append_project_task', shapeId: 'shape:project_1', taskId: 'task_ship', text: 'Ship' },
  { type: 'update_project_task_text', shapeId: 'shape:project_1', taskId: 'task_ship', text: 'Publish' },
  { type: 'move_project_task', shapeId: 'shape:project_1', taskId: 'task_ship', status: 'doing' },
  { type: 'update_project_card', shapeId: 'shape:project_1', title: 'Release' },
  { type: 'remove_project_task', shapeId: 'shape:project_1', taskId: 'task_copy' }
]
```

Assert the final observation contains:

```ts
{
  id: 'shape:project_1', type: 'project_card', x: 40, y: 80, w: 960, h: 480,
  props: {
    title: 'Release',
    tasks: [{ id: 'task_ship', text: 'Publish', status: 'doing' }],
    color: 'light-violet'
  }
}
```

In `CanvasBridge.test.ts`, create `task_ship`, attempt a duplicate append, then move the original task to Doing. Assert `result.ok` is false, all three result items remain present, and the observation contains the moved task. In the headless test, send the complete sequence above, assert the normalized observation, then inspect the room snapshot and verify `props.tasks` contains `{ id: 'task_ship', text: 'Publish', status: 'doing' }`.

- [ ] **Step 2: Run executor tests and verify failure**

Run: `npm test -- src/canvas/bridge/CanvasBridge.test.ts server/canvas/tldrawHeadlessExecutor.test.ts`

Expected: FAIL because the integration tests still send and assert legacy Project action fields.

- [ ] **Step 3: Update bridge failure-continuation assertions**

Use this exact bridge batch:

```ts
actions: [
  { type: 'create_project_card', id: 'shape:project_1', x: 0, y: 0, title: 'Launch', tasks: [{ id: 'task_ship', text: 'Ship' }] },
  { type: 'append_project_task', shapeId: 'shape:project_1', taskId: 'task_ship', text: 'Duplicate' },
  { type: 'move_project_task', shapeId: 'shape:project_1', taskId: 'task_ship', status: 'doing' }
]
```

Expect the duplicate error `Duplicate project task task_ship`, the following move result, and final `props.tasks` equal to `[{ id: 'task_ship', text: 'Ship', status: 'doing' }]`.

- [ ] **Step 4: Update headless persistence assertions**

```ts
expect(responses[1]).toMatchObject({
  type: 'canvas.observation',
  state: { shapes: [{
    id: 'shape:project_1', type: 'project_card', w: 960, h: 480,
    props: { title: 'Release', tasks: [{ id: 'task_ship', text: 'Publish', status: 'doing' }] }
  }] }
})
```

Inspect the stored document and assert the same `props.title` and `props.tasks` values.

- [ ] **Step 5: Run executor, bridge, and headless tests**

Run: `npm test -- src/canvas/bridge/CanvasBridge.test.ts server/canvas/tldrawHeadlessExecutor.test.ts && npm run lint:types`

Expected: both test files PASS and TypeScript exits 0.

- [ ] **Step 6: Commit execution and persistence**

```bash
git add src/canvas/bridge/CanvasBridge.test.ts server/canvas/tldrawHeadlessExecutor.test.ts
git commit -m "test: verify project task-board persistence"
```

---

### Task 4: Build the Four-Column Board and Pointer Dragging

**Files:**
- Create: `src/canvas/tldraw/projectCardDrag.ts`
- Create: `src/canvas/tldraw/projectCardDrag.test.ts`
- Create: `src/canvas/tldraw/ProjectCardBoard.tsx`
- Create: `src/canvas/tldraw/ProjectCardBoard.test.tsx`
- Modify: `src/canvas/tldraw/projectCardUtils.tsx`
- Modify: `src/canvas/tldraw/projectCardUtils.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- `resolveProjectTaskDrop(x, y, zones) -> { status, beforeTaskId } | null` contains no DOM access.
- `ProjectCardBoard` consumes `title`, `tasks`, `onTitleChange`, `onTasksChange`, and `onInteraction`.
- `ProjectCardShapeUtil` remains responsible only for tldraw geometry, theme color, resize, and shape-prop writes.

- [ ] **Step 1: Write failing drag-geometry tests**

Create `projectCardDrag.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { resolveProjectTaskDrop } from './projectCardDrag'

const zones = [
  {
    status: 'todo' as const,
    rect: { left: 0, right: 200, top: 40, bottom: 300 },
    tasks: [
      { id: 'task_a', rect: { left: 0, right: 200, top: 60, bottom: 100 } },
      { id: 'task_b', rect: { left: 0, right: 200, top: 110, bottom: 150 } }
    ]
  },
  { status: 'doing' as const, rect: { left: 210, right: 410, top: 40, bottom: 300 }, tasks: [] }
]

describe('resolveProjectTaskDrop', () => {
  it('returns beginning, middle, end, and empty-column targets', () => {
    expect(resolveProjectTaskDrop(100, 65, zones)).toEqual({ status: 'todo', beforeTaskId: 'task_a' })
    expect(resolveProjectTaskDrop(100, 115, zones)).toEqual({ status: 'todo', beforeTaskId: 'task_b' })
    expect(resolveProjectTaskDrop(100, 250, zones)).toEqual({ status: 'todo', beforeTaskId: null })
    expect(resolveProjectTaskDrop(300, 100, zones)).toEqual({ status: 'doing', beforeTaskId: null })
  })

  it('returns null outside all column bodies', () => {
    expect(resolveProjectTaskDrop(500, 100, zones)).toBeNull()
    expect(resolveProjectTaskDrop(100, 20, zones)).toBeNull()
  })
})
```

- [ ] **Step 2: Implement the drop resolver and run its tests**

```ts
import type { ProjectTaskStatus } from './projectCard.types'

export type ProjectDragRect = { left: number; right: number; top: number; bottom: number }
export type ProjectDropZone = {
  status: ProjectTaskStatus
  rect: ProjectDragRect
  tasks: Array<{ id: string; rect: ProjectDragRect }>
}

export function resolveProjectTaskDrop(x: number, y: number, zones: ProjectDropZone[]) {
  const zone = zones.find(({ rect }) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
  if (!zone) return null
  const before = zone.tasks.find(({ rect }) => y < rect.top + (rect.bottom - rect.top) / 2)
  return { status: zone.status, beforeTaskId: before?.id ?? null }
}
```

Run: `npm test -- src/canvas/tldraw/projectCardDrag.test.ts`

Expected: PASS.

- [ ] **Step 3: Write failing board component tests**

Create a stateful harness in `ProjectCardBoard.test.tsx` and assert:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectCardBoard } from './ProjectCardBoard'
import type { ProjectTask } from './projectCard.types'

afterEach(() => vi.restoreAllMocks())

function Harness() {
  const [title, setTitle] = useState('Website launch')
  const [tasks, setTasks] = useState<ProjectTask[]>([
    { id: 'task_todo', text: 'Draft', status: 'todo' },
    { id: 'task_doing', text: 'Review', status: 'doing' },
    { id: 'task_done', text: 'Ship', status: 'done' },
    { id: 'task_blocked', text: 'Legal', status: 'blocked' }
  ])
  return <ProjectCardBoard title={title} tasks={tasks} onTitleChange={setTitle} onTasksChange={setTasks} onInteraction={() => undefined} />
}

it('renders fixed columns, counts, and status treatments', () => {
  render(<Harness />)
  expect(screen.getByRole('heading', { name: 'Todo 1' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Doing 1' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Done 1' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Blocked 1' })).toBeInTheDocument()
  expect(screen.getByText('Ship').closest('[data-project-task]')).toHaveAttribute('data-status', 'done')
  expect(screen.getByText('Legal').closest('[data-project-task]')).toHaveAttribute('data-status', 'blocked')
})

it('adds a Todo task and immediately edits selected text', async () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
  const input = await screen.findByRole('textbox', { name: 'Task text' })
  expect(input).toHaveValue('New task')
  expect(document.activeElement).toBe(input)
  expect(input).toHaveProperty('selectionStart', 0)
  expect(input).toHaveProperty('selectionEnd', 8)
  fireEvent.change(input, { target: { value: 'Write copy' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByText('Write copy')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Todo 2' })).toBeInTheDocument()
})

it('edits by double click, cancels with Escape, saves on blur, and deletes', () => {
  render(<Harness />)
  fireEvent.doubleClick(screen.getByText('Draft'))
  const input = screen.getByRole('textbox', { name: 'Task text' })
  fireEvent.change(input, { target: { value: 'Changed' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(screen.getByText('Draft')).toBeInTheDocument()
  fireEvent.doubleClick(screen.getByText('Draft'))
  fireEvent.change(screen.getByRole('textbox', { name: 'Task text' }), { target: { value: 'Final' } })
  fireEvent.blur(screen.getByRole('textbox', { name: 'Task text' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete task: Final' }))
  expect(screen.queryByText('Final')).not.toBeInTheDocument()
})

it('edits the project title with save, fallback, and cancel semantics', () => {
  render(<Harness />)
  fireEvent.doubleClick(screen.getByText('Website launch'))
  fireEvent.change(screen.getByRole('textbox', { name: 'Project title' }), { target: { value: 'Release' } })
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Project title' }), { key: 'Enter' })
  expect(screen.getByText('Release')).toBeInTheDocument()
  fireEvent.doubleClick(screen.getByText('Release'))
  fireEvent.change(screen.getByRole('textbox', { name: 'Project title' }), { target: { value: '   ' } })
  fireEvent.blur(screen.getByRole('textbox', { name: 'Project title' }))
  expect(screen.getByText('Untitled Project')).toBeInTheDocument()
  fireEvent.doubleClick(screen.getByText('Untitled Project'))
  fireEvent.change(screen.getByRole('textbox', { name: 'Project title' }), { target: { value: 'Cancelled' } })
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Project title' }), { key: 'Escape' })
  expect(screen.getByText('Untitled Project')).toBeInTheDocument()
})

it('keeps each task column vertically scrollable without horizontal board scrolling', () => {
  const styles = readFileSync('src/styles.css', 'utf8')
  expect(styles).toMatch(/\.hermes-project-board\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s)
  expect(styles).toMatch(/\.hermes-project-column-body\s*\{[^}]*overflow-y:\s*auto;/s)
  expect(styles).not.toMatch(/\.hermes-project-board\s*\{[^}]*overflow-x:\s*auto;/s)
})
```

Add these pointer assertions. Give each column `data-testid="project-column-${status}"`, `data-project-column-body`, and `data-status`; give each task `data-project-task` and `data-task-id`.

```tsx
it('moves a task by pointer and cancels outside or on Escape', () => {
  const rect = (left: number, right: number, top: number, bottom: number) => ({
    left, right, top, bottom, width: right - left, height: bottom - top,
    x: left, y: top, toJSON: () => ({})
  }) as DOMRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.getAttribute('data-task-id') === 'task_todo') return rect(10, 190, 60, 100)
    if (this.getAttribute('data-status') === 'todo') return rect(0, 200, 40, 300)
    if (this.getAttribute('data-status') === 'doing') return rect(210, 410, 40, 300)
    if (this.hasAttribute('data-project-column-body')) return rect(420, 620, 40, 300)
    return rect(0, 0, 0, 0)
  })
  render(<Harness />)
  const task = screen.getByText('Draft').closest('[data-project-task]') as HTMLElement
  fireEvent.pointerDown(task, { pointerId: 1, button: 0, clientX: 50, clientY: 80 })
  fireEvent.pointerMove(task, { pointerId: 1, clientX: 300, clientY: 100 })
  expect(screen.getByRole('status', { name: 'Draft task' })).toBeInTheDocument()
  fireEvent.pointerUp(task, { pointerId: 1, clientX: 300, clientY: 100 })
  expect(within(screen.getByTestId('project-column-doing')).getByText('Draft')).toBeInTheDocument()

  const moved = screen.getByText('Draft').closest('[data-project-task]') as HTMLElement
  fireEvent.pointerDown(moved, { pointerId: 2, button: 0, clientX: 300, clientY: 100 })
  fireEvent.pointerMove(moved, { pointerId: 2, clientX: 700, clientY: 100 })
  fireEvent.pointerUp(moved, { pointerId: 2, clientX: 700, clientY: 100 })
  expect(within(screen.getByTestId('project-column-doing')).getByText('Draft')).toBeInTheDocument()

  fireEvent.pointerDown(moved, { pointerId: 3, button: 0, clientX: 300, clientY: 100 })
  fireEvent.pointerMove(moved, { pointerId: 3, clientX: 100, clientY: 100 })
  fireEvent.keyDown(screen.getByTestId('project-board'), { key: 'Escape' })
  fireEvent.pointerUp(moved, { pointerId: 3, clientX: 100, clientY: 100 })
  expect(within(screen.getByTestId('project-column-doing')).getByText('Draft')).toBeInTheDocument()
})
```

Use an accessible preview role/name such as `<div role="status" aria-label={`${text} task`}>` so the `Draft task` assertion is deterministic.

- [ ] **Step 4: Implement `ProjectCardBoard` editing and creation**

Use local `editingTitle`, `editingTaskId`, `draft`, and `newTaskId` state. Render columns by filtering `tasks` through `PROJECT_TASK_STATUSES`; label them with:

```ts
const STATUS_LABEL = { todo: 'Todo', doing: 'Doing', done: 'Done', blocked: 'Blocked' } as const
```

Implement the exact commits:

```ts
const commitTitle = () => {
  onTitleChange(draft.trim() || 'Untitled Project')
  setEditingTitle(false)
}

const commitTask = (taskId: string) => {
  onTasksChange(updateProjectTaskText(tasks, taskId, draft.trim() || 'New task'))
  setEditingTaskId(null)
  setNewTaskId(null)
}

const addTask = (event: React.MouseEvent<HTMLButtonElement>) => {
  onInteraction(event)
  const id = nextProjectTaskId(tasks)
  onTasksChange(appendProjectTask(tasks, { id, text: 'New task', status: 'todo' }))
  setDraft('New task')
  setNewTaskId(id)
  setEditingTaskId(id)
}
```

Use an effect keyed by `editingTaskId` to call `scrollIntoView({ block: 'nearest' })`, focus, and select the matching input. Enter calls the commit helper, Escape restores the label without mutation (leaving a new task as `New task`), and blur commits. Task delete buttons call `removeProjectTask`. Double-click handlers call `onInteraction`, set the relevant draft, and open only that input.

- [ ] **Step 5: Implement pointer drag state and preview**

Use a ref containing `{ pointerId, taskId, startX, startY, active }`, component state containing `{ taskId, x, y, drop }`, and a board ref. Build drop zones from `[data-project-column-body]` and child `[data-project-task]` rectangles. Activate only after `Math.hypot(dx, dy) >= 5`. On a valid pointer-up call:

```ts
onTasksChange(moveProjectTask(tasks, drag.taskId, drag.drop.status, drag.drop.beforeTaskId))
```

Render the preview through `createPortal` into `document.body`:

```tsx
{drag && createPortal(
  <div className="hermes-project-drag-preview" style={{ left: drag.x + 12, top: drag.y + 12 }}>
    {tasks.find((task) => task.id === drag.taskId)?.text}
  </div>,
  document.body
)}
```

Set `data-drop-active` on the destination column and render `.hermes-project-drop-marker` immediately before the matching `beforeTaskId`, or after the last row when it is `null`. Pointer-up outside the board, Escape, and `lostpointercapture` clear drag state without calling `onTasksChange`.

- [ ] **Step 6: Reduce `ProjectCardShapeUtil` to a tested adapter**

The component method must render `ProjectCardBoard` inside `HTMLContainer` and write only title/tasks:

```tsx
<ProjectCardBoard
  title={shape.props.title}
  tasks={shape.props.tasks}
  onTitleChange={(title) => editor.updateShape({
    id: shape.id, type: PROJECT_CARD_TYPE, props: { title }
  })}
  onTasksChange={(tasks) => editor.updateShape({
    id: shape.id, type: PROJECT_CARD_TYPE, props: { tasks }
  })}
  onInteraction={(event) => editor.markEventAsHandled(event)}
/>
```

Update `projectCardUtils.test.tsx` to expect `960x480`, minimum `760x320`, no lifecycle fields, and adapter calls containing `{ title }` or `{ tasks }`. Retain theme color, geometry, and independent resize assertions.

- [ ] **Step 7: Replace Project CSS with board-specific rules**

Remove selectors for status badges, priority, due date, progress, legacy action rows, and focused card edit mode. Add concrete rules for:

```css
.hermes-project-card { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; }
.hermes-project-board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; min-height: 0; }
.hermes-project-column { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; border-radius: 12px; background: rgb(255 255 255 / 58%); }
.hermes-project-column[data-drop-active="true"] { outline: 2px solid var(--hermes-card-accent); outline-offset: -2px; }
.hermes-project-column-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px; }
.hermes-project-task { position: relative; margin-bottom: 8px; border-radius: 10px; padding: 9px 28px 9px 10px; cursor: grab; background: rgb(255 255 255 / 88%); }
.hermes-project-task[data-status="done"] { opacity: .62; }
.hermes-project-task[data-status="blocked"] { border-left: 3px solid #ef4444; }
.hermes-project-task:active { cursor: grabbing; }
.hermes-project-task-delete { position: absolute; top: 5px; right: 5px; }
.hermes-project-drop-marker { height: 3px; margin: 3px 0 5px; border-radius: 999px; background: var(--hermes-card-accent); }
.hermes-project-drag-preview { position: fixed; z-index: 10000; max-width: 220px; pointer-events: none; border-radius: 10px; padding: 9px 12px; box-shadow: 0 12px 28px rgb(15 23 42 / 24%); background: white; }
.hermes-project-footer { display: flex; justify-content: center; padding-top: 10px; }
```

Add input/button `:focus-visible` styles consistent with existing Hermes controls.

- [ ] **Step 8: Run component tests and type checking**

Run: `npm test -- src/canvas/tldraw/projectCardDrag.test.ts src/canvas/tldraw/ProjectCardBoard.test.tsx src/canvas/tldraw/projectCardUtils.test.tsx src/canvas/tldraw/customShapeUtils.test.tsx && npm run lint:types`

Expected: all four test files PASS and TypeScript exits 0.

- [ ] **Step 9: Commit the board UI**

```bash
git add src/canvas/tldraw/projectCardDrag.ts src/canvas/tldraw/projectCardDrag.test.ts src/canvas/tldraw/ProjectCardBoard.tsx src/canvas/tldraw/ProjectCardBoard.test.tsx src/canvas/tldraw/projectCardUtils.tsx src/canvas/tldraw/projectCardUtils.test.tsx src/styles.css
git commit -m "feat: render draggable project task boards"
```

---

### Task 5: Update Canvas Integration and Published Workflows

**Files:**
- Modify: `src/canvas/components/CanvasInsertMenu.tsx`
- Test: `src/canvas/components/CanvasSurface.test.tsx`
- Test: `src/canvas/tldraw/tidyCardLayout.test.ts`
- Modify: `CANVAS_API.md`
- Modify: `README.md`
- Modify: `docs/PRD.md`
- Modify: `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`

**Interfaces:**
- Consumes: new defaults and six public actions.
- Produces: correctly centered insertion, wider tidy spacing, and no published legacy lifecycle guidance.

- [ ] **Step 1: Update insertion and tidy tests first**

In `CanvasSurface.test.tsx`, assert Project insertion creates and selects a shape with:

```ts
expect(tldrawMock.shapes[0]).toMatchObject({
  type: 'project_card',
  x: 120,
  y: 160,
  props: { title: 'New Project', tasks: [], w: 960, h: 480, color: 'light-violet' }
})
```

The viewport is `1200x800`, so centering `960x480` yields `(120, 160)`. In `tidyCardLayout.test.ts`, change the Project test shape to `{ w: 960, h: 480 }` and expect later columns at x positions `1116`, `1532`, and `1908` while retaining the original y ordering.

- [ ] **Step 2: Run integration tests and verify failure**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/tidyCardLayout.test.ts`

Expected: FAIL because insertion still centers `360x320` and still sends legacy fields.

- [ ] **Step 3: Update Project insertion**

In `CanvasInsertMenu.tsx`, use `{ width: 960, height: 480 }` for Project centering and return:

```ts
{
  type: 'create_project_card',
  id,
  title: 'New Project',
  tasks: [],
  x,
  y
}
```

No production tidy-layout change is necessary because it already reads the Project shape's stored width; only its regression expectation changes.

- [ ] **Step 4: Rewrite public Project examples**

Document exactly these payloads in `CANVAS_API.md`, `README.md`, and the Canvas Dashboard skill:

```json
{"type":"create_project_card","id":"shape:website","title":"Website Launch","x":100,"y":120,"tasks":[{"id":"task_copy","text":"Finish copy"},{"id":"task_review","text":"Review","status":"doing"}]}
{"type":"update_project_card","shapeId":"shape:website","title":"Website Release"}
{"type":"append_project_task","shapeId":"shape:website","taskId":"task_ship","text":"Ship"}
{"type":"update_project_task_text","shapeId":"shape:website","taskId":"task_ship","text":"Publish release"}
{"type":"move_project_task","shapeId":"shape:website","taskId":"task_ship","status":"done","beforeTaskId":null}
{"type":"remove_project_task","shapeId":"shape:website","taskId":"task_ship"}
```

State the status order, default Todo behavior, stable ID rule, `beforeTaskId` semantics, and browser/headless parity. Remove project status, priority, due-date, progress, action-completion, and checklist examples. Update PRD goals, capability note, requirements, acceptance criteria, and insert-menu dimensions to describe the four-column board.

- [ ] **Step 5: Run integration tests and scan for stale contract terms**

Run:

```bash
npm test -- src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/tidyCardLayout.test.ts
rg -n "append_project_action|update_project_action_text|set_project_action_done|remove_project_action|Project status|Project priority|Project due|project progress" CANVAS_API.md README.md docs/PRD.md plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md src
```

Expected: both test files PASS and `rg` returns no legacy Project contract references. Todo task completion references may remain.

- [ ] **Step 6: Commit integration and documentation**

```bash
git add src/canvas/components/CanvasInsertMenu.tsx src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/tidyCardLayout.test.ts CANVAS_API.md README.md docs/PRD.md plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md
git commit -m "docs: publish project task-board workflows"
```

---

### Task 6: Full Verification and Handoff

**Files:**
- Verify all modified files.
- Modify only files implicated by a failing check.

**Interfaces:**
- Confirms the revised schema, UI, browser/headless routes, persistence, regressions, and docs are coherent.

- [ ] **Step 1: Run the focused feature suite**

```bash
npm test -- src/canvas/tldraw/projectCard.types.test.ts src/canvas/actions/canvasAction.schema.test.ts src/canvas/tldraw/tldrawSchema.test.ts src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/bridge/CanvasBridge.test.ts server/canvas/tldrawHeadlessExecutor.test.ts src/canvas/tldraw/projectCardDrag.test.ts src/canvas/tldraw/ProjectCardBoard.test.tsx src/canvas/tldraw/projectCardUtils.test.tsx src/canvas/tldraw/customShapeUtils.test.tsx src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/tidyCardLayout.test.ts
```

Expected: all named files PASS with zero failed tests.

- [ ] **Step 2: Run type checking**

Run: `npm run lint:types`

Expected: exit 0 with no TypeScript diagnostics.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test`

Expected: every test file passes. Run outside the filesystem sandbox if the gateway integration test cannot bind its localhost socket.

- [ ] **Step 4: Build the production application**

Run: `npm run build`

Expected: TypeScript and Vite exit 0. The existing Vite large-chunk advisory is non-blocking.

- [ ] **Step 5: Inspect repository quality and commit any verification fix**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and no uncommitted files after any necessary focused fix commit.

- [ ] **Step 6: Finish the branch workflow**

Invoke `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Report exact test counts and build status before offering repository handoff choices.
