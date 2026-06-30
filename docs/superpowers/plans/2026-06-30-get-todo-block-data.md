# Get Todo Block Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a canvas action that returns structured todo task data for one todo block by `blockId`.

**Architecture:** The bridge already owns action validation and execution. Add a read-only action to the existing discriminated union, resolve the block through `CanvasAdapter.getBlockById`, and return the structured todo payload in the action result while keeping canvas observations unchanged.

**Tech Stack:** TypeScript, React, Vite, Vitest, Zod.

---

### Task 1: Action Schema

**Files:**
- Modify: `src/canvas/actions/canvasAction.types.ts`
- Modify: `src/canvas/actions/canvasAction.schema.ts`
- Test: `src/canvas/actions/canvasAction.schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add this case to `canvasAction.schema.test.ts`:

```ts
it('accepts get_todo_block_data by block id', () => {
  const parsed = canvasActionSchema.parse({
    type: 'get_todo_block_data',
    blockId: 'block_0001'
  })

  expect(parsed.type).toBe('get_todo_block_data')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts`

Expected: FAIL because the discriminated union does not know `get_todo_block_data`.

- [ ] **Step 3: Write minimal implementation**

Add the type:

```ts
export type GetTodoBlockDataAction = {
  type: 'get_todo_block_data'
  blockId: string
}
```

Add it to the `CanvasAction` union and add this zod object:

```ts
z.object({
  type: z.literal('get_todo_block_data'),
  blockId: z.string().min(1)
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts`

Expected: PASS.

### Task 2: Executor Behavior

**Files:**
- Modify: `src/canvas/bridge/ActionExecutor.ts`
- Test: `src/canvas/bridge/CanvasBridge.test.ts`

- [ ] **Step 1: Write failing bridge tests**

Add tests that:

```ts
expect(response.result.results[0].todoBlock).toEqual({
  id: blockId,
  name: 'Launch checklist',
  tasks: [{ id: 'task_docs', text: 'Write docs', done: false }]
})
```

Also assert unknown block returns `error: 'Unknown block block_missing'`, and a text block returns `error: 'Block <id> is not a todo block'`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/canvas/bridge/CanvasBridge.test.ts`

Expected: FAIL because the action is not implemented in `ActionExecutor`.

- [ ] **Step 3: Write minimal implementation**

Extend `ActionExecutionResult`:

```ts
todoBlock?: {
  id: string
  name?: string
  tasks: TodoTask[]
}
```

Handle the action:

```ts
case 'get_todo_block_data': {
  const block = this.adapter.getBlockById(action.blockId)
  if (!block) return { actionType: action.type, error: `Unknown block ${action.blockId}` }
  if (block.type !== 'todo_block') return { actionType: action.type, error: `Block ${action.blockId} is not a todo block` }
  const tasks = Array.isArray(block.props?.tasks) ? block.props.tasks.filter(isTodoTask) : []
  return {
    actionType: action.type,
    matchedBlockIds: [block.id],
    todoBlock: { id: block.id, name: block.name, tasks }
  }
}
```

Add a local `isTodoTask` type guard.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/canvas/bridge/CanvasBridge.test.ts`

Expected: PASS.

### Task 3: Protocol Result Validation

**Files:**
- Modify: `src/canvas/protocol/canvasMessages.ts`
- Test: `src/canvas/protocol/canvasMessages.test.ts`

- [ ] **Step 1: Write failing protocol test**

Add a `canvasResultEnvelopeSchema` parse case containing:

```ts
{
  actionType: 'get_todo_block_data',
  matchedBlockIds: ['block_0001'],
  todoBlock: {
    id: 'block_0001',
    name: 'Launch checklist',
    tasks: [{ id: 'task_docs', text: 'Write docs', done: false }]
  },
  createdTaskIds: ['task_new'],
  updatedTaskIds: ['task_docs'],
  deletedTaskIds: ['task_old']
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/canvas/protocol/canvasMessages.test.ts`

Expected: FAIL because task-id fields and `todoBlock` are not in the result schema.

- [ ] **Step 3: Write minimal implementation**

Add `todoTaskSchema`, `todoBlockResultSchema`, and optional `createdTaskIds`, `updatedTaskIds`, `deletedTaskIds`, and `todoBlock` fields to `resultItemSchema`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/canvas/protocol/canvasMessages.test.ts`

Expected: PASS.

### Task 4: Simulator And Docs

**Files:**
- Modify: `src/canvas/components/Simulator.tsx`
- Modify: `CANVAS_API.md`

- [ ] **Step 1: Add simulator preset**

Add a preset with:

```ts
{
  name: 'Todo Data by Block ID',
  value: {
    type: 'get_todo_block_data',
    blockId: 'block_0001'
  }
}
```

- [ ] **Step 2: Document the action**

Add a `get_todo_block_data` section to `CANVAS_API.md` with request, schema, result fields, and error cases.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: PASS.

Run: `npm run lint:types`

Expected: PASS.
