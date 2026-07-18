import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { ConversationMenu } from "./ConversationMenu";
import { MessageList } from "./MessageList";
import { useChatStore } from "./chatStore";
import "./chat.css";

export function ChatSidebar({ canvasId }: { canvasId: string }) {
  const [collapsed, setCollapsed] = useState(true);
  const [draft, setDraft] = useState("");
  const initialize = useChatStore((state) => state.initialize);
  const messages = useChatStore((state) => state.messages);
  const toolActivities = useChatStore((state) => state.toolActivities);
  const status = useChatStore((state) => state.status);
  const statusMessage = useChatStore((state) => state.statusMessage);
  const error = useChatStore((state) => state.error);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stop = useChatStore((state) => state.stop);
  const clearError = useChatStore((state) => state.clearError);

  useEffect(() => {
    void initialize(canvasId);
  }, [canvasId, initialize]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || status === "streaming") return;
    setDraft("");
    void sendMessage(message);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  if (collapsed) {
    return (
      <button
        className="chat-expand"
        type="button"
        aria-label="Expand assistant"
        onClick={() => setCollapsed(false)}
      >
        <AssistantIcon />
        <span>AI</span>
      </button>
    );
  }

  const isLoading = status === "loading";
  const isStreaming = status === "streaming";

  return (
    <aside className="chat-sidebar" aria-label="Canvas assistant">
      <header className="chat-header">
        <div className="chat-title-group">
          <span className="chat-title-icon" aria-hidden="true">
            <AssistantIcon />
          </span>
          <div>
            <p className="chat-eyebrow">AI workspace</p>
            <h2>Canvas assistant</h2>
          </div>
        </div>
        <button
          className="chat-icon-button"
          type="button"
          aria-label="Collapse assistant"
          title="Collapse assistant"
          onClick={() => setCollapsed(true)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m12.5 5-5 5 5 5" />
          </svg>
        </button>
      </header>

      <ConversationMenu disabled={isStreaming || isLoading} />
      <MessageList
        messages={messages}
        tools={toolActivities}
        loading={isLoading}
      />

      {error && (
        <div className="chat-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      <div className="hermes-sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      <form className="chat-composer" onSubmit={submit}>
        <label htmlFor="chat-message">Message</label>
        <div className="chat-composer-input">
          <textarea
            id="chat-message"
            rows={3}
            maxLength={20_000}
            value={draft}
            placeholder="Ask about this canvas…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            disabled={isLoading}
          />
          {isStreaming ? (
            <button
              className="chat-submit chat-stop"
              type="button"
              aria-label="Stop response"
              onClick={() => void stop()}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <rect x="6" y="6" width="8" height="8" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              className="chat-submit"
              type="submit"
              aria-label="Send message"
              disabled={!draft.trim() || isLoading}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="m4 10 12-6-4 12-2-5-6-1Z" />
              </svg>
            </button>
          )}
        </div>
        <p className="chat-composer-hint">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </aside>
  );
}

function AssistantIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
    </svg>
  );
}
