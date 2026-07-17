export type Conversation = {
  id: string
  canvas_id: string
  title: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type ToolActivity = {
  callId: string
  name: string
  summary: string
  status: 'running' | 'completed' | 'failed'
}

export type ChatStreamEvent =
  | { event: 'run.started'; data: { run_id: string; user_message: ChatMessage } }
  | { event: 'assistant.delta'; data: { message_id: string; text: string } }
  | {
      event: 'tool.started'
      data: { call_id: string; name: string; summary: string }
    }
  | {
      event: 'tool.completed'
      data: { call_id: string; name: string; ok: boolean; summary: string }
    }
  | { event: 'assistant.completed'; data: { message: ChatMessage } }
  | { event: 'run.cancelled'; data: { run_id: string; message: string } }
  | {
      event: 'run.failed'
      data: { run_id: string; code: string; message: string; retryable: boolean }
    }
  | { event: 'stream.done'; data: { run_id: string } }

export interface ChatApi {
  listConversations(canvasId: string): Promise<Conversation[]>
  createConversation(canvasId: string): Promise<Conversation>
  activateConversation(id: string): Promise<Conversation>
  getMessages(id: string): Promise<ChatMessage[]>
  streamMessage(
    id: string,
    message: string,
    signal: AbortSignal
  ): AsyncGenerator<ChatStreamEvent>
  cancelRun(runId: string): Promise<void>
}
