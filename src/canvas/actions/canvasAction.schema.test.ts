import { describe, expect, it } from 'vitest'
import { canvasActionBatchSchema, canvasActionSchema } from './canvasAction.schema'

describe('tldraw canvas action schema', () => {
  it('accepts core tldraw shape actions', () => {
    expect(
      canvasActionBatchSchema.parse([
        {
          type: 'create_shape',
          shape: {
            id: 'shape:box_1',
            type: 'geo',
            x: 100,
            y: 120,
            props: { w: 240, h: 140, geo: 'rectangle' }
          }
        },
        {
          type: 'update_shape',
          shapeId: 'shape:box_1',
          patch: { x: 140, props: { w: 300 } }
        },
        {
          type: 'delete_shapes',
          shapeIds: ['shape:box_1']
        }
      ])
    ).toHaveLength(3)
  })

  it('accepts project custom shape helper actions', () => {
    expect(
      canvasActionSchema.parse({
        type: 'create_todo_block',
        id: 'shape:todo_1',
        x: 80,
        y: 100,
        title: 'Launch',
        backgroundColor: '#fee2e2',
        tasks: [{ id: 'task_copy', text: 'Write copy', done: false }]
      })
    ).toMatchObject({ type: 'create_todo_block', title: 'Launch', backgroundColor: '#fee2e2' })

    expect(
      canvasActionSchema.parse({
        type: 'create_task_card',
        id: 'shape:task_1',
        x: 120,
        y: 140,
        title: 'Design',
        backgroundColor: '#fef3c7'
      })
    ).toMatchObject({ type: 'create_task_card', title: 'Design', backgroundColor: '#fef3c7' })

    expect(
      canvasActionSchema.parse({
        type: 'create_link_card',
        id: 'shape:link_1',
        x: 120,
        y: 320,
        title: 'Docs',
        url: 'https://tldraw.dev',
        backgroundColor: '#ecfccb'
      })
    ).toMatchObject({ type: 'create_link_card', title: 'Docs', backgroundColor: '#ecfccb' })
  })

  it('rejects empty action batches and malformed urls', () => {
    expect(() => canvasActionBatchSchema.parse([])).toThrow()
    expect(() =>
      canvasActionSchema.parse({
        type: 'create_link_card',
        title: 'Bad',
        url: 'not a url',
        x: 0,
        y: 0
      })
    ).toThrow()
  })
})
