import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeSqliteWrapper, SQLiteSyncStorage, TLSocketRoom } from '@tldraw/sync-core'
import {
  DefaultColorStyle,
  createShapePropsMigrationSequence,
  createTLSchema,
  defaultBindingSchemas,
  defaultShapeSchemas,
  type TLRecord
} from '@tldraw/tlschema'
import { T } from '@tldraw/validate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TldrawSyncRoomManager } from './tldrawSyncServer'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')

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

  it('drops persisted legacy unsupported custom shapes before opening a room', async () => {
    const legacyType = ['task', 'card'].join('_')
    const databasePath = join(dir, 'tldraw-sync.sqlite')
    const db = new DatabaseSync(databasePath)
    const sql = new NodeSqliteWrapper(db, { tablePrefix: 'room_canvas_001_' })
    const storage = new SQLiteSyncStorage<TLRecord>({ sql })
    const legacyRoom = new TLSocketRoom<TLRecord>({
      schema: createTLSchema({
        shapes: {
          ...defaultShapeSchemas,
          [legacyType]: {
            migrations: createShapePropsMigrationSequence({ sequence: [] }),
            props: {
              w: T.number,
              h: T.number,
              title: T.string,
              body: T.string,
              status: T.string,
              priority: T.string,
              color: DefaultColorStyle,
              backgroundColor: T.string.optional()
            }
          }
        },
        bindings: defaultBindingSchemas
      }),
      storage
    })

    await legacyRoom.updateStore((store) => {
      store.put({
        typeName: 'shape',
        id: 'shape:legacy',
        type: legacyType,
        x: 100,
        y: 120,
        rotation: 0,
        parentId: 'page:page',
        index: 'a1',
        isLocked: false,
        opacity: 1,
        props: {
          w: 280,
          h: 160,
          title: 'Legacy',
          body: 'Persisted before removal',
          status: 'todo',
          priority: 'medium',
          color: 'light-blue'
        },
        meta: {}
      } as unknown as TLRecord)
    })
    legacyRoom.close()
    db.close()

    const manager = new TldrawSyncRoomManager({ dataDir: dir })
    const snapshot = manager.getOrCreateRoom('canvas_001').getCurrentSnapshot()

    expect(snapshot.documents.some((entry) => entry.state.id === 'shape:legacy')).toBe(false)

    manager.close()
  })
})
