import { b64Vecs, toRichText } from '@tldraw/tlschema'
import { getIndices } from '@tldraw/utils'
import type { Editor } from 'tldraw'
import type { CanvasAction } from '../actions/canvasAction.types'
import {
  LINK_CARD_TYPE,
  TODO_BLOCK_TYPE,
  createLinkCardProps,
  createTodoBlockProps,
  type TodoTask
} from './customShape.types'
import {
  createCanvasObservationFromRecords,
  type CanvasObservationState
} from './tldrawObservation'
import { createNoteCardProps } from './nativeNoteCard'
import {
  DOCS_CARD_TYPE,
  createDocsCardProps
} from './docsCard.types'
import {
  PROJECT_CARD_TYPE,
  appendProjectTask,
  createProjectCardProps,
  moveProjectTask,
  removeProjectTask,
  updateProjectTaskText,
  type ProjectTask
} from './projectCard.types'

export type TldrawActionResult = {
  actionType: CanvasAction['type']
  createdShapeIds?: string[]
  updatedShapeIds?: string[]
  deletedShapeIds?: string[]
  createdBindingIds?: string[]
  deletedBindingIds?: string[]
  error?: string
}

export type ShapeRecord = {
  id: string
  type: string
  parentId?: string
  x: number
  y: number
  rotation: number
  opacity: number
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
    case 'create_shape':
      return createShape(target, {
        id: action.shape.id ?? nextShapeId(target, action.shape.type),
        type: action.shape.type,
        x: action.shape.x ?? 0,
        y: action.shape.y ?? 0,
        rotation: action.shape.rotation ?? 0,
        opacity: action.shape.opacity ?? 1,
        props: withBuiltinDefaults(action.shape.type, action.shape.props ?? {}),
        meta: action.shape.meta ?? {},
        actionType: action.type
      })
    case 'create_todo_block':
      return createShape(target, {
        id: action.id ?? nextShapeId(target, TODO_BLOCK_TYPE),
        type: TODO_BLOCK_TYPE,
        x: action.x,
        y: action.y,
        rotation: 0,
        opacity: 1,
        props: createTodoBlockProps(action),
        meta: { source: 'hermes' },
        actionType: action.type
      })
    case 'create_link_card':
      return createShape(target, {
        id: action.id ?? nextShapeId(target, LINK_CARD_TYPE),
        type: LINK_CARD_TYPE,
        x: action.x,
        y: action.y,
        rotation: 0,
        opacity: 1,
        props: createLinkCardProps(action),
        meta: { source: 'hermes' },
        actionType: action.type
      })
    case 'create_note_card':
      return createShape(target, {
        id: action.id ?? nextShapeId(target, 'geo'),
        type: 'geo',
        x: action.x,
        y: action.y,
        rotation: 0,
        opacity: 1,
        props: createNoteCardProps(action as any) as unknown as Record<string, unknown>,
        meta: { source: 'hermes' },
        actionType: action.type
      })
    case 'create_docs_card':
      return createShape(target, {
        id: action.id ?? nextShapeId(target, DOCS_CARD_TYPE),
        type: DOCS_CARD_TYPE,
        x: action.x,
        y: action.y,
        rotation: 0,
        opacity: 1,
        props: createDocsCardProps(action),
        meta: { source: 'hermes' },
        actionType: action.type
      })
    case 'update_docs_card':
      return updateDocsCard(target, action)
    case 'create_project_card':
      return createShape(target, {
        id: action.id ?? nextShapeId(target, PROJECT_CARD_TYPE),
        type: PROJECT_CARD_TYPE,
        x: action.x,
        y: action.y,
        rotation: 0,
        opacity: 1,
        props: createProjectCardProps(action),
        meta: { source: 'hermes' },
        actionType: action.type
      })
    case 'update_project_card':
      return updateProjectTitle(target, action)
    case 'append_project_task':
    case 'update_project_task_text':
    case 'move_project_task':
    case 'remove_project_task':
      return mutateProjectTasks(target, action)
    case 'update_shape': {
      const existing = target.shapes.get(action.shapeId)
      if (!existing) return { actionType: action.type, error: `Unknown shape ${action.shapeId}` }
      const next = {
        ...existing,
        x: action.patch.x ?? existing.x,
        y: action.patch.y ?? existing.y,
        rotation: action.patch.rotation ?? existing.rotation,
        opacity: action.patch.opacity ?? existing.opacity,
        props: { ...existing.props, ...(action.patch.props ?? {}) },
        meta: { ...existing.meta, ...(action.patch.meta ?? {}) }
      }
      target.shapes.set(action.shapeId, next)
      target.editor?.updateShape({
        id: action.shapeId as any,
        type: next.type as any,
        x: next.x,
        y: next.y,
        rotation: next.rotation,
        opacity: next.opacity,
        props: next.props as any,
        meta: next.meta as any
      })
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

function withBuiltinDefaults(
  shapeType: string,
  props: Record<string, unknown>
): Record<string, unknown> {
  const defaults = getBuiltinDefaultProps(shapeType)
  const merged = defaults ? { ...defaults, ...props } : props
  if (shapeType !== 'draw' && shapeType !== 'highlight') return merged
  if (!Array.isArray(merged.segments)) return merged
  return {
    ...merged,
    segments: merged.segments.map(normalizeStrokeSegment)
  }
}

function normalizeStrokeSegment(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const segment = value as Record<string, unknown>
  const type = segment.type ?? 'free'
  const { points, ...withoutLegacyPoints } = segment
  if (typeof segment.path === 'string') {
    return { ...withoutLegacyPoints, type }
  }
  if (!Array.isArray(points)) {
    return { ...segment, type }
  }

  const normalizedPoints = points.map((point) => {
    if (!point || typeof point !== 'object' || Array.isArray(point)) {
      throw new Error('Draw segment points must contain finite x and y coordinates')
    }
    const record = point as Record<string, unknown>
    if (
      typeof record.x !== 'number' ||
      !Number.isFinite(record.x) ||
      typeof record.y !== 'number' ||
      !Number.isFinite(record.y) ||
      (record.z !== undefined &&
        (typeof record.z !== 'number' || !Number.isFinite(record.z)))
    ) {
      throw new Error('Draw segment points must contain finite x and y coordinates')
    }
    return { x: record.x, y: record.y, z: record.z ?? 0.5 }
  })

  return {
    ...withoutLegacyPoints,
    type,
    path: b64Vecs.encodePoints(normalizedPoints)
  }
}

function getBuiltinDefaultProps(shapeType: string): Record<string, unknown> | null {
  switch (shapeType) {
    case 'arrow':
      return {
        kind: 'arc',
        elbowMidPoint: 0.5,
        dash: 'draw',
        size: 'm',
        fill: 'none',
        color: 'black',
        labelColor: 'black',
        bend: 0,
        start: { x: 0, y: 0 },
        end: { x: 2, y: 0 },
        arrowheadStart: 'none',
        arrowheadEnd: 'arrow',
        richText: toRichText(''),
        labelPosition: 0.5,
        font: 'draw',
        scale: 1
      }
    case 'bookmark':
      return { url: '', w: 300, h: 320, assetId: null }
    case 'draw':
      return {
        segments: [],
        color: 'black',
        fill: 'none',
        dash: 'draw',
        size: 'm',
        isComplete: false,
        isClosed: false,
        isPen: false,
        scale: 1,
        scaleX: 1,
        scaleY: 1
      }
    case 'embed':
      return { w: 300, h: 300, url: '' }
    case 'frame':
      return { w: 320, h: 180, name: '', color: 'black' }
    case 'geo':
      return {
        w: 100,
        h: 100,
        geo: 'rectangle',
        dash: 'draw',
        growY: 0,
        url: '',
        scale: 1,
        color: 'black',
        labelColor: 'black',
        fill: 'none',
        size: 'm',
        font: 'draw',
        align: 'middle',
        verticalAlign: 'middle',
        richText: toRichText('')
      }
    case 'group':
      return {}
    case 'highlight':
      return {
        segments: [],
        color: 'black',
        size: 'm',
        isComplete: false,
        isPen: false,
        scale: 1,
        scaleX: 1,
        scaleY: 1
      }
    case 'image':
      return {
        w: 100,
        h: 100,
        assetId: null,
        playing: true,
        url: '',
        crop: null,
        flipX: false,
        flipY: false,
        altText: ''
      }
    case 'line': {
      const [start, end] = getIndices(2)
      return {
        dash: 'draw',
        size: 'm',
        color: 'black',
        spline: 'line',
        points: {
          [start]: { id: start, index: start, x: 0, y: 0 },
          [end]: { id: end, index: end, x: 0.1, y: 0.1 }
        },
        scale: 1
      }
    }
    case 'note':
      return {
        color: 'black',
        richText: toRichText(''),
        size: 'm',
        font: 'draw',
        align: 'middle',
        verticalAlign: 'middle',
        labelColor: 'black',
        growY: 0,
        fontSizeAdjustment: 1,
        url: '',
        scale: 1,
        textLastEditedBy: null
      }
    case 'text':
      return {
        color: 'black',
        size: 'm',
        w: 8,
        font: 'draw',
        textAlign: 'start',
        autoSize: true,
        scale: 1,
        richText: toRichText('')
      }
    case 'video':
      return {
        w: 100,
        h: 100,
        assetId: null,
        autoplay: true,
        url: '',
        altText: '',
        time: 0,
        playing: true
      }
    default:
      return null
  }
}

export function readTldrawObservation(target: TldrawExecutorTarget): CanvasObservationState {
  const viewportPageBounds = target.editor?.getViewportPageBounds()
  const editorShapes = target.editor
    ? target.editor.getCurrentPageShapesSorted().map((shape) => ({
        id: String(shape.id),
        type: shape.type,
        x: shape.x,
        y: shape.y,
        rotation: shape.rotation,
        opacity: shape.opacity,
        props: shape.props as Record<string, unknown>,
        meta: shape.meta as Record<string, unknown>
      }))
    : [...target.shapes.values()]

  return createCanvasObservationFromRecords({
    canvasId: target.canvasId,
    pageId: target.pageId,
    selectedShapeIds: target.editor ? target.editor.getSelectedShapeIds().map(String) : target.selectedShapeIds,
    camera: target.editor ? target.editor.getCamera() : target.camera,
    viewportPageBounds: viewportPageBounds
      ? {
          x: viewportPageBounds.x,
          y: viewportPageBounds.y,
          w: viewportPageBounds.w,
          h: viewportPageBounds.h
        }
      : undefined,
    shapes: editorShapes
  })
}

function createShape(
  target: TldrawExecutorTarget,
  input: ShapeRecord & { actionType: CanvasAction['type'] }
): TldrawActionResult {
  const { actionType, ...shape } = input
  if (target.shapes.has(shape.id)) {
    return { actionType, error: `Shape ${shape.id} already exists` }
  }
  target.shapes.set(shape.id, shape)
  target.editor?.createShape({
    id: shape.id as any,
    type: shape.type as any,
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    opacity: shape.opacity,
    props: shape.props as any,
    meta: shape.meta as any
  })
  return { actionType, createdShapeIds: [shape.id] }
}

function mutateTodoShape(
  target: TldrawExecutorTarget,
  action: Extract<CanvasAction, { type: 'append_todo_task' | 'set_todo_task_done' | 'remove_todo_task' }>
): TldrawActionResult {
  const existing = target.shapes.get(action.shapeId)
  if (!existing || existing.type !== TODO_BLOCK_TYPE) {
    return { actionType: action.type, error: `Unknown todo block ${action.shapeId}` }
  }

  const tasks = Array.isArray(existing.props.tasks) ? (existing.props.tasks as TodoTask[]) : []
  if (action.type === 'append_todo_task') {
    const task = {
      id: action.taskId ?? `task_${String(tasks.length + 1).padStart(4, '0')}`,
      text: action.text,
      done: false
    }
    return updateTodoTasks(target, existing, [...tasks, task], action.type)
  }

  if (action.type === 'set_todo_task_done') {
    if (!tasks.some((task) => task.id === action.taskId)) {
      return { actionType: action.type, error: `Unknown todo task ${action.taskId}` }
    }
    return updateTodoTasks(
      target,
      existing,
      tasks.map((task) => task.id === action.taskId ? { ...task, done: action.done } : task),
      action.type
    )
  }

  if (!tasks.some((task) => task.id === action.taskId)) {
    return { actionType: action.type, error: `Unknown todo task ${action.taskId}` }
  }
  return updateTodoTasks(
    target,
    existing,
    tasks.filter((task) => task.id !== action.taskId),
    action.type
  )
}

function updateDocsCard(
  target: TldrawExecutorTarget,
  action: Extract<CanvasAction, { type: 'update_docs_card' }>
): TldrawActionResult {
  const existing = target.shapes.get(action.shapeId)
  if (!existing || existing.type !== DOCS_CARD_TYPE) {
    return { actionType: action.type, error: `Unknown docs card ${action.shapeId}` }
  }

  const nextProps = {
    ...existing.props,
    ...(action.title !== undefined ? { title: action.title.trim() } : {}),
    ...(action.content !== undefined ? { content: action.content } : {})
  }
  const next = { ...existing, props: nextProps }
  target.shapes.set(existing.id, next)
  target.editor?.updateShape({
    id: existing.id as any,
    type: DOCS_CARD_TYPE as any,
    props: nextProps as any
  })
  return { actionType: action.type, updatedShapeIds: [existing.id] }
}

function updateTodoTasks(
  target: TldrawExecutorTarget,
  shape: ShapeRecord,
  tasks: TodoTask[],
  actionType: CanvasAction['type']
): TldrawActionResult {
  const next = { ...shape, props: { ...shape.props, tasks } }
  target.shapes.set(shape.id, next)
  target.editor?.updateShape({ id: shape.id as any, type: TODO_BLOCK_TYPE, props: next.props as any })
  return { actionType, updatedShapeIds: [shape.id] }
}

type ProjectTaskMutation = Extract<
  CanvasAction,
  {
    type:
      | 'append_project_task'
      | 'update_project_task_text'
      | 'move_project_task'
      | 'remove_project_task'
  }
>

function projectShape(target: TldrawExecutorTarget, shapeId: string) {
  const shape = target.shapes.get(shapeId)
  return shape?.type === PROJECT_CARD_TYPE ? shape : undefined
}

function updateProjectProps(
  target: TldrawExecutorTarget,
  shape: ShapeRecord,
  props: Record<string, unknown>,
  actionType: CanvasAction['type']
): TldrawActionResult {
  const next = { ...shape, props }
  target.shapes.set(shape.id, next)
  target.editor?.updateShape({
    id: shape.id as any,
    type: PROJECT_CARD_TYPE as any,
    props: next.props as any
  })
  return { actionType, updatedShapeIds: [shape.id] }
}

function updateProjectTitle(
  target: TldrawExecutorTarget,
  action: Extract<CanvasAction, { type: 'update_project_card' }>
): TldrawActionResult {
  const shape = projectShape(target, action.shapeId)
  if (!shape) {
    return { actionType: action.type, error: `Unknown project card ${action.shapeId}` }
  }

  return updateProjectProps(
    target,
    shape,
    { ...shape.props, title: action.title },
    action.type
  )
}

function mutateProjectTasks(
  target: TldrawExecutorTarget,
  action: ProjectTaskMutation
): TldrawActionResult {
  const shape = projectShape(target, action.shapeId)
  if (!shape) {
    return { actionType: action.type, error: `Unknown project card ${action.shapeId}` }
  }

  const tasks = Array.isArray(shape.props.tasks) ? (shape.props.tasks as ProjectTask[]) : []

  try {
    const nextTasks =
      action.type === 'append_project_task'
        ? appendProjectTask(tasks, {
            id: action.taskId,
            text: action.text,
            status: action.status ?? 'todo'
          })
        : action.type === 'update_project_task_text'
          ? updateProjectTaskText(tasks, action.taskId, action.text)
          : action.type === 'move_project_task'
            ? moveProjectTask(tasks, action.taskId, action.status, action.beforeTaskId)
            : removeProjectTask(tasks, action.taskId)

    if (nextTasks === tasks) {
      return { actionType: action.type, updatedShapeIds: [shape.id] }
    }

    return updateProjectProps(
      target,
      shape,
      { ...shape.props, tasks: nextTasks },
      action.type
    )
  } catch (error) {
    return {
      actionType: action.type,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function nextShapeId(target: TldrawExecutorTarget, type: string): string {
  let sequence = target.shapes.size + 1
  let candidate = `shape:${type}_${String(sequence).padStart(4, '0')}`
  while (target.shapes.has(candidate)) {
    sequence += 1
    candidate = `shape:${type}_${String(sequence).padStart(4, '0')}`
  }
  return candidate
}
