import React, { useState, useRef, useEffect } from 'react';

export default function ChatAssistant({
  messages,
  onSend,
  loading,
  onClose,
  isOpen,
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-b border-slate-600">
        <h3 className="font-semibold text-slate-200">AI Reel Maker Assistant</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[320px]"
      >
        {messages.length === 0 ? (
          <p className="text-slate-400 text-sm">Start a conversation to brainstorm your reel idea.</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-emerald-600/80 text-white'
                    : 'bg-slate-700 text-slate-200'
                }`}
              >
                <p className="whitespace-pre-wrap">
                  {m.content}
                  {loading && i === messages.length - 1 && m.role === 'assistant' && (
                    <span className="inline-block w-0.5 h-4 ml-0.5 bg-current animate-pulse align-middle" aria-hidden />
                  )}
                </p>
              </div>
            </div>
          ))
        )}
        {loading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-lg px-3 py-2 text-slate-400 text-sm">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-600">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
