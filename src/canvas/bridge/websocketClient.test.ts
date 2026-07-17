import { afterEach, describe, expect, it, vi } from 'vitest'
import { BridgeWebSocketClient, type BridgeSocketHandlers } from './websocketClient'

class FakeWebSocket {
  static OPEN = 1
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.OPEN
  close = vi.fn(() => {
    this.readyState = 3
  })
  send = vi.fn()
  addEventListener = vi.fn()

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }
}

const handlers: BridgeSocketHandlers = {
  onOpen: vi.fn(),
  onClose: vi.fn(),
  onError: vi.fn(),
  onMessage: vi.fn()
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeWebSocket.instances = []
})

describe('BridgeWebSocketClient', () => {
  it('closes stale sockets when reconnecting and when disconnected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const client = new BridgeWebSocketClient()

    client.connect('ws://gateway/first', handlers)
    client.connect('ws://gateway/second', handlers)

    const [first, second] = FakeWebSocket.instances
    expect(first.close).toHaveBeenCalledOnce()
    client.send({ type: 'canvas.result' })
    expect(second.send).toHaveBeenCalledOnce()

    client.disconnect()
    expect(second.close).toHaveBeenCalledOnce()
  })
})
