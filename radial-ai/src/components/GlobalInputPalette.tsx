import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';

type Scope = 'ancestry' | 'global' | 'custom';

const SCOPE_CONFIG: Record<Scope, { icon: string; label: string; tooltip: string }> = {
  ancestry: {
    icon: '🔗',
    label: '血親路徑',
    tooltip: '直系血親 (預設): 僅傳送當前節點沿箭頭往上追溯的歷史對話，最省 Token',
  },
  global: {
    icon: '🌐',
    label: '所有節點',
    tooltip: '全局歷史: 傳送畫布上所有節點，適合跨分支綜合歸納',
  },
  custom: {
    icon: '👆',
    label: '自定義',
    tooltip: '自定義: 在畫布上 Shift+Click 選取特定節點，僅以那些節點的內容作為 Context (不追溯祖先)',
  },
};

export default function GlobalInputPalette() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { contextCapsules, removeContextCapsule, sendPrompt, historyScope, setHistoryScope } = useCanvasStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); textareaRef.current?.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handler = () => textareaRef.current?.focus();
    window.addEventListener('radial:focus-palette', handler);
    return () => window.removeEventListener('radial:focus-palette', handler);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    setError('');
    const prompt = input.trim();
    setInput('');
    try { await sendPrompt(prompt); }
    catch (err) { setError(err instanceof Error ? err.message : 'An error occurred'); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-5 px-6 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-3xl rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-input-palette)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid var(--border-base)',
          boxShadow: '0 8px 40px var(--shadow-md), 0 2px 8px var(--shadow-sm)',
        }}
      >
        {/* Gradient top accent line */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)' }} />

        {/* Context Capsules */}
        {contextCapsules.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--border-base)' }}>
            {contextCapsules.map((capsule) => (
              <div
                key={capsule.id}
                className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1"
                style={{ background: 'linear-gradient(90deg,var(--bg-subtle),var(--bg-subtle-blue))', border: '1px solid var(--border-accent)', color: '#be185d' }}
              >
                <span style={{ color: '#f472b6' }}>⎡</span>
                <span className="max-w-[160px] truncate">
                  {capsule.isFullNode ? `[Full] ${capsule.sourceNodeLabel}` : capsule.text.slice(0, 40) + (capsule.text.length > 40 ? '…' : '')}
                </span>
                <button onClick={() => removeContextCapsule(capsule.id)}
                  className="hover:text-pink-600 ml-0.5 transition-colors" style={{ color: '#f9a8d4' }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Context Scope Selector */}
        <div
          className="flex items-center gap-1 px-4 py-1.5"
          style={{ borderBottom: '1px solid var(--border-base)' }}
        >
          <span className="text-[10px] font-semibold mr-1.5 flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
            Context
          </span>
          {(Object.entries(SCOPE_CONFIG) as [Scope, typeof SCOPE_CONFIG[Scope]][]).map(([scope, cfg]) => (
            <button
              key={scope}
              onClick={() => setHistoryScope(scope)}
              title={cfg.tooltip}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all whitespace-nowrap"
              style={historyScope === scope
                ? {
                  background: 'linear-gradient(135deg,rgba(244,114,182,0.15),rgba(96,165,250,0.15))',
                  color: '#be185d',
                  border: '1px solid rgba(244,114,182,0.4)',
                  fontWeight: 600,
                }
                : {
                  color: 'var(--text-faint)',
                  border: '1px solid transparent',
                }
              }
            >
              <span>{cfg.icon}</span>
              <span className="hidden sm:inline">{cfg.label}</span>
            </button>
          ))}
          {historyScope === 'custom' && (
            <span className="text-[9px] ml-1 italic" style={{ color: 'var(--text-faint)' }}>
              Shift+Click 選取節點
            </span>
          )}
          {historyScope === 'global' && (
            <span className="text-[9px] ml-1 italic" style={{ color: 'var(--text-faint)' }}>
              ⚠ 高 Token 消耗
            </span>
          )}
        </div>

        {/* Input row */}
        <div className="flex items-end gap-3 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… Enter to send · Shift+Enter for newline · ⌘/ to focus"
            className="flex-1 bg-transparent text-sm resize-none outline-none max-h-40 min-h-[2.5rem] placeholder-pink-200"
            style={{ lineHeight: '1.5rem', color: 'var(--text-body)' }}
            rows={1}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 160) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex-shrink-0 text-sm font-semibold px-5 py-2 rounded-xl transition-all"
            style={input.trim()
              ? { background: 'linear-gradient(90deg,#f472b6,#60a5fa)', color: 'white', boxShadow: '0 2px 12px rgba(244,114,182,0.3)' }
              : { background: 'var(--bg-inactive)', color: 'var(--text-faint)', cursor: 'not-allowed' }
            }
          >
            Send
          </button>
        </div>

        {error && <div className="px-4 pb-3 text-sm" style={{ color: '#e11d48' }}>{error}</div>}
      </div>
    </div>
  );
}
