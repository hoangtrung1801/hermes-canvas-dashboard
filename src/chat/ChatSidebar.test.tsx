import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useChatStore } from './chatStore'
import { ChatSidebar } from './ChatSidebar'

const chatApiMock = vi.hoisted(() => ({
  listConversations: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue({
    id: 'conv:1',
    canvas_id: 'canvas_001',
    title: 'New conversation',
    is_active: true,
    created_at: '2026-07-17T00:00:00Z',
    updated_at: '2026-07-17T00:00:00Z'
  }),
  activateConversation: vi.fn(),
  getMessages: vi.fn().mockResolvedValue([]),
  cancelRun: vi.fn().mockResolvedValue(undefined),
  streamMessage: vi.fn(async function* (
    _conversationId: string,
    message: string,
    signal: AbortSignal
  ) {
    yield {
      event: 'run.started' as const,
      data: {
        run_id: 'run:1',
        user_message: { id: 'user:1', role: 'user' as const, content: message }
      }
    }
    await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()))
  })
}))

vi.mock('./chatApi', () => ({ chatApi: chatApiMock }))

beforeEach(() => {
  vi.clearAllMocks()
  chatApiMock.listConversations.mockResolvedValue([])
  chatApiMock.getMessages.mockResolvedValue([])
  useChatStore.setState(useChatStore.getInitialState(), true)
})

afterEach(() => {
  useChatStore.getState().abortController?.abort()
})

it('submits a message and exposes stop while streaming', async () => {
  render(<ChatSidebar canvasId="canvas_001" />)
  const messageBox = await screen.findByRole('textbox', { name: 'Message' })
  await waitFor(() => expect(messageBox).toBeEnabled())

  fireEvent.change(messageBox, { target: { value: 'Create a launch note' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

  expect(await screen.findByRole('button', { name: 'Stop response' })).toBeInTheDocument()
  expect(screen.getByText('Create a launch note')).toBeInTheDocument()
})

it('collapses to a labeled control and expands again', async () => {
  render(<ChatSidebar canvasId="canvas_001" />)
  await screen.findByRole('textbox', { name: 'Message' })

  fireEvent.click(screen.getByRole('button', { name: 'Collapse assistant' }))
  expect(screen.queryByRole('complementary', { name: 'Canvas assistant' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Expand assistant' }))
  expect(screen.getByRole('complementary', { name: 'Canvas assistant' })).toBeInTheDocument()
})

it('shows the empty state and keeps conversation controls labeled', async () => {
  render(<ChatSidebar canvasId="canvas_001" />)

  expect(await screen.findByText('Ask me to create, update, or arrange your canvas.')).toBeVisible()
  expect(screen.getByRole('combobox', { name: 'Conversation' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New conversation' })).toBeInTheDocument()
})
