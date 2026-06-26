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
