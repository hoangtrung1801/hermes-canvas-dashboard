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
