# Headless Canvas Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Hermes agents to send canvas actions when the dashboard is closed by executing those actions against persisted canvas state in the gateway.

**Architecture:** Keep the WebSocket protocol unchanged. The gateway forwards to a live dashboard bridge when present; otherwise it runs a headless executor that reuses `CanvasBridge` and `ExcalidrawAdapter` through a small in-memory `ExcalidrawApiLike` implementation.

**Tech Stack:** TypeScript, Node HTTP/WebSocket gateway, Vitest, `ws`, existing canvas action schemas, existing Excalidraw adapter abstractions.

---

## File Structure

- Modify `server/canvas/roomManager.ts`: add bridge lifecycle tracking and `hasBridge(canvasId)`.
- Modify `server/canvas/canvasGateway.ts`: inject a headless executor and use it when no bridge socket is attached.
- Create `server/canvas/headlessExcalidrawApi.ts`: implement `ExcalidrawApiLike` over in-memory elements and app state.
- Create `server/canvas/headlessCanvasExecutor.ts`: load/create snapshots, execute actions through `CanvasBridge`, save snapshots, and return bridge-style envelopes.
- Modify `src/canvas/adapters/ExcalidrawAdapter.ts`: make `createArrow` return `null` when either endpoint block is missing.
- Modify `src/canvas/adapters/canvasAdapter.ts`: update `createArrow` return type to `AdapterCreateResult | null`.
- Modify `src/canvas/bridge/ActionExecutor.ts`: return an action-level error when `create_arrow` cannot create an arrow.
- Modify tests:
  - `server/canvas/canvasGateway.test.ts`
  - `server/canvas/canvasGateway.integration.test.ts`
  - `src/canvas/adapters/ExcalidrawAdapter.test.ts`
  - `src/canvas/bridge/CanvasBridge.test.ts`
  - Create `server/canvas/headlessExcalidrawApi.test.ts`
  - Create `server/canvas/headlessCanvasExecutor.test.ts`
- Modify docs:
  - `README.md`
  - `skills/canvas-dashboard/SKILL.md`
  - `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`

## Task 1: Track Live Bridge Presence

**Files:**
- Modify: `server/canvas/roomManager.ts`
- Modify: `server/canvas/canvasGateway.ts`
- Test: `server/canvas/canvasGateway.test.ts`

- [ ] **Step 1: Write the failing `RoomManager` tests**

Add these tests to `server/canvas/canvasGateway.test.ts` under the existing `RoomManager` describe block:

```ts
it('reports whether a bridge is attached for a canvas id', () => {
  const rooms = new RoomManager()
  const bridge = { send() {} }

  expect(rooms.hasBridge('canvas_001')).toBe(false)

  rooms.attachBridge('canvas_001', bridge)

  expect(rooms.hasBridge('canvas_001')).toBe(true)
  expect(rooms.hasBridge('canvas_002')).toBe(false)
})

it('clears bridge presence only for the attached bridge socket', () => {
  const rooms = new RoomManager()
  const firstBridge = { send() {} }
  const secondBridge = { send() {} }

  rooms.attachBridge('canvas_001', firstBridge)
  rooms.attachBridge('canvas_001', secondBridge)
  rooms.detachBridge('canvas_001', firstBridge)

  expect(rooms.hasBridge('canvas_001')).toBe(true)

  rooms.detachBridge('canvas_001', secondBridge)

  expect(rooms.hasBridge('canvas_001')).toBe(false)
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- server/canvas/canvasGateway.test.ts
```

Expected: FAIL with TypeScript or runtime errors that `hasBridge` and `detachBridge` do not exist.

- [ ] **Step 3: Implement bridge presence tracking**

Replace `server/canvas/roomManager.ts` with:

```ts
type RoomConnection = {
  bridge?: { send(data: string): void }
  hermes?: { send(data: string): void }
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomConnection>()

  getOrCreate(canvasId: string): RoomConnection {
    const existing = this.rooms.get(canvasId)
    if (existing) {
      return existing
    }

    const created: RoomConnection = {}
    this.rooms.set(canvasId, created)
    return created
  }

  attachBridge(canvasId: string, socket: { send(data: string): void }) {
    this.getOrCreate(canvasId).bridge = socket
  }

  detachBridge(canvasId: string, socket: { send(data: string): void }) {
    const room = this.rooms.get(canvasId)
    if (room?.bridge === socket) {
      delete room.bridge
    }
  }

  hasBridge(canvasId: string): boolean {
    return Boolean(this.rooms.get(canvasId)?.bridge)
  }

  attachHermes(canvasId: string, socket: { send(data: string): void }) {
    this.getOrCreate(canvasId).hermes = socket
  }

  forwardToBridge(canvasId: string, payload: string) {
    this.getOrCreate(canvasId).bridge?.send(payload)
  }

  forwardToHermes(canvasId: string, payload: string) {
    this.getOrCreate(canvasId).hermes?.send(payload)
  }
}
```

In `server/canvas/canvasGateway.ts`, after `rooms.attachBridge(canvasId, socket)`, add a close listener:

```ts
if (role === 'bridge') {
  rooms.attachBridge(canvasId, socket)
  socket.on('close', () => rooms.detachBridge(canvasId, socket))
} else {
  rooms.attachHermes(canvasId, socket)
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
npm test -- server/canvas/canvasGateway.test.ts
```

Expected: PASS for `server/canvas/canvasGateway.test.ts`.

- [ ] **Step 5: Commit**

Run:

```bash
git add server/canvas/roomManager.ts server/canvas/canvasGateway.ts server/canvas/canvasGateway.test.ts
git commit -m "feat: track canvas bridge presence"
```

## Task 2: Add Headless Excalidraw API

**Files:**
- Create: `server/canvas/headlessExcalidrawApi.ts`
- Create: `server/canvas/headlessExcalidrawApi.test.ts`

- [ ] **Step 1: Write the failing headless API tests**

Create `server/canvas/headlessExcalidrawApi.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ExcalidrawElementLike } from '../../src/canvas/adapters/ExcalidrawAdapter'
import { HeadlessExcalidrawApi } from './headlessExcalidrawApi'

describe('HeadlessExcalidrawApi', () => {
  it('stores and replaces scene elements in memory', () => {
    const initial: ExcalidrawElementLike[] = [
      { id: 'element_0001', type: 'rectangle', x: 10, y: 20, width: 100, height: 80 }
    ]
    const api = new HeadlessExcalidrawApi(initial)

    expect(api.getSceneElements()).toEqual(initial)

    const next: ExcalidrawElementLike[] = [
      { id: 'element_0002', type: 'text', x: 30, y: 40, width: 160, height: 32 }
    ]

    api.updateScene({ elements: next })

    expect(api.getSceneElements()).toEqual(next)
    expect(api.getSceneElements()).not.toBe(next)
  })

  it('returns stable default app state for observations', () => {
    const api = new HeadlessExcalidrawApi([])

    expect(api.getAppState()).toEqual({
      scrollX: 0,
      scrollY: 0,
      selectedElementIds: {},
      width: 1200,
      height: 800
    })
  })

  it('accepts scrollToContent without requiring a browser runtime', () => {
    const api = new HeadlessExcalidrawApi([])

    expect(() => api.scrollToContent()).not.toThrow()
    expect(api.getAppState()).toMatchObject({ width: 1200, height: 800 })
  })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- server/canvas/headlessExcalidrawApi.test.ts
```

Expected: FAIL because `server/canvas/headlessExcalidrawApi.ts` does not exist.

- [ ] **Step 3: Implement `HeadlessExcalidrawApi`**

Create `server/canvas/headlessExcalidrawApi.ts`:

```ts
import type {
  ExcalidrawApiLike,
  ExcalidrawElementLike
} from '../../src/canvas/adapters/ExcalidrawAdapter'

type HeadlessAppState = ReturnType<ExcalidrawApiLike['getAppState']>

const defaultAppState: HeadlessAppState = {
  scrollX: 0,
  scrollY: 0,
  selectedElementIds: {},
  width: 1200,
  height: 800
}

export class HeadlessExcalidrawApi implements ExcalidrawApiLike {
  private elements: ExcalidrawElementLike[]
  private appState: HeadlessAppState

  constructor(
    elements: readonly ExcalidrawElementLike[],
    appState: HeadlessAppState = defaultAppState
  ) {
    this.elements = elements.map((element) => ({ ...element }))
    this.appState = {
      ...defaultAppState,
      ...appState,
      selectedElementIds: { ...(appState.selectedElementIds ?? {}) }
    }
  }

  updateScene(scene: {
    elements?: readonly ExcalidrawElementLike[]
    appState?: Record<string, unknown> | null
  }): void {
    if (scene.elements) {
      this.elements = scene.elements.map((element) => ({ ...element }))
    }

    if (scene.appState) {
      this.appState = {
        ...this.appState,
        ...scene.appState
      }
    }
  }

  getSceneElements(): readonly ExcalidrawElementLike[] {
    return this.elements.map((element) => ({ ...element }))
  }

  getAppState(): HeadlessAppState {
    return {
      ...this.appState,
      selectedElementIds: { ...(this.appState.selectedElementIds ?? {}) }
    }
  }

  scrollToContent(): void {
    this.updateScene({ appState: { scrollX: 0, scrollY: 0 } })
  }
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
npm test -- server/canvas/headlessExcalidrawApi.test.ts
```

Expected: PASS for `server/canvas/headlessExcalidrawApi.test.ts`.

- [ ] **Step 5: Commit**

Run:

```bash
git add server/canvas/headlessExcalidrawApi.ts server/canvas/headlessExcalidrawApi.test.ts
git commit -m "feat: add headless excalidraw api"
```

## Task 3: Add Headless Canvas Executor

**Files:**
- Create: `server/canvas/headlessCanvasExecutor.ts`
- Create: `server/canvas/headlessCanvasExecutor.test.ts`

- [ ] **Step 1: Write failing executor tests**

Create `server/canvas/headlessCanvasExecutor.test.ts`:

```ts
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasFileStore } from './canvasFileStore'
import { executeHeadlessCanvasAction } from './headlessCanvasExecutor'

describe('executeHeadlessCanvasAction', () => {
  let dir: string
  let store: CanvasFileStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hermes-canvas-headless-'))
    store = new CanvasFileStore(dir)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('creates a blank snapshot when no saved state exists and handles read_canvas', async () => {
    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_read',
      canvasId: 'canvas_001',
      actions: [{ type: 'read_canvas' }]
    })

    expect(responses).toHaveLength(2)
    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_read',
      ok: true,
      results: [{ actionType: 'read_canvas' }]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      requestId: 'req_read',
      canvasId: 'canvas_001',
      state: {
        canvasId: 'canvas_001',
        blocks: []
      }
    })
    await expect(store.load('canvas_001')).resolves.toMatchObject({
      version: 1,
      canvasId: 'canvas_001',
      elements: [],
      adapter: {
        blocks: [],
        sequence: 0,
        todoTaskSequence: 0
      }
    })
  })

  it('executes create_text and persists elements plus adapter state', async () => {
    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_create',
      canvasId: 'canvas_001',
      actions: [{ type: 'create_text', text: 'Hello headless', x: 80, y: 120 }]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      ok: true,
      results: [
        {
          actionType: 'create_text',
          createdBlockIds: ['block_0001'],
          createdShapeIds: ['element_0002']
        }
      ]
    })

    const saved = await store.load('canvas_001')
    expect(saved).toMatchObject({
      version: 1,
      canvasId: 'canvas_001',
      adapter: {
        blocks: [
          {
            id: 'block_0001',
            type: 'text',
            text: 'Hello headless',
            x: 80,
            y: 120,
            shapeIds: ['element_0002']
          }
        ],
        sequence: 2,
        todoTaskSequence: 0
      }
    })
    expect((saved as { elements: unknown[] }).elements).toEqual([
      expect.objectContaining({
        id: 'element_0002',
        type: 'text',
        text: 'Hello headless'
      })
    ])
  })

  it('returns result ok false plus observation for action-level failures', async () => {
    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_missing',
      canvasId: 'canvas_001',
      actions: [{ type: 'update_text', blockId: 'block_missing', text: 'Nope' }]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_missing',
      ok: false,
      results: [
        {
          actionType: 'update_text',
          error: 'Unknown block block_missing'
        }
      ]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      requestId: 'req_missing',
      canvasId: 'canvas_001'
    })
  })

  it('returns canvas.error for invalid persisted snapshot without overwriting it', async () => {
    await writeFile(join(dir, 'canvas_001.json'), '{"version":1,"canvasId":"wrong"}\n', 'utf8')

    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_invalid_snapshot',
      canvasId: 'canvas_001',
      actions: [{ type: 'read_canvas' }]
    })

    expect(responses).toEqual([
      {
        type: 'canvas.error',
        requestId: 'req_invalid_snapshot',
        message: 'Invalid persisted canvas snapshot for canvas_001'
      }
    ])
    await expect(readFile(join(dir, 'canvas_001.json'), 'utf8')).resolves.toBe(
      '{"version":1,"canvasId":"wrong"}\n'
    )
  })

  it('accepts zoom_to_fit in headless mode', async () => {
    const responses = await executeHeadlessCanvasAction(store, {
      type: 'canvas.action',
      requestId: 'req_zoom',
      canvasId: 'canvas_001',
      actions: [{ type: 'zoom_to_fit' }]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_zoom',
      ok: true,
      results: [{ actionType: 'zoom_to_fit' }]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      state: {
        viewport: { x: 0, y: 0, w: 1200, h: 800 }
      }
    })
  })
})
```

- [ ] **Step 2: Run focused executor tests and verify failure**

Run:

```bash
npm test -- server/canvas/headlessCanvasExecutor.test.ts
```

Expected: FAIL because `server/canvas/headlessCanvasExecutor.ts` does not exist.

- [ ] **Step 3: Implement the executor**

Create `server/canvas/headlessCanvasExecutor.ts`:

```ts
import {
  ExcalidrawAdapter,
  type ExcalidrawElementLike
} from '../../src/canvas/adapters/ExcalidrawAdapter'
import type { CanvasAction } from '../../src/canvas/actions/canvasAction.types'
import type { CanvasObservationState } from '../../src/canvas/blocks/block.types'
import { CanvasBridge } from '../../src/canvas/bridge/CanvasBridge'
import type { ActionExecutionResult } from '../../src/canvas/bridge/ActionExecutor'
import type { CanvasFileStore } from './canvasFileStore'
import { HeadlessExcalidrawApi } from './headlessExcalidrawApi'

type CanvasPersistenceSnapshot = {
  version: 1
  canvasId: string
  elements: ExcalidrawElementLike[]
  adapter: ReturnType<ExcalidrawAdapter['exportSnapshot']>
}

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
      results: ActionExecutionResult[]
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

const CANVAS_PERSISTENCE_VERSION = 1

export async function executeHeadlessCanvasAction(
  store: CanvasFileStore,
  envelope: ActionEnvelope
): Promise<HeadlessResponse[]> {
  try {
    const loaded = await store.load(envelope.canvasId)
    const snapshot = loaded === null ? createBlankSnapshot(envelope.canvasId) : loaded

    if (!isCanvasPersistenceSnapshot(snapshot) || snapshot.canvasId !== envelope.canvasId) {
      return [canvasError(envelope.requestId, `Invalid persisted canvas snapshot for ${envelope.canvasId}`)]
    }

    const headlessApi = new HeadlessExcalidrawApi(snapshot.elements)
    const adapter = new ExcalidrawAdapter(headlessApi, envelope.canvasId, snapshot.adapter)
    const bridge = new CanvasBridge(adapter)
    const response = bridge.handleActionEnvelope(envelope)

    if ('error' in response) {
      return [response.error]
    }

    await store.save(
      envelope.canvasId,
      createHeadlessSnapshot({
        canvasId: envelope.canvasId,
        elements: headlessApi.getSceneElements(),
        adapter: adapter.exportSnapshot()
      })
    )

    return [response.result, response.observation]
  } catch (error) {
    return [canvasError(envelope.requestId, formatError(error))]
  }
}

function createBlankSnapshot(canvasId: string): CanvasPersistenceSnapshot {
  return {
    version: CANVAS_PERSISTENCE_VERSION,
    canvasId,
    elements: [],
    adapter: {
      blocks: [],
      sequence: 0,
      todoTaskSequence: 0
    }
  }
}

function createHeadlessSnapshot(input: {
  canvasId: string
  elements: readonly CanvasPersistenceSnapshot['elements'][number][]
  adapter: CanvasPersistenceSnapshot['adapter']
}): CanvasPersistenceSnapshot {
  return {
    version: CANVAS_PERSISTENCE_VERSION,
    canvasId: input.canvasId,
    elements: input.elements.map((element) => ({ ...element })),
    adapter: input.adapter
  }
}

function isCanvasPersistenceSnapshot(value: unknown): value is CanvasPersistenceSnapshot {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  if (record.version !== CANVAS_PERSISTENCE_VERSION) return false
  if (typeof record.canvasId !== 'string') return false
  if (!Array.isArray(record.elements)) return false
  if (!record.adapter || typeof record.adapter !== 'object') return false

  const adapter = record.adapter as Record<string, unknown>
  return (
    Array.isArray(adapter.blocks) &&
    typeof adapter.sequence === 'number' &&
    typeof adapter.todoTaskSequence === 'number'
  )
}

function canvasError(requestId: string, message: string): HeadlessResponse {
  return {
    type: 'canvas.error',
    requestId,
    message
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
```

- [ ] **Step 4: Run focused executor tests and verify pass**

Run:

```bash
npm test -- server/canvas/headlessCanvasExecutor.test.ts
```

Expected: PASS for `server/canvas/headlessCanvasExecutor.test.ts`.

- [ ] **Step 5: Commit**

Run:

```bash
git add server/canvas/headlessCanvasExecutor.ts server/canvas/headlessCanvasExecutor.test.ts
git commit -m "feat: execute canvas actions headlessly"
```

## Task 4: Route Hermes Actions To Headless Fallback

**Files:**
- Modify: `server/canvas/canvasGateway.ts`
- Modify: `server/canvas/canvasGateway.integration.test.ts`

- [ ] **Step 1: Write failing gateway fallback integration tests**

Add this test to `server/canvas/canvasGateway.integration.test.ts`:

```ts
it('executes Hermes actions headlessly when no bridge client is connected', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'hermes-canvas-headless-gateway-'))
  tempDirs.push(dataDir)
  const gateway = createCanvasGateway(8793, { dataDir })
  instances.push(gateway)

  const hermesClient = new WebSocket(
    'ws://localhost:8793/canvas?canvasId=canvas_001&role=hermes'
  )
  clients.push(hermesClient)

  const responses = await new Promise<any[]>((resolve, reject) => {
    const received: any[] = []
    const timer = setTimeout(() => reject(new Error('Timed out waiting for headless responses')), 2000)

    hermesClient.addEventListener('message', (event: { data: unknown }) => {
      received.push(JSON.parse(String(event.data)))
      if (received.some((item) => item.type === 'canvas.observation')) {
        clearTimeout(timer)
        resolve(received)
      }
    })

    hermesClient.addEventListener('open', () => {
      hermesClient.send(
        JSON.stringify(
          createHermesCanvasToolPayload('canvas_001', [
            { type: 'create_text', text: 'Created without dashboard', x: 80, y: 120 }
          ])
        )
      )
    })
  })

  expect(responses[0]).toMatchObject({
    type: 'canvas.result',
    ok: true,
    results: [
      {
        actionType: 'create_text',
        createdBlockIds: ['block_0001']
      }
    ]
  })
  expect(responses[1]).toMatchObject({
    type: 'canvas.observation',
    state: {
      blocks: [
        {
          id: 'block_0001',
          text: 'Created without dashboard'
        }
      ]
    }
  })

  const saved = JSON.parse(await readFile(join(dataDir, 'canvas_001.json'), 'utf8'))
  expect(saved.adapter.blocks[0]).toMatchObject({
    id: 'block_0001',
    text: 'Created without dashboard'
  })
})
```

Update the import at the top of `server/canvas/canvasGateway.integration.test.ts`:

```ts
import { mkdtemp, readFile, rm } from 'node:fs/promises'
```

- [ ] **Step 2: Run focused integration tests and verify failure**

Run:

```bash
npm test -- server/canvas/canvasGateway.integration.test.ts
```

Expected: FAIL because the gateway still drops Hermes messages when no bridge is connected.

- [ ] **Step 3: Implement fallback routing in the gateway**

In `server/canvas/canvasGateway.ts`, add the import:

```ts
import { executeHeadlessCanvasAction } from './headlessCanvasExecutor'
```

In the Hermes branch, replace:

```ts
rooms.forwardToBridge(canvasId, payload)
return
```

with:

```ts
if (rooms.hasBridge(canvasId)) {
  rooms.forwardToBridge(canvasId, payload)
  return
}

void executeHeadlessCanvasAction(store, validated.data).then((responses) => {
  responses.forEach((responseEnvelope) => {
    socket.send(JSON.stringify(responseEnvelope))
  })
})
return
```

Keep the existing validation error path unchanged.

- [ ] **Step 4: Run focused integration tests and verify pass**

Run:

```bash
npm test -- server/canvas/canvasGateway.integration.test.ts
```

Expected: PASS for the gateway integration tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add server/canvas/canvasGateway.ts server/canvas/canvasGateway.integration.test.ts
git commit -m "feat: fallback to headless canvas execution"
```

## Task 5: Fix `create_arrow` Missing Endpoint Semantics

**Files:**
- Modify: `src/canvas/adapters/canvasAdapter.ts`
- Modify: `src/canvas/adapters/ExcalidrawAdapter.ts`
- Modify: `src/canvas/bridge/ActionExecutor.ts`
- Modify: `src/canvas/adapters/ExcalidrawAdapter.test.ts`
- Modify: `src/canvas/bridge/CanvasBridge.test.ts`

- [ ] **Step 1: Write failing adapter and bridge tests**

Add this test to `src/canvas/adapters/ExcalidrawAdapter.test.ts`:

```ts
it('does not create an arrow when either endpoint block is missing', () => {
  const api = createFakeApi()
  const adapter = new ExcalidrawAdapter(api, 'canvas_001')
  const created = adapter.createTaskCard({
    name: 'Existing block',
    x: 100,
    y: 120
  })

  expect(adapter.createArrow({
    fromBlockId: created.block.id,
    toBlockId: 'block_missing',
    label: 'Missing target'
  })).toBeNull()
  expect(adapter.createArrow({
    fromBlockId: 'block_missing',
    toBlockId: created.block.id,
    label: 'Missing source'
  })).toBeNull()
  expect(api.elements).toHaveLength(created.shapeIds.length)
})
```

Add this test to `src/canvas/bridge/CanvasBridge.test.ts`:

```ts
it('returns an action-level error for create_arrow when an endpoint is missing', () => {
  const bridge = new CanvasBridge(createFakeAdapter())

  const response = bridge.handleActionEnvelope({
    type: 'canvas.action',
    requestId: 'req_arrow_missing',
    canvasId: 'canvas_001',
    actions: [
      { type: 'create_task_card', name: 'Source', x: 100, y: 120 },
      { type: 'create_arrow', fromBlockId: 'block_1', toBlockId: 'block_missing', label: 'Missing' }
    ]
  })

  if ('error' in response) {
    throw new Error('expected bridge response, received error')
  }

  expect(response.result.ok).toBe(false)
  expect(response.result.results[1]).toEqual({
    actionType: 'create_arrow',
    error: 'Unknown arrow endpoint block_missing'
  })
})
```

Update the fake adapter `createArrow` in `src/canvas/bridge/CanvasBridge.test.ts`:

```ts
createArrow(input) {
  const fromBlock = blocks.get(input.fromBlockId)
  const toBlock = blocks.get(input.toBlockId)
  if (!fromBlock || !toBlock) return null

  blockCounter += 1
  const block: CanvasBlock = {
    id: `block_${blockCounter}`,
    type: 'box',
    name: input.label,
    x: 0,
    y: 0,
    shapeIds: [`shape_${blockCounter}`]
  }
  blocks.set(block.id, block)
  return { block, shapeIds: block.shapeIds }
},
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
npm test -- src/canvas/adapters/ExcalidrawAdapter.test.ts src/canvas/bridge/CanvasBridge.test.ts
```

Expected: FAIL because `ExcalidrawAdapter.createArrow` still creates arrows for missing endpoint blocks and `ActionExecutor` assumes the adapter always returns a create result.

- [ ] **Step 3: Update adapter contract and executor behavior**

In `src/canvas/adapters/canvasAdapter.ts`, change:

```ts
createArrow(input: { fromBlockId: string; toBlockId: string; label?: string }): AdapterCreateResult
```

to:

```ts
createArrow(input: { fromBlockId: string; toBlockId: string; label?: string }): AdapterCreateResult | null
```

In `src/canvas/adapters/ExcalidrawAdapter.ts`, update `createArrow`:

```ts
createArrow(input: { fromBlockId: string; toBlockId: string; label?: string }): AdapterCreateResult | null {
  const fromBlock = this.blocks.get(input.fromBlockId)
  const toBlock = this.blocks.get(input.toBlockId)
  if (!fromBlock || !toBlock) return null

  const blockId = this.nextId('block')
  const shapeId = this.nextId('element')
  const fromCenter = this.getBlockCenter(fromBlock)
  const toCenter = this.getBlockCenter(toBlock)
  const x = Math.min(fromCenter.x, toCenter.x)
  const y = Math.min(fromCenter.y, toCenter.y)
  const width = Math.max(Math.abs(toCenter.x - fromCenter.x), 1)
  const height = Math.max(Math.abs(toCenter.y - fromCenter.y), 1)
  const block: CanvasBlock = {
    id: blockId,
    type: 'box',
    name: input.label,
    x,
    y,
    w: width,
    h: height,
    text: input.label,
    props: { fromBlockId: input.fromBlockId, toBlockId: input.toBlockId },
    shapeIds: [shapeId]
  }

  this.appendElements([this.createArrowElement(shapeId, x, y, width, height)])
  this.blocks.set(blockId, block)

  return { block, shapeIds: [shapeId] }
}
```

In `src/canvas/bridge/ActionExecutor.ts`, update the `create_arrow` case:

```ts
case 'create_arrow': {
  const created = this.adapter.createArrow(action)
  return created
    ? {
        actionType: action.type,
        createdBlockIds: [created.block.id],
        createdShapeIds: created.shapeIds
      }
    : {
        actionType: action.type,
        error: `Unknown arrow endpoint ${missingArrowEndpoint(action, this.adapter)}`
      }
}
```

Add this helper above the class:

```ts
function missingArrowEndpoint(
  action: Extract<CanvasAction, { type: 'create_arrow' }>,
  adapter: CanvasAdapter
): string {
  if (!adapter.getBlockById(action.fromBlockId)) return action.fromBlockId
  return action.toBlockId
}
```

- [ ] **Step 4: Run focused tests and verify pass**

Run:

```bash
npm test -- src/canvas/adapters/ExcalidrawAdapter.test.ts src/canvas/bridge/CanvasBridge.test.ts
```

Expected: PASS for the adapter and bridge tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/canvas/adapters/canvasAdapter.ts src/canvas/adapters/ExcalidrawAdapter.ts src/canvas/bridge/ActionExecutor.ts src/canvas/adapters/ExcalidrawAdapter.test.ts src/canvas/bridge/CanvasBridge.test.ts
git commit -m "fix: reject arrows with missing endpoints"
```

## Task 6: Update Agent-Facing Documentation

**Files:**
- Modify: `README.md`
- Modify: `skills/canvas-dashboard/SKILL.md`
- Modify: `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`

- [ ] **Step 1: Update README local development notes**

In `README.md`, replace the existing local development list with:

```md
## Local development

1. Install dependencies: `npm install`
2. Start the gateway: `npm run server`
3. Optional: start the frontend for live visual editing: `VITE_CANVAS_GATEWAY_URL="ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge" npm run dev`
4. Send a Hermes-style write batch: `npm run hermes:demo`
5. Run tests: `npm test`

The gateway exposes two canvas capabilities:

- WebSocket action API: `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`
- Local file-backed canvas state API: `http://localhost:8787/canvas-state/canvas_001`

When the frontend dashboard is open and connected as `role=bridge`, actions are handled live by the browser bridge. When no dashboard bridge is connected, the gateway executes actions headlessly against `data/canvas_001.json`; if no snapshot exists, it creates a blank one. The next dashboard load restores that saved state.
```

Keep the existing alternate-port snippet, but ensure it still says the frontend is optional for headless mutation.

- [ ] **Step 2: Update both canvas-dashboard skill files**

In both `skills/canvas-dashboard/SKILL.md` and `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`, update the operating guidance so it states:

```md
The gateway must be running before using this skill. Opening the canvas dashboard is optional:

- If the dashboard is open and connected as `role=bridge`, actions execute live in the browser.
- If the dashboard is closed, the gateway executes the same action batch headlessly against the persisted snapshot and saves the result.
- If no snapshot exists yet, the gateway creates a blank canvas snapshot.
```

Also replace any sentence that says the browser bridge is required for all action execution with a sentence that says the browser bridge is required only for live visual execution.

- [ ] **Step 3: Run a documentation diff check**

Run:

```bash
git diff -- README.md skills/canvas-dashboard/SKILL.md plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md
```

Expected: Diff shows only headless-mode documentation updates and no unrelated rewrite.

- [ ] **Step 4: Commit**

Run:

```bash
git add README.md skills/canvas-dashboard/SKILL.md plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md
git commit -m "docs: explain headless canvas action mode"
```

## Task 7: Full Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS for all Vitest suites.

- [ ] **Step 2: Run TypeScript type checking**

Run:

```bash
npm run lint:types
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run Python canvas dashboard tool tests**

Run:

```bash
python3 -m unittest skills.canvas-dashboard.scripts.test_canvas_dashboard_tool
```

Expected: PASS for the Python CLI unit tests.

If Python import syntax rejects the hyphenated path, run the test file directly:

```bash
python3 skills/canvas-dashboard/scripts/test_canvas_dashboard_tool.py
```

Expected: PASS for the Python CLI unit tests.

- [ ] **Step 4: Manual headless smoke test**

Start the gateway:

```bash
npm run server
```

In a second terminal, run:

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_text","text":"Headless smoke","x":120,"y":160}]'
```

Expected: JSON output has `"ok": true`, a `canvas.result`, and a `canvas.observation`. `data/canvas_001.json` contains a block with `"text": "Headless smoke"`.

- [ ] **Step 5: Manual live-mode smoke test**

Start the gateway:

```bash
npm run server
```

Start the frontend:

```bash
VITE_CANVAS_GATEWAY_URL="ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge" npm run dev
```

With the dashboard open, run:

```bash
python3 skills/canvas-dashboard/scripts/canvas_dashboard_tool.py --actions '[{"type":"create_text","text":"Live smoke","x":180,"y":220}]'
```

Expected: JSON output has `"ok": true`; the dashboard shows the new text without needing a reload.

- [ ] **Step 6: Commit final verification notes if docs changed during smoke tests**

If no files changed, do not create a commit. If documentation was corrected during verification, run:

```bash
git add README.md skills/canvas-dashboard/SKILL.md plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md
git commit -m "docs: clarify canvas verification steps"
```

## Self-Review

- Spec coverage: Tasks cover live bridge preservation, headless fallback, blank snapshot creation, persisted mutation, unchanged WebSocket response shape, invalid snapshot errors, `zoom_to_fit`, `create_arrow` endpoint correctness, README/skill docs, and verification.
- Placeholder scan: The plan contains concrete file paths, code snippets, commands, and expected outcomes.
- Type consistency: The plan uses the existing `CanvasAdapter`, `ExcalidrawApiLike`, `CanvasBridge`, `CanvasFileStore`, and `CanvasPersistenceSnapshot` names consistently.
