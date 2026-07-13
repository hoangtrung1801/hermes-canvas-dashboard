import { z } from 'zod'

const position = {
  x: z.number(),
  y: z.number()
}

const shapeId = z.string().min(1)
const shapeIdList = z.array(shapeId).min(1)
const record = z.record(z.unknown())
const backgroundColor = z.string().min(1).optional()
const tldrawDefaultColor = z.enum([
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white'
])
const tldrawNoteSize = z.enum(['s', 'm', 'l', 'xl'])
const nonBlank = z.string().trim().min(1)
const projectTaskStatus = z.enum(['todo', 'doing', 'done', 'blocked'])
const projectTaskInput = z.object({
  id: nonBlank.optional(),
  text: nonBlank,
  status: projectTaskStatus.default('todo')
}).strict()
const projectTaskInputs = z.array(projectTaskInput).superRefine((tasks, context) => {
  const seen = new Set<string>()

  tasks.forEach((task, index) => {
    if (!task.id) return
    if (seen.has(task.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, 'id'],
        message: `duplicate task id ${task.id}`
      })
    }
    seen.add(task.id)
  })
})

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
    backgroundColor,
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
    type: z.literal('create_link_card'),
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    url: z.string().url(),
    description: z.string().optional(),
    imageUrl: z.string().refine(
      (value) => /^https?:\/\//i.test(value) || /^data:image\//i.test(value),
      'imageUrl must be an HTTP(S) URL or image data URI'
    ).optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    backgroundColor,
    ...position
  }),
  z.object({
    type: z.literal('create_note_card'),
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    tag: z.string().min(1),
    content: z.string().optional(),
    color: tldrawDefaultColor.optional(),
    size: tldrawNoteSize.optional(),
    ...position
  }),
  z.object({
    type: z.literal('create_project_card'),
    id: nonBlank.optional(),
    title: nonBlank,
    tasks: projectTaskInputs.optional(),
    w: z.number().finite().positive().optional(),
    h: z.number().finite().positive().optional(),
    color: tldrawDefaultColor.optional(),
    ...position
  }).strict(),
  z.object({
    type: z.literal('update_project_card'),
    shapeId,
    title: nonBlank
  }).strict(),
  z.object({
    type: z.literal('append_project_task'),
    shapeId,
    taskId: nonBlank,
    text: nonBlank,
    status: projectTaskStatus.default('todo')
  }).strict(),
  z.object({
    type: z.literal('update_project_task_text'),
    shapeId,
    taskId: nonBlank,
    text: nonBlank
  }).strict(),
  z.object({
    type: z.literal('move_project_task'),
    shapeId,
    taskId: nonBlank,
    status: projectTaskStatus,
    beforeTaskId: nonBlank.nullable().optional()
  }).strict(),
  z.object({
    type: z.literal('remove_project_task'),
    shapeId,
    taskId: nonBlank
  }).strict()
])

export const canvasActionBatchSchema = z.array(canvasActionSchema).min(1)

export type CanvasActionInput = z.infer<typeof canvasActionSchema>
