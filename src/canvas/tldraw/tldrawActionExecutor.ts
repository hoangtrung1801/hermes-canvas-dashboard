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
        props: action.shape.props ?? {},
        meta: action.shape.meta ?? {},
        actionType: action.type
      })
    case 'create_todo_block':
      return createShape(target, {
        id: action.id ?? nextShapeId(target, TODO_BLOCK_TYPE),
        type: TODO_BLOCK_TYPE,
        x: action.x,
        y: action.y,
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
        props: createNoteCardProps(action as any) as unknown as Record<string, unknown>,
        meta: { source: 'hermes' },
        actionType: action.type
      })
    case 'create_project_card':
      return createShape(target, {
        id: action.id ?? nextShapeId(target, PROJECT_CARD_TYPE),
        type: PROJECT_CARD_TYPE,
        x: action.x,
        y: action.y,
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
        props: { ...existing.props, ...(action.patch.props ?? {}) },
        meta: { ...existing.meta, ...(action.patch.meta ?? {}) }
      }
      target.shapes.set(action.shapeId, next)
      target.editor?.updateShape({
        id: action.shapeId as any,
        type: next.type as any,
        x: next.x,
        y: next.y,
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

export function readTldrawObservation(target: TldrawExecutorTarget): CanvasObservationState {
  const editorShapes = target.editor
    ? target.editor.getCurrentPageShapesSorted().map((shape) => ({
        id: String(shape.id),
        type: shape.type,
        x: shape.x,
        y: shape.y,
        props: shape.props as Record<string, unknown>,
        meta: shape.meta as Record<string, unknown>
      }))
    : [...target.shapes.values()]

  return createCanvasObservationFromRecords({
    canvasId: target.canvasId,
    pageId: target.pageId,
    selectedShapeIds: target.editor ? target.editor.getSelectedShapeIds().map(String) : target.selectedShapeIds,
    camera: target.editor ? target.editor.getCamera() : target.camera,
    shapes: editorShapes
  })
}

function createShape(
  target: TldrawExecutorTarget,
  input: ShapeRecord & { actionType: CanvasAction['type'] }
): TldrawActionResult {
  const { actionType, ...shape } = input
  target.shapes.set(shape.id, shape)
  target.editor?.createShape({
    id: shape.id as any,
    type: shape.type as any,
    x: shape.x,
    y: shape.y,
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
  return `shape:${type}_${String(target.shapes.size + 1).padStart(4, '0')}`
}
