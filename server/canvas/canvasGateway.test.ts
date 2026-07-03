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

  it('reports whether a bridge is attached for a canvas id', () => {
    const rooms = new RoomManager()
    const bridge = { send() {} }

    expect(rooms.hasBridge('canvas_001')).toBe(false)

    rooms.attachBridge('canvas_001', bridge)

    expect(rooms.hasBridge('canvas_001')).toBe(true)
    expect(rooms.hasBridge('canvas_002')).toBe(false)
  })

  it('clears bridge presence only for the attached bridge socket', () => {
    const rooms = new RoomManager()
    const firstBridge = { send() {} }
    const secondBridge = { send() {} }

    rooms.attachBridge('canvas_001', firstBridge)
    rooms.attachBridge('canvas_001', secondBridge)
    rooms.detachBridge('canvas_001', firstBridge)

    expect(rooms.hasBridge('canvas_001')).toBe(true)

    rooms.detachBridge('canvas_001', secondBridge)

    expect(rooms.hasBridge('canvas_001')).toBe(false)
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
