import { describe, expect, it } from 'vitest'
import { canvasActionBatchSchema, canvasActionSchema } from './canvasAction.schema'

describe('canvasActionSchema', () => {
  it('accepts a task card action', () => {
    const parsed = canvasActionSchema.parse({
      type: 'create_task_card',
      name: 'Design import modal',
      x: 100,
      y: 200,
      props: { status: 'todo', priority: 'high' }
    })

    expect(parsed.type).toBe('create_task_card')
  })

  it('accepts todo block task actions', () => {
    const parsed = canvasActionBatchSchema.parse([
      {
        type: 'create_todo_block',
        name: 'Release checklist',
        x: 100,
        y: 200,
        tasks: [
          'Write docs',
          { id: 'task_review', text: 'Review launch notes', done: true }
        ]
      },
      {
        type: 'append_todo_task',
        blockId: 'block_0001',
        text: 'Ship feature'
      },
      {
        type: 'set_todo_task_done',
        blockId: 'block_0001',
        taskId: 'task_review',
        done: false
      },
      {
        type: 'remove_todo_task',
        blockId: 'block_0001',
        taskId: 'task_review'
      }
    ])

    expect(parsed).toHaveLength(4)
  })

  it('rejects arrows without endpoints', () => {
    expect(() =>
      canvasActionSchema.parse({
        type: 'create_arrow',
        label: 'missing ids'
      })
    ).toThrow(/fromBlockId|toBlockId/)
  })

  it('accepts a batch of actions', () => {
    const parsed = canvasActionBatchSchema.parse([
      { type: 'create_text', text: 'Hello', x: 10, y: 20 },
      { type: 'read_canvas' }
    ])

    expect(parsed).toHaveLength(2)
  })
})
