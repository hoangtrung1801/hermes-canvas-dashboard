import { describe, expect, it } from 'vitest'
import {
  canvasActionEnvelopeSchema,
  canvasErrorEnvelopeSchema,
  canvasObservationEnvelopeSchema,
  canvasResultEnvelopeSchema,
  canvasReadyEnvelopeSchema
} from './canvasMessages'

describe('canvasMessages', () => {
  it('parses canvas.action envelopes', () => {
    const parsed = canvasActionEnvelopeSchema.parse({
      type: 'canvas.action',
      requestId: 'req_001',
      canvasId: 'canvas_001',
      actions: [{ type: 'read_canvas' }]
    })

    expect(parsed.type).toBe('canvas.action')
  })

  it('parses canvas.observation envelopes', () => {
    const parsed = canvasObservationEnvelopeSchema.parse({
      type: 'canvas.observation',
      requestId: 'req_001',
      canvasId: 'canvas_001',
      state: {
        canvasId: 'canvas_001',
        selectedShapeIds: [],
        viewport: { x: 0, y: 0, w: 1200, h: 800 },
        blocks: []
      }
    })

    expect(parsed.state.blocks).toEqual([])
  })

  it('parses canvas.ready and canvas.error envelopes', () => {
    const ready = canvasReadyEnvelopeSchema.parse({
      type: 'canvas.ready',
      canvasId: 'canvas_001',
      roomId: 'room_001'
    })

    const error = canvasErrorEnvelopeSchema.parse({
      type: 'canvas.error',
      requestId: 'req_001',
      message: 'Invalid action'
    })

    expect(ready.roomId).toBe('room_001')
    expect(error.message).toBe('Invalid action')
  })

  it('parses todo block data result envelopes', () => {
    const parsed = canvasResultEnvelopeSchema.parse({
      type: 'canvas.result',
      requestId: 'req_001',
      ok: true,
      results: [
        {
          actionType: 'get_todo_block_data',
          matchedBlockIds: ['block_0001'],
          todoBlock: {
            id: 'block_0001',
            name: 'Launch checklist',
            tasks: [{ id: 'task_docs', text: 'Write docs', done: false }]
          },
          createdTaskIds: ['task_new'],
          updatedTaskIds: ['task_docs'],
          deletedTaskIds: ['task_old']
        }
      ]
    })

    expect(parsed.results[0].todoBlock).toEqual({
      id: 'block_0001',
      name: 'Launch checklist',
      tasks: [{ id: 'task_docs', text: 'Write docs', done: false }]
    })
    expect(parsed.results[0].createdTaskIds).toEqual(['task_new'])
    expect(parsed.results[0].updatedTaskIds).toEqual(['task_docs'])
    expect(parsed.results[0].deletedTaskIds).toEqual(['task_old'])
  })
})
