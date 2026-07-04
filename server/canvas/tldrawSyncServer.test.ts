import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TldrawSyncRoomManager } from './tldrawSyncServer'

describe('TldrawSyncRoomManager', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hermes-tldraw-sync-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reuses one room per room id', () => {
    const manager = new TldrawSyncRoomManager({ dataDir: dir })

    expect(manager.getOrCreateRoom('canvas_001')).toBe(manager.getOrCreateRoom('canvas_001'))
    expect(manager.getOrCreateRoom('canvas_001')).not.toBe(manager.getOrCreateRoom('canvas_002'))

    manager.close()
  })

  it('exposes the sqlite database path', () => {
    const manager = new TldrawSyncRoomManager({ dataDir: dir })

    expect(manager.databasePath).toBe(join(dir, 'tldraw-sync.sqlite'))

    manager.close()
  })
})
