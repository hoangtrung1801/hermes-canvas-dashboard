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
