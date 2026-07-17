import type { ChatApi, ChatMessage, ChatStreamEvent, Conversation } from './chat.types'

type Fetcher = typeof fetch

export class ChatApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ChatApiError'
  }
}

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<ChatStreamEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (value) buffer += decoder.decode(value, { stream: !done })
      if (done) buffer += decoder.decode()
      buffer = buffer.replace(/\r\n/g, '\n')

      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const parsed = parseFrame(frame)
        if (parsed) yield parsed
        boundary = buffer.indexOf('\n\n')
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
}

function parseFrame(frame: string): ChatStreamEvent | null {
  const lines = frame.split('\n')
  const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
  if (!event) return null
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  return {
    event,
    data: data ? JSON.parse(data) : {}
  } as ChatStreamEvent
}

export function createChatApi(baseUrl: string, fetcher: Fetcher = fetch): ChatApi {
  const root = baseUrl.replace(/\/+$/, '')

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetcher(`${root}${path}`, init)
    if (!response.ok) throw await responseError(response)
    return (await response.json()) as T
  }

  return {
    listConversations(canvasId) {
      return requestJson<Conversation[]>(
        `/api/canvases/${encodeURIComponent(canvasId)}/conversations`
      )
    },
    createConversation(canvasId) {
      return requestJson<Conversation>(
        `/api/canvases/${encodeURIComponent(canvasId)}/conversations`,
        { method: 'POST' }
      )
    },
    activateConversation(id) {
      return requestJson<Conversation>(
        `/api/conversations/${encodeURIComponent(id)}/activate`,
        { method: 'POST' }
      )
    },
    getMessages(id) {
      return requestJson<ChatMessage[]>(`/api/conversations/${encodeURIComponent(id)}/messages`)
    },
    async *streamMessage(id, message, signal) {
      const response = await fetcher(
        `${root}/api/conversations/${encodeURIComponent(id)}/messages:stream`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
          signal
        }
      )
      if (!response.ok) throw await responseError(response)
      if (!response.body) throw new ChatApiError(0, 'The response stream is unavailable.')

      let completed = false
      for await (const event of parseSseStream(response.body)) {
        if (event.event === 'stream.done') completed = true
        yield event
      }
      if (!completed) {
        throw new ChatApiError(0, 'The response stream ended unexpectedly.')
      }
    },
    async cancelRun(runId) {
      const response = await fetcher(`${root}/api/runs/${encodeURIComponent(runId)}/cancel`, {
        method: 'POST'
      })
      if (!response.ok) throw await responseError(response)
    }
  }
}

async function responseError(response: Response): Promise<ChatApiError> {
  let message = `Request failed with status ${response.status}`
  try {
    const payload = (await response.json()) as { detail?: string; message?: string }
    message = payload.detail ?? payload.message ?? message
  } catch {
    // Keep the status-based fallback for non-JSON proxy or server responses.
  }
  return new ChatApiError(response.status, message)
}

const configuredBaseUrl = import.meta.env.VITE_AI_SERVICE_URL ?? 'http://127.0.0.1:8000'

export const chatApi = createChatApi(configuredBaseUrl)
