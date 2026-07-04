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
import { createHermesTldrawSchema } from '../../src/canvas/tldraw/tldrawSchema'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')

type TldrawSyncRoomManagerOptions = {
  dataDir: string
}

export class TldrawSyncRoomManager {
  private readonly db: InstanceType<typeof DatabaseSync>
  private readonly rooms = new Map<string, TLSocketRoom>()

  readonly databasePath: string

  constructor(options: TldrawSyncRoomManagerOptions) {
    mkdirSync(options.dataDir, { recursive: true })
    this.databasePath = join(options.dataDir, 'tldraw-sync.sqlite')
    this.db = new DatabaseSync(this.databasePath)
  }

  getOrCreateRoom(roomId: string): TLSocketRoom {
    const existing = this.rooms.get(roomId)
    if (existing) return existing

    const sql = new NodeSqliteWrapper(this.db, { tablePrefix: `${toSqlitePrefix(roomId)}_` })
    const storage = new SQLiteSyncStorage({ sql })
    const room = new TLSocketRoom({
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
