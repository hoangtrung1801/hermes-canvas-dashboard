import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
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

it('floats the expanded assistant over the desktop canvas', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const sidebarRule = styles.match(/^\.chat-sidebar \{(?<body>[\s\S]*?)\n\}/m)

  expect(sidebarRule?.groups?.body).toMatch(/position:\s*absolute;/)
  expect(sidebarRule?.groups?.body).toMatch(/top:\s*3rem;/)
  expect(sidebarRule?.groups?.body).toMatch(/left:\s*14px;/)
  expect(sidebarRule?.groups?.body).toMatch(/bottom:\s*14px;/)
  expect(sidebarRule?.groups?.body).toMatch(/width:\s*clamp\(300px, 28vw, 360px\);/)
  expect(sidebarRule?.groups?.body).toMatch(/border-radius:\s*24px;/)
})

it('keeps the canvas full size beneath the assistant overlay', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const workspaceRule = styles.match(/^\.chat-workspace \{(?<body>[\s\S]*?)\n\}/m)
  const canvasRule = styles.match(
    /^\.chat-workspace > \.fullscreen-canvas-container \{(?<body>[\s\S]*?)\n\}/m
  )

  expect(workspaceRule?.groups?.body).toMatch(/position:\s*relative;/)
  expect(canvasRule?.groups?.body).toMatch(/width:\s*100%;/)
  expect(canvasRule?.groups?.body).not.toMatch(/margin-right|padding-right/)
})

it('uses a compact floating desktop control when chat is collapsed', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const expandRules = [...styles.matchAll(/^\.chat-expand \{(?<body>[\s\S]*?)\n\}/gm)]
  const expandRule = expandRules.at(-1)

  expect(expandRule?.groups?.body).toMatch(/position:\s*absolute;/)
  expect(expandRule?.groups?.body).toMatch(/left:\s*0;/)
  expect(expandRule?.groups?.body).toMatch(/bottom:\s*3rem;/)
  expect(expandRule?.groups?.body).toMatch(/border-radius:\s*50%;/)
})

it('keeps the collapsed control bottom anchored on mobile', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const mobileExpandRule = styles.match(
    /@media \(max-width: 760px\) \{[\s\S]*?  \.chat-expand \{(?<body>[\s\S]*?)\n  \}/
  )

  expect(mobileExpandRule?.groups?.body).toMatch(/left:\s*12px;/)
  expect(mobileExpandRule?.groups?.body).toMatch(/right:\s*auto;/)
  expect(mobileExpandRule?.groups?.body).toMatch(/bottom:\s*max\(74px,/)
})

it('uses a bright white chat palette', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const themeRule = styles.match(
    /^\.chat-sidebar,\n\.chat-expand \{(?<body>[\s\S]*?)\n\}/m
  )

  expect(themeRule?.groups?.body).toMatch(/--chat-surface:\s*#f8fafc;/)
  expect(themeRule?.groups?.body).toMatch(/--chat-surface-raised:\s*#ffffff;/)
  expect(themeRule?.groups?.body).toMatch(/--chat-border:\s*rgba\(15, 23, 42, 0\.14\);/)
  expect(themeRule?.groups?.body).toMatch(/--chat-copy:\s*#0f172a;/)
  expect(themeRule?.groups?.body).toMatch(/--chat-muted:\s*#475569;/)
})

it('uses a vivid gradient for the floating chatbot button', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const expandRules = [...styles.matchAll(/^\.chat-expand \{(?<body>[\s\S]*?)\n\}/gm)]
  const expandRule = expandRules.at(-1)

  expect(expandRule?.groups?.body).toMatch(
    /background:\s*linear-gradient\(135deg, #ffffff, #e0f2fe\);/
  )
  expect(expandRule?.groups?.body).toMatch(/color:\s*#0369a1;/)
  expect(expandRule?.groups?.body).toMatch(/border-color:\s*rgba\(14, 165, 233, 0\.38\);/)
})
