import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import { useEffect, useMemo, useRef } from 'react'
import type { ChatMessage, ToolActivity as ToolActivityModel } from './chat.types'
import { ToolActivity } from './ToolActivity'

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true })
const defaultLinkOpen =
  markdown.renderer.rules.link_open ??
  ((tokens, index, options, _environment, renderer) =>
    renderer.renderToken(tokens, index, options))

markdown.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
  tokens[index].attrSet('target', '_blank')
  tokens[index].attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, index, options, environment, renderer)
}

export function MessageList({
  messages,
  tools,
  loading = false
}: {
  messages: ChatMessage[]
  tools: ToolActivityModel[]
  loading?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, tools])

  return (
    <div className="chat-timeline" ref={scrollRef} aria-label="Conversation messages">
      {loading && messages.length === 0 ? (
        <div className="chat-empty" role="status">
          <span className="chat-empty-orbit" aria-hidden="true" />
          <p>Opening your canvas assistant…</p>
        </div>
      ) : messages.length === 0 && tools.length === 0 ? (
        <div className="chat-empty">
          <AssistantMark />
          <h3>Build directly on the canvas</h3>
          <p>Ask me to create, update, or arrange your canvas.</p>
        </div>
      ) : (
        <>
          <ol className="chat-message-list">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ol>
          {tools.length > 0 && (
            <section className="chat-tool-section" aria-label="Canvas activity">
              <p className="chat-tool-heading">Canvas activity</p>
              <ol className="chat-tool-list">
                {tools.map((activity) => (
                  <ToolActivity key={activity.callId} activity={activity} />
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const safeHtml = useMemo(() => {
    if (message.role !== 'assistant') return ''
    return DOMPurify.sanitize(markdown.render(message.content), {
      USE_PROFILES: { html: true }
    })
  }, [message.content, message.role])

  return (
    <li className={`chat-message chat-message-${message.role}`}>
      <p className="chat-message-author">{message.role === 'user' ? 'You' : 'Canvas assistant'}</p>
      {message.role === 'user' ? (
        <p className="chat-user-copy">{message.content}</p>
      ) : (
        <div className="chat-markdown" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      )}
    </li>
  )
}

function AssistantMark() {
  return (
    <span className="chat-assistant-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
      </svg>
    </span>
  )
}
