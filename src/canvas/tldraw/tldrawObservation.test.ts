import { describe, expect, it } from 'vitest'
import { createCanvasObservationFromRecords } from './tldrawObservation'

describe('tldraw observation', () => {
  it('summarizes shapes, selection, and camera for Hermes', () => {
    const observation = createCanvasObservationFromRecords({
      canvasId: 'canvas_001',
      pageId: 'page:page',
      selectedShapeIds: ['shape:task_1'],
      camera: { x: 10, y: 20, z: 1.5 },
      shapes: [
        {
          id: 'shape:task_1',
          type: 'task_card',
          x: 100,
          y: 120,
          props: { w: 280, h: 160, title: 'Task', body: 'Body' },
          meta: { source: 'hermes' }
        }
      ]
    })

    expect(observation).toEqual({
      canvasId: 'canvas_001',
      pageId: 'page:page',
      selectedShapeIds: ['shape:task_1'],
      camera: { x: 10, y: 20, z: 1.5 },
      shapes: [
        {
          id: 'shape:task_1',
          type: 'task_card',
          x: 100,
          y: 120,
          w: 280,
          h: 160,
          props: { w: 280, h: 160, title: 'Task', body: 'Body' },
          meta: { source: 'hermes' }
        }
      ]
    })
  })
})
