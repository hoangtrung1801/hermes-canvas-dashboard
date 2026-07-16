import type { TodoTaskInput } from '../tldraw/customShape.types'
import type { ProjectTaskInput, ProjectTaskStatus } from '../tldraw/projectCard.types'

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

export type CreateDocsCardAction = {
  type: 'create_docs_card'
  id?: string
  x: number
  y: number
  title: string
  content?: string
  w?: number
  h?: number
}

export type UpdateDocsCardAction = {
  type: 'update_docs_card'
  shapeId: string
  title?: string
  content?: string
}

export type CreateProjectCardAction = {
  type: 'create_project_card'
  id?: string
  x: number
  y: number
  title: string
  tasks?: ProjectTaskInput[]
  w?: number
  h?: number
  color?: string
}

export type UpdateProjectCardAction = {
  type: 'update_project_card'
  shapeId: string
  title: string
}

export type AppendProjectTaskAction = {
  type: 'append_project_task'
  shapeId: string
  taskId: string
  text: string
  status?: ProjectTaskStatus
}

export type UpdateProjectTaskTextAction = {
  type: 'update_project_task_text'
  shapeId: string
  taskId: string
  text: string
}

export type MoveProjectTaskAction = {
  type: 'move_project_task'
  shapeId: string
  taskId: string
  status: ProjectTaskStatus
  beforeTaskId?: string | null
}

export type RemoveProjectTaskAction = {
  type: 'remove_project_task'
  shapeId: string
  taskId: string
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
  | CreateDocsCardAction
  | UpdateDocsCardAction
  | CreateProjectCardAction
  | UpdateProjectCardAction
  | AppendProjectTaskAction
  | UpdateProjectTaskTextAction
  | MoveProjectTaskAction
  | RemoveProjectTaskAction
