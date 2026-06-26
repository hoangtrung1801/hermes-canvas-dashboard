export type BridgeSocketHandlers = {
  onOpen(): void
  onClose(): void
  onError(error: Event): void
  onMessage(data: string): void
}

export class BridgeWebSocketClient {
  private socket: WebSocket | null = null

  connect(url: string, handlers: BridgeSocketHandlers) {
    if (typeof WebSocket === 'undefined') {
      return
    }

    this.socket = new WebSocket(url)
    this.socket.addEventListener('open', handlers.onOpen)
    this.socket.addEventListener('close', handlers.onClose)
    this.socket.addEventListener('error', handlers.onError)
    this.socket.addEventListener('message', (event) =>
      handlers.onMessage(String(event.data))
    )
  }

  send(payload: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    this.socket.send(JSON.stringify(payload))
  }
}
