import { beforeEach, expect, it, vi } from 'vitest'
import type { ChatApi, ChatStreamEvent, Conversation } from './chat.types'
import { useChatStore } from './chatStore'

const conversation: Conversation = {
  id: 'conv:1',
  canvas_id: 'canvas_001',
  title: 'New conversation',
  is_active: true,
  created_at: '2026-07-17T00:00:00Z',
  updated_at: '2026-07-17T00:00:00Z'
}

function apiWith(overrides: Partial<ChatApi> = {}): ChatApi {
  return {
    listConversations: vi.fn().mockResolvedValue([]),
    createConversation: vi.fn().mockResolvedValue(conversation),
    activateConversation: vi.fn().mockResolvedValue(conversation),
    getMessages: vi.fn().mockResolvedValue([]),
    async *streamMessage() {
      yield { event: 'stream.done', data: { run_id: 'run:1' } }
    },
    cancelRun: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

beforeEach(() => {
  useChatStore.setState({
    canvasId: null,
    conversations: [],
    activeConversationId: null,
    messages: [],
    toolActivities: [],
    status: 'idle',
    statusMessage: null,
    activeRunId: null,
    error: null,
    abortController: null
  })
})

it('restores or creates an active canvas conversation', async () => {
  const api = apiWith()

  await useChatStore.getState().initialize('canvas_001', api)

  expect(api.createConversation).toHaveBeenCalledWith('canvas_001')
  expect(useChatStore.getState().activeConversationId).toBe('conv:1')
  expect(useChatStore.getState().status).toBe('idle')
})

it('deduplicates concurrent initialization for the same canvas', async () => {
  const releases: Array<(conversations: Conversation[]) => void> = []
  const api = apiWith({
    listConversations: vi.fn().mockImplementation(
      () =>
        new Promise<Conversation[]>((resolve) => {
          releases.push(resolve)
        })
    )
  })

  const first = useChatStore.getState().initialize('canvas_001', api)
  const second = useChatStore.getState().initialize('canvas_001', api)
  await Promise.resolve()
  releases.forEach((release) => release([]))
  await Promise.all([first, second])

  expect(api.listConversations).toHaveBeenCalledTimes(1)
  expect(api.createConversation).toHaveBeenCalledTimes(1)
})

it('accumulates assistant text and public tool progress, then refreshes messages', async () => {
  const completedMessages = [
    { id: 'user:run:1', role: 'user' as const, content: 'Create a note' },
    { id: 'msg:1', role: 'assistant' as const, content: 'Created it.' }
  ]
  const events: ChatStreamEvent[] = [
    {
      event: 'run.started',
      data: { run_id: 'run:1', user_message: completedMessages[0] }
    },
    {
      event: 'tool.started',
      data: { call_id: 'call:1', name: 'create_note_card', summary: 'Creating note card' }
    },
    {
      event: 'assistant.delta',
      data: { message_id: 'msg:1', text: 'Created ' }
    },
    {
      event: 'tool.completed',
      data: {
        call_id: 'call:1',
        name: 'create_note_card',
        ok: true,
        summary: 'Created note card'
      }
    },
    { event: 'assistant.delta', data: { message_id: 'msg:1', text: 'it.' } },
    { event: 'assistant.completed', data: { message: completedMessages[1] } },
    { event: 'stream.done', data: { run_id: 'run:1' } }
  ]
  const api = apiWith({
    listConversations: vi.fn().mockResolvedValue([conversation]),
    getMessages: vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(completedMessages),
    async *streamMessage() {
      for (const event of events) yield event
    }
  })
  await useChatStore.getState().initialize('canvas_001', api)

  await useChatStore.getState().sendMessage('Create a note')

  expect(useChatStore.getState().messages).toEqual(completedMessages)
  expect(useChatStore.getState().toolActivities).toEqual([
    {
      callId: 'call:1',
      name: 'create_note_card',
      summary: 'Created note card',
      status: 'completed'
    }
  ])
  expect(useChatStore.getState().status).toBe('idle')
  expect(useChatStore.getState().activeRunId).toBeNull()
})

it('does not submit a second message while streaming', async () => {
  let release: (() => void) | undefined
  const api = apiWith({
    listConversations: vi.fn().mockResolvedValue([conversation]),
    streamMessage: vi.fn().mockImplementation(async function* () {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      yield { event: 'stream.done', data: { run_id: 'run:1' } }
    })
  })
  await useChatStore.getState().initialize('canvas_001', api)

  const first = useChatStore.getState().sendMessage('First')
  await Promise.resolve()
  await useChatStore.getState().sendMessage('Second')
  release?.()
  await first

  expect(api.streamMessage).toHaveBeenCalledTimes(1)
})
