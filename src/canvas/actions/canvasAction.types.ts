import type { TodoTaskInput } from '../tldraw/customShape.types'
import type {
  ProjectActionInput,
  ProjectPriority,
  ProjectStatus
} from '../tldraw/projectCard.types'

export type TldrawShapePayload = {
  id?: string
  type: string
  x?: number
  y?: number
  rotation?: number
  opacity?: number
  props?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export type CreateShapeAction = {
  type: 'create_shape'
  shape: TldrawShapePayload
}

export type UpdateShapeAction = {
  type: 'update_shape'
  shapeId: string
  patch: Partial<TldrawShapePayload>
}

export type DeleteShapesAction = {
  type: 'delete_shapes'
  shapeIds: string[]
}

export type MoveShapesAction = {
  type: 'move_shapes'
  shapeIds: string[]
  x?: number
  y?: number
  dx?: number
  dy?: number
}

export type CreateBindingAction = {
  type: 'create_binding'
  binding: Record<string, unknown>
}

export type DeleteBindingsAction = {
  type: 'delete_bindings'
  bindingIds: string[]
}

export type SetCameraAction = {
  type: 'set_camera'
  x: number
  y: number
  z?: number
}

export type ZoomToFitAction = {
  type: 'zoom_to_fit'
}

export type SelectShapesAction = {
  type: 'select_shapes'
  shapeIds: string[]
}

export type ClearSelectionAction = {
  type: 'clear_selection'
}

export type ReadCanvasAction = {
  type: 'read_canvas'
}

export type CreateTodoBlockAction = {
  type: 'create_todo_block'
  id?: string
  x: number
  y: number
  title: string
  tasks?: TodoTaskInput[]
  w?: number
  h?: number
  backgroundColor?: string
}

export type AppendTodoTaskAction = {
  type: 'append_todo_task'
  shapeId: string
  text: string
  taskId?: string
}

export type SetTodoTaskDoneAction = {
  type: 'set_todo_task_done'
  shapeId: string
  taskId: string
  done: boolean
}

export type RemoveTodoTaskAction = {
  type: 'remove_todo_task'
  shapeId: string
  taskId: string
}

export type CreateLinkCardAction = {
  type: 'create_link_card'
  id?: string
  x: number
  y: number
  title: string
  url: string
  description?: string
  imageUrl?: string
  w?: number
  h?: number
  backgroundColor?: string
}

export type CreateNoteCardAction = {
  type: 'create_note_card'
  id?: string
  x: number
  y: number
  title: string
  tag: string
  content?: string
  color?: string
  size?: 's' | 'm' | 'l' | 'xl'
}

export type CreateProjectCardAction = {
  type: 'create_project_card'
  id?: string
  x: number
  y: number
  title: string
  status?: ProjectStatus
  priority?: ProjectPriority
  dueDate?: string
  actions?: ProjectActionInput[]
  w?: number
  h?: number
  color?: string
}

export type UpdateProjectCardAction = {
  type: 'update_project_card'
  shapeId: string
  title?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  dueDate?: string | null
}

export type AppendProjectAction = {
  type: 'append_project_action'
  shapeId: string
  actionId: string
  text: string
  done?: boolean
}

export type UpdateProjectActionTextAction = {
  type: 'update_project_action_text'
  shapeId: string
  actionId: string
  text: string
}

export type SetProjectActionDoneAction = {
  type: 'set_project_action_done'
  shapeId: string
  actionId: string
  done: boolean
}

export type RemoveProjectActionAction = {
  type: 'remove_project_action'
  shapeId: string
  actionId: string
}

export type CanvasAction =
  | CreateShapeAction
  | UpdateShapeAction
  | DeleteShapesAction
  | MoveShapesAction
  | CreateBindingAction
  | DeleteBindingsAction
  | SetCameraAction
  | ZoomToFitAction
  | SelectShapesAction
  | ClearSelectionAction
  | ReadCanvasAction
  | CreateTodoBlockAction
  | AppendTodoTaskAction
  | SetTodoTaskDoneAction
  | RemoveTodoTaskAction
  | CreateLinkCardAction
  | CreateNoteCardAction
  | CreateProjectCardAction
  | UpdateProjectCardAction
  | AppendProjectAction
  | UpdateProjectActionTextAction
  | SetProjectActionDoneAction
  | RemoveProjectActionAction
