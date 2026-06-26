import { z } from 'zod'
import { canvasActionBatchSchema } from '../actions/canvasAction.schema'
import { canvasBlockTypes } from '../blocks/block.types'

const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number()
})

const blockSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.enum(canvasBlockTypes),
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
  text: z.string().optional(),
  props: z.record(z.unknown()).optional(),
  shapeIds: z.array(z.string())
})

const resultItemSchema = z.object({
  actionType: z.string(),
  createdBlockIds: z.array(z.string()).optional(),
  updatedBlockIds: z.array(z.string()).optional(),
  deletedBlockIds: z.array(z.string()).optional(),
  createdShapeIds: z.array(z.string()).optional(),
  matchedBlockIds: z.array(z.string()).optional(),
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
    selectedShapeIds: z.array(z.string()),
    viewport: viewportSchema,
    blocks: z.array(blockSchema)
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
