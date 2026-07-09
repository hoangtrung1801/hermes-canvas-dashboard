import type { TLRecord } from '@tldraw/tlschema'
import { ZERO_INDEX_KEY, getIndicesAbove, type IndexKey } from '@tldraw/utils'
import { CanvasBridge } from '../../src/canvas/bridge/CanvasBridge'
import type { CanvasObservationState } from '../../src/canvas/tldraw/tldrawObservation'
import {
  createMemoryTldrawTarget,
  type ShapeRecord,
  type TldrawActionResult,
  type TldrawExecutorTarget
} from '../../src/canvas/tldraw/tldrawActionExecutor'
import type { TldrawSyncRoomManager } from './tldrawSyncServer'

type ActionEnvelope = {
  type: 'canvas.action'
  requestId: string
  canvasId: string
  actions: unknown[]
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

type PersistedShapeRecord = ShapeRecord & {
  parentId: string
  index: IndexKey
  rotation: number
  isLocked: boolean
  opacity: number
}

export async function executeHeadlessTldrawAction(
  manager: TldrawSyncRoomManager,
  envelope: ActionEnvelope
): Promise<HeadlessResponse[]> {
  try {
    const room = manager.getOrCreateRoom(envelope.canvasId)
    const target = createTargetFromRoom(envelope.canvasId, room.getCurrentSnapshot().documents)
    const bridge = new CanvasBridge(target as TldrawExecutorTarget)
    const response = bridge.handleActionEnvelope(envelope as never)

    if ('error' in response) {
      return [response.error]
    }

    await commitTargetToRoom(room, target)
    return [response.result, response.observation]
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

function createTargetFromRoom(
  canvasId: string,
  documents: Array<{ state: unknown }>
): TldrawExecutorTarget & {
  persistedShapes: Map<string, PersistedShapeRecord>
} {
  const target = createMemoryTldrawTarget(canvasId) as TldrawExecutorTarget & {
    persistedShapes: Map<string, PersistedShapeRecord>
  }
  target.persistedShapes = new Map()

  const page = documents.find((entry) => isRecord(entry.state) && entry.state.typeName === 'page')
  if (isRecord(page?.state) && typeof page.state.id === 'string') {
    target.pageId = page.state.id
  }

  for (const entry of documents) {
    if (!isPersistedShapeRecord(entry.state)) continue
    target.shapes.set(entry.state.id, entry.state)
    target.persistedShapes.set(entry.state.id, entry.state)
  }

  return target
}

async function commitTargetToRoom(
  room: ReturnType<TldrawSyncRoomManager['getOrCreateRoom']>,
  target: TldrawExecutorTarget & { persistedShapes: Map<string, PersistedShapeRecord> }
): Promise<void> {
  const shapeRecords = [...target.shapes.values()]
  const nextIndexByShapeId = createNextIndexByShapeId(shapeRecords, target.persistedShapes)

  await room.updateStore((store) => {
    for (const previousId of target.persistedShapes.keys()) {
      if (!target.shapes.has(previousId)) {
        store.delete(previousId)
      }
    }

    shapeRecords.forEach((shape) => {
      store.put(toTlShapeRecord(shape, target.persistedShapes.get(shape.id), target.pageId, nextIndexByShapeId))
    })
  })
}

function createNextIndexByShapeId(
  shapeRecords: ShapeRecord[],
  persistedShapes: Map<string, PersistedShapeRecord>
): Map<string, IndexKey> {
  const highestExistingIndex =
    shapeRecords.reduce<IndexKey | undefined>((highest, shape) => {
      const existingIndex = persistedShapes.get(shape.id)?.index
      if (!existingIndex) return highest
      return !highest || existingIndex > highest ? existingIndex : highest
    }, undefined) ?? ZERO_INDEX_KEY

  const createdShapeIds = shapeRecords
    .filter((shape) => !persistedShapes.has(shape.id))
    .map((shape) => shape.id)

  const createdIndices = getIndicesAbove(highestExistingIndex, createdShapeIds.length)
  return new Map(createdShapeIds.map((shapeId, index) => [shapeId, createdIndices[index]]))
}

function toTlShapeRecord(
  shape: ShapeRecord,
  existing: PersistedShapeRecord | undefined,
  pageId: string,
  nextIndexByShapeId: Map<string, IndexKey>
): TLRecord {
  return {
    typeName: 'shape',
    id: shape.id,
    type: shape.type,
    x: shape.x,
    y: shape.y,
    rotation: existing?.rotation ?? 0,
    parentId: existing?.parentId ?? pageId,
    index: existing?.index ?? nextIndexByShapeId.get(shape.id) ?? ZERO_INDEX_KEY,
    isLocked: existing?.isLocked ?? false,
    opacity: existing?.opacity ?? 1,
    props: shape.props,
    meta: shape.meta
  } as unknown as TLRecord
}

function isPersistedShapeRecord(value: unknown): value is PersistedShapeRecord & TLRecord {
  if (!isRecord(value)) return false
  if (value.typeName !== 'shape') return false

  const record = value
  return (
    typeof record.id === 'string' &&
    typeof record.type === 'string' &&
    typeof record.x === 'number' &&
    typeof record.y === 'number' &&
    typeof record.parentId === 'string' &&
    typeof record.index === 'string' &&
    typeof record.rotation === 'number' &&
    typeof record.isLocked === 'boolean' &&
    typeof record.opacity === 'number' &&
    !!record.props &&
    typeof record.props === 'object' &&
    !!record.meta &&
    typeof record.meta === 'object'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}
