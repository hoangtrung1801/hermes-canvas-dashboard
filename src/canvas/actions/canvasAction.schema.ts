import { z } from 'zod'

const basePosition = {
  x: z.number(),
  y: z.number()
}

const todoTaskInputSchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1).optional(),
    text: z.string().min(1),
    done: z.boolean().optional()
  })
])

export const canvasActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_text'),
    text: z.string().min(1),
    name: z.string().optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_box'),
    name: z.string().optional(),
    text: z.string().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_note'),
    text: z.string().min(1),
    name: z.string().optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_todo_block'),
    name: z.string().min(1),
    tasks: z.array(todoTaskInputSchema).optional(),
    props: z.record(z.unknown()).optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_task_card'),
    name: z.string().min(1),
    text: z.string().optional(),
    props: z.record(z.unknown()).optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_link_card'),
    name: z.string().min(1),
    url: z.string().url(),
    props: z.record(z.unknown()).optional(),
    ...basePosition
  }),
  z.object({
    type: z.literal('create_arrow'),
    fromBlockId: z.string().min(1),
    toBlockId: z.string().min(1),
    label: z.string().optional()
  }),
  z.object({
    type: z.literal('update_text'),
    blockId: z.string().min(1),
    text: z.string().min(1)
  }),
  z.object({
    type: z.literal('append_todo_task'),
    blockId: z.string().min(1),
    text: z.string().min(1),
    taskId: z.string().min(1).optional()
  }),
  z.object({
    type: z.literal('set_todo_task_done'),
    blockId: z.string().min(1),
    taskId: z.string().min(1),
    done: z.boolean()
  }),
  z.object({
    type: z.literal('remove_todo_task'),
    blockId: z.string().min(1),
    taskId: z.string().min(1)
  }),
  z.object({
    type: z.literal('move_block'),
    blockId: z.string().min(1),
    ...basePosition
  }),
  z.object({
    type: z.literal('delete_block'),
    blockId: z.string().min(1)
  }),
  z.object({
    type: z.literal('read_canvas')
  }),
  z.object({
    type: z.literal('get_block_by_name'),
    name: z.string().min(1)
  }),
  z.object({
    type: z.literal('zoom_to_fit')
  })
])

export const canvasActionBatchSchema = z.array(canvasActionSchema).min(1)

export type CanvasActionInput = z.infer<typeof canvasActionSchema>
