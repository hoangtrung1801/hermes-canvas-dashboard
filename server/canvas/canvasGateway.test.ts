import { describe, expect, it } from 'vitest'
import { createHermesCanvasToolPayload } from './hermesCanvasTool'
import { RoomManager } from './roomManager'

describe('RoomManager', () => {
  it('creates stable room records by canvas id', () => {
    const rooms = new RoomManager()

    const roomA = rooms.getOrCreate('canvas_001')
    const roomB = rooms.getOrCreate('canvas_001')

    expect(roomA).toBe(roomB)
  })
})

describe('createHermesCanvasToolPayload', () => {
  it('builds a canvas.action envelope', () => {
    const payload = createHermesCanvasToolPayload('canvas_001', [
      { type: 'read_canvas' }
    ])

    expect(payload.type).toBe('canvas.action')
    expect(payload.canvasId).toBe('canvas_001')
  })
})
