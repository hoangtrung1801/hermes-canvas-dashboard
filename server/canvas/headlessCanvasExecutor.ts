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

type ActionEnvelope = {
  type: 'canvas.action'
  requestId: string
  canvasId: string
  actions: CanvasAction[]
}

type CanvasPersistenceSnapshot = {
  version: 1
  canvasId: string
  elements: ExcalidrawElementLike[]
  adapter: ReturnType<ExcalidrawAdapter['exportSnapshot']>
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
  elements: readonly ExcalidrawElementLike[]
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
