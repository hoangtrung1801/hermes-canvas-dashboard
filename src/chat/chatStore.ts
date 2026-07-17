import { create } from 'zustand'
import { chatApi } from './chatApi'
import type {
  ChatApi,
  ChatMessage,
  ChatStreamEvent,
  Conversation,
  ToolActivity
} from './chat.types'

export type ChatStatus = 'idle' | 'loading' | 'streaming' | 'error'

type ChatStore = {
  canvasId: string | null
  conversations: Conversation[]
  activeConversationId: string | null
  messages: ChatMessage[]
  toolActivities: ToolActivity[]
  status: ChatStatus
  statusMessage: string | null
  activeRunId: string | null
  error: string | null
  abortController: AbortController | null
  api: ChatApi
  initialize(canvasId: string, api?: ChatApi): Promise<void>
  newConversation(): Promise<void>
  activateConversation(conversationId: string): Promise<void>
  sendMessage(message: string): Promise<void>
  stop(): Promise<void>
  clearError(): void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  canvasId: null,
  conversations: [],
  activeConversationId: null,
  messages: [],
  toolActivities: [],
  status: 'idle',
  statusMessage: null,
  activeRunId: null,
  error: null,
  abortController: null,
  api: chatApi,

  initialize: async (canvasId, api = chatApi) => {
    const current = get()
    if (
      current.canvasId === canvasId &&
      (current.status === 'loading' || current.activeConversationId !== null)
    ) {
      return
    }
    get().abortController?.abort()
    set({
      canvasId,
      api,
      status: 'loading',
      statusMessage: 'Loading conversations…',
      error: null,
      messages: [],
      toolActivities: [],
      activeRunId: null,
      abortController: null
    })
    try {
      let conversations = await api.listConversations(canvasId)
      let active = conversations.find((conversation) => conversation.is_active)
      if (!active) {
        const selected = conversations[0] ?? (await api.createConversation(canvasId))
        active = selected
        if (!conversations.some((conversation) => conversation.id === selected.id)) {
          conversations = [selected, ...conversations]
        }
      }
      const messages = await api.getMessages(active.id)
      set({
        conversations,
        activeConversationId: active.id,
        messages,
        status: 'idle',
        statusMessage: null
      })
    } catch (error) {
      setFailure(set, error)
    }
  },

  newConversation: async () => {
    const { canvasId, api, status } = get()
    if (!canvasId || status === 'streaming') return
    set({ status: 'loading', statusMessage: 'Starting a new conversation…', error: null })
    try {
      const created = await api.createConversation(canvasId)
      set((state) => ({
        conversations: [
          created,
          ...state.conversations.map((conversation) => ({
            ...conversation,
            is_active: false
          }))
        ],
        activeConversationId: created.id,
        messages: [],
        toolActivities: [],
        status: 'idle',
        statusMessage: null
      }))
    } catch (error) {
      setFailure(set, error)
    }
  },

  activateConversation: async (conversationId) => {
    const { api, status } = get()
    if (status === 'streaming' || conversationId === get().activeConversationId) return
    set({ status: 'loading', statusMessage: 'Opening conversation…', error: null })
    try {
      const active = await api.activateConversation(conversationId)
      const messages = await api.getMessages(conversationId)
      set((state) => ({
        conversations: state.conversations.map((conversation) => ({
          ...(conversation.id === active.id ? active : conversation),
          is_active: conversation.id === active.id
        })),
        activeConversationId: active.id,
        messages,
        toolActivities: [],
        status: 'idle',
        statusMessage: null
      }))
    } catch (error) {
      setFailure(set, error)
    }
  },

  sendMessage: async (rawMessage) => {
    const message = rawMessage.trim()
    const { activeConversationId, api, status } = get()
    if (!message || !activeConversationId || status === 'streaming') return

    const controller = new AbortController()
    const optimisticId = `local:${Date.now()}:${Math.random().toString(36).slice(2)}`
    set((state) => ({
      messages: [...state.messages, { id: optimisticId, role: 'user', content: message }],
      toolActivities: [],
      status: 'streaming',
      statusMessage: 'Thinking…',
      activeRunId: null,
      error: null,
      abortController: controller
    }))

    let failure: string | null = null
    try {
      for await (const event of api.streamMessage(
        activeConversationId,
        message,
        controller.signal
      )) {
        applyStreamEvent(set, event, optimisticId)
        if (event.event === 'run.failed') failure = event.data.message
      }
    } catch (error) {
      if (!controller.signal.aborted) failure = errorMessage(error)
    } finally {
      try {
        const messages = await api.getMessages(activeConversationId)
        set({ messages })
      } catch (error) {
        if (!failure) failure = errorMessage(error)
      }
      set({
        status: failure ? 'error' : 'idle',
        statusMessage: controller.signal.aborted ? 'Stopped' : null,
        error: failure,
        activeRunId: null,
        abortController: null
      })
    }
  },

  stop: async () => {
    const { activeRunId, abortController, api } = get()
    if (!abortController) return
    set({ statusMessage: 'Stopping…' })
    try {
      if (activeRunId) await api.cancelRun(activeRunId)
    } catch (error) {
      set({ error: errorMessage(error) })
    } finally {
      abortController.abort()
    }
  },

  clearError: () => set({ error: null, status: 'idle', statusMessage: null })
}))

type StoreSetter = Parameters<typeof useChatStore.setState>[0] extends never
  ? never
  : (partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)) => void

function applyStreamEvent(set: StoreSetter, event: ChatStreamEvent, optimisticId: string) {
  switch (event.event) {
    case 'run.started':
      set((state) => ({
        activeRunId: event.data.run_id,
        messages: state.messages.map((message) =>
          message.id === optimisticId ? event.data.user_message : message
        )
      }))
      break
    case 'assistant.delta':
      set((state) => ({
        messages: appendAssistantDelta(state.messages, event.data.message_id, event.data.text)
      }))
      break
    case 'assistant.completed':
      set((state) => ({
        messages: upsertMessage(state.messages, event.data.message)
      }))
      break
    case 'tool.started':
      set((state) => ({
        toolActivities: upsertTool(state.toolActivities, {
          callId: event.data.call_id,
          name: event.data.name,
          summary: event.data.summary,
          status: 'running'
        }),
        statusMessage: event.data.summary
      }))
      break
    case 'tool.completed':
      set((state) => ({
        toolActivities: upsertTool(state.toolActivities, {
          callId: event.data.call_id,
          name: event.data.name,
          summary: event.data.summary,
          status: event.data.ok ? 'completed' : 'failed'
        }),
        statusMessage: event.data.summary
      }))
      break
    case 'run.cancelled':
      set({ statusMessage: event.data.message })
      break
    case 'run.failed':
      set({ error: event.data.message, statusMessage: null })
      break
    case 'stream.done':
      break
  }
}

function appendAssistantDelta(messages: ChatMessage[], id: string, text: string): ChatMessage[] {
  const existing = messages.find((message) => message.id === id)
  if (!existing) return [...messages, { id, role: 'assistant', content: text }]
  return messages.map((message) =>
    message.id === id ? { ...message, content: message.content + text } : message
  )
}

function upsertMessage(messages: ChatMessage[], next: ChatMessage): ChatMessage[] {
  return messages.some((message) => message.id === next.id)
    ? messages.map((message) => (message.id === next.id ? next : message))
    : [...messages, next]
}

function upsertTool(activities: ToolActivity[], next: ToolActivity): ToolActivity[] {
  return activities.some((activity) => activity.callId === next.callId)
    ? activities.map((activity) => (activity.callId === next.callId ? next : activity))
    : [...activities, next]
}

function setFailure(set: StoreSetter, error: unknown) {
  set({ status: 'error', statusMessage: null, error: errorMessage(error) })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}
