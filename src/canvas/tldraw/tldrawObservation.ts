export type CanvasCamera = {
  x: number
  y: number
  z: number
}

export type CanvasShapeSummary = {
  id: string
  type: string
  x: number
  y: number
  w?: number
  h?: number
  props: Record<string, unknown>
  meta: Record<string, unknown>
}

export type CanvasObservationState = {
  canvasId: string
  pageId: string
  selectedShapeIds: string[]
  camera: CanvasCamera
  shapes: CanvasShapeSummary[]
}

type ShapeRecordLike = {
  id: string
  type: string
  x?: number
  y?: number
  props?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export function createCanvasObservationFromRecords(input: {
  canvasId: string
  pageId: string
  selectedShapeIds?: string[]
  camera?: Partial<CanvasCamera>
  shapes: ShapeRecordLike[]
}): CanvasObservationState {
  return {
    canvasId: input.canvasId,
    pageId: input.pageId,
    selectedShapeIds: input.selectedShapeIds ?? [],
    camera: {
      x: input.camera?.x ?? 0,
      y: input.camera?.y ?? 0,
      z: input.camera?.z ?? 1
    },
    shapes: input.shapes.map((shape) => ({
      id: shape.id,
      type: shape.type,
      x: shape.x ?? 0,
      y: shape.y ?? 0,
      w: numberProp(shape.props, 'w'),
      h: numberProp(shape.props, 'h'),
      props: { ...(shape.props ?? {}) },
      meta: { ...(shape.meta ?? {}) }
    }))
  }
}

function numberProp(props: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = props?.[key]
  return typeof value === 'number' ? value : undefined
}
