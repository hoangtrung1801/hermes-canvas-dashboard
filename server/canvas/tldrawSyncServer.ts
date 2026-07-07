import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import {
  NodeSqliteWrapper,
  SQLiteSyncStorage,
  TLSocketRoom,
  type WebSocketMinimal
} from '@tldraw/sync-core'
import type { TLRecord } from '@tldraw/tlschema'
import { createHermesTldrawSchema } from '../../src/canvas/tldraw/tldrawSchema'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
const unsupportedLegacyShapeTypes = new Set([['task', 'card'].join('_')])

type TldrawSyncRoomManagerOptions = {
  dataDir: string
}

export class TldrawSyncRoomManager {
  private readonly db: InstanceType<typeof DatabaseSync>
  private readonly rooms = new Map<string, TLSocketRoom<TLRecord>>()

  readonly databasePath: string

  constructor(options: TldrawSyncRoomManagerOptions) {
    mkdirSync(options.dataDir, { recursive: true })
    this.databasePath = join(options.dataDir, 'tldraw-sync.sqlite')
    this.db = new DatabaseSync(this.databasePath)
  }

  getOrCreateRoom(roomId: string): TLSocketRoom<TLRecord> {
    const existing = this.rooms.get(roomId)
    if (existing) return existing

    const sql = new NodeSqliteWrapper(this.db, { tablePrefix: `${toSqlitePrefix(roomId)}_` })
    const storage = new SQLiteSyncStorage<TLRecord>({ sql })
    removeUnsupportedLegacyShapeRecords(storage)
    const room = new TLSocketRoom<TLRecord>({
      schema: createHermesTldrawSchema(),
      storage
    })

    this.rooms.set(roomId, room)
    return room
  }

  connectSocket(roomId: string, socket: WebSocketMinimal, sessionId?: string): void {
    this.getOrCreateRoom(roomId).handleSocketConnect({ sessionId: sessionId ?? randomUUID(), socket })
  }

  close(): void {
    for (const room of this.rooms.values()) {
      room.close()
    }
    this.rooms.clear()
    this.db.close()
  }
}

function toSqlitePrefix(roomId: string): string {
  return `room_${roomId.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

function removeUnsupportedLegacyShapeRecords(storage: SQLiteSyncStorage<TLRecord>): void {
  const unsupportedShapeIds: string[] = []

  for (const entry of storage.getSnapshot().documents) {
    if (isUnsupportedLegacyShapeRecord(entry.state)) {
      unsupportedShapeIds.push(entry.state.id)
    }
  }

  if (unsupportedShapeIds.length === 0) return

  storage.transaction((transaction) => {
    for (const shapeId of unsupportedShapeIds) {
      transaction.delete(shapeId)
    }
  }, { id: 'remove_unsupported_legacy_shapes' })
}

function isUnsupportedLegacyShapeRecord(record: unknown): record is TLRecord & { type: string } {
  return (
    !!record &&
    typeof record === 'object' &&
    'typeName' in record &&
    record.typeName === 'shape' &&
    'type' in record &&
    typeof record.type === 'string' &&
    unsupportedLegacyShapeTypes.has(record.type)
  )
}
