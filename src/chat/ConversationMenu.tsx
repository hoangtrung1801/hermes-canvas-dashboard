import { useChatStore } from './chatStore'

export function ConversationMenu({ disabled }: { disabled: boolean }) {
  const conversations = useChatStore((state) => state.conversations)
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const activateConversation = useChatStore((state) => state.activateConversation)
  const newConversation = useChatStore((state) => state.newConversation)

  return (
    <div className="chat-conversation-controls">
      <label className="chat-conversation-field" htmlFor="chat-conversation">
        <span>Conversation</span>
        <select
          id="chat-conversation"
          value={activeConversationId ?? ''}
          onChange={(event) => void activateConversation(event.target.value)}
          disabled={disabled || conversations.length === 0}
        >
          {conversations.length === 0 ? (
            <option value="">Loading…</option>
          ) : (
            conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title}
              </option>
            ))
          )}
        </select>
      </label>
      <button
        className="chat-icon-button"
        type="button"
        aria-label="New conversation"
        title="New conversation"
        disabled={disabled}
        onClick={() => void newConversation()}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 4v12M4 10h12" />
        </svg>
      </button>
    </div>
  )
}
