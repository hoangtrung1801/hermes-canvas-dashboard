type RoomConnection = {
  bridge?: { send(data: string): void }
  hermes?: { send(data: string): void }
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomConnection>()

  getOrCreate(canvasId: string): RoomConnection {
    const existing = this.rooms.get(canvasId)
    if (existing) {
      return existing
    }

    const created: RoomConnection = {}
    this.rooms.set(canvasId, created)
    return created
  }

  attachBridge(canvasId: string, socket: { send(data: string): void }) {
    this.getOrCreate(canvasId).bridge = socket
  }

  attachHermes(canvasId: string, socket: { send(data: string): void }) {
    this.getOrCreate(canvasId).hermes = socket
  }

  forwardToBridge(canvasId: string, payload: string) {
    this.getOrCreate(canvasId).bridge?.send(payload)
  }

  forwardToHermes(canvasId: string, payload: string) {
    this.getOrCreate(canvasId).hermes?.send(payload)
  }
}
