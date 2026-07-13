# Project Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one self-contained, persistent Project card per project with fixed status and priority values, an optional due date, derived action progress, a scrollable action list, direct editing, and equivalent Hermes browser/headless actions.

**Architecture:** A focused Project domain module owns props, migrations, normalization, date rules, dimensions, IDs, and progress. A dedicated tldraw `ShapeUtil` renders and edits the shape, while the existing Zod action union and shared executor provide one mutation contract for both the mounted browser bridge and headless sync-room execution.

**Tech Stack:** TypeScript, React 19, tldraw 5.2, Zod 3, Vitest, Testing Library, Vite, tldraw sync, SQLite-backed sync rooms, plain CSS.

## Global Constraints

- Use the internal shape identifier `project_card`, following `todo_block` and `link_card` naming.
- Status values are exactly `planned`, `active`, `blocked`, and `done`.
- Priority values are exactly `low`, `medium`, and `high`.
- Defaults are Planned, Medium, no due date, no actions, `360x320`, minimum `320x240`, and tldraw color `light-violet`.
- Store due dates only as real calendar dates in exact `YYYY-MM-DD` form; compare overdue state against the user's local calendar date and do not treat today as overdue.
- Derive progress as completed actions divided by total actions; an empty list is 0% and `0/0`.
- Keep status explicit: completing all actions must not automatically change status to Done.
- Permit any number of actions, preserve insertion order, keep the card size stable, and scroll the action viewport.
- Browser and headless routes must return equivalent per-action results, errors, persistence, and observations.
- Do not add linked Todo Blocks, reordering, dependencies, owners, tags, milestones, attachments, recurrence, kanban views, notifications, portfolio containers, or automatic status transitions.
- Add no runtime dependency.

---

## File Structure

- Create `src/canvas/tldraw/projectCard.types.ts`: Project constants, types, migrations, normalization, dimension, progress, date, and ID helpers.
- Create `src/canvas/tldraw/projectCard.types.test.ts`: focused domain and migration-helper tests.
- Create `src/canvas/tldraw/projectCardUtils.tsx`: Project `ShapeUtil`, normal mode, focused edit mode, and direct editor mutations.
- Create `src/canvas/tldraw/projectCardUtils.test.tsx`: renderer, interaction, resize, accessibility, and overdue tests.
- Modify `src/canvas/tldraw/tldrawSchema.ts`: register `project_card` in the shared browser/server schema.
- Modify `src/canvas/tldraw/tldrawSchema.test.ts`: prove shared schema registration.
- Modify `src/canvas/actions/canvasAction.types.ts`: add six typed Project operations.
- Modify `src/canvas/actions/canvasAction.schema.ts`: validate and normalize Project actions.
- Modify `src/canvas/actions/canvasAction.schema.test.ts`: cover accepted payloads and each domain validation failure.
- Modify `src/canvas/tldraw/tldrawActionExecutor.ts`: create and mutate Project records for both execution routes.
- Modify `src/canvas/tldraw/tldrawActionExecutor.test.ts`: cover lifecycle, observations, and action-level failures.
- Modify `src/canvas/bridge/CanvasBridge.test.ts`: prove validated sequential Project batches keep per-action result context.
- Modify `server/canvas/tldrawHeadlessExecutor.test.ts`: prove Project records persist and reload in a sync room.
- Modify `src/canvas/tldraw/customShapeUtils.tsx`: add `ProjectCardShapeUtil` to the central custom-shape list.
- Modify `src/canvas/tldraw/customShapeUtils.test.tsx`: update the supported shape registration assertion.
- Modify `src/canvas/components/CanvasSurface.test.tsx`: update registered utility count and integration assertions.
- Modify `src/styles.css`: add Project layout, statuses, priorities, progress, scrolling, edit controls, and focus styles.
- Modify `src/canvas/components/CanvasInsertMenu.tsx`: add Project creation and icon.
- Modify `src/canvas/tldraw/tidyCardLayout.ts`: include a Project column.
- Modify `src/canvas/tldraw/tidyCardLayout.test.ts`: cover Project placement and dimensions.
- Modify `CANVAS_API.md`: document all Project actions and observation behavior.
- Modify `README.md`: add a concise Project lifecycle example.
- Modify `docs/PRD.md`: mark the Project component shipped and add its product requirements.
- Modify `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`: teach Hermes when and how to operate Project cards.

---

### Task 1: Add the Project Domain Model and Shared tldraw Schema

**Files:**
- Create: `src/canvas/tldraw/projectCard.types.ts`
- Create: `src/canvas/tldraw/projectCard.types.test.ts`
- Modify: `src/canvas/tldraw/tldrawSchema.ts`
- Modify: `src/canvas/tldraw/tldrawSchema.test.ts`

**Interfaces:**
- Consumes: tldraw shape migration helpers from `@tldraw/tlschema`.
- Produces: `PROJECT_CARD_TYPE`, `ProjectStatus`, `ProjectPriority`, `ProjectAction`, `ProjectActionInput`, `ProjectCardProps`, `projectCardMigrations`, `projectCardProps`, `createProjectCardProps()`, `nextProjectActionId()`, `getProjectProgress()`, `isValidProjectDueDate()`, `localProjectDate()`, and `isProjectOverdue()`.

- [ ] **Step 1: Write the failing domain tests**

Create `src/canvas/tldraw/projectCard.types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createProjectCardProps,
  getProjectProgress,
  isProjectOverdue,
  isValidProjectDueDate,
  nextProjectActionId
} from './projectCard.types'

describe('project card domain', () => {
  it('creates trimmed defaults and reserves explicit action ids before generation', () => {
    expect(
      createProjectCardProps({
        title: '  Website launch  ',
        actions: [
          { text: '  Draft copy  ' },
          { id: 'action_0001', text: 'Approve design', done: true },
          { text: 'Publish' }
        ]
      })
    ).toEqual({
      w: 360,
      h: 320,
      title: 'Website launch',
      status: 'planned',
      priority: 'medium',
      actions: [
        { id: 'action_0002', text: 'Draft copy', done: false },
        { id: 'action_0001', text: 'Approve design', done: true },
        { id: 'action_0003', text: 'Publish', done: false }
      ],
      color: 'light-violet'
    })
  })

  it('fits dimensions independently to the project minimums', () => {
    expect(createProjectCardProps({ title: 'Small', w: 120, h: 100 })).toMatchObject({
      w: 320,
      h: 240
    })
    expect(createProjectCardProps({ title: 'Wide', w: 640, h: 260 })).toMatchObject({
      w: 640,
      h: 260
    })
  })

  it('rejects blank text and duplicate explicit ids', () => {
    expect(() => createProjectCardProps({ title: '   ' })).toThrow('Project title must not be empty')
    expect(() =>
      createProjectCardProps({
        title: 'Launch',
        actions: [
          { id: 'action_ship', text: 'Ship' },
          { id: 'action_ship', text: 'Announce' }
        ]
      })
    ).toThrow('Duplicate project action action_ship')
  })

  it('derives empty, partial, and complete progress', () => {
    expect(getProjectProgress([])).toEqual({ completed: 0, total: 0, percent: 0 })
    expect(
      getProjectProgress([
        { id: 'a', text: 'A', done: true },
        { id: 'b', text: 'B', done: false },
        { id: 'c', text: 'C', done: true }
      ])
    ).toEqual({ completed: 2, total: 3, percent: 67 })
  })

  it('validates real ISO dates and applies explicit overdue rules', () => {
    expect(isValidProjectDueDate('2026-07-13')).toBe(true)
    expect(isValidProjectDueDate('2026-02-30')).toBe(false)
    expect(isValidProjectDueDate('13-07-2026')).toBe(false)
    expect(isProjectOverdue('2026-07-12', 'active', '2026-07-13')).toBe(true)
    expect(isProjectOverdue('2026-07-13', 'active', '2026-07-13')).toBe(false)
    expect(isProjectOverdue('2026-07-12', 'done', '2026-07-13')).toBe(false)
  })

  it('finds the next unused local action id', () => {
    expect(nextProjectActionId([
      { id: 'action_0001', text: 'A', done: false },
      { id: 'action_0003', text: 'C', done: false }
    ])).toBe('action_0002')
  })
})
```

Extend `src/canvas/tldraw/tldrawSchema.test.ts` with:

```ts
expect(JSON.stringify(schema)).toContain('project_card')
```

- [ ] **Step 2: Run the tests and verify the red state**

Run: `npm test -- src/canvas/tldraw/projectCard.types.test.ts src/canvas/tldraw/tldrawSchema.test.ts`

Expected: FAIL because the Project domain module and shared schema entry do not exist.

- [ ] **Step 3: Implement the Project domain module**

Create `src/canvas/tldraw/projectCard.types.ts`:

```ts
import {
  DefaultColorStyle,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence
} from '@tldraw/tlschema'
import { T } from '@tldraw/validate'

export const PROJECT_CARD_TYPE = 'project_card'
export const PROJECT_CARD_DEFAULT_WIDTH = 360
export const PROJECT_CARD_DEFAULT_HEIGHT = 320
export const PROJECT_CARD_MIN_WIDTH = 320
export const PROJECT_CARD_MIN_HEIGHT = 240
export const DEFAULT_PROJECT_CARD_COLOR = 'light-violet'

export const PROJECT_STATUSES = ['planned', 'active', 'blocked', 'done'] as const
export const PROJECT_PRIORITIES = ['low', 'medium', 'high'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number]

export type ProjectAction = { id: string; text: string; done: boolean }
export type ProjectActionInput = { id?: string; text: string; done?: boolean }
export type ProjectCardProps = {
  w: number
  h: number
  title: string
  status: ProjectStatus
  priority: ProjectPriority
  dueDate?: string
  actions: ProjectAction[]
  color: string
}

const projectCardVersions = createShapePropsMigrationIds(PROJECT_CARD_TYPE, {
  AddProjectFields: 1
})

export const projectCardMigrations = createShapePropsMigrationSequence({
  sequence: [{
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
  }]
})

const projectActionValidator = T.object({ id: T.string, text: T.string, done: T.boolean })
export const projectCardProps = {
  w: T.number,
  h: T.number,
  title: T.string,
  status: T.literalEnum(...PROJECT_STATUSES),
  priority: T.literalEnum(...PROJECT_PRIORITIES),
  dueDate: T.string.optional(),
  actions: T.arrayOf(projectActionValidator),
  color: DefaultColorStyle
}

function nonBlank(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} must not be empty`)
  return trimmed
}

export function nextProjectActionId(actions: Pick<ProjectAction, 'id'>[]) {
  const used = new Set(actions.map((action) => action.id))
  for (let index = 1; ; index += 1) {
    const id = `action_${String(index).padStart(4, '0')}`
    if (!used.has(id)) return id
  }
}

export function normalizeProjectActions(inputs: ProjectActionInput[] = []): ProjectAction[] {
  const supplied = inputs.flatMap((action) => action.id ? [action.id] : [])
  if (new Set(supplied).size !== supplied.length) {
    const duplicate = supplied.find((id, index) => supplied.indexOf(id) !== index)
    throw new Error(`Duplicate project action ${duplicate}`)
  }

  const used = new Set(supplied)
  return inputs.map((input) => {
    let id = input.id
    if (!id) {
      id = nextProjectActionId([...used].map((usedId) => ({ id: usedId })))
      used.add(id)
    }
    return { id, text: nonBlank(input.text, 'Project action text'), done: input.done ?? false }
  })
}

export function fitProjectCardDimensions(w?: number, h?: number) {
  const validW = typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : PROJECT_CARD_DEFAULT_WIDTH
  const validH = typeof h === 'number' && Number.isFinite(h) && h > 0 ? h : PROJECT_CARD_DEFAULT_HEIGHT
  return { w: Math.max(PROJECT_CARD_MIN_WIDTH, validW), h: Math.max(PROJECT_CARD_MIN_HEIGHT, validH) }
}

export function isValidProjectDueDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function localProjectDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isProjectOverdue(dueDate: string | undefined, status: ProjectStatus, today = localProjectDate()) {
  return Boolean(dueDate && isValidProjectDueDate(dueDate) && status !== 'done' && dueDate < today)
}

export function getProjectProgress(actions: ProjectAction[]) {
  const completed = actions.filter((action) => action.done).length
  const total = actions.length
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) }
}

export function createProjectCardProps(input: {
  title: string
  status?: ProjectStatus
  priority?: ProjectPriority
  dueDate?: string
  actions?: ProjectActionInput[]
  w?: number
  h?: number
  color?: string
}): ProjectCardProps {
  if (input.dueDate !== undefined && !isValidProjectDueDate(input.dueDate)) {
    throw new Error('Project due date must be a real YYYY-MM-DD date')
  }
  return {
    ...fitProjectCardDimensions(input.w, input.h),
    title: nonBlank(input.title, 'Project title'),
    status: input.status ?? 'planned',
    priority: input.priority ?? 'medium',
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    actions: normalizeProjectActions(input.actions),
    color: input.color ?? DEFAULT_PROJECT_CARD_COLOR
  }
}
```

- [ ] **Step 4: Register the shape in the shared schema**

In `src/canvas/tldraw/tldrawSchema.ts`, import `projectCardMigrations` and `projectCardProps`, then add this entry beside the existing custom shapes:

```ts
project_card: {
  migrations: projectCardMigrations,
  props: projectCardProps
}
```

- [ ] **Step 5: Run the domain and schema tests**

Run: `npm test -- src/canvas/tldraw/projectCard.types.test.ts src/canvas/tldraw/tldrawSchema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the domain slice**

```bash
git add src/canvas/tldraw/projectCard.types.ts src/canvas/tldraw/projectCard.types.test.ts src/canvas/tldraw/tldrawSchema.ts src/canvas/tldraw/tldrawSchema.test.ts
git commit -m "feat: add project card domain model"
```

---

### Task 2: Add the Typed Project Action Contract

**Files:**
- Modify: `src/canvas/actions/canvasAction.types.ts`
- Modify: `src/canvas/actions/canvasAction.schema.ts`
- Test: `src/canvas/actions/canvasAction.schema.test.ts`

**Interfaces:**
- Consumes: `ProjectActionInput`, `ProjectPriority`, and `ProjectStatus` from Task 1.
- Produces: six `CanvasAction` variants whose parsed strings are trimmed and whose dates, enums, IDs, dimensions, and non-empty update payloads are validated before execution.

- [ ] **Step 1: Write failing schema tests**

Add to `src/canvas/actions/canvasAction.schema.test.ts`:

```ts
it('accepts and trims the complete project action contract', () => {
  const actions = [
    {
      type: 'create_project_card', id: 'shape:project_1', x: 40, y: 80,
      title: '  Website launch  ', status: 'active', priority: 'high', dueDate: '2026-07-31',
      actions: [{ id: 'action_copy', text: '  Finish copy  ' }], w: 420, h: 340,
      color: 'light-violet'
    },
    { type: 'update_project_card', shapeId: 'shape:project_1', status: 'blocked', dueDate: null },
    { type: 'append_project_action', shapeId: 'shape:project_1', actionId: 'action_ship', text: '  Ship  ' },
    { type: 'update_project_action_text', shapeId: 'shape:project_1', actionId: 'action_ship', text: '  Publish  ' },
    { type: 'set_project_action_done', shapeId: 'shape:project_1', actionId: 'action_copy', done: true },
    { type: 'remove_project_action', shapeId: 'shape:project_1', actionId: 'action_ship' }
  ]

  expect(canvasActionBatchSchema.parse(actions)).toMatchObject([
    { type: 'create_project_card', title: 'Website launch', actions: [{ text: 'Finish copy' }] },
    { type: 'update_project_card', dueDate: null },
    { type: 'append_project_action', text: 'Ship' },
    { type: 'update_project_action_text', text: 'Publish' },
    { type: 'set_project_action_done', done: true },
    { type: 'remove_project_action' }
  ])
})

it('rejects invalid project fields and empty metadata updates', () => {
  const invalid = [
    { type: 'create_project_card', x: 0, y: 0, title: '   ' },
    { type: 'create_project_card', x: 0, y: 0, title: 'Project', status: 'paused' },
    { type: 'create_project_card', x: 0, y: 0, title: 'Project', priority: 'urgent' },
    { type: 'create_project_card', x: 0, y: 0, title: 'Project', dueDate: '2026-02-30' },
    { type: 'create_project_card', x: 0, y: 0, title: 'Project', actions: [
      { id: 'same', text: 'A' }, { id: 'same', text: 'B' }
    ] },
    { type: 'update_project_card', shapeId: 'shape:project_1' },
    { type: 'append_project_action', shapeId: 'shape:project_1', actionId: '', text: 'Ship' },
    { type: 'update_project_action_text', shapeId: 'shape:project_1', actionId: 'a', text: '   ' }
  ]
  for (const action of invalid) expect(() => canvasActionSchema.parse(action)).toThrow()
})
```

- [ ] **Step 2: Run schema tests and verify failure**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts`

Expected: FAIL because the union rejects every Project action.

- [ ] **Step 3: Add the TypeScript action types**

In `src/canvas/actions/canvasAction.types.ts`, import the Project types and add:

```ts
export type CreateProjectCardAction = {
  type: 'create_project_card'; id?: string; x: number; y: number; title: string
  status?: ProjectStatus; priority?: ProjectPriority; dueDate?: string
  actions?: ProjectActionInput[]; w?: number; h?: number; color?: string
}
export type UpdateProjectCardAction = {
  type: 'update_project_card'; shapeId: string; title?: string; status?: ProjectStatus
  priority?: ProjectPriority; dueDate?: string | null
}
export type AppendProjectAction = {
  type: 'append_project_action'; shapeId: string; actionId: string; text: string; done?: boolean
}
export type UpdateProjectActionTextAction = {
  type: 'update_project_action_text'; shapeId: string; actionId: string; text: string
}
export type SetProjectActionDoneAction = {
  type: 'set_project_action_done'; shapeId: string; actionId: string; done: boolean
}
export type RemoveProjectActionAction = {
  type: 'remove_project_action'; shapeId: string; actionId: string
}
```

Add all six names to the `CanvasAction` union.

- [ ] **Step 4: Add Zod Project schemas**

In `src/canvas/actions/canvasAction.schema.ts`, import `isValidProjectDueDate` and add these constants:

```ts
const nonBlank = z.string().trim().min(1)
const projectStatus = z.enum(['planned', 'active', 'blocked', 'done'])
const projectPriority = z.enum(['low', 'medium', 'high'])
const projectDueDate = z.string().refine(isValidProjectDueDate, 'dueDate must be a real YYYY-MM-DD date')
const projectActionInput = z.object({
  id: nonBlank.optional(),
  text: nonBlank,
  done: z.boolean().optional()
})
const projectActionInputs = z.array(projectActionInput).superRefine((actions, context) => {
  const seen = new Set<string>()
  actions.forEach((action, index) => {
    if (!action.id) return
    if (seen.has(action.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'id'], message: `duplicate action id ${action.id}` })
    }
    seen.add(action.id)
  })
})
```

Add these six members to `canvasActionSchema`:

```ts
z.object({
  type: z.literal('create_project_card'), id: nonBlank.optional(), title: nonBlank,
  status: projectStatus.optional(), priority: projectPriority.optional(), dueDate: projectDueDate.optional(),
  actions: projectActionInputs.optional(), w: z.number().finite().positive().optional(),
  h: z.number().finite().positive().optional(), color: tldrawDefaultColor.optional(), ...position
}),
z.object({
  type: z.literal('update_project_card'), shapeId, title: nonBlank.optional(),
  status: projectStatus.optional(), priority: projectPriority.optional(),
  dueDate: projectDueDate.nullable().optional()
}).refine((value) => value.title !== undefined || value.status !== undefined ||
  value.priority !== undefined || value.dueDate !== undefined, {
  message: 'update_project_card requires at least one field'
}),
z.object({
  type: z.literal('append_project_action'), shapeId, actionId: nonBlank,
  text: nonBlank, done: z.boolean().optional()
}),
z.object({
  type: z.literal('update_project_action_text'), shapeId, actionId: nonBlank, text: nonBlank
}),
z.object({
  type: z.literal('set_project_action_done'), shapeId, actionId: nonBlank, done: z.boolean()
}),
z.object({
  type: z.literal('remove_project_action'), shapeId, actionId: nonBlank
})
```

- [ ] **Step 5: Run schema tests**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the action contract**

```bash
git add src/canvas/actions/canvasAction.types.ts src/canvas/actions/canvasAction.schema.ts src/canvas/actions/canvasAction.schema.test.ts
git commit -m "feat: add project card action contract"
```

---

### Task 3: Execute Project Actions in the Shared Browser/Memory Executor

**Files:**
- Modify: `src/canvas/tldraw/tldrawActionExecutor.ts`
- Test: `src/canvas/tldraw/tldrawActionExecutor.test.ts`
- Test: `src/canvas/bridge/CanvasBridge.test.ts`

**Interfaces:**
- Consumes: the Task 1 prop builder and Task 2 action variants.
- Produces: creation and metadata/action mutation results used unchanged by the browser bridge and headless room adapter.

- [ ] **Step 1: Write the failing executor lifecycle test**

Add to `src/canvas/tldraw/tldrawActionExecutor.test.ts`:

```ts
it('creates and mutates a project card while preserving explicit status', () => {
  const target = createMemoryTldrawTarget('canvas_001')
  const actions: CanvasAction[] = [
    { type: 'create_project_card', id: 'shape:project_1', x: 40, y: 80, title: 'Launch',
      status: 'active', priority: 'high', dueDate: '2026-07-31',
      actions: [{ id: 'action_copy', text: 'Write copy' }] },
    { type: 'append_project_action', shapeId: 'shape:project_1', actionId: 'action_ship', text: 'Ship' },
    { type: 'update_project_action_text', shapeId: 'shape:project_1', actionId: 'action_ship', text: 'Publish' },
    { type: 'set_project_action_done', shapeId: 'shape:project_1', actionId: 'action_copy', done: true },
    { type: 'update_project_card', shapeId: 'shape:project_1', priority: 'medium', dueDate: null },
    { type: 'remove_project_action', shapeId: 'shape:project_1', actionId: 'action_ship' }
  ]
  expect(actions.map((action) => executeTldrawAction(target, action))).toEqual([
    { actionType: 'create_project_card', createdShapeIds: ['shape:project_1'] },
    { actionType: 'append_project_action', updatedShapeIds: ['shape:project_1'] },
    { actionType: 'update_project_action_text', updatedShapeIds: ['shape:project_1'] },
    { actionType: 'set_project_action_done', updatedShapeIds: ['shape:project_1'] },
    { actionType: 'update_project_card', updatedShapeIds: ['shape:project_1'] },
    { actionType: 'remove_project_action', updatedShapeIds: ['shape:project_1'] }
  ])
  expect(readTldrawObservation(target).shapes[0]).toMatchObject({
    id: 'shape:project_1', type: 'project_card', x: 40, y: 80, w: 360, h: 320,
    props: {
      title: 'Launch', status: 'active', priority: 'medium',
      actions: [{ id: 'action_copy', text: 'Write copy', done: true }]
    }
  })
  expect(readTldrawObservation(target).shapes[0].props).not.toHaveProperty('dueDate')
})

it('returns stable project action-level errors without mutation', () => {
  const target = createMemoryTldrawTarget('canvas_001')
  executeTldrawAction(target, { type: 'create_project_card', id: 'shape:project_1', x: 0, y: 0,
    title: 'Launch', actions: [{ id: 'action_ship', text: 'Ship' }] })
  expect(executeTldrawAction(target, { type: 'append_project_action', shapeId: 'shape:project_1',
    actionId: 'action_ship', text: 'Duplicate' })).toEqual({
    actionType: 'append_project_action', error: 'Duplicate project action action_ship'
  })
  expect(executeTldrawAction(target, { type: 'set_project_action_done', shapeId: 'shape:project_1',
    actionId: 'missing', done: true })).toEqual({
    actionType: 'set_project_action_done', error: 'Unknown project action missing'
  })
  expect(executeTldrawAction(target, { type: 'update_project_card', shapeId: 'shape:missing',
    status: 'done' })).toEqual({
    actionType: 'update_project_card', error: 'Unknown project card shape:missing'
  })
})
```

Add this case to `CanvasBridge.test.ts`:

```ts
it('keeps project batch result context after an action-level failure', () => {
  const bridge = new CanvasBridge(createMemoryTldrawTarget('canvas_001'))
  const response = bridge.handleActionEnvelope({
    type: 'canvas.action', requestId: 'req_project', canvasId: 'canvas_001', actions: [
      { type: 'create_project_card', id: 'shape:project_1', x: 0, y: 0, title: 'Launch',
        actions: [{ id: 'action_ship', text: 'Ship' }] },
      { type: 'append_project_action', shapeId: 'shape:project_1', actionId: 'action_ship', text: 'Duplicate' },
      { type: 'set_project_action_done', shapeId: 'shape:project_1', actionId: 'action_ship', done: true }
    ]
  })
  if ('error' in response) throw new Error('expected action results')
  expect(response.result).toMatchObject({ ok: false, results: [
    { actionType: 'create_project_card', createdShapeIds: ['shape:project_1'] },
    { actionType: 'append_project_action', error: 'Duplicate project action action_ship' },
    { actionType: 'set_project_action_done', updatedShapeIds: ['shape:project_1'] }
  ] })
  expect(response.observation.state.shapes[0].props.actions).toEqual([
    { id: 'action_ship', text: 'Ship', done: true }
  ])
})
```

- [ ] **Step 2: Run executor and bridge tests and verify failure**

Run: `npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/bridge/CanvasBridge.test.ts`

Expected: FAIL because `executeTldrawAction` has no Project cases.

- [ ] **Step 3: Add Project creation and routing cases**

In `src/canvas/tldraw/tldrawActionExecutor.ts`, import Project types/helpers and add these switch cases:

```ts
case 'create_project_card':
  return createShape(target, {
    id: action.id ?? nextShapeId(target, PROJECT_CARD_TYPE), type: PROJECT_CARD_TYPE,
    x: action.x, y: action.y, props: createProjectCardProps(action),
    meta: { source: 'hermes' }, actionType: action.type
  })
case 'update_project_card':
  return updateProjectMetadata(target, action)
case 'append_project_action':
case 'update_project_action_text':
case 'set_project_action_done':
case 'remove_project_action':
  return mutateProjectActions(target, action)
```

- [ ] **Step 4: Implement Project mutation helpers**

Add to `src/canvas/tldraw/tldrawActionExecutor.ts`:

```ts
type ProjectMutation = Extract<CanvasAction, { type:
  | 'append_project_action' | 'update_project_action_text'
  | 'set_project_action_done' | 'remove_project_action' }>

function projectShape(target: TldrawExecutorTarget, shapeId: string) {
  const shape = target.shapes.get(shapeId)
  return shape?.type === PROJECT_CARD_TYPE ? shape : undefined
}

function updateProjectProps(target: TldrawExecutorTarget, shape: ShapeRecord,
  props: Record<string, unknown>, actionType: CanvasAction['type']): TldrawActionResult {
  const next = { ...shape, props }
  target.shapes.set(shape.id, next)
  target.editor?.updateShape({ id: shape.id as any, type: PROJECT_CARD_TYPE, props: next.props as any })
  return { actionType, updatedShapeIds: [shape.id] }
}

function updateProjectMetadata(target: TldrawExecutorTarget,
  action: Extract<CanvasAction, { type: 'update_project_card' }>): TldrawActionResult {
  const shape = projectShape(target, action.shapeId)
  if (!shape) return { actionType: action.type, error: `Unknown project card ${action.shapeId}` }
  const props = { ...shape.props }
  if (action.title !== undefined) props.title = action.title
  if (action.status !== undefined) props.status = action.status
  if (action.priority !== undefined) props.priority = action.priority
  if (action.dueDate === null) delete props.dueDate
  else if (action.dueDate !== undefined) props.dueDate = action.dueDate
  return updateProjectProps(target, shape, props, action.type)
}

function mutateProjectActions(target: TldrawExecutorTarget, action: ProjectMutation): TldrawActionResult {
  const shape = projectShape(target, action.shapeId)
  if (!shape) return { actionType: action.type, error: `Unknown project card ${action.shapeId}` }
  const actions = Array.isArray(shape.props.actions) ? shape.props.actions as ProjectAction[] : []

  if (action.type === 'append_project_action') {
    if (actions.some((item) => item.id === action.actionId)) {
      return { actionType: action.type, error: `Duplicate project action ${action.actionId}` }
    }
    return updateProjectProps(target, shape, { ...shape.props, actions: [
      ...actions, { id: action.actionId, text: action.text, done: action.done ?? false }
    ] }, action.type)
  }

  if (!actions.some((item) => item.id === action.actionId)) {
    return { actionType: action.type, error: `Unknown project action ${action.actionId}` }
  }
  const nextActions = action.type === 'remove_project_action'
    ? actions.filter((item) => item.id !== action.actionId)
    : actions.map((item) => item.id !== action.actionId ? item
      : action.type === 'update_project_action_text' ? { ...item, text: action.text }
      : { ...item, done: action.done })
  return updateProjectProps(target, shape, { ...shape.props, actions: nextActions }, action.type)
}
```

- [ ] **Step 5: Run executor and bridge tests**

Run: `npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/bridge/CanvasBridge.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the shared executor slice**

```bash
git add src/canvas/tldraw/tldrawActionExecutor.ts src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/bridge/CanvasBridge.test.ts
git commit -m "feat: execute project card actions"
```

---

### Task 4: Prove Headless Sync-Room Persistence

**Files:**
- Test: `server/canvas/tldrawHeadlessExecutor.test.ts`

**Interfaces:**
- Consumes: the shared schema from Task 1 and shared executor from Task 3.
- Produces: integration evidence that no separate server implementation is required and that `project_card` records survive room persistence.

- [ ] **Step 1: Write the failing headless persistence test**

Add to `server/canvas/tldrawHeadlessExecutor.test.ts`:

```ts
it('persists project creation and mutations without a browser bridge', async () => {
  const responses = await executeHeadlessTldrawAction(manager, {
    type: 'canvas.action', requestId: 'req_project', canvasId: 'canvas_001', actions: [
      { type: 'create_project_card', id: 'shape:project_1', x: 100, y: 120,
        title: 'Website launch', status: 'active', priority: 'high', dueDate: '2026-07-31',
        actions: [{ id: 'action_copy', text: 'Write copy' }] },
      { type: 'append_project_action', shapeId: 'shape:project_1', actionId: 'action_ship', text: 'Ship' },
      { type: 'set_project_action_done', shapeId: 'shape:project_1', actionId: 'action_copy', done: true },
      { type: 'read_canvas' }
    ]
  })
  expect(responses[0]).toMatchObject({ type: 'canvas.result', requestId: 'req_project', ok: true })
  expect(responses[1]).toMatchObject({
    type: 'canvas.observation', state: { shapes: [{
      id: 'shape:project_1', type: 'project_card', w: 360, h: 320,
      props: { title: 'Website launch', status: 'active', priority: 'high', dueDate: '2026-07-31',
        actions: [
          { id: 'action_copy', text: 'Write copy', done: true },
          { id: 'action_ship', text: 'Ship', done: false }
        ] }
    }] }
  })
  const stored = manager.getOrCreateRoom('canvas_001').getCurrentSnapshot().documents
    .find((entry) => entry.state.id === 'shape:project_1')?.state as any
  expect(stored).toMatchObject({ typeName: 'shape', type: 'project_card', props: {
    title: 'Website launch', actions: [{ done: true }, { done: false }]
  } })
})
```

- [ ] **Step 2: Run the headless test**

Run: `npm test -- server/canvas/tldrawHeadlessExecutor.test.ts`

Expected: PASS after Tasks 1–3; if it fails, fix only shared schema/executor parity rather than adding a second Project mutation implementation to the server file.

- [ ] **Step 3: Commit the integration proof**

```bash
git add server/canvas/tldrawHeadlessExecutor.test.ts
git commit -m "test: verify headless project persistence"
```

---

### Task 5: Add the Project Shape UI and Styling

**Files:**
- Create: `src/canvas/tldraw/projectCardUtils.tsx`
- Create: `src/canvas/tldraw/projectCardUtils.test.tsx`
- Modify: `src/canvas/tldraw/customShapeUtils.tsx`
- Modify: `src/canvas/tldraw/customShapeUtils.test.tsx`
- Modify: `src/canvas/components/CanvasSurface.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: all Task 1 domain helpers and tldraw's editor/editing hooks.
- Produces: `ProjectCardShapeUtil`, registered as the third Hermes custom shape utility.

- [ ] **Step 1: Write failing renderer and interaction tests**

Create `src/canvas/tldraw/projectCardUtils.test.tsx`. Mock `HTMLContainer` as a `div`, `ShapeUtil` as an empty class, `Rectangle2d` as a class retaining its constructor input, `useEditor` with spies for `updateShape`, `markEventAsHandled`, and `setEditingShape`, `useIsEditing` from a mutable `editingShapeId`, `getColorValue` from the supplied palette, and `resizeBox` as a spy returning a `360x320` props patch. Cover these exact assertions:

```tsx
expect(ProjectCardShapeUtil.type).toBe('project_card')
expect(ProjectCardShapeUtil.props.color).toBe(DefaultColorStyle)
expect(new ProjectCardShapeUtil({} as any).getDefaultProps()).toMatchObject({
  w: 360, h: 320, title: 'New Project', status: 'planned', priority: 'medium', actions: [],
  color: 'light-violet'
})
expect(new ProjectCardShapeUtil({} as any).isAspectRatioLocked()).toBe(false)
```

Render a normal Active/High card with two actions, one complete, and assert:

```tsx
expect(screen.getByText('Website launch')).toBeInTheDocument()
expect(screen.getByText('Active')).toBeInTheDocument()
expect(screen.getByText('High')).toBeInTheDocument()
expect(screen.getByLabelText('1 of 2 project actions complete')).toHaveTextContent('1/2')
expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
fireEvent.click(screen.getByRole('checkbox', { name: 'Ship' }))
expect(tldrawMock.editor.updateShape).toHaveBeenCalledWith({
  id: 'shape:project_1', type: 'project_card', props: { actions: [
    { id: 'action_copy', text: 'Write copy', done: true },
    { id: 'action_ship', text: 'Ship', done: true }
  ] }
})
```

Render edit mode and assert title, status, priority, date, action text, Add action, Remove action, and Escape call `updateShape` or `setEditingShape(null)` with exact Project props. Assert an overdue Active card has `.is-overdue`, a Done card with the same date does not, and `onResize` calls `resizeBox` with `{ minWidth: 320, minHeight: 240 }`.

- [ ] **Step 2: Run the UI tests and verify failure**

Run: `npm test -- src/canvas/tldraw/projectCardUtils.test.tsx src/canvas/tldraw/customShapeUtils.test.tsx src/canvas/components/CanvasSurface.test.tsx`

Expected: FAIL because `ProjectCardShapeUtil` is absent and only two custom utilities are registered.

- [ ] **Step 3: Implement the Project ShapeUtil**

Create `src/canvas/tldraw/projectCardUtils.tsx`. The file must:

```tsx
import {
  HTMLContainer, Rectangle2d, ShapeUtil, getColorValue, resizeBox,
  useEditor, useIsEditing, type TLResizeInfo, type TLShape
} from 'tldraw'
import type { CSSProperties, ChangeEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import {
  PROJECT_CARD_MIN_HEIGHT, PROJECT_CARD_MIN_WIDTH, PROJECT_CARD_TYPE,
  PROJECT_PRIORITIES, PROJECT_STATUSES, createProjectCardProps,
  getProjectProgress, isProjectOverdue, nextProjectActionId,
  projectCardMigrations, projectCardProps, type ProjectCardProps
} from './projectCard.types'
```

```tsx
declare module 'tldraw' {
  export interface TLGlobalShapePropsMap { [PROJECT_CARD_TYPE]: ProjectCardProps }
}

export type ProjectCardShape = TLShape<typeof PROJECT_CARD_TYPE>

export class ProjectCardShapeUtil extends ShapeUtil<ProjectCardShape> {
  static override type = PROJECT_CARD_TYPE
  static override migrations = projectCardMigrations
  static override props = projectCardProps
  override canEdit = () => true
  override canResize = () => true
  override isAspectRatioLocked = () => false

  getDefaultProps() { return createProjectCardProps({ title: 'New Project' }) }
  getGeometry(shape: ProjectCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }
  getIndicatorPath() { return undefined }
  override onResize(shape: ProjectCardShape, info: TLResizeInfo<ProjectCardShape>) {
    const { id: _id, type: _type, ...patch } = resizeBox(shape, info, {
      minWidth: PROJECT_CARD_MIN_WIDTH, minHeight: PROJECT_CARD_MIN_HEIGHT
    })
    return patch
  }
  component(shape: ProjectCardShape) { return <ProjectCardView shape={shape} /> }
}
```

Add these helpers and the complete view component before `ProjectCardShapeUtil`:

```tsx
const STATUS_LABEL = { planned: 'Planned', active: 'Active', blocked: 'Blocked', done: 'Done' } as const
const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const

function ProjectIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6.5h14v9H3z" /><path d="M7 6.5V4.5h6v2" /></svg>
}

function ProjectCardView({ shape }: { shape: ProjectCardShape }) {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const { completed, total, percent } = getProjectProgress(shape.props.actions)
  const overdue = isProjectOverdue(shape.props.dueDate, shape.props.status)
  const background = getColorValue(
    editor.getCurrentTheme().colors[editor.getColorMode()], shape.props.color, 'noteFill'
  )
  const updateProps = (props: Partial<ProjectCardProps>) => editor.updateShape({
    id: shape.id, type: PROJECT_CARD_TYPE, props
  })
  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => editor.markEventAsHandled(event),
    onPointerUp: (event: PointerEvent<HTMLElement>) => editor.markEventAsHandled(event)
  }
  const setDone = (id: string, done: boolean) => updateProps({ actions:
    shape.props.actions.map((action) => action.id === id ? { ...action, done } : action)
  })
  const setActionText = (id: string, text: string) => updateProps({ actions:
    shape.props.actions.map((action) => action.id === id ? { ...action, text } : action)
  })
  const addAction = (event: MouseEvent<HTMLButtonElement>) => {
    editor.markEventAsHandled(event)
    updateProps({ actions: [...shape.props.actions, {
      id: nextProjectActionId(shape.props.actions), text: 'New action', done: false
    }] })
  }
  const removeAction = (id: string, event: MouseEvent<HTMLButtonElement>) => {
    editor.markEventAsHandled(event)
    updateProps({ actions: shape.props.actions.filter((action) => action.id !== id) })
  }
  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') editor.setEditingShape(null)
  }
  const progress = <>
    <div className="hermes-project-progress-row">
      <span>Progress</span>
      <span aria-label={`${completed} of ${total} project actions complete`}>{completed}/{total}</span>
    </div>
    <div className="hermes-project-progress" role="progressbar"
      aria-label="Project action progress"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span style={{ width: `${percent}%` }} />
    </div>
  </>

  if (!isEditing) {
    return <HTMLContainer className="hermes-shape hermes-project-card"
      style={{ width: shape.props.w, height: shape.props.h, backgroundColor: background,
        '--hermes-card-accent': background } as CSSProperties}
      onDoubleClick={(event: MouseEvent<HTMLElement>) => {
        editor.setEditingShape(shape.id); editor.markEventAsHandled(event)
      }}>
      <div className="hermes-card-header">
        <span className="hermes-card-icon"><ProjectIcon /></span>
        <strong>{shape.props.title}</strong>
        <span className="hermes-project-badge" data-status={shape.props.status}>{STATUS_LABEL[shape.props.status]}</span>
      </div>
      <div className="hermes-project-meta">
        <span className="hermes-project-priority" data-priority={shape.props.priority}>{PRIORITY_LABEL[shape.props.priority]}</span>
        {shape.props.dueDate && <time className={`hermes-project-due${overdue ? ' is-overdue' : ''}`}
          dateTime={shape.props.dueDate}>Due {shape.props.dueDate}</time>}
      </div>
      {progress}
      <div className="hermes-project-actions" onWheel={(event) => event.stopPropagation()}>
        {shape.props.actions.map((action) => <label key={action.id}
          className={`hermes-project-action${action.done ? ' is-done' : ''}`}>
          <input type="checkbox" aria-label={action.text} checked={action.done}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDone(action.id, event.currentTarget.checked)}
            {...handlers} />
          <span className="hermes-project-action-label">{action.text}</span>
        </label>)}
      </div>
    </HTMLContainer>
  }

  return <HTMLContainer className="hermes-shape hermes-project-card is-editing"
    style={{ width: shape.props.w, height: shape.props.h, backgroundColor: background,
      '--hermes-card-accent': background } as CSSProperties}
    onKeyDown={closeOnEscape}>
    <div className="hermes-card-header hermes-card-header-editing">
      <span className="hermes-card-icon"><ProjectIcon /></span>
      <input aria-label="Project title" className="hermes-inline-title-input" value={shape.props.title}
        onChange={(event) => updateProps({ title: event.currentTarget.value })}
        onBlur={(event) => updateProps({ title: event.currentTarget.value.trim() || 'Untitled Project' })}
        {...handlers} />
    </div>
    <div className="hermes-project-edit-fields">
      <select aria-label="Project status" value={shape.props.status}
        onChange={(event) => updateProps({ status: event.currentTarget.value as ProjectCardProps['status'] })}
        {...handlers}>{PROJECT_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}</select>
      <select aria-label="Project priority" value={shape.props.priority}
        onChange={(event) => updateProps({ priority: event.currentTarget.value as ProjectCardProps['priority'] })}
        {...handlers}>{PROJECT_PRIORITIES.map((value) => <option key={value} value={value}>{PRIORITY_LABEL[value]}</option>)}</select>
      <input aria-label="Project due date" type="date" value={shape.props.dueDate ?? ''}
        onChange={(event) => updateProps({ dueDate: event.currentTarget.value || undefined })}
        {...handlers} />
    </div>
    {progress}
    <div className="hermes-project-actions" onWheel={(event) => event.stopPropagation()}>
      {shape.props.actions.map((action) => <div key={action.id}
        className={`hermes-project-action${action.done ? ' is-done' : ''}`}>
        <input type="checkbox" aria-label={`Complete ${action.text}`} checked={action.done}
          onChange={(event) => setDone(action.id, event.currentTarget.checked)} {...handlers} />
        <input type="text" aria-label={`Project action: ${action.text}`} value={action.text}
          onChange={(event) => setActionText(action.id, event.currentTarget.value)}
          onBlur={(event) => setActionText(action.id, event.currentTarget.value.trim() || 'New action')}
          {...handlers} />
        <button type="button" aria-label={`Remove action: ${action.text}`}
          onClick={(event) => removeAction(action.id, event)} {...handlers}>×</button>
      </div>)}
    </div>
    <button type="button" className="hermes-add-task-button" aria-label="Add project action"
      onClick={addAction} {...handlers}>+</button>
  </HTMLContainer>
}
```

- [ ] **Step 4: Register the Project utility**

In `src/canvas/tldraw/customShapeUtils.tsx`, import `ProjectCardShapeUtil` and change the export to:

```ts
export const hermesShapeUtils = [TodoBlockShapeUtil, LinkCardShapeUtil, ProjectCardShapeUtil]
```

Update the registration expectation in `customShapeUtils.test.tsx` to `['todo_block', 'link_card', 'project_card']`, and the `CanvasSurface.test.tsx` shape utility count from 2 to 3.

- [ ] **Step 5: Add Project CSS**

Add a focused block in `src/styles.css` beside the existing Hermes card rules. It must define these selectors and behaviors:

```css
.hermes-project-card { display: flex; flex-direction: column; gap: 10px; background: color-mix(in srgb, var(--hermes-card-accent, #ddd6fe) 38%, white) !important; }
.hermes-project-badge, .hermes-project-priority { border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
.hermes-project-badge[data-status='planned'] { background: #eef2ff; color: #4f46e5; }
.hermes-project-badge[data-status='active'] { background: #dcfce7; color: #15803d; }
.hermes-project-badge[data-status='blocked'] { background: #fee2e2; color: #b91c1c; }
.hermes-project-badge[data-status='done'] { background: #e2e8f0; color: #475569; }
.hermes-project-priority[data-priority='low'] { background: #f1f5f9; color: #475569; }
.hermes-project-priority[data-priority='medium'] { background: #fef3c7; color: #a16207; }
.hermes-project-priority[data-priority='high'] { background: #ffedd5; color: #c2410c; }
.hermes-project-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 24px; }
.hermes-project-due.is-overdue { color: #b91c1c; font-weight: 700; }
.hermes-project-progress { height: 7px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.65); }
.hermes-project-progress > span { display: block; height: 100%; border-radius: inherit; background: #6c5ce7; transition: width .16s ease; }
.hermes-project-actions { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.hermes-project-action { display: flex; align-items: center; gap: 8px; min-height: 34px; }
.hermes-project-action.is-done .hermes-project-action-label, .hermes-project-action.is-done input[type='text'] { color: #64748b; text-decoration: line-through; }
.hermes-project-edit-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.hermes-project-edit-fields input, .hermes-project-edit-fields select, .hermes-project-action input[type='text'] { min-width: 0; border: 1px solid rgba(75,68,105,.2); border-radius: 7px; background: rgba(255,255,255,.82); }
.hermes-project-edit-fields :focus-visible, .hermes-project-action :focus-visible { outline: 2px solid #6c5ce7; outline-offset: 1px; }
```

- [ ] **Step 6: Run the UI tests**

Run: `npm test -- src/canvas/tldraw/projectCardUtils.test.tsx src/canvas/tldraw/customShapeUtils.test.tsx src/canvas/components/CanvasSurface.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the Project UI slice**

```bash
git add src/canvas/tldraw/projectCardUtils.tsx src/canvas/tldraw/projectCardUtils.test.tsx src/canvas/tldraw/customShapeUtils.tsx src/canvas/tldraw/customShapeUtils.test.tsx src/canvas/components/CanvasSurface.test.tsx src/styles.css
git commit -m "feat: render editable project cards"
```

---

### Task 6: Integrate Project Insertion and Tidy Layout

**Files:**
- Modify: `src/canvas/components/CanvasInsertMenu.tsx`
- Modify: `src/canvas/components/CanvasSurface.test.tsx`
- Modify: `src/canvas/tldraw/tidyCardLayout.ts`
- Test: `src/canvas/tldraw/tidyCardLayout.test.ts`

**Interfaces:**
- Consumes: `create_project_card` and `PROJECT_CARD_TYPE`.
- Produces: a Project toolbar control that creates, observes, and selects a default card plus a first Project column in tidy layout.

- [ ] **Step 1: Write failing insertion and tidy tests**

In `CanvasSurface.test.tsx`, expect a `Project Card` toolbar button, click it, and assert the final observation contains:

```tsx
expect.objectContaining({ type: 'project_card', props: expect.objectContaining({
  title: 'New Project', status: 'planned', priority: 'medium', actions: []
}) })
```

Also assert one selected shape ID. In `tidyCardLayout.test.ts`, include:

```ts
shape('shape:project_1', 'project_card', 100, 300, { w: 360, h: 320 })
```

and expect it at `{ id: 'shape:project_1', type: 'project_card', x: 100, y: 100 }`, before Todo, Note, and Link columns.

- [ ] **Step 2: Run integration tests and verify failure**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/tidyCardLayout.test.ts`

Expected: FAIL because Project is absent from both integrations.

- [ ] **Step 3: Add the Project insert option**

In `CanvasInsertMenu.tsx`, extend `ComponentKind` with `'project'`, extend `InsertOption['icon']` with `'project'`, and add:

```ts
{ kind: 'project', label: 'Project Card', icon: 'project' }
```

and return this action from `buildCreateAction`:

```ts
if (kind === 'project') {
  return { type: 'create_project_card', id, title: 'New Project', status: 'planned',
    priority: 'medium', actions: [], x, y }
}
```

Add this branch at the start of `ComponentIcon`:

```tsx
if (icon === 'project') {
  return <svg viewBox="0 0 20 20" aria-hidden="true">
    <rect x="3" y="6" width="14" height="10" rx="2" />
    <path d="M7 6V4h6v2M3 10h14" />
  </svg>
}
```

Replace `getInsertPoint` and its call with:

```ts
function getInsertPoint(editor: unknown, kind: ComponentKind) {
  const editorWithBounds = editor as {
    getViewportPageBounds?: () => { x: number; y: number; w: number; h: number }
  }
  const bounds = editorWithBounds.getViewportPageBounds?.()
  if (!bounds) return { x: 160, y: 160 }
  const dimensions = kind === 'project' ? { w: 360, h: 320 } : { w: 280, h: 160 }
  return {
    x: Math.round(bounds.x + bounds.w / 2 - dimensions.w / 2),
    y: Math.round(bounds.y + bounds.h / 2 - dimensions.h / 2)
  }
}

const point = getInsertPoint(editor, kind)
```

- [ ] **Step 4: Add Project to tidy layout**

In `tidyCardLayout.ts`, import `PROJECT_CARD_TYPE`, change:

```ts
type CardKind = 'project' | 'todo' | 'note' | 'link'
const CARD_KIND_ORDER: CardKind[] = ['project', 'todo', 'note', 'link']
```

and return `'project'` when `shape.type === PROJECT_CARD_TYPE`.

- [ ] **Step 5: Run insertion and tidy tests**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/tidyCardLayout.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit canvas integration**

```bash
git add src/canvas/components/CanvasInsertMenu.tsx src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/tidyCardLayout.ts src/canvas/tldraw/tidyCardLayout.test.ts
git commit -m "feat: integrate project cards into canvas tools"
```

---

### Task 7: Document Hermes Project Operations and Verify the Feature

**Files:**
- Modify: `CANVAS_API.md`
- Modify: `README.md`
- Modify: `docs/PRD.md`
- Modify: `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`

**Interfaces:**
- Consumes: final action names and defaults from Tasks 1–6.
- Produces: accurate operator and Hermes guidance with no undocumented Project operation.

- [ ] **Step 1: Add canonical API examples**

Add Project sections to `CANVAS_API.md` using these payloads:

```json
{"type":"create_project_card","id":"shape:website_launch","title":"Website Launch","status":"active","priority":"high","dueDate":"2026-07-31","x":100,"y":120,"actions":[{"id":"action_copy","text":"Finish copy"},{"id":"action_ship","text":"Ship","done":false}]}
{"type":"update_project_card","shapeId":"shape:website_launch","status":"blocked","priority":"medium","dueDate":null}
{"type":"append_project_action","shapeId":"shape:website_launch","actionId":"action_announce","text":"Publish announcement"}
{"type":"update_project_action_text","shapeId":"shape:website_launch","actionId":"action_announce","text":"Publish launch announcement"}
{"type":"set_project_action_done","shapeId":"shape:website_launch","actionId":"action_copy","done":true}
{"type":"remove_project_action","shapeId":"shape:website_launch","actionId":"action_announce"}
```

Document defaults, exact enums, `dueDate: null`, stable unique action IDs, derived progress, explicit status, scroll behavior, per-action errors, and `project_card` observation props.

- [ ] **Step 2: Update user and agent documentation**

Add the create/mutate batch to `README.md`. Add `Project cards | Shipped` to the PRD capability table, update the floating insert menu row to include Project, and add requirements covering one project per card, exact status/priority values, optional real date, derived progress, scrolling, direct editing, and browser/headless actions.

In the Canvas Dashboard skill, add “projects and project actions” to When to Use and add all six canonical payloads under Actions. Tell Hermes to read the card first, preserve stable action IDs, use Project actions instead of replacing the full `props.actions` array, and verify the final observation.

- [ ] **Step 3: Run focused verification**

Run:

```bash
npm test -- src/canvas/tldraw/projectCard.types.test.ts src/canvas/actions/canvasAction.schema.test.ts src/canvas/tldraw/tldrawSchema.test.ts src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/bridge/CanvasBridge.test.ts server/canvas/tldrawHeadlessExecutor.test.ts src/canvas/tldraw/projectCardUtils.test.tsx src/canvas/tldraw/customShapeUtils.test.tsx src/canvas/components/CanvasSurface.test.tsx src/canvas/tldraw/tidyCardLayout.test.ts
```

Expected: all focused test files PASS.

- [ ] **Step 4: Run repository-wide verification**

Run each command separately:

```bash
npm run lint:types
npm test
npm run build
git diff --check
git status --short
```

Expected: type checking exits 0, the complete Vitest suite passes, the production build exits 0, diff check prints nothing, and status lists only intended Project implementation/docs changes if the final docs commit has not yet been made.

- [ ] **Step 5: Commit documentation and any verified final adjustments**

```bash
git add CANVAS_API.md README.md docs/PRD.md plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md
git commit -m "docs: document project card workflows"
```

- [ ] **Step 6: Confirm the branch is clean**

Run: `git status --short`

Expected: no output.
