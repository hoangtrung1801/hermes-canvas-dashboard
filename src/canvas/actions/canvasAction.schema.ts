import { z } from 'zod'

const position = {
  x: z.number(),
  y: z.number()
}

const shapeId = z.string().min(1)
const shapeIdList = z.array(shapeId).min(1)
const record = z.record(z.unknown())

const tldrawShapePayloadSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  props: record.optional(),
  meta: record.optional()
})

const todoTaskInputSchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1).optional(),
    text: z.string().min(1),
    done: z.boolean().optional()
  })
])

export const canvasActionSchema = z.union([
  z.object({ type: z.literal('create_shape'), shape: tldrawShapePayloadSchema }),
  z.object({
    type: z.literal('update_shape'),
    shapeId,
    patch: tldrawShapePayloadSchema.partial().refine((value) => Object.keys(value).length > 0, {
      message: 'patch must contain at least one field'
    })
  }),
  z.object({ type: z.literal('delete_shapes'), shapeIds: shapeIdList }),
  z.object({
    type: z.literal('move_shapes'),
    shapeIds: shapeIdList,
    x: z.number().optional(),
    y: z.number().optional(),
    dx: z.number().optional(),
    dy: z.number().optional()
  }).refine(
    (value) =>
      value.x !== undefined ||
      value.y !== undefined ||
      value.dx !== undefined ||
      value.dy !== undefined,
    {
      message: 'move_shapes requires x, y, dx, or dy'
    }
  ),
  z.object({ type: z.literal('create_binding'), binding: record }),
  z.object({ type: z.literal('delete_bindings'), bindingIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('set_camera'), x: z.number(), y: z.number(), z: z.number().positive().optional() }),
  z.object({ type: z.literal('zoom_to_fit') }),
  z.object({ type: z.literal('select_shapes'), shapeIds: shapeIdList }),
  z.object({ type: z.literal('clear_selection') }),
  z.object({ type: z.literal('read_canvas') }),
  z.object({
    type: z.literal('create_todo_block'),
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    tasks: z.array(todoTaskInputSchema).optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    ...position
  }),
  z.object({
    type: z.literal('append_todo_task'),
    shapeId,
    text: z.string().min(1),
    taskId: z.string().min(1).optional()
  }),
  z.object({
    type: z.literal('set_todo_task_done'),
    shapeId,
    taskId: z.string().min(1),
    done: z.boolean()
  }),
  z.object({
    type: z.literal('remove_todo_task'),
    shapeId,
    taskId: z.string().min(1)
  }),
  z.object({
    type: z.literal('create_task_card'),
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    status: z.string().min(1).optional(),
    priority: z.string().min(1).optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    ...position
  }),
  z.object({
    type: z.literal('create_link_card'),
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    url: z.string().url(),
    description: z.string().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    ...position
  })
])

export const canvasActionBatchSchema = z.array(canvasActionSchema).min(1)

export type CanvasActionInput = z.infer<typeof canvasActionSchema>
