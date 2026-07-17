import { describe, expect, it, vi } from 'vitest'
import { ChatApiError, createChatApi, parseSseStream } from './chatApi'

function byteStream(...chunks: string[]) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    }
  })
}

describe('parseSseStream', () => {
  it('parses events split across byte chunks', async () => {
    const stream = byteStream(
      'event: assistant.delta\r',
      '\ndata: {"message_id":"msg:1","text":"Hel',
      'lo"}\r\n\r\nevent: stream.done\ndata: {"run_id":"run:1"}\n\n'
    )

    const events = []
    for await (const event of parseSseStream(stream)) events.push(event)

    expect(events).toEqual([
      { event: 'assistant.delta', data: { message_id: 'msg:1', text: 'Hello' } },
      { event: 'stream.done', data: { run_id: 'run:1' } }
    ])
  })
})

describe('createChatApi', () => {
  it('posts a message and rejects a stream that closes without stream.done', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        byteStream('event: assistant.delta\ndata: {"message_id":"msg:1","text":"Hi"}\n\n'),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      )
    )
    const api = createChatApi('http://agent.test/', fetcher)
    const controller = new AbortController()

    const consume = async () => {
      const events = []
      for await (const event of api.streamMessage('conv:1', 'Hello', controller.signal)) {
        events.push(event)
      }
      return events
    }

    await expect(consume()).rejects.toEqual(
      expect.objectContaining({ message: 'The response stream ended unexpectedly.' })
    )
    expect(fetcher).toHaveBeenCalledWith(
      'http://agent.test/api/conversations/conv%3A1/messages:stream',
      expect.objectContaining({ method: 'POST', signal: controller.signal })
    )
  })

  it('surfaces structured HTTP errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Conversation not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      })
    )
    const api = createChatApi('http://agent.test', fetcher)

    await expect(api.getMessages('missing')).rejects.toEqual(
      new ChatApiError(404, 'Conversation not found')
    )
  })
})
