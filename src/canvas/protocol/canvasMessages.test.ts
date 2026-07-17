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
        pageId: 'page:page',
        selectedShapeIds: [],
        camera: { x: 0, y: 0, z: 1 },
        viewportPageBounds: { x: 10, y: 20, w: 800, h: 600 },
        shapes: []
      }
    })

    expect(parsed.state.shapes).toEqual([])
    expect(parsed.state.viewportPageBounds).toEqual({ x: 10, y: 20, w: 800, h: 600 })
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

  it('parses tldraw shape result envelopes', () => {
    const parsed = canvasResultEnvelopeSchema.parse({
      type: 'canvas.result',
      requestId: 'req_001',
      ok: true,
      results: [
        {
          actionType: 'create_link_card',
          createdShapeIds: ['shape:link_1'],
          updatedShapeIds: ['shape:link_2'],
          deletedShapeIds: ['shape:link_3'],
          createdBindingIds: ['binding:arrow_1'],
          deletedBindingIds: ['binding:arrow_2']
        }
      ]
    })

    expect(parsed.results[0].createdShapeIds).toEqual(['shape:link_1'])
  })
})
