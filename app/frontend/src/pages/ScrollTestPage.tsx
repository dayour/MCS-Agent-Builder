import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const FAKE_RESPONSE = `Thanks for your message! Here's a detailed response to make sure we have enough content to test the scrolling behavior.

First paragraph: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.

Second paragraph: Ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Third paragraph: Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem.

Fourth paragraph: At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi.

Fifth paragraph: Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est.`;

const PARAGRAPHS = FAKE_RESPONSE.split('\n\n');

// Space reserved for the absolutely-positioned input bar
const INPUT_BAR_HEIGHT = 64;
// Breathing room between user message and top of container
const SCROLL_TOP_OFFSET = 40;

export function ScrollTestPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello! Send me a message to test the scroll behavior.' },
    { id: '2', role: 'user', content: 'What is the capital of France?' },
    { id: '3', role: 'assistant', content: 'The capital of France is Paris.' },
    { id: '4', role: 'user', content: 'And Germany?' },
    { id: '5', role: 'assistant', content: 'The capital of Germany is Berlin.' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pendingScrollIdRef = useRef<string | null>(null);
  const streamTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear any pending stream timeouts on unmount
  useEffect(() => {
    return () => {
      streamTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Direct DOM padding manipulation — no React state, no re-render, no layout shift.
  const inflatePadding = () => {
    const c = scrollAreaRef.current;
    if (!c) return;
    c.style.paddingBottom = `${c.clientHeight + INPUT_BAR_HEIGHT}px`;
  };

  // Scroll user message to top on send, follow bottom during streaming
  useEffect(() => {
    const container = scrollAreaRef.current;
    if (!container) return;

    if (pendingScrollIdRef.current) {
      const id = pendingScrollIdRef.current;
      pendingScrollIdRef.current = null;
      const el = container.querySelector(`[data-message-id="${id}"]`) as HTMLElement;
      if (!el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      container.scrollTop = container.scrollTop + (elRect.top - containerRect.top) - SCROLL_TOP_OFFSET;
    } else if (isLoading) {
      container.scrollTop = container.scrollHeight - container.clientHeight;
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };

    // Reset any previous inflation (sync write — browser won't paint between this and inflate below)
    const c = scrollAreaRef.current;
    if (c) c.style.paddingBottom = `${INPUT_BAR_HEIGHT}px`;

    // Inflate before state update so the container has scroll room when the effect fires
    inflatePadding();
    pendingScrollIdRef.current = userMsg.id;

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput('');
    setIsLoading(true);

    // Clear any previously-scheduled stream timeouts before scheduling new ones
    streamTimeoutsRef.current.forEach(clearTimeout);
    streamTimeoutsRef.current = [];

    PARAGRAPHS.forEach((para, i) => {
      const id = setTimeout(() => {
        setMessages(prev =>
          prev.map(m =>
            m.id === aiMsg.id
              ? { ...m, content: m.content + (m.content ? '\n\n' : '') + para }
              : m
          )
        );
        if (i === PARAGRAPHS.length - 1) {
          setIsLoading(false);
          // Padding stays inflated — it resets at the start of the next handleSend,
          // which avoids any visual jump from deflating while the user is at the bottom.
        }
      }, (i + 1) * 400);
      streamTimeoutsRef.current.push(id);
    });
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 680,
      margin: '0 auto',
      fontFamily: 'sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid hsl(var(--stroke-default))', fontWeight: 600, flexShrink: 0 }}>
        Scroll Test
      </div>

      {/* Main area: position relative so scroll + input can be absolute children */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>

        {/* Scroll area — fills the main area, input sits on top via absolute positioning */}
        <div
          ref={scrollAreaRef}
          style={{
            position: 'absolute',
            inset: 0,
            overflowY: 'auto',
            paddingTop: 16,
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: INPUT_BAR_HEIGHT, // space for the input bar overlay
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map(m => (
              <div
                key={m.id}
                data-message-id={m.id}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: m.role === 'user' ? 'hsl(var(--primary))' : 'hsl(var(--surface-quaternary))',
                  color: m.role === 'user' ? '#fff' : '#111',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {m.content || <span style={{ opacity: 0.5 }}>●●●</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Input bar — overlays the bottom of the scroll area */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          borderTop: '1px solid hsl(var(--stroke-default))',
          display: 'flex',
          gap: 8,
          background: 'white',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message and press Enter..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, outline: 'none' }}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{ padding: '10px 20px', borderRadius: 8, background: 'hsl(var(--primary))', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, opacity: isLoading ? 0.5 : 1 }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
