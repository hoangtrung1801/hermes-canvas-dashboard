import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { executeHeadlessTldrawAction } from './tldrawHeadlessExecutor'
import { TldrawSyncRoomManager } from './tldrawSyncServer'

describe('executeHeadlessTldrawAction', () => {
  let dir: string
  let manager: TldrawSyncRoomManager

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hermes-tldraw-headless-'))
    manager = new TldrawSyncRoomManager({ dataDir: dir })
  })

  afterEach(async () => {
    manager.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('executes tldraw actions against a sync room and returns an observation', async () => {
    const responses = await executeHeadlessTldrawAction(manager, {
      type: 'canvas.action',
      requestId: 'req_create',
      canvasId: 'canvas_001',
      actions: [
        {
          type: 'create_note_card',
          id: 'shape:note_1',
          title: 'Headless note',
          tag: 'Note',
          content: 'Created without a bridge',
          x: 100,
          y: 120
        },
        { type: 'read_canvas' }
      ]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_create',
      ok: true,
      results: [
        { actionType: 'create_note_card', createdShapeIds: ['shape:note_1'] },
        { actionType: 'read_canvas' }
      ]
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      requestId: 'req_create',
      canvasId: 'canvas_001',
      state: {
        canvasId: 'canvas_001',
        pageId: 'page:page',
        shapes: [
          {
            id: 'shape:note_1',
            type: 'geo',
            x: 100,
            y: 120,
            props: {
              geo: 'rectangle',
              color: 'yellow'
            }
          }
        ]
      }
    })

    const room = manager.getOrCreateRoom('canvas_001')
    const snapshot = room.getCurrentSnapshot()
    expect(snapshot.documents.some((entry) => entry.state.id === 'shape:note_1')).toBe(true)
  })

  it('returns canvas.error for invalid action envelopes', async () => {
    const responses = await executeHeadlessTldrawAction(manager, {
      type: 'canvas.action',
      requestId: 'req_invalid',
      canvasId: 'canvas_001',
      actions: [{ type: 'missing_action' }]
    } as never)

    expect(responses).toEqual([
      {
        type: 'canvas.error',
        requestId: 'req_invalid',
        message: expect.stringContaining('Invalid input')
      }
    ])
  })

  it('persists batches larger than nine shapes with valid tldraw indices', async () => {
    const responses = await executeHeadlessTldrawAction(manager, {
      type: 'canvas.action',
      requestId: 'req_many_shapes',
      canvasId: 'canvas_001',
      actions: [
        ...Array.from({ length: 10 }, (_, index) => ({
          type: 'create_link_card' as const,
          id: `shape:link_${index + 1}`,
          title: `Link ${index + 1}`,
          url: `https://example.com/${index + 1}`,
          x: index * 24,
          y: index * 12
        })),
        { type: 'read_canvas' as const }
      ]
    })

    expect(responses[0]).toMatchObject({
      type: 'canvas.result',
      requestId: 'req_many_shapes',
      ok: true
    })
    expect(responses[1]).toMatchObject({
      type: 'canvas.observation',
      requestId: 'req_many_shapes',
      canvasId: 'canvas_001',
      state: {
        shapes: expect.arrayContaining([
          expect.objectContaining({ id: 'shape:link_10', type: 'link_card' })
        ])
      }
    })
  })
})
