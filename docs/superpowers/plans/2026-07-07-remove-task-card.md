# Remove Task Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Task Card from the Hermes Canvas app and canvas-dashboard plugin, and reject new `create_task_card` actions.

**Architecture:** Task Card will be hard removed from supported custom component registration, action validation, executor routing, UI affordances, active documentation, and plugin guidance. Todo Block, Link Card, and Native Note Card remain supported.

**Tech Stack:** TypeScript, React, Vite, Vitest, tldraw, zod, Python unittest.

---

## File Structure

- Modify `src/canvas/actions/canvasAction.types.ts`: remove `CreateTaskCardAction`.
- Modify `src/canvas/actions/canvasAction.schema.ts`: remove `create_task_card` validation.
- Modify `src/canvas/actions/canvasAction.schema.test.ts`: assert `create_task_card` is rejected and supported actions still parse.
- Modify `src/canvas/tldraw/customShape.types.ts`: remove task-card constants, props, migrations, and helper.
- Modify `src/canvas/tldraw/customShape.types.test.ts`: remove task-card helper/migration assertions.
- Modify `src/canvas/tldraw/customShapeUtils.tsx`: remove `TaskCardShapeUtil` and task-card type registration.
- Modify `src/canvas/tldraw/customShapeUtils.test.tsx`: remove task-card render/edit tests and assert registration excludes Task Card.
- Modify `src/canvas/tldraw/tldrawSchema.ts`: remove `task_card` schema registration.
- Modify `src/canvas/tldraw/tldrawSchema.test.ts`: assert `task_card` is absent while supported custom shapes remain present.
- Modify `src/canvas/tldraw/tldrawActionExecutor.ts`: remove `create_task_card` executor branch.
- Modify `src/canvas/tldraw/tldrawActionExecutor.test.ts`: use supported actions in executor tests and assert rejected task-card behavior through schema tests.
- Modify `src/canvas/components/CanvasInsertMenu.tsx`: remove Task Card insert option.
- Modify `src/canvas/components/CanvasSurface.test.tsx`: remove task-card insert assertions and ensure Todo, Link, Note still work.
- Modify `src/canvas/components/Simulator.tsx`: remove Sprint Task Card preset.
- Modify `src/App.test.tsx` or add focused simulator coverage if existing tests do not cover presets.
- Modify `src/canvas/components/Inspector.tsx`: remove Task Card filter option.
- Modify `src/styles.css`: remove task-card badge styling.
- Modify `README.md`: remove task-card examples and replace demo command with Note Card.
- Modify `CANVAS_API.md`: remove `create_task_card` section.
- Modify `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`: remove Task Card guidance/examples and use Note Card/Todo/Link examples.
- Modify `plugins/canvas-dashboard/test_tools.py`: replace task-card payloads and assert plugin skill no longer documents task-card support.
- Modify server/client tests that currently create task cards: replace with Note Card or Link Card payloads.

---

### Task 1: Reject create_task_card At The Action Schema

**Files:**
- Modify: `src/canvas/actions/canvasAction.types.ts`
- Modify: `src/canvas/actions/canvasAction.schema.ts`
- Test: `src/canvas/actions/canvasAction.schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

In `src/canvas/actions/canvasAction.schema.test.ts`, remove the `create_task_card` parse assertion from `accepts project custom shape helper actions`, then add this test:

```ts
it('rejects removed task card helper actions', () => {
  expect(() =>
    canvasActionSchema.parse({
      type: 'create_task_card',
      id: 'shape:task_1',
      x: 120,
      y: 140,
      title: 'Design'
    })
  ).toThrow()
})
```

- [ ] **Step 2: Run schema tests to verify they fail**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts`

Expected: FAIL because `create_task_card` still parses.

- [ ] **Step 3: Remove the action type**

In `src/canvas/actions/canvasAction.types.ts`, delete:

```ts
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
  backgroundColor?: string
}
```

Remove `| CreateTaskCardAction` from the `CanvasAction` union.

- [ ] **Step 4: Remove zod validation**

In `src/canvas/actions/canvasAction.schema.ts`, delete the `z.object({ type: z.literal('create_task_card'), ... })` union member.

- [ ] **Step 5: Run schema tests to verify they pass**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/actions/canvasAction.types.ts src/canvas/actions/canvasAction.schema.ts src/canvas/actions/canvasAction.schema.test.ts
git commit -m "feat: reject task card actions"
```

---

### Task 2: Remove Task Card Custom Shape Registration

**Files:**
- Modify: `src/canvas/tldraw/customShape.types.ts`
- Modify: `src/canvas/tldraw/customShape.types.test.ts`
- Modify: `src/canvas/tldraw/customShapeUtils.tsx`
- Modify: `src/canvas/tldraw/customShapeUtils.test.tsx`
- Modify: `src/canvas/tldraw/tldrawSchema.ts`
- Modify: `src/canvas/tldraw/tldrawSchema.test.ts`

- [ ] **Step 1: Write failing registration tests**

In `src/canvas/tldraw/tldrawSchema.test.ts`, replace the current test body with:

```ts
it('creates a schema for supported custom shape types only', () => {
  const schema = createHermesTldrawSchema()

  expect(Object.keys(schema.types)).toEqual(
    expect.arrayContaining(['shape', 'binding', 'asset', 'document', 'page'])
  )
  expect(JSON.stringify(schema)).toContain('todo_block')
  expect(JSON.stringify(schema)).toContain('link_card')
  expect(JSON.stringify(schema)).not.toContain('task_card')
})
```

In `src/canvas/tldraw/customShapeUtils.test.tsx`, add:

```ts
it('registers only supported Hermes custom shape utils', () => {
  expect(hermesShapeUtils.map((util) => util.type)).toEqual(['todo_block', 'link_card'])
})
```

Update the import at the top of that test file to include `hermesShapeUtils`:

```ts
import { LinkCardShapeUtil, TodoBlockShapeUtil, hermesShapeUtils } from './customShapeUtils'
```

- [ ] **Step 2: Run registration tests to verify they fail**

Run: `npm test -- src/canvas/tldraw/tldrawSchema.test.ts src/canvas/tldraw/customShapeUtils.test.tsx`

Expected: FAIL because Task Card is still registered.

- [ ] **Step 3: Remove task-card shape types and helpers**

In `src/canvas/tldraw/customShape.types.ts`, delete:

```ts
export const TASK_CARD_TYPE = 'task_card'
export const DEFAULT_TASK_CARD_COLOR = 'light-blue'
```

Delete the `TaskCardProps` type, remove `typeof TASK_CARD_TYPE` from `HermesCustomShapeType`, delete `taskCardVersions`, delete `taskCardMigrations`, and delete `createTaskCardProps`.

Keep all Todo Block and Link Card exports intact.

- [ ] **Step 4: Update custom shape type tests**

In `src/canvas/tldraw/customShape.types.test.ts`, remove imports of `createTaskCardProps` and `taskCardMigrations`.

Replace the test named `creates stable default props for task and link cards` with:

```ts
it('creates stable default props for link cards', () => {
  expect(createLinkCardProps({ title: 'Docs', url: 'https://tldraw.dev' })).toEqual({
    w: 300,
    h: 120,
    title: 'Docs',
    url: 'https://tldraw.dev',
    description: '',
    color: 'light-green'
  })
})
```

In `preserves explicit background colors for custom component props`, remove the `createTaskCardProps` expectation.

In `migrates existing custom component props to include a tldraw color`, remove `taskProps`, `runFirstMigration(taskCardMigrations, taskProps)`, and `expect(taskProps.color).toBe('light-blue')`.

- [ ] **Step 5: Remove task-card shape util**

In `src/canvas/tldraw/customShapeUtils.tsx`, remove imports for:

```ts
TASK_CARD_TYPE,
DEFAULT_TASK_CARD_COLOR,
type TaskCardProps,
taskCardMigrations
```

Remove `[TASK_CARD_TYPE]: TaskCardProps` from `TLGlobalShapePropsMap`.

Delete:

```ts
export type TaskCardShape = TLShape<typeof TASK_CARD_TYPE>
```

Change:

```ts
type HermesCardShape = TodoBlockShape | TaskCardShape | LinkCardShape
```

to:

```ts
type HermesCardShape = TodoBlockShape | LinkCardShape
```

Delete the full `TaskCardShapeUtil` class.

Change:

```ts
export const hermesShapeUtils = [
  TodoBlockShapeUtil,
  TaskCardShapeUtil,
  LinkCardShapeUtil
]
```

to:

```ts
export const hermesShapeUtils = [
  TodoBlockShapeUtil,
  LinkCardShapeUtil
]
```

- [ ] **Step 6: Update custom shape util tests**

In `src/canvas/tldraw/customShapeUtils.test.tsx`, remove imports of `TaskCardShapeUtil`.

Delete tests or assertions that render or edit `task_card`, including:

- task-card half of `renders task and link cards`
- task-card editable rendering assertion
- `updates task card fields from editable controls`
- task-card color/background assertions

Keep Todo Block and Link Card coverage intact.

- [ ] **Step 7: Remove task-card schema registration**

In `src/canvas/tldraw/tldrawSchema.ts`, remove `taskCardMigrations` from imports and delete the `task_card` entry from `shapes`.

- [ ] **Step 8: Run shape registration tests to verify they pass**

Run: `npm test -- src/canvas/tldraw/customShape.types.test.ts src/canvas/tldraw/customShapeUtils.test.tsx src/canvas/tldraw/tldrawSchema.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/canvas/tldraw/customShape.types.ts src/canvas/tldraw/customShape.types.test.ts src/canvas/tldraw/customShapeUtils.tsx src/canvas/tldraw/customShapeUtils.test.tsx src/canvas/tldraw/tldrawSchema.ts src/canvas/tldraw/tldrawSchema.test.ts
git commit -m "feat: remove task card shape registration"
```

---

### Task 3: Remove Executor Support And Replace Internal Test Payloads

**Files:**
- Modify: `src/canvas/tldraw/tldrawActionExecutor.ts`
- Modify: `src/canvas/tldraw/tldrawActionExecutor.test.ts`
- Modify: `src/canvas/components/CanvasSurface.test.tsx`
- Modify: `server/canvas/tldrawHeadlessExecutor.test.ts`
- Modify: `server/canvas/canvasGateway.integration.test.ts`
- Modify: `server/canvas/hermesCanvasClient.ts`
- Modify: `server/canvas/hermesCanvasClient.test.ts`

- [ ] **Step 1: Write failing executor-focused expectations**

In `src/canvas/tldraw/tldrawActionExecutor.test.ts`, change the first test actions from task-card creation to link-card creation:

```ts
const actions: CanvasAction[] = [
  {
    type: 'create_link_card',
    id: 'shape:link_1',
    title: 'Docs',
    url: 'https://tldraw.dev',
    description: 'SDK docs',
    backgroundColor: '#ecfccb',
    x: 100,
    y: 120
  },
  { type: 'update_shape', shapeId: 'shape:link_1', patch: { props: { description: 'Updated docs' } } },
  { type: 'move_shapes', shapeIds: ['shape:link_1'], dx: 20, dy: 10 },
  { type: 'read_canvas' }
]
```

Update expected results to use `create_link_card` and `shape:link_1`. Update the observation expectation to:

```ts
props: {
  title: 'Docs',
  url: 'https://tldraw.dev',
  description: 'Updated docs',
  backgroundColor: '#ecfccb'
}
```

Update the delete assertion to delete `shape:link_1`.

- [ ] **Step 2: Run executor tests to verify they fail**

Run: `npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts`

Expected: PASS or FAIL depending on whether TypeScript still compiles. If it passes, continue; the red coverage for rejection lives in Task 1.

- [ ] **Step 3: Remove executor branch**

In `src/canvas/tldraw/tldrawActionExecutor.ts`, remove imports of `TASK_CARD_TYPE` and `createTaskCardProps`.

Delete the `case 'create_task_card':` branch.

- [ ] **Step 4: Replace mounted browser bridge task-card test payload**

In `src/canvas/components/CanvasSurface.test.tsx`, replace the `create_task_card` action inside `handles Hermes actions through the mounted tldraw editor without snapshot fetches` with:

```ts
{
  type: 'create_link_card',
  id: 'shape:link_1',
  title: 'Saved from Hermes',
  url: 'https://example.com',
  description: 'Rendered with tldraw',
  x: 100,
  y: 120
}
```

Update the corresponding observation assertion to:

```ts
expect.objectContaining({
  id: 'shape:link_1',
  type: 'link_card',
  props: expect.objectContaining({ title: 'Saved from Hermes' })
})
```

- [ ] **Step 5: Replace server/headless test payloads**

In `server/canvas/tldrawHeadlessExecutor.test.ts`, replace `create_task_card` with `create_note_card`:

```ts
{
  type: 'create_note_card',
  id: 'shape:note_1',
  title: 'Headless note',
  tag: 'Note',
  content: 'Created without a bridge',
  x: 100,
  y: 120
}
```

Update expected action type to `create_note_card`, created id to `shape:note_1`, observed shape type to `note`, and snapshot id to `shape:note_1`.

In `server/canvas/canvasGateway.integration.test.ts`, replace the headless `create_task_card` payload with `create_note_card` using id `shape:note_gateway`, update expected action type/id, update observed shape type to `note`, and update snapshot id to `shape:note_gateway`.

- [ ] **Step 6: Replace demo client defaults**

In `server/canvas/hermesCanvasClient.ts`, replace the default demo `create_task_card` action with:

```ts
{
  type: "create_note_card",
  id: "shape:demo_note",
  title: "Hermes Demo",
  tag: "Note",
  content: "Created by the Hermes demo client",
  x: 100,
  y: 120,
}
```

In `server/canvas/hermesCanvasClient.test.ts`, replace task-card CLI fixtures with note-card fixtures:

```ts
'[{"type":"create_note_card","title":"Hello","tag":"Note","content":"World","x":10,"y":20}]'
```

and expected action:

```ts
{ type: 'create_note_card', title: 'Hello', tag: 'Note', content: 'World', x: 10, y: 20 }
```

- [ ] **Step 7: Run executor and server tests**

Run: `npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/components/CanvasSurface.test.tsx server/canvas/tldrawHeadlessExecutor.test.ts server/canvas/canvasGateway.integration.test.ts server/canvas/hermesCanvasClient.test.ts`

Expected: PASS. If sandbox blocks local sockets with `EPERM`, rerun this command with escalation.

- [ ] **Step 8: Commit**

```bash
git add src/canvas/tldraw/tldrawActionExecutor.ts src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/components/CanvasSurface.test.tsx server/canvas/tldrawHeadlessExecutor.test.ts server/canvas/canvasGateway.integration.test.ts server/canvas/hermesCanvasClient.ts server/canvas/hermesCanvasClient.test.ts
git commit -m "feat: remove task card executor support"
```

---

### Task 4: Remove Task Card From UI And Simulator

**Files:**
- Modify: `src/canvas/components/CanvasInsertMenu.tsx`
- Modify: `src/canvas/components/CanvasSurface.test.tsx`
- Modify: `src/canvas/components/Simulator.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/canvas/components/Inspector.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing UI tests**

In `src/canvas/components/CanvasSurface.test.tsx`, update the insert-menu test:

```ts
expect(screen.getByRole('menuitem', { name: /Todo Block/ })).toBeInTheDocument()
expect(screen.getByRole('menuitem', { name: /Link Card/ })).toBeInTheDocument()
expect(screen.getByRole('menuitem', { name: /Note Card/ })).toBeInTheDocument()
expect(screen.queryByRole('menuitem', { name: /Task Card/ })).not.toBeInTheDocument()
```

Delete the test named `inserts a task card from the floating canvas menu and selects it`.

In `src/App.test.tsx`, add a test:

```ts
it('does not show removed task card simulator or inspector options', () => {
  render(<App />)

  expect(screen.queryByRole('option', { name: 'Sprint Task Card' })).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Task Card' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx src/App.test.tsx`

Expected: FAIL because UI still contains Task Card options.

- [ ] **Step 3: Remove Task Card from insert menu**

In `src/canvas/components/CanvasInsertMenu.tsx`, change:

```ts
type ComponentKind = 'todo' | 'task' | 'link' | 'note'
```

to:

```ts
type ComponentKind = 'todo' | 'link' | 'note'
```

Change the icon union to remove `'task'`, delete the `{ kind: 'task', label: 'Task Card', icon: 'task' }` option, delete the `if (kind === 'task')` branch in `buildCreateAction`, and delete the `if (icon === 'task')` branch in `ComponentIcon`.

- [ ] **Step 4: Remove Task Card from simulator**

In `src/canvas/components/Simulator.tsx`, delete the preset object with `name: 'Sprint Task Card'`.

- [ ] **Step 5: Remove Task Card from inspector and styles**

In `src/canvas/components/Inspector.tsx`, delete:

```tsx
<option value="task_card">Task Card</option>
```

In `src/styles.css`, delete:

```css
.block-badge-type.type-task_card { background: rgba(244, 63, 94, 0.12); color: #fb7185; }
```

- [ ] **Step 6: Run UI tests to verify they pass**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/canvas/components/CanvasInsertMenu.tsx src/canvas/components/CanvasSurface.test.tsx src/canvas/components/Simulator.tsx src/App.test.tsx src/canvas/components/Inspector.tsx src/styles.css
git commit -m "feat: remove task card from dashboard UI"
```

---

### Task 5: Update Active Docs And Plugin Guidance

**Files:**
- Modify: `README.md`
- Modify: `CANVAS_API.md`
- Modify: `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`
- Modify: `plugins/canvas-dashboard/test_tools.py`

- [ ] **Step 1: Write failing docs/plugin tests**

In `plugins/canvas-dashboard/test_tools.py`, add to `test_bundled_skill_uses_hermes_skill_format`:

```python
self.assertNotIn("create_task_card", skill_text)
self.assertNotIn("Task Card", skill_text)
self.assertNotIn("task cards", skill_text)
```

Replace `create_task_card` payloads in plugin tests with `create_note_card`:

```python
{"actions": [{"type": "create_note_card", "title": "Hello", "tag": "Note", "content": "World"}]}
```

and expected prepended actions:

```python
[
    {"type": "read_canvas"},
    {"type": "create_note_card", "title": "Hello", "tag": "Note", "content": "World"},
]
```

Add a repository docs test to `plugins/canvas-dashboard/test_tools.py`:

```python
def test_active_docs_do_not_advertise_task_cards(self):
    repo_root = PLUGIN_DIR.parent.parent
    for relative_path in [
        "README.md",
        "CANVAS_API.md",
        "plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md",
    ]:
        text = (repo_root / relative_path).read_text(encoding="utf-8")
        self.assertNotIn("create_task_card", text, relative_path)
        self.assertNotIn("Task Card", text, relative_path)
```

- [ ] **Step 2: Run plugin tests to verify they fail**

Run: `python -m unittest plugins/canvas-dashboard/test_tools.py`

Expected: FAIL because active docs and plugin skill still advertise Task Card.

- [ ] **Step 3: Update README**

In `README.md`, replace the custom action demo command:

```bash
npm run hermes:demo -- --actions '[{"type":"create_note_card","title":"Hello","tag":"Note","content":"Created by Hermes","x":120,"y":160}]'
```

Delete the `Create a task card:` section and its JSON example.

- [ ] **Step 4: Update CANVAS_API.md**

In `CANVAS_API.md`, delete the `### create_task_card` section and JSON example.

Ensure `### create_note_card` remains documented.

- [ ] **Step 5: Update plugin skill**

In `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`, change the "When to Use" sentence to remove `task cards`.

Delete the `### create_task_card` section and JSON example.

Replace the batch example with:

```json
{"actions":[{"type":"create_note_card","id":"shape:plan","title":"Plan","tag":"Note","content":"Dashboard plan","x":80,"y":80},{"type":"create_todo_block","id":"shape:next_steps","title":"Next Steps","x":120,"y":250,"tasks":[{"id":"task_read","text":"Read current canvas"},{"id":"task_update","text":"Update task status"}]},{"type":"zoom_to_fit"},{"type":"read_canvas"}]}
```

Replace the CLI batch example with:

```bash
uv run --with websocket-client scripts/canvas_dashboard_tool.py --actions '[{"type":"create_note_card","id":"shape:plan","title":"Plan","tag":"Note","content":"Dashboard plan","x":80,"y":80},{"type":"create_todo_block","id":"shape:next_steps","title":"Next Steps","x":120,"y":250,"tasks":[{"id":"task_read","text":"Read current canvas"},{"id":"task_update","text":"Update task status"}]},{"type":"zoom_to_fit"},{"type":"read_canvas"}]'
```

Update examples that reference `shape:sprint_task` to use `shape:plan` or another supported id.

- [ ] **Step 6: Run plugin tests to verify they pass**

Run: `python -m unittest plugins/canvas-dashboard/test_tools.py`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add README.md CANVAS_API.md plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md plugins/canvas-dashboard/test_tools.py
git commit -m "docs: remove task card plugin guidance"
```

---

### Task 6: Repository-Wide Cleanup And Verification

**Files:**
- Verify: repository search, full tests, typecheck

- [ ] **Step 1: Search active code/docs for removed API**

Run:

```bash
rg -n "create_task_card|Task Card|task_card|TaskCard|TASK_CARD" src server plugins README.md CANVAS_API.md
```

Expected: no matches except false positives in todo task names are not allowed for these exact patterns. If matches remain in active code/docs, remove or update them. Do not search or edit `docs/superpowers`.

- [ ] **Step 2: Run full JavaScript/TypeScript tests**

Run: `npm test`

Expected: PASS. If gateway integration tests fail with `listen EPERM` or `connect EPERM`, rerun with sandbox escalation because those tests bind local ports.

- [ ] **Step 3: Run TypeScript type checking**

Run: `npm run lint:types`

Expected: PASS.

- [ ] **Step 4: Run plugin tests**

Run: `python -m unittest plugins/canvas-dashboard/test_tools.py`

Expected: PASS.

- [ ] **Step 5: Check final git status**

Run: `git status --short`

Expected: no uncommitted implementation changes.

---

## Self-Review

- Spec coverage: The plan removes Task Card from action schema, executor, shape registration, UI, simulator, inspector, active docs, plugin skill, and plugin tests. It preserves Todo Block, Link Card, and Note Card, and leaves historical docs untouched.
- Placeholder scan: No placeholders remain; every task has exact file paths, concrete snippets, commands, and expected outcomes.
- Type consistency: Removed names are consistently `create_task_card`, `task_card`, `Task Card`, `TaskCard`, and `TASK_CARD`; supported replacement examples use `create_note_card`, `create_todo_block`, and `create_link_card`.
