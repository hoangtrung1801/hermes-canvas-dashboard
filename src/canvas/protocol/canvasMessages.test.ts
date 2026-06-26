import { describe, expect, it } from 'vitest'
import {
  canvasActionEnvelopeSchema,
  canvasErrorEnvelopeSchema,
  canvasObservationEnvelopeSchema,
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
})
