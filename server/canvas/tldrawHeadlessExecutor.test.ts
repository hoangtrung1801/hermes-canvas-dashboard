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
          type: 'create_task_card',
          id: 'shape:task_1',
          title: 'Ship tldraw',
          body: 'Persist with sync',
          x: 80,
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
        { actionType: 'create_task_card', createdShapeIds: ['shape:task_1'] },
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
            id: 'shape:task_1',
            type: 'task_card',
            x: 80,
            y: 120,
            props: {
              title: 'Ship tldraw',
              body: 'Persist with sync'
            }
          }
        ]
      }
    })

    const room = manager.getOrCreateRoom('canvas_001')
    const snapshot = room.getCurrentSnapshot()
    expect(snapshot.documents.some((entry) => entry.state.id === 'shape:task_1')).toBe(true)
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
})
