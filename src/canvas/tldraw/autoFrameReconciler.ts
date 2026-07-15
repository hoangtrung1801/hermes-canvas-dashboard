import type { Editor } from 'tldraw'
import type { CanvasObservationState } from '../blocks/block.types'
import {
  AUTO_FRAME_META_KEY,
  getAutoFrameCardKind,
  planAutoFrameLayout,
  readAutoFrameKind,
  type AutoFrameLayoutShape,
  type AutoFrameMode,
  type PlannedFrame
} from './autoFrameLayout'
import {
  readTldrawObservation,
  type TldrawExecutorTarget
} from './tldrawActionExecutor'

export type AutoFrameReconcileResult = {
  cardCount: number
  frameCount: number
  changed: boolean
  createdFrameCount: number
  deletedFrameCount: number
  error?: string
}

type StoreRecordLike = {
  id: string
  typeName?: string
  type?: string
  parentId?: string
  x?: number
  y?: number
  props?: Record<string, unknown>
  meta?: Record<string, unknown>
}

type StoreChangeEntry = {
  changes: {
    added: Record<string, StoreRecordLike>
    updated: Record<string, [StoreRecordLike, StoreRecordLike]>
    removed: Record<string, StoreRecordLike>
  }
}

const applyingEditors = new WeakSet<object>()

function editorSnapshot(editor: Editor): AutoFrameLayoutShape[] {
  return editor.getCurrentPageShapesSorted().map((shape) => {
    const bounds = editor.getShapePageBounds(shape.id)
    return {
      id: String(shape.id),
      type: shape.type,
      parentId: String(shape.parentId),
      x: shape.x,
      y: shape.y,
      pageX: bounds?.x ?? shape.x,
      pageY: bounds?.y ?? shape.y,
      props: shape.props as Record<string, unknown>,
      meta: shape.meta as Record<string, unknown>
    }
  })
}

function sameMeta(a: Record<string, unknown>, b: Record<string, unknown>) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function framePatch(frame: PlannedFrame, current: AutoFrameLayoutShape) {
  const props = current.props
  const unchanged =
    current.x === frame.x &&
    current.y === frame.y &&
    props.w === frame.w &&
    props.h === frame.h &&
    props.name === frame.title &&
    props.color === frame.color &&
    sameMeta(current.meta, frame.meta)

  return unchanged
    ? null
    : {
        id: frame.id,
        type: 'frame',
        x: frame.x,
        y: frame.y,
        props: { w: frame.w, h: frame.h, name: frame.title, color: frame.color },
        meta: frame.meta
      }
}

function syncAdapterFromEditor(editor: Editor, adapter: TldrawExecutorTarget) {
  adapter.pageId = String(editor.getCurrentPageId())
  adapter.shapes.clear()
  for (const shape of editor.getCurrentPageShapesSorted()) {
    adapter.shapes.set(String(shape.id), {
      id: String(shape.id),
      type: shape.type,
      parentId: String(shape.parentId),
      x: shape.x,
      y: shape.y,
      props: shape.props as Record<string, unknown>,
      meta: shape.meta as Record<string, unknown>
    })
  }
}

function countManagedCards(pageId: string, shapes: AutoFrameLayoutShape[]) {
  const managedFrameIds = new Set(
    shapes
      .filter((shape) => shape.type === 'frame' && readAutoFrameKind(shape.meta) !== null)
      .map((shape) => shape.id)
  )
  return shapes.filter(
    (shape) =>
      getAutoFrameCardKind(shape) !== null &&
      (shape.parentId === pageId || managedFrameIds.has(shape.parentId))
  ).length
}

export function reconcileAutoFrames(options: {
  editor: Editor
  adapter: TldrawExecutorTarget
  mode?: AutoFrameMode
  setObservation?: (state: CanvasObservationState) => void
  addLog?: (direction: 'info' | 'error', type: string, payload: unknown) => void
}): AutoFrameReconcileResult {
  const { editor, adapter, setObservation, addLog } = options
  const mode = options.mode ?? 'continuous'
  const pageId = String(editor.getCurrentPageId())
  const before = editorSnapshot(editor)
  const cardCount = countManagedCards(pageId, before)

  if (applyingEditors.has(editor)) {
    return { cardCount, frameCount: 0, changed: false, createdFrameCount: 0, deletedFrameCount: 0 }
  }

  const plan = planAutoFrameLayout({ pageId, shapes: before, mode })
  const byId = new Map(before.map((shape) => [shape.id, shape]))
  const createFrames = plan.frames.filter((frame) => frame.create)
  const frameUpdates = plan.frames.flatMap((frame) => {
    const current = byId.get(frame.id)
    if (!current || frame.create) return []
    const patch = framePatch(frame, current)
    return patch ? [patch] : []
  })
  const shapeUpdates = [...frameUpdates, ...plan.cardUpdates]
  const changed =
    createFrames.length > 0 ||
    shapeUpdates.length > 0 ||
    plan.deleteFrameIds.length > 0 ||
    plan.demoteFrameIds.length > 0

  if (!changed) {
    syncAdapterFromEditor(editor, adapter)
    setObservation?.(readTldrawObservation(adapter))
    return {
      cardCount,
      frameCount: plan.frames.length,
      changed: false,
      createdFrameCount: 0,
      deletedFrameCount: 0
    }
  }

  try {
    applyingEditors.add(editor)
    editor.run(() => {
      if (createFrames.length > 0) {
        editor.createShapes(createFrames.map((frame) => ({
          id: frame.id as any,
          type: 'frame' as const,
          parentId: pageId as any,
          x: frame.x,
          y: frame.y,
          props: { w: frame.w, h: frame.h, name: frame.title, color: frame.color as any },
          meta: frame.meta
        })) as any)
      }
      if (shapeUpdates.length > 0) editor.updateShapes(shapeUpdates as any)
      for (const frameId of plan.demoteFrameIds) {
        ;(editor.store as any).update(frameId, (record: StoreRecordLike) => {
          const meta = { ...(record.meta ?? {}) }
          delete meta[AUTO_FRAME_META_KEY]
          return { ...record, meta }
        })
      }
      if (plan.deleteFrameIds.length > 0) editor.deleteShapes(plan.deleteFrameIds as any)
    }, { history: mode === 'continuous' ? 'ignore' : 'record' })
    syncAdapterFromEditor(editor, adapter)
    setObservation?.(readTldrawObservation(adapter))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    addLog?.('error', 'canvas.auto_frame_failed', message)
    return {
      cardCount,
      frameCount: plan.frames.length,
      changed: false,
      createdFrameCount: 0,
      deletedFrameCount: 0,
      error: message
    }
  } finally {
    applyingEditors.delete(editor)
  }

  return {
    cardCount,
    frameCount: plan.frames.length,
    changed: true,
    createdFrameCount: createFrames.length,
    deletedFrameCount: plan.deleteFrameIds.length
  }
}

function isRelevantRecord(record: StoreRecordLike | undefined) {
  if (!record || record.typeName !== 'shape' || !record.type) return false
  const shape = {
    type: record.type,
    props: record.props ?? {}
  } as Pick<AutoFrameLayoutShape, 'type' | 'props'>
  if (getAutoFrameCardKind(shape) !== null) return true
  return record.type === 'frame' && readAutoFrameKind(record.meta ?? {}) !== null
}

export function isAutoFrameRelevantChange(entry: StoreChangeEntry) {
  if (Object.values(entry.changes.added).some(isRelevantRecord)) return true
  if (Object.values(entry.changes.removed).some(isRelevantRecord)) return true
  return Object.values(entry.changes.updated)
    .some(([before, after]) => isRelevantRecord(before) || isRelevantRecord(after))
}

function restoreCardsRemovedWithManagedFrame(editor: Editor, entry: StoreChangeEntry) {
  const removed = Object.values(entry.changes.removed)
  const removedFrameIds = new Set(
    removed
      .filter(
        (record) =>
          record.typeName === 'shape' &&
          record.type === 'frame' &&
          readAutoFrameKind(record.meta ?? {}) !== null
      )
      .map((record) => record.id)
  )
  if (removedFrameIds.size === 0) return false

  const removedFrames = new Map(
    removed
      .filter((record) => removedFrameIds.has(record.id))
      .map((record) => [record.id, record])
  )
  const existingIds = new Set(editor.getCurrentPageShapesSorted().map((shape) => String(shape.id)))
  const cards = removed.filter((record) => {
    if (!record.type || !record.parentId || !removedFrameIds.has(record.parentId)) return false
    if (existingIds.has(record.id)) return false
    return getAutoFrameCardKind({ type: record.type, props: record.props ?? {} }) !== null
  })
  if (cards.length === 0) return false

  applyingEditors.add(editor)
  try {
    editor.run(() => {
      editor.createShapes(cards.map((card) => {
        const parent = removedFrames.get(card.parentId!)!
        return {
          id: card.id as any,
          type: card.type as any,
          parentId: editor.getCurrentPageId(),
          x: numberOr(card.x) + numberOr(parent.x),
          y: numberOr(card.y) + numberOr(parent.y),
          props: card.props ?? {},
          meta: card.meta ?? {}
        }
      }) as any)
    }, { history: 'ignore' })
  } finally {
    applyingEditors.delete(editor)
  }
  return true
}

function numberOr(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function subscribeToAutoFrameChanges(options: {
  editor: Editor
  reconcile: () => void
  debounceMs?: number
}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = options.editor.store.listen((entry) => {
    if (applyingEditors.has(options.editor)) return
    const typedEntry = entry as unknown as StoreChangeEntry
    const restoredCards = restoreCardsRemovedWithManagedFrame(options.editor, typedEntry)
    if (!restoredCards && !isAutoFrameRelevantChange(typedEntry)) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      options.reconcile()
    }, restoredCards ? 0 : options.debounceMs ?? 80)
  }, { source: 'all', scope: 'document' })

  return () => {
    if (timer) clearTimeout(timer)
    stop()
  }
}
