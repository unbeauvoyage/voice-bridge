import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../../api.ts';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function ArticleChat({
  content,
  itemId,
  messages,
  onMessages,
}: {
  content: string;
  itemId?: string;
  messages: ChatMessage[];
  onMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}): React.JSX.Element {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted chat history from DB when itemId changes
  useEffect(() => {
    if (!itemId) return;
    api.getChatHistory(itemId).then((data: { messages: ChatMessage[] }) => {
      if (data.messages.length > 0) onMessages(data.messages);
    }).catch(() => {});
  }, [itemId]);

  async function handleSend(): Promise<void> {
    const msg = input.trim();
    if (!msg || loading) return;
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: msg }];
    onMessages(newMessages);
    setInput('');
    setLoading(true);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    try {
      let reply: string;
      if (itemId) {
        const res = await api.discussItem(itemId, msg, messages);
        reply = res.reply;
      } else {
        const res = await api.previewChat(content, newMessages);
        reply = res.reply;
      }
      onMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      onMessages([...newMessages, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
  }

  return (
    <div className="reader-discuss-section">
      <div className="reader-discuss-header">
        <div className="reader-section-label">Discuss</div>
        {itemId && messages.length > 0 && (
          <button
            className="chat-clear-btn"
            onClick={() => {
              api.clearChatHistory(itemId).then(() => { onMessages([]); setInput(''); }).catch(() => {});
            }}
            title="Clear chat history"
          >Clear</button>
        )}
      </div>
      <div className="reader-discuss-messages">
        {messages.length === 0 && (
          <div className="reader-discuss-empty">Ask anything about this article — the model has the full transcript and summary as context.</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`reader-discuss-msg reader-discuss-msg--${msg.role}`}>
            <span className="reader-discuss-role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
            <span className="reader-discuss-content">{msg.content}</span>
          </div>
        ))}
        {loading && (
          <div className="reader-discuss-msg reader-discuss-msg--assistant reader-discuss-msg--loading">
            <span className="reader-discuss-role">Assistant</span>
            <span className="reader-discuss-content reader-discuss-typing">Thinking…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="reader-discuss-input-row">
        <textarea
          ref={inputRef}
          className="reader-discuss-input"
          placeholder="Ask a question about this article…"
          value={input}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          disabled={loading}
        />
        <button
          className="reader-discuss-send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>
      {!itemId && messages.length > 0 && (
        <button
          className="reader-discuss-clear-btn"
          onClick={() => { onMessages([]); setInput(''); }}
        >
          Clear conversation
        </button>
      )}
    </div>
  );
}
