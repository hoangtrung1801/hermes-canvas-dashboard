# Canvas for Hermes MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP Canvas Bridge that lets Hermes send validated canvas actions to a tldraw-backed React app and receive simplified canvas observations over WebSocket.

**Architecture:** This repository is currently empty, so the MVP should be built as a single TypeScript workspace with a Vite React frontend and a small Node WebSocket server. Shared schemas in `src/canvas` define actions, results, and observations; the browser-side bridge executes those actions through a `TldrawAdapter`, while the server-side gateway routes messages between Hermes and the active canvas room.

**Tech Stack:** TypeScript, React, Vite, tldraw, Zod, Zustand, `ws`, Vitest, React Testing Library, jsdom

---

## Scope Check

This spec spans frontend rendering, bridge orchestration, protocol design, and backend transport, but those pieces form one MVP vertical slice rather than separate products. Keep this as one plan. Do not implement multiplayer conflict resolution, offline support, arbitrary React component generation, or alternate canvas providers beyond the `TldrawAdapter` boundary.

## File Structure

The repo is empty, so create these focused units:

- `package.json`
  Defines frontend, server, build, and test scripts plus dependencies.
- `tsconfig.json`
  Base TypeScript configuration for browser and Node code.
- `tsconfig.node.json`
  Node-targeted config for `vite.config.ts` and `server/**/*`.
- `vite.config.ts`
  React and Vitest configuration.
- `index.html`
  Browser entry point for the canvas app.
- `src/main.tsx`
  React bootstrap.
- `src/styles.css`
  App shell styling.
- `src/setupTests.ts`
  Vitest DOM matchers.
- `src/App.tsx`
  Top-level shell showing bridge status and canvas surface.
- `src/App.test.tsx`
  Frontend smoke test.
- `src/canvas/blocks/block.types.ts`
  Canonical `CanvasBlock`, `CanvasBlockType`, viewport, and observation types.
- `src/canvas/actions/canvasAction.types.ts`
  Discriminated union types for Hermes actions.
- `src/canvas/actions/canvasAction.schema.ts`
  Zod validators for actions and batches.
- `src/canvas/actions/canvasAction.schema.test.ts`
  Schema validation tests.
- `src/canvas/protocol/canvasMessages.ts`
  Zod schemas and types for `canvas.ready`, `canvas.action`, `canvas.result`, `canvas.observation`, and `canvas.error`.
- `src/canvas/protocol/canvasMessages.test.ts`
  Protocol envelope tests.
- `src/canvas/blocks/blockRegistry.ts`
  Product-level block registry and block defaults.
- `src/canvas/blocks/blockRegistry.test.ts`
  Registry behavior tests.
- `src/canvas/adapters/canvasAdapter.ts`
  Provider-agnostic adapter interface.
- `src/canvas/adapters/TldrawAdapter.ts`
  The only module that talks directly to tldraw editor APIs.
- `src/canvas/adapters/TldrawAdapter.test.ts`
  Adapter tests using a fake editor contract.
- `src/canvas/bridge/ActionExecutor.ts`
  Maps validated actions to adapter calls.
- `src/canvas/bridge/StateObserver.ts`
  Reads simplified canvas state from the adapter.
- `src/canvas/bridge/CanvasBridge.ts`
  Orchestrates request handling, result generation, and observation replies.
- `src/canvas/bridge/CanvasBridge.test.ts`
  Bridge unit tests.
- `src/canvas/bridge/websocketClient.ts`
  Browser WebSocket lifecycle wrapper.
- `src/canvas/state/bridgeStore.ts`
  Zustand state for connection status, last observation, and bridge instance.
- `src/canvas/components/CanvasSurface.tsx`
  Mounts the tldraw editor and installs the adapter into the store.
- `src/canvas/components/CanvasSurface.test.tsx`
  Canvas mounting and connection tests with mocks.
- `server/canvas/roomManager.ts`
  Tracks canvas room membership and current bridge/hermes connections.
- `server/canvas/canvasGateway.ts`
  `ws` server that routes validated protocol messages.
- `server/canvas/hermesCanvasTool.ts`
  Helper client for Hermes-side request construction and response parsing.
- `server/canvas/canvasGateway.test.ts`
  Node-side gateway tests.
- `server/index.ts`
  Local dev entry point for the WebSocket gateway.
- `README.md`
  Local run instructions and protocol overview.

## Task 1: Bootstrap the workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/setupTests.ts`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write the failing test and the minimal test harness**

Create these files:

```json
// package.json
{
  "name": "hermes-canvas-productivity",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "server": "tsx server/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint:types": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tldraw": "^3.0.0",
    "zod": "^3.23.8",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.1",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.1",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4",
    "vite": "^5.3.5",
    "vitest": "^2.0.5",
    "ws": "^8.18.0"
  }
}
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts'
  }
})
```

```ts
// src/setupTests.ts
import '@testing-library/jest-dom/vitest'
```

```tsx
// src/App.test.tsx
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('shows the bridge status header', () => {
    render(<App />)

    expect(screen.getByText('Canvas for Hermes')).toBeInTheDocument()
    expect(screen.getByText('Bridge disconnected')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm install`

Run: `npm test -- src/App.test.tsx`

Expected: FAIL with a module resolution error for `./App` or an assertion failure because the component does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create these files:

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "server", "vite.config.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```json
// tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "server/**/*"]
}
```

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Canvas for Hermes</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

```tsx
// src/App.tsx
export default function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Hermes Canvas Bridge</p>
          <h1>Canvas for Hermes</h1>
        </div>
        <p className="status-pill">Bridge disconnected</p>
      </header>

      <section className="canvas-panel">
        <p>Canvas runtime will mount here.</p>
      </section>
    </main>
  )
}
```

```css
/* src/styles.css */
:root {
  color: #e8ecf3;
  background: radial-gradient(circle at top, #16324f 0%, #08111f 65%);
  font-family: "IBM Plex Sans", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  min-height: 100vh;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #7cb9ff;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}

.app-header h1 {
  margin: 0;
  font-size: 32px;
}

.status-pill {
  margin: 0;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.canvas-panel {
  min-height: calc(100vh - 120px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  background: rgba(7, 16, 30, 0.72);
  display: grid;
  place-items: center;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/main.tsx src/App.tsx src/styles.css src/setupTests.ts src/App.test.tsx
git commit -m "chore: bootstrap canvas workspace"
```

## Task 2: Define shared block, action, and protocol schemas

**Files:**
- Create: `src/canvas/blocks/block.types.ts`
- Create: `src/canvas/actions/canvasAction.types.ts`
- Create: `src/canvas/actions/canvasAction.schema.ts`
- Create: `src/canvas/actions/canvasAction.schema.test.ts`
- Create: `src/canvas/protocol/canvasMessages.ts`
- Create: `src/canvas/protocol/canvasMessages.test.ts`

- [ ] **Step 1: Write the failing tests**

Create these tests:

```ts
// src/canvas/actions/canvasAction.schema.test.ts
import { describe, expect, it } from 'vitest'
import { canvasActionBatchSchema, canvasActionSchema } from './canvasAction.schema'

describe('canvasActionSchema', () => {
  it('accepts a task card action', () => {
    const parsed = canvasActionSchema.parse({
      type: 'create_task_card',
      name: 'Design import modal',
      x: 100,
      y: 200,
      props: { status: 'todo', priority: 'high' }
    })

    expect(parsed.type).toBe('create_task_card')
  })

  it('rejects arrows without endpoints', () => {
    expect(() =>
      canvasActionSchema.parse({
        type: 'create_arrow',
        label: 'missing ids'
      })
    ).toThrow(/fromBlockId|toBlockId/)
  })

  it('accepts a batch of actions', () => {
    const parsed = canvasActionBatchSchema.parse([
      { type: 'create_text', text: 'Hello', x: 10, y: 20 },
      { type: 'read_canvas' }
    ])

    expect(parsed).toHaveLength(2)
  })
})
```

```ts
// src/canvas/protocol/canvasMessages.test.ts
import { describe, expect, it } from 'vitest'
import { canvasActionEnvelopeSchema, canvasErrorEnvelopeSchema, canvasObservationEnvelopeSchema, canvasReadyEnvelopeSchema } from './canvasMessages'

describe('canvasMessages', () => {
  it('parses canvas.action envelopes', () => {
    const parsed = canvasActionEnvelopeSchema.parse({
      type: 'canvas.action',
      requestId: 'req_001',
      canvasId: 'canvas_001',
      actions: [{ type: 'read_canvas' }]
    })

    expect(parsed.type).toBe('canvas.action')
  })

  it('parses canvas.observation envelopes', () => {
    const parsed = canvasObservationEnvelopeSchema.parse({
      type: 'canvas.observation',
      requestId: 'req_001',
      canvasId: 'canvas_001',
      state: {
        canvasId: 'canvas_001',
        selectedShapeIds: [],
        viewport: { x: 0, y: 0, w: 1200, h: 800 },
        blocks: []
      }
    })

    expect(parsed.state.blocks).toEqual([])
  })

  it('parses canvas.ready and canvas.error envelopes', () => {
    const ready = canvasReadyEnvelopeSchema.parse({
      type: 'canvas.ready',
      canvasId: 'canvas_001',
      roomId: 'room_001'
    })

    const error = canvasErrorEnvelopeSchema.parse({
      type: 'canvas.error',
      requestId: 'req_001',
      message: 'Invalid action'
    })

    expect(ready.roomId).toBe('room_001')
    expect(error.message).toBe('Invalid action')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts src/canvas/protocol/canvasMessages.test.ts`

Expected: FAIL with `Cannot find module` errors for the schema files.

- [ ] **Step 3: Write the minimal implementation**

Create these files:

```ts
// src/canvas/blocks/block.types.ts
export const canvasBlockTypes = [
  'text',
  'box',
  'note',
  'task_card',
  'link_card',
  'file_card',
  'job_panel'
] as const

export type CanvasBlockType = (typeof canvasBlockTypes)[number]

export type CanvasBlock = {
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

export type CanvasViewport = {
  x: number
  y: number
  w: number
  h: number
}

export type CanvasObservationState = {
  canvasId: string
  selectedShapeIds: string[]
  viewport: CanvasViewport
  blocks: CanvasBlock[]
}
```

```ts
// src/canvas/actions/canvasAction.types.ts
export type CreateTextAction = {
  type: 'create_text'
  text: string
  x: number
  y: number
  name?: string
}

export type CreateBoxAction = {
  type: 'create_box'
  x: number
  y: number
  w?: number
  h?: number
  name?: string
  text?: string
}

export type CreateNoteAction = {
  type: 'create_note'
  x: number
  y: number
  text: string
  name?: string
}

export type CreateTaskCardAction = {
  type: 'create_task_card'
  x: number
  y: number
  name: string
  text?: string
  props?: Record<string, unknown>
}

export type CreateLinkCardAction = {
  type: 'create_link_card'
  x: number
  y: number
  name: string
  url: string
  props?: Record<string, unknown>
}

export type CreateArrowAction = {
  type: 'create_arrow'
  fromBlockId: string
  toBlockId: string
  label?: string
}

export type UpdateTextAction = {
  type: 'update_text'
  blockId: string
  text: string
}

export type MoveBlockAction = {
  type: 'move_block'
  blockId: string
  x: number
  y: number
}

export type DeleteBlockAction = {
  type: 'delete_block'
  blockId: string
}

export type ReadCanvasAction = {
  type: 'read_canvas'
}

export type GetBlockByNameAction = {
  type: 'get_block_by_name'
  name: string
}

export type ZoomToFitAction = {
  type: 'zoom_to_fit'
}

export type CanvasAction =
  | CreateTextAction
  | CreateBoxAction
  | CreateNoteAction
  | CreateTaskCardAction
  | CreateLinkCardAction
  | CreateArrowAction
  | UpdateTextAction
  | MoveBlockAction
  | DeleteBlockAction
  | ReadCanvasAction
  | GetBlockByNameAction
  | ZoomToFitAction
```

```ts
// src/canvas/actions/canvasAction.schema.ts
import { z } from 'zod'

const basePosition = {
  x: z.number(),
  y: z.number()
}

export const canvasActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_text'),
    text: z.string().min(1),
    name: z.string().optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_box'),
    name: z.string().optional(),
    text: z.string().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_note'),
    text: z.string().min(1),
    name: z.string().optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_task_card'),
    name: z.string().min(1),
    text: z.string().optional(),
    props: z.record(z.unknown()).optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_link_card'),
    name: z.string().min(1),
    url: z.string().url(),
    props: z.record(z.unknown()).optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_arrow'),
    fromBlockId: z.string().min(1),
    toBlockId: z.string().min(1),
    label: z.string().optional()
  }),
  z.object({
    type: z.literal('update_text'),
    blockId: z.string().min(1),
    text: z.string().min(1)
  }),
  z.object({
    type: z.literal('move_block'),
    blockId: z.string().min(1),
    ...basePosition
  }),
  z.object({
    type: z.literal('delete_block'),
    blockId: z.string().min(1)
  }),
  z.object({
    type: z.literal('read_canvas')
  }),
  z.object({
    type: z.literal('get_block_by_name'),
    name: z.string().min(1)
  }),
  z.object({
    type: z.literal('zoom_to_fit')
  })
])

export const canvasActionBatchSchema = z.array(canvasActionSchema).min(1)

export type CanvasActionInput = z.infer<typeof canvasActionSchema>
```

```ts
// src/canvas/protocol/canvasMessages.ts
import { z } from 'zod'
import { canvasActionBatchSchema } from '../actions/canvasAction.schema'
import { canvasBlockTypes } from '../blocks/block.types'

const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number()
})

const blockSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.enum(canvasBlockTypes),
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
  text: z.string().optional(),
  props: z.record(z.unknown()).optional(),
  shapeIds: z.array(z.string())
})

const resultItemSchema = z.object({
  actionType: z.string(),
  createdBlockIds: z.array(z.string()).optional(),
  updatedBlockIds: z.array(z.string()).optional(),
  deletedBlockIds: z.array(z.string()).optional(),
  createdShapeIds: z.array(z.string()).optional(),
  matchedBlockIds: z.array(z.string()).optional(),
  error: z.string().optional()
})

export const canvasReadyEnvelopeSchema = z.object({
  type: z.literal('canvas.ready'),
  canvasId: z.string(),
  roomId: z.string()
})

export const canvasActionEnvelopeSchema = z.object({
  type: z.literal('canvas.action'),
  requestId: z.string(),
  canvasId: z.string(),
  actions: canvasActionBatchSchema
})

export const canvasResultEnvelopeSchema = z.object({
  type: z.literal('canvas.result'),
  requestId: z.string(),
  ok: z.boolean(),
  results: z.array(resultItemSchema)
})

export const canvasObservationEnvelopeSchema = z.object({
  type: z.literal('canvas.observation'),
  requestId: z.string(),
  canvasId: z.string(),
  state: z.object({
    canvasId: z.string(),
    selectedShapeIds: z.array(z.string()),
    viewport: viewportSchema,
    blocks: z.array(blockSchema)
  })
})

export const canvasErrorEnvelopeSchema = z.object({
  type: z.literal('canvas.error'),
  requestId: z.string(),
  message: z.string()
})

export const hermesToCanvasEnvelopeSchema = canvasActionEnvelopeSchema

export const canvasToHermesEnvelopeSchema = z.union([
  canvasReadyEnvelopeSchema,
  canvasResultEnvelopeSchema,
  canvasObservationEnvelopeSchema,
  canvasErrorEnvelopeSchema
])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts src/canvas/protocol/canvasMessages.test.ts`

Expected: PASS with `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/blocks/block.types.ts src/canvas/actions/canvasAction.types.ts src/canvas/actions/canvasAction.schema.ts src/canvas/actions/canvasAction.schema.test.ts src/canvas/protocol/canvasMessages.ts src/canvas/protocol/canvasMessages.test.ts
git commit -m "feat: add shared canvas schemas"
```

## Task 3: Build the block registry and adapter contract

**Files:**
- Create: `src/canvas/blocks/blockRegistry.ts`
- Create: `src/canvas/blocks/blockRegistry.test.ts`
- Create: `src/canvas/adapters/canvasAdapter.ts`
- Create: `src/canvas/adapters/TldrawAdapter.ts`
- Create: `src/canvas/adapters/TldrawAdapter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create these tests:

```ts
// src/canvas/blocks/blockRegistry.test.ts
import { describe, expect, it } from 'vitest'
import { blockRegistry } from './blockRegistry'

describe('blockRegistry', () => {
  it('returns defaults for supported block types', () => {
    expect(blockRegistry.task_card.defaultSize).toEqual({ w: 280, h: 160 })
    expect(blockRegistry.link_card.defaultProps).toEqual({ url: '' })
  })
})
```

```ts
// src/canvas/adapters/TldrawAdapter.test.ts
import { describe, expect, it } from 'vitest'
import { TldrawAdapter } from './TldrawAdapter'

const fakeEditor = {
  created: [] as unknown[],
  createShape(shape: unknown) {
    this.created.push(shape)
    return shape
  },
  updateShape() {},
  deleteShape() {},
  getCurrentPageShapes() {
    return []
  },
  getSelectedShapeIds() {
    return []
  },
  getViewportPageBounds() {
    return { x: 0, y: 0, w: 1200, h: 800 }
  },
  zoomToFit() {}
}

describe('TldrawAdapter', () => {
  it('creates a task card as a geo shape', () => {
    const adapter = new TldrawAdapter(fakeEditor as never, 'canvas_001')

    const result = adapter.createTaskCard({
      name: 'Design import modal',
      x: 100,
      y: 120,
      props: { status: 'todo' }
    })

    expect(result.block.type).toBe('task_card')
    expect(result.shapeIds).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/blocks/blockRegistry.test.ts src/canvas/adapters/TldrawAdapter.test.ts`

Expected: FAIL with missing module errors for the registry and adapter files.

- [ ] **Step 3: Write the minimal implementation**

Create these files:

```ts
// src/canvas/blocks/blockRegistry.ts
import type { CanvasBlockType } from './block.types'

type BlockDefinition = {
  label: string
  defaultSize: { w: number; h: number }
  defaultProps?: Record<string, unknown>
}

export const blockRegistry: Record<CanvasBlockType, BlockDefinition> = {
  text: {
    label: 'Text',
    defaultSize: { w: 200, h: 32 }
  },
  box: {
    label: 'Box',
    defaultSize: { w: 240, h: 140 }
  },
  note: {
    label: 'Note',
    defaultSize: { w: 240, h: 180 }
  },
  task_card: {
    label: 'Task Card',
    defaultSize: { w: 280, h: 160 },
    defaultProps: { status: 'todo', priority: 'medium' }
  },
  link_card: {
    label: 'Link Card',
    defaultSize: { w: 300, h: 120 },
    defaultProps: { url: '' }
  },
  file_card: {
    label: 'File Card',
    defaultSize: { w: 300, h: 120 }
  },
  job_panel: {
    label: 'Job Panel',
    defaultSize: { w: 360, h: 220 }
  }
}
```

```ts
// src/canvas/adapters/canvasAdapter.ts
import type { CanvasBlock, CanvasObservationState } from '../blocks/block.types'

export type AdapterCreateResult = {
  block: CanvasBlock
  shapeIds: string[]
}

export interface CanvasAdapter {
  readonly canvasId: string
  createText(input: { text: string; x: number; y: number; name?: string }): AdapterCreateResult
  createBox(input: { x: number; y: number; w?: number; h?: number; name?: string; text?: string }): AdapterCreateResult
  createNote(input: { x: number; y: number; text: string; name?: string }): AdapterCreateResult
  createTaskCard(input: { x: number; y: number; name: string; text?: string; props?: Record<string, unknown> }): AdapterCreateResult
  createLinkCard(input: { x: number; y: number; name: string; url: string; props?: Record<string, unknown> }): AdapterCreateResult
  createArrow(input: { fromBlockId: string; toBlockId: string; label?: string }): AdapterCreateResult
  updateText(input: { blockId: string; text: string }): CanvasBlock | null
  moveBlock(input: { blockId: string; x: number; y: number }): CanvasBlock | null
  deleteBlock(input: { blockId: string }): string[]
  getBlockById(blockId: string): CanvasBlock | null
  getBlockByName(name: string): CanvasBlock | null
  getCanvasState(): CanvasObservationState
  zoomToFit(): void
}
```

```ts
// src/canvas/adapters/TldrawAdapter.ts
import { blockRegistry } from '../blocks/blockRegistry'
import type { CanvasBlock, CanvasObservationState } from '../blocks/block.types'
import type { AdapterCreateResult, CanvasAdapter } from './canvasAdapter'

type EditorLike = {
  createShape(shape: Record<string, unknown>): unknown
  updateShape(shape: Record<string, unknown>): unknown
  deleteShape(shapeId: string): unknown
  getCurrentPageShapes(): Array<Record<string, unknown>>
  getSelectedShapeIds(): string[]
  getViewportPageBounds(): { x: number; y: number; w: number; h: number }
  zoomToFit(): void
}

export class TldrawAdapter implements CanvasAdapter {
  private readonly blocks = new Map<string, CanvasBlock>()
  private sequence = 0

  constructor(private readonly editor: EditorLike, public readonly canvasId: string) {}

  createText(input: { text: string; x: number; y: number; name?: string }): AdapterCreateResult {
    return this.createBlock('text', input)
  }

  createBox(input: { x: number; y: number; w?: number; h?: number; name?: string; text?: string }): AdapterCreateResult {
    return this.createBlock('box', input)
  }

  createNote(input: { x: number; y: number; text: string; name?: string }): AdapterCreateResult {
    return this.createBlock('note', input)
  }

  createTaskCard(input: { x: number; y: number; name: string; text?: string; props?: Record<string, unknown> }): AdapterCreateResult {
    return this.createBlock('task_card', input)
  }

  createLinkCard(input: { x: number; y: number; name: string; url: string; props?: Record<string, unknown> }): AdapterCreateResult {
    return this.createBlock('link_card', input)
  }

  createArrow(input: { fromBlockId: string; toBlockId: string; label?: string }): AdapterCreateResult {
    const blockId = this.nextId('block')
    const shapeId = this.nextId('shape')
    const block: CanvasBlock = {
      id: blockId,
      type: 'box',
      name: input.label,
      x: 0,
      y: 0,
      text: input.label,
      props: { fromBlockId: input.fromBlockId, toBlockId: input.toBlockId },
      shapeIds: [shapeId]
    }

    this.editor.createShape({ id: shapeId, type: 'arrow', props: input })
    this.blocks.set(blockId, block)
    return { block, shapeIds: [shapeId] }
  }

  updateText(input: { blockId: string; text: string }): CanvasBlock | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return null
    const next = { ...existing, text: input.text }
    this.blocks.set(input.blockId, next)
    this.editor.updateShape({ id: existing.shapeIds[0], props: { text: input.text } })
    return next
  }

  moveBlock(input: { blockId: string; x: number; y: number }): CanvasBlock | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return null
    const next = { ...existing, x: input.x, y: input.y }
    this.blocks.set(input.blockId, next)
    this.editor.updateShape({ id: existing.shapeIds[0], x: input.x, y: input.y })
    return next
  }

  deleteBlock(input: { blockId: string }): string[] {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return []
    existing.shapeIds.forEach((shapeId) => this.editor.deleteShape(shapeId))
    this.blocks.delete(input.blockId)
    return existing.shapeIds
  }

  getBlockById(blockId: string): CanvasBlock | null {
    return this.blocks.get(blockId) ?? null
  }

  getBlockByName(name: string): CanvasBlock | null {
    return [...this.blocks.values()].find((block) => block.name === name) ?? null
  }

  getCanvasState(): CanvasObservationState {
    return {
      canvasId: this.canvasId,
      selectedShapeIds: this.editor.getSelectedShapeIds(),
      viewport: this.editor.getViewportPageBounds(),
      blocks: [...this.blocks.values()]
    }
  }

  zoomToFit(): void {
    this.editor.zoomToFit()
  }

  private createBlock(
    type: CanvasBlock['type'],
    input: { x: number; y: number; name?: string; text?: string; props?: Record<string, unknown>; w?: number; h?: number }
  ): AdapterCreateResult {
    const definition = blockRegistry[type]
    const blockId = this.nextId('block')
    const shapeId = this.nextId('shape')
    const block: CanvasBlock = {
      id: blockId,
      type,
      name: input.name,
      x: input.x,
      y: input.y,
      w: input.w ?? definition.defaultSize.w,
      h: input.h ?? definition.defaultSize.h,
      text: input.text ?? input.name,
      props: { ...definition.defaultProps, ...input.props },
      shapeIds: [shapeId]
    }

    this.editor.createShape({
      id: shapeId,
      type: type === 'text' ? 'text' : 'geo',
      x: block.x,
      y: block.y,
      props: {
        text: block.text,
        w: block.w,
        h: block.h
      }
    })

    this.blocks.set(blockId, block)
    return { block, shapeIds: [shapeId] }
  }

  private nextId(prefix: 'block' | 'shape'): string {
    this.sequence += 1
    return `${prefix}_${this.sequence.toString().padStart(4, '0')}`
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/blocks/blockRegistry.test.ts src/canvas/adapters/TldrawAdapter.test.ts`

Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/blocks/blockRegistry.ts src/canvas/blocks/blockRegistry.test.ts src/canvas/adapters/canvasAdapter.ts src/canvas/adapters/TldrawAdapter.ts src/canvas/adapters/TldrawAdapter.test.ts
git commit -m "feat: add canvas block registry and adapter contract"
```

## Task 4: Implement the browser-side bridge runtime

**Files:**
- Create: `src/canvas/bridge/ActionExecutor.ts`
- Create: `src/canvas/bridge/StateObserver.ts`
- Create: `src/canvas/bridge/CanvasBridge.ts`
- Create: `src/canvas/bridge/CanvasBridge.test.ts`

- [ ] **Step 1: Write the failing tests**

Create this test file:

```ts
// src/canvas/bridge/CanvasBridge.test.ts
import { describe, expect, it } from 'vitest'
import { CanvasBridge } from './CanvasBridge'
import type { CanvasAdapter } from '../adapters/canvasAdapter'

function createFakeAdapter(): CanvasAdapter {
  let blockCounter = 0
  const blocks = new Map<string, any>()

  return {
    canvasId: 'canvas_001',
    createText(input) {
      blockCounter += 1
      const block = { id: `block_${blockCounter}`, type: 'text', x: input.x, y: input.y, text: input.text, shapeIds: [`shape_${blockCounter}`] }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createBox(input) {
      blockCounter += 1
      const block = { id: `block_${blockCounter}`, type: 'box', x: input.x, y: input.y, shapeIds: [`shape_${blockCounter}`] }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createNote(input) {
      blockCounter += 1
      const block = { id: `block_${blockCounter}`, type: 'note', x: input.x, y: input.y, text: input.text, shapeIds: [`shape_${blockCounter}`] }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createTaskCard(input) {
      blockCounter += 1
      const block = { id: `block_${blockCounter}`, type: 'task_card', name: input.name, x: input.x, y: input.y, shapeIds: [`shape_${blockCounter}`] }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createLinkCard(input) {
      blockCounter += 1
      const block = { id: `block_${blockCounter}`, type: 'link_card', name: input.name, x: input.x, y: input.y, shapeIds: [`shape_${blockCounter}`] }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createArrow(input) {
      blockCounter += 1
      const block = { id: `block_${blockCounter}`, type: 'box', name: input.label, x: 0, y: 0, shapeIds: [`shape_${blockCounter}`] }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    updateText({ blockId, text }) {
      const block = blocks.get(blockId)
      if (!block) return null
      const next = { ...block, text }
      blocks.set(blockId, next)
      return next
    },
    moveBlock({ blockId, x, y }) {
      const block = blocks.get(blockId)
      if (!block) return null
      const next = { ...block, x, y }
      blocks.set(blockId, next)
      return next
    },
    deleteBlock({ blockId }) {
      const block = blocks.get(blockId)
      if (!block) return []
      blocks.delete(blockId)
      return block.shapeIds
    },
    getBlockById(blockId) {
      return blocks.get(blockId) ?? null
    },
    getBlockByName(name) {
      return [...blocks.values()].find((block) => block.name === name) ?? null
    },
    getCanvasState() {
      return {
        canvasId: 'canvas_001',
        selectedShapeIds: [],
        viewport: { x: 0, y: 0, w: 1200, h: 800 },
        blocks: [...blocks.values()]
      }
    },
    zoomToFit() {}
  }
}

describe('CanvasBridge', () => {
  it('executes a create_text request and returns an observation', () => {
    const bridge = new CanvasBridge(createFakeAdapter())

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_001',
      canvasId: 'canvas_001',
      actions: [{ type: 'create_text', text: 'Hello from Hermes', x: 80, y: 120 }]
    })

    expect(response.result.ok).toBe(true)
    expect(response.result.results[0].createdBlockIds).toHaveLength(1)
    expect(response.observation.state.blocks[0].text).toBe('Hello from Hermes')
  })

  it('resolves get_block_by_name requests against the current canvas state', () => {
    const bridge = new CanvasBridge(createFakeAdapter())

    bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_seed',
      canvasId: 'canvas_001',
      actions: [{ type: 'create_task_card', name: 'Import Book Modal', x: 140, y: 220 }]
    })

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_lookup',
      canvasId: 'canvas_001',
      actions: [{ type: 'get_block_by_name', name: 'Import Book Modal' }]
    })

    expect(response.result.results[0].matchedBlockIds).toHaveLength(1)
    expect(response.observation.state.blocks[0].name).toBe('Import Book Modal')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/bridge/CanvasBridge.test.ts`

Expected: FAIL with `Cannot find module './CanvasBridge'`.

- [ ] **Step 3: Write the minimal implementation**

Create these files:

```ts
// src/canvas/bridge/ActionExecutor.ts
import type { CanvasAction } from '../actions/canvasAction.types'
import type { CanvasAdapter } from '../adapters/canvasAdapter'

export type ActionExecutionResult = {
  actionType: CanvasAction['type']
  createdBlockIds?: string[]
  updatedBlockIds?: string[]
  deletedBlockIds?: string[]
  createdShapeIds?: string[]
  matchedBlockIds?: string[]
  error?: string
}

export class ActionExecutor {
  constructor(private readonly adapter: CanvasAdapter) {}

  execute(action: CanvasAction): ActionExecutionResult {
    switch (action.type) {
      case 'create_text': {
        const created = this.adapter.createText(action)
        return { actionType: action.type, createdBlockIds: [created.block.id], createdShapeIds: created.shapeIds }
      }
      case 'create_box': {
        const created = this.adapter.createBox(action)
        return { actionType: action.type, createdBlockIds: [created.block.id], createdShapeIds: created.shapeIds }
      }
      case 'create_note': {
        const created = this.adapter.createNote(action)
        return { actionType: action.type, createdBlockIds: [created.block.id], createdShapeIds: created.shapeIds }
      }
      case 'create_task_card': {
        const created = this.adapter.createTaskCard(action)
        return { actionType: action.type, createdBlockIds: [created.block.id], createdShapeIds: created.shapeIds }
      }
      case 'create_link_card': {
        const created = this.adapter.createLinkCard(action)
        return { actionType: action.type, createdBlockIds: [created.block.id], createdShapeIds: created.shapeIds }
      }
      case 'create_arrow': {
        const created = this.adapter.createArrow(action)
        return { actionType: action.type, createdBlockIds: [created.block.id], createdShapeIds: created.shapeIds }
      }
      case 'update_text': {
        const updated = this.adapter.updateText(action)
        return updated
          ? { actionType: action.type, updatedBlockIds: [updated.id] }
          : { actionType: action.type, error: `Unknown block ${action.blockId}` }
      }
      case 'move_block': {
        const updated = this.adapter.moveBlock(action)
        return updated
          ? { actionType: action.type, updatedBlockIds: [updated.id] }
          : { actionType: action.type, error: `Unknown block ${action.blockId}` }
      }
      case 'delete_block': {
        const deletedShapeIds = this.adapter.deleteBlock(action)
        return deletedShapeIds.length > 0
          ? { actionType: action.type, deletedBlockIds: [action.blockId] }
          : { actionType: action.type, error: `Unknown block ${action.blockId}` }
      }
      case 'get_block_by_name': {
        const matched = this.adapter.getBlockByName(action.name)
        return matched
          ? { actionType: action.type, matchedBlockIds: [matched.id] }
          : { actionType: action.type, error: `Unknown block named ${action.name}` }
      }
      case 'read_canvas':
      case 'zoom_to_fit':
        if (action.type === 'zoom_to_fit') {
          this.adapter.zoomToFit()
        }
        return { actionType: action.type }
      default: {
        const exhaustive: never = action
        return exhaustive
      }
    }
  }
}
```

```ts
// src/canvas/bridge/StateObserver.ts
import type { CanvasObservationState } from '../blocks/block.types'
import type { CanvasAdapter } from '../adapters/canvasAdapter'

export class StateObserver {
  constructor(private readonly adapter: CanvasAdapter) {}

  read(): CanvasObservationState {
    return this.adapter.getCanvasState()
  }

  findBlockByName(name: string) {
    return this.adapter.getBlockByName(name)
  }

  findBlockById(blockId: string) {
    return this.adapter.getBlockById(blockId)
  }
}
```

```ts
// src/canvas/bridge/CanvasBridge.ts
import type { CanvasAdapter } from '../adapters/canvasAdapter'
import type { CanvasAction } from '../actions/canvasAction.types'
import type { CanvasObservationState } from '../blocks/block.types'
import { ActionExecutor, type ActionExecutionResult } from './ActionExecutor'
import { StateObserver } from './StateObserver'

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
    results: ActionExecutionResult[]
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
  private readonly executor: ActionExecutor
  private readonly observer: StateObserver

  constructor(private readonly adapter: CanvasAdapter) {
    this.executor = new ActionExecutor(adapter)
    this.observer = new StateObserver(adapter)
  }

  handleActionEnvelope(envelope: ActionEnvelope): BridgeResponse {
    const results = envelope.actions.map((action) => this.executor.execute(action))
    const ok = results.every((result) => !result.error)
    const observationState = this.observer.read()

    return {
      result: {
        type: 'canvas.result',
        requestId: envelope.requestId,
        ok,
        results
      },
      observation: {
        type: 'canvas.observation',
        requestId: envelope.requestId,
        canvasId: this.adapter.canvasId,
        state: observationState
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/bridge/CanvasBridge.test.ts`

Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/bridge/ActionExecutor.ts src/canvas/bridge/StateObserver.ts src/canvas/bridge/CanvasBridge.ts src/canvas/bridge/CanvasBridge.test.ts
git commit -m "feat: add browser-side canvas bridge runtime"
```

## Task 5: Wire the frontend canvas app to tldraw and WebSocket

**Files:**
- Create: `src/canvas/bridge/websocketClient.ts`
- Create: `src/canvas/state/bridgeStore.ts`
- Create: `src/canvas/components/CanvasSurface.tsx`
- Create: `src/canvas/components/CanvasSurface.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing test**

Create this test file:

```tsx
// src/canvas/components/CanvasSurface.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'

vi.mock('tldraw', () => ({
  Tldraw: ({ onMount }: { onMount(editor: unknown): void }) => {
    onMount({
      createShape() {},
      updateShape() {},
      deleteShape() {},
      getCurrentPageShapes() { return [] },
      getSelectedShapeIds() { return [] },
      getViewportPageBounds() { return { x: 0, y: 0, w: 1200, h: 800 } },
      zoomToFit() {}
    })
    return <div data-testid="tldraw-root">tldraw mounted</div>
  }
}))

describe('CanvasSurface', () => {
  it('renders the tldraw surface inside the app shell', () => {
    render(<App />)

    expect(screen.getByTestId('tldraw-root')).toBeInTheDocument()
    expect(screen.getByText('Bridge ready')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx`

Expected: FAIL because `App` still renders placeholder text and no tldraw surface.

- [ ] **Step 3: Write the minimal implementation**

Create these files and update `src/App.tsx`:

```ts
// src/canvas/bridge/websocketClient.ts
export type BridgeSocketHandlers = {
  onOpen(): void
  onClose(): void
  onError(error: Event): void
  onMessage(data: string): void
}

export class BridgeWebSocketClient {
  private socket: WebSocket | null = null

  connect(url: string, handlers: BridgeSocketHandlers) {
    this.socket = new WebSocket(url)
    this.socket.addEventListener('open', handlers.onOpen)
    this.socket.addEventListener('close', handlers.onClose)
    this.socket.addEventListener('error', handlers.onError)
    this.socket.addEventListener('message', (event) => handlers.onMessage(String(event.data)))
  }

  send(payload: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify(payload))
  }
}
```

```ts
// src/canvas/state/bridgeStore.ts
import { create } from 'zustand'
import type { CanvasObservationState } from '../blocks/block.types'
import type { CanvasBridge } from '../bridge/CanvasBridge'

type BridgeStatus = 'disconnected' | 'ready' | 'error'

type BridgeStore = {
  bridge: CanvasBridge | null
  status: BridgeStatus
  lastObservation: CanvasObservationState | null
  setBridge(bridge: CanvasBridge): void
  setStatus(status: BridgeStatus): void
  setObservation(state: CanvasObservationState): void
}

export const useBridgeStore = create<BridgeStore>((set) => ({
  bridge: null,
  status: 'disconnected',
  lastObservation: null,
  setBridge: (bridge) => set({ bridge, status: 'ready' }),
  setStatus: (status) => set({ status }),
  setObservation: (lastObservation) => set({ lastObservation })
}))
```

```tsx
// src/canvas/components/CanvasSurface.tsx
import { Tldraw } from 'tldraw'
import { useEffect } from 'react'
import { TldrawAdapter } from '../adapters/TldrawAdapter'
import { CanvasBridge } from '../bridge/CanvasBridge'
import { BridgeWebSocketClient } from '../bridge/websocketClient'
import { useBridgeStore } from '../state/bridgeStore'

const socket = new BridgeWebSocketClient()

export function CanvasSurface() {
  const bridge = useBridgeStore((state) => state.bridge)
  const setBridge = useBridgeStore((state) => state.setBridge)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const setStatus = useBridgeStore((state) => state.setStatus)

  useEffect(() => {
    if (!bridge) return

    socket.connect('ws://localhost:8787/canvas/canvas_001', {
      onOpen() {
        setStatus('ready')
        socket.send({
          type: 'canvas.ready',
          canvasId: 'canvas_001',
          roomId: 'room_001'
        })
      },
      onClose() {
        setStatus('disconnected')
      },
      onError() {
        setStatus('error')
      },
      onMessage(data) {
        const payload = JSON.parse(data)
        if (payload.type === 'canvas.action') {
          const response = bridge.handleActionEnvelope(payload)
          setObservation(response.observation.state)
          socket.send(response.result)
          socket.send(response.observation)
        }
      }
    })
  }, [bridge, setObservation, setStatus])

  return (
    <Tldraw
      persistenceKey="hermes-canvas"
      onMount={(editor) => {
        setBridge(new CanvasBridge(new TldrawAdapter(editor as never, 'canvas_001')))
      }}
    />
  )
}
```

```tsx
// src/App.tsx
import { CanvasSurface } from './canvas/components/CanvasSurface'
import { useBridgeStore } from './canvas/state/bridgeStore'

const statusCopy = {
  disconnected: 'Bridge disconnected',
  ready: 'Bridge ready',
  error: 'Bridge error'
} as const

export default function App() {
  const status = useBridgeStore((state) => state.status)

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Hermes Canvas Bridge</p>
          <h1>Canvas for Hermes</h1>
        </div>
        <p className="status-pill">{statusCopy[status]}</p>
      </header>

      <section className="canvas-panel">
        <CanvasSurface />
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx src/App.test.tsx`

Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/bridge/websocketClient.ts src/canvas/state/bridgeStore.ts src/canvas/components/CanvasSurface.tsx src/canvas/components/CanvasSurface.test.tsx src/App.tsx
git commit -m "feat: mount canvas surface and websocket bridge"
```

## Task 6: Add the WebSocket gateway and Hermes-facing tool helper

**Files:**
- Create: `server/canvas/roomManager.ts`
- Create: `server/canvas/canvasGateway.ts`
- Create: `server/canvas/hermesCanvasTool.ts`
- Create: `server/canvas/canvasGateway.test.ts`
- Create: `server/index.ts`

- [ ] **Step 1: Write the failing test**

Create this test file:

```ts
// server/canvas/canvasGateway.test.ts
import { describe, expect, it } from 'vitest'
import { RoomManager } from './roomManager'
import { createHermesCanvasToolPayload } from './hermesCanvasTool'

describe('RoomManager', () => {
  it('creates stable room records by canvas id', () => {
    const rooms = new RoomManager()

    const roomA = rooms.getOrCreate('canvas_001')
    const roomB = rooms.getOrCreate('canvas_001')

    expect(roomA).toBe(roomB)
  })
})

describe('createHermesCanvasToolPayload', () => {
  it('builds a canvas.action envelope', () => {
    const payload = createHermesCanvasToolPayload('canvas_001', [{ type: 'read_canvas' }])

    expect(payload.type).toBe('canvas.action')
    expect(payload.canvasId).toBe('canvas_001')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- server/canvas/canvasGateway.test.ts`

Expected: FAIL with missing module errors for the gateway files.

- [ ] **Step 3: Write the minimal implementation**

Create these files:

```ts
// server/canvas/roomManager.ts
type RoomConnection = {
  bridge?: { send(data: string): void }
  hermes?: { send(data: string): void }
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomConnection>()

  getOrCreate(canvasId: string): RoomConnection {
    const existing = this.rooms.get(canvasId)
    if (existing) return existing
    const created: RoomConnection = {}
    this.rooms.set(canvasId, created)
    return created
  }

  attachBridge(canvasId: string, socket: { send(data: string): void }) {
    this.getOrCreate(canvasId).bridge = socket
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

```ts
// server/canvas/hermesCanvasTool.ts
import type { CanvasAction } from '../../src/canvas/actions/canvasAction.types'

export function createHermesCanvasToolPayload(canvasId: string, actions: CanvasAction[]) {
  return {
    type: 'canvas.action' as const,
    requestId: `req_${Date.now()}`,
    canvasId,
    actions
  }
}
```

```ts
// server/canvas/canvasGateway.ts
import { WebSocketServer, type WebSocket } from 'ws'
import { RoomManager } from './roomManager'

export function createCanvasGateway(port = 8787) {
  const rooms = new RoomManager()
  const wss = new WebSocketServer({ port, path: '/canvas' })

  wss.on('connection', (socket: WebSocket, request) => {
    const url = new URL(request.url ?? '/canvas?canvasId=canvas_001', 'http://localhost')
    const canvasId = url.searchParams.get('canvasId') ?? 'canvas_001'
    const role = url.searchParams.get('role') ?? 'bridge'

    if (role === 'bridge') {
      rooms.attachBridge(canvasId, socket)
    } else {
      rooms.attachHermes(canvasId, socket)
    }

    socket.on('message', (raw) => {
      const payload = String(raw)
      if (role === 'bridge') {
        rooms.forwardToHermes(canvasId, payload)
      } else {
        rooms.forwardToBridge(canvasId, payload)
      }
    })
  })

  return { wss, rooms }
}
```

```ts
// server/index.ts
import { createCanvasGateway } from './canvas/canvasGateway'

const { wss } = createCanvasGateway(8787)

console.log(`Canvas gateway listening on ws://localhost:8787/canvas`)

process.on('SIGINT', () => {
  wss.close(() => process.exit(0))
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- server/canvas/canvasGateway.test.ts`

Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add server/canvas/roomManager.ts server/canvas/canvasGateway.ts server/canvas/hermesCanvasTool.ts server/canvas/canvasGateway.test.ts server/index.ts
git commit -m "feat: add canvas websocket gateway"
```

## Task 7: Close the loop with protocol hardening, integration coverage, and docs

**Files:**
- Modify: `src/canvas/bridge/CanvasBridge.ts`
- Modify: `src/canvas/components/CanvasSurface.tsx`
- Modify: `server/canvas/canvasGateway.ts`
- Create: `server/canvas/canvasGateway.integration.test.ts`
- Create: `README.md`

- [ ] **Step 1: Write the failing integration test**

Create this test file:

```ts
// server/canvas/canvasGateway.integration.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { createCanvasGateway } from './canvasGateway'
import { createHermesCanvasToolPayload } from './hermesCanvasTool'

describe('canvas gateway integration', () => {
  const instances: Array<{ wss: { close(callback: () => void): void } }> = []

  afterEach(async () => {
    await Promise.all(
      instances.map(
        (instance) =>
          new Promise<void>((resolve) => {
            instance.wss.close(() => resolve())
          })
      )
    )
  })

  it('forwards Hermes actions to the connected bridge client', async () => {
    const gateway = createCanvasGateway(8790)
    instances.push(gateway)

    const bridgeClient = new WebSocket('ws://localhost:8790/canvas?canvasId=canvas_001&role=bridge')
    const hermesClient = new WebSocket('ws://localhost:8790/canvas?canvasId=canvas_001&role=hermes')

    const received = await new Promise<string>((resolve) => {
      bridgeClient.addEventListener('message', (event) => resolve(String(event.data)))
      hermesClient.addEventListener('open', () => {
        hermesClient.send(JSON.stringify(createHermesCanvasToolPayload('canvas_001', [{ type: 'read_canvas' }])))
      })
    })

    expect(JSON.parse(received).type).toBe('canvas.action')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- server/canvas/canvasGateway.integration.test.ts`

Expected: FAIL because the gateway path/query handling is too brittle or the bridge connection does not receive the forwarded action yet.

- [ ] **Step 3: Write the minimal implementation**

Update these files:

```ts
// server/canvas/canvasGateway.ts
import { WebSocketServer, type WebSocket } from 'ws'
import { canvasToHermesEnvelopeSchema, hermesToCanvasEnvelopeSchema } from '../../src/canvas/protocol/canvasMessages'
import { RoomManager } from './roomManager'

export function createCanvasGateway(port = 8787) {
  const rooms = new RoomManager()
  const wss = new WebSocketServer({ port })

  wss.on('connection', (socket: WebSocket, request) => {
    const url = new URL(request.url ?? '/canvas?canvasId=canvas_001&role=bridge', 'http://localhost')
    if (url.pathname !== '/canvas') {
      socket.close()
      return
    }

    const canvasId = url.searchParams.get('canvasId') ?? 'canvas_001'
    const role = url.searchParams.get('role') ?? 'bridge'

    if (role === 'bridge') {
      rooms.attachBridge(canvasId, socket)
    } else {
      rooms.attachHermes(canvasId, socket)
    }

    socket.on('message', (raw) => {
      const payload = String(raw)
      const parsed = JSON.parse(payload)

      if (role === 'hermes') {
        hermesToCanvasEnvelopeSchema.parse(parsed)
        rooms.forwardToBridge(canvasId, payload)
        return
      }

      canvasToHermesEnvelopeSchema.parse(parsed)
      rooms.forwardToHermes(canvasId, payload)
    })
  })

  return { wss, rooms }
}
```

```ts
// src/canvas/bridge/CanvasBridge.ts
import { canvasActionEnvelopeSchema } from '../protocol/canvasMessages'
import type { CanvasAdapter } from '../adapters/canvasAdapter'
import type { CanvasAction } from '../actions/canvasAction.types'
import type { CanvasObservationState } from '../blocks/block.types'
import { ActionExecutor, type ActionExecutionResult } from './ActionExecutor'
import { StateObserver } from './StateObserver'

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
    results: ActionExecutionResult[]
  }
  observation: {
    type: 'canvas.observation'
    requestId: string
    canvasId: string
    state: CanvasObservationState
  }
}

export class CanvasBridge {
  private readonly executor: ActionExecutor
  private readonly observer: StateObserver

  constructor(private readonly adapter: CanvasAdapter) {
    this.executor = new ActionExecutor(adapter)
    this.observer = new StateObserver(adapter)
  }

  handleActionEnvelope(envelope: ActionEnvelope): BridgeResponse | BridgeErrorResponse {
    try {
      const validated = canvasActionEnvelopeSchema.parse(envelope)
      const results = validated.actions.map((action) => this.executor.execute(action))
      const ok = results.every((result) => !result.error)
      const observationState = this.observer.read()

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
          canvasId: this.adapter.canvasId,
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

```tsx
// src/canvas/components/CanvasSurface.tsx
import { Tldraw } from 'tldraw'
import { useEffect } from 'react'
import { canvasActionEnvelopeSchema, canvasErrorEnvelopeSchema, canvasObservationEnvelopeSchema, canvasResultEnvelopeSchema } from '../protocol/canvasMessages'
import { TldrawAdapter } from '../adapters/TldrawAdapter'
import { CanvasBridge } from '../bridge/CanvasBridge'
import { BridgeWebSocketClient } from '../bridge/websocketClient'
import { useBridgeStore } from '../state/bridgeStore'

const socket = new BridgeWebSocketClient()

export function CanvasSurface() {
  const bridge = useBridgeStore((state) => state.bridge)
  const setBridge = useBridgeStore((state) => state.setBridge)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const setStatus = useBridgeStore((state) => state.setStatus)

  useEffect(() => {
    if (!bridge) return

    socket.connect('ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge', {
      onOpen() {
        setStatus('ready')
        socket.send({
          type: 'canvas.ready',
          canvasId: 'canvas_001',
          roomId: 'room_001'
        })
      },
      onClose() {
        setStatus('disconnected')
      },
      onError() {
        setStatus('error')
      },
      onMessage(data) {
        const payload = JSON.parse(data)

        if (payload.type === 'canvas.action') {
          const validated = canvasActionEnvelopeSchema.parse(payload)
          const response = bridge.handleActionEnvelope(validated)
          if ('error' in response) {
            socket.send(response.error)
            return
          }
          setObservation(response.observation.state)
          socket.send(response.result)
          socket.send(response.observation)
          return
        }

        if (payload.type === 'canvas.result') {
          canvasResultEnvelopeSchema.parse(payload)
          return
        }

        if (payload.type === 'canvas.observation') {
          const observation = canvasObservationEnvelopeSchema.parse(payload)
          setObservation(observation.state)
          return
        }

        if (payload.type === 'canvas.error') {
          canvasErrorEnvelopeSchema.parse(payload)
          setStatus('error')
        }
      }
    })
  }, [bridge, setObservation, setStatus])

  return (
    <Tldraw
      persistenceKey="hermes-canvas"
      onMount={(editor) => {
        setBridge(new CanvasBridge(new TldrawAdapter(editor as never, 'canvas_001')))
      }}
    />
  )
}
```

```md
<!-- README.md -->
# Canvas for Hermes

Hermes sends validated `canvas.action` messages to a browser-resident Canvas Bridge. The bridge applies those actions to a tldraw canvas and replies with `canvas.result` and `canvas.observation`.

## Local development

1. Install dependencies: `npm install`
2. Start the gateway: `npm run server`
3. Start the frontend: `npm run dev`
4. Run tests: `npm test`

## MVP message flow

1. The browser sends `canvas.ready` to `ws://localhost:8787/canvas?canvasId=canvas_001&role=bridge` when the canvas is mounted.
2. Hermes sends a `canvas.action` envelope to `ws://localhost:8787/canvas?canvasId=canvas_001&role=hermes`.
3. The gateway forwards the action to the active bridge client for that canvas.
4. The browser validates the action, executes it through `CanvasBridge`, and returns either `canvas.error` or the `canvas.result` plus `canvas.observation` pair.
5. The gateway forwards the bridge response back to the Hermes client.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- server/canvas/canvasGateway.integration.test.ts src/canvas/bridge/CanvasBridge.test.ts`

Expected: PASS with the bridge action path and gateway forwarding verified.

- [ ] **Step 5: Commit**

```bash
git add server/canvas/canvasGateway.ts server/canvas/canvasGateway.integration.test.ts src/canvas/bridge/CanvasBridge.ts src/canvas/components/CanvasSurface.tsx README.md
git commit -m "feat: close the loop between hermes and canvas bridge"
```

## Self-Review

### Spec coverage

- Overview, goals, and non-goals: Covered by Tasks 2 through 7, with all Hermes interactions routed through schemas, bridge classes, and the `TldrawAdapter` boundary.
- High-level architecture: Mapped directly to `src/canvas/**/*` and `server/canvas/**/*`.
- Canvas Web responsibilities: Covered by Task 5.
- Hermes Canvas Tool responsibilities: Covered by Task 6 via `server/canvas/hermesCanvasTool.ts`.
- Canvas Bridge executor and observer: Covered by Task 4.
- Action schema and `canvas.error`: Covered by Task 2 protocol definitions and made executable in Task 7 through explicit `canvas.error` responses from `CanvasBridge`.
- Observation schema: Covered by Task 2 and returned in Task 4 and Task 7.
- Tldraw Adapter isolation: Covered by Task 3 and consumed everywhere else through the `CanvasAdapter` interface.
- Core user flows: Create, read, update, connect, move, delete, zoom, and get-by-name actions are all represented in the action union and executor.
- MVP features: All listed action types and observation fields are represented in the planned types and tests.

### Placeholder scan

- No `TODO`, `TBD`, or deferred implementation markers remain in tasks.
- Every code-writing step includes concrete file content.
- Every test step includes exact commands and expected outcomes.

### Type consistency

- `CanvasAction` names match the schema discriminators and the protocol envelopes.
- `CanvasObservationState` is the single observation payload shape across adapter, observer, bridge, and protocol modules.
- `CanvasAdapter` method names match `ActionExecutor` dispatch branches.
- `canvas.ready`, `canvas.action`, `canvas.result`, `canvas.observation`, and `canvas.error` are used consistently across frontend and backend tasks.
