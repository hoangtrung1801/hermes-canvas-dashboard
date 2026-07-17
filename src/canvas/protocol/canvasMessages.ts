import { z } from 'zod'
import { canvasActionBatchSchema } from '../actions/canvasAction.schema'

const cameraSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
})

const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number()
})

const shapeSummarySchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
  props: z.record(z.unknown()),
  meta: z.record(z.unknown())
})

const resultItemSchema = z.object({
  actionType: z.string(),
  createdShapeIds: z.array(z.string()).optional(),
  updatedShapeIds: z.array(z.string()).optional(),
  deletedShapeIds: z.array(z.string()).optional(),
  createdBindingIds: z.array(z.string()).optional(),
  deletedBindingIds: z.array(z.string()).optional(),
  error: z.string().optional()
})

export const canvasReadyEnvelopeSchema = z.object({
  type: z.literal('canvas.ready'),
  canvasId: z.string(),
  roomId: z.string()
})

export const canvasActionEnvelopeSchema = z.object({
  type: z.literal('canvas.action'),
  requestId: z.string(),
  canvasId: z.string(),
  actions: canvasActionBatchSchema
})

export const canvasResultEnvelopeSchema = z.object({
  type: z.literal('canvas.result'),
  requestId: z.string(),
  ok: z.boolean(),
  results: z.array(resultItemSchema)
})

export const canvasObservationEnvelopeSchema = z.object({
  type: z.literal('canvas.observation'),
  requestId: z.string(),
  canvasId: z.string(),
  state: z.object({
    canvasId: z.string(),
    pageId: z.string(),
    selectedShapeIds: z.array(z.string()),
    camera: cameraSchema,
    viewportPageBounds: viewportSchema.optional(),
    shapes: z.array(shapeSummarySchema)
  })
})

export const canvasErrorEnvelopeSchema = z.object({
  type: z.literal('canvas.error'),
  requestId: z.string(),
  message: z.string()
})

export const hermesToCanvasEnvelopeSchema = canvasActionEnvelopeSchema

export const canvasToHermesEnvelopeSchema = z.union([
  canvasReadyEnvelopeSchema,
  canvasResultEnvelopeSchema,
  canvasObservationEnvelopeSchema,
  canvasErrorEnvelopeSchema
])
