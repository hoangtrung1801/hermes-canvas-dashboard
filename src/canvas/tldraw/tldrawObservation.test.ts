import { describe, expect, it } from 'vitest'
import { createCanvasObservationFromRecords } from './tldrawObservation'

describe('tldraw observation', () => {
  it('summarizes shapes, selection, and camera for Hermes', () => {
    const observation = createCanvasObservationFromRecords({
      canvasId: 'canvas_001',
      pageId: 'page:page',
      selectedShapeIds: ['shape:link_1'],
      camera: { x: 10, y: 20, z: 1.5 },
      viewportPageBounds: { x: 40, y: 50, w: 800, h: 600 },
      shapes: [
        {
          id: 'shape:link_1',
          type: 'link_card',
          x: 100,
          y: 120,
          props: { w: 300, h: 120, title: 'Docs', url: 'https://tldraw.dev' },
          meta: { source: 'hermes' }
        }
      ]
    })

    expect(observation).toEqual({
      canvasId: 'canvas_001',
      pageId: 'page:page',
      selectedShapeIds: ['shape:link_1'],
      camera: { x: 10, y: 20, z: 1.5 },
      viewportPageBounds: { x: 40, y: 50, w: 800, h: 600 },
      shapes: [
        {
          id: 'shape:link_1',
          type: 'link_card',
          x: 100,
          y: 120,
          w: 300,
          h: 120,
          props: { w: 300, h: 120, title: 'Docs', url: 'https://tldraw.dev' },
          meta: { source: 'hermes' }
        }
      ]
    })
  })
})
