import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';

export default function GlobalInputPalette() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { contextCapsules, removeContextCapsule, sendPrompt } = useCanvasStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); textareaRef.current?.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid #fce7f3',
          boxShadow: '0 8px 40px rgba(236,72,153,0.12), 0 2px 8px rgba(59,130,246,0.07)',
        }}
      >
        {/* Gradient top accent line */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)' }} />

        {/* Context Capsules */}
        {contextCapsules.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-2" style={{ borderBottom: '1px solid #fdf2f8' }}>
            {contextCapsules.map((capsule) => (
              <div
                key={capsule.id}
                className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1"
                style={{ background: 'linear-gradient(90deg,#fdf2f8,#eff6ff)', border: '1px solid #f9a8d4', color: '#be185d' }}
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

        {/* Input row */}
        <div className="flex items-end gap-3 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… Enter to send · Shift+Enter for newline · ⌘/ to focus"
            className="flex-1 bg-transparent text-sm resize-none outline-none max-h-40 min-h-[2.5rem] text-gray-700 placeholder-pink-200"
            rows={1}
            style={{ lineHeight: '1.5rem' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 160) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex-shrink-0 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all"
            style={input.trim()
              ? { background: 'linear-gradient(90deg,#f472b6,#60a5fa)', boxShadow: '0 2px 12px rgba(244,114,182,0.3)' }
              : { background: '#f3f4f6', color: '#d1d5db', cursor: 'not-allowed' }
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
