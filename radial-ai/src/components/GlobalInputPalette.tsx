import { useState, useRef, useEffect, useCallback } from 'react';
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

// ── Floating panel geometry (draggable + resizable, persisted) ────────────────
interface Rect { x: number; y: number; w: number; h: number; }
const STORAGE_KEY = 'radial:palette-rect';
const MIN_W = 320;
const MIN_H = 132;

function defaultRect(): Rect {
  const w = Math.min(760, window.innerWidth - 40);
  const h = 200;
  return { w, h, x: Math.max(20, (window.innerWidth - w) / 2), y: window.innerHeight - h - 20 };
}

function clampRect(r: Rect): Rect {
  const w = Math.min(Math.max(r.w, MIN_W), window.innerWidth - 16);
  const h = Math.min(Math.max(r.h, MIN_H), window.innerHeight - 16);
  const x = Math.min(Math.max(r.x, 8), window.innerWidth - w - 8);
  const y = Math.min(Math.max(r.y, 8), window.innerHeight - h - 8);
  return { x, y, w, h };
}

function loadRect(): Rect {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return clampRect({ ...defaultRect(), ...JSON.parse(raw) });
  } catch { /* ignore corrupt value */ }
  return defaultRect();
}

export default function GlobalInputPalette() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { contextCapsules, removeContextCapsule, sendPrompt, historyScope, setHistoryScope, commitOriginalText } = useCanvasStore();

  const [rect, setRect] = useState<Rect>(loadRect);
  const rectRef = useRef(rect);
  useEffect(() => { rectRef.current = rect; }, [rect]);

  const persist = useCallback((r: Rect) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch { /* ignore quota */ }
  }, []);

  // Keep the panel on-screen if the window is resized.
  useEffect(() => {
    const onResize = () => setRect(r => clampRect(r));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Drag by the header grip.
  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const startX = e.clientX, startY = e.clientY;
    const base = rectRef.current;
    let latest = base;
    const onMove = (ev: PointerEvent) => {
      latest = clampRect({ ...base, x: base.x + ev.clientX - startX, y: base.y + ev.clientY - startY });
      setRect(latest);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      persist(latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [persist]);

  // Resize from the bottom-right grip.
  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const startX = e.clientX, startY = e.clientY;
    const base = rectRef.current;
    let latest = base;
    const onMove = (ev: PointerEvent) => {
      latest = clampRect({ ...base, w: base.w + ev.clientX - startX, h: base.h + ev.clientY - startY });
      setRect(latest);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      persist(latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [persist]);

  const resetPosition = useCallback(() => {
    const r = defaultRect();
    setRect(r);
    rectRef.current = r;
    persist(r);
  }, [persist]);

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

  // Save the textarea text straight into a node as raw original text (no AI call).
  const handlePasteOriginal = () => {
    const text = input.trim();
    if (!text) { setError('請先在下方輸入框貼上原文'); textareaRef.current?.focus(); return; }
    setError('');
    commitOriginalText(text);
    setInput('');
  };

  return (
    <div
      className="fixed z-40 flex flex-col rounded-2xl overflow-hidden"
      style={{
        left: rect.x, top: rect.y, width: rect.w, height: rect.h,
        background: 'var(--bg-input-palette)',
        backdropFilter: 'blur(16px)',
        border: '1.5px solid var(--border-base)',
        boxShadow: '0 8px 40px var(--shadow-md), 0 2px 8px var(--shadow-sm)',
      }}
    >
      {/* Drag handle — gradient bar with a grip + reset button */}
      <div
        onPointerDown={startDrag}
        className="flex-shrink-0 flex items-center justify-center relative select-none"
        style={{ height: 16, cursor: 'move', background: 'linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)' }}
        title="拖移以移動視窗"
      >
        <div className="flex gap-1">
          <span className="block w-1 h-1 rounded-full bg-white/70" />
          <span className="block w-1 h-1 rounded-full bg-white/70" />
          <span className="block w-1 h-1 rounded-full bg-white/70" />
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={resetPosition}
          title="重設視窗位置與大小"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-[10px] leading-none"
        >
          ⤢
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Context Capsules */}
        {contextCapsules.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-2 max-h-24 overflow-y-auto flex-shrink-0" style={{ borderBottom: '1px solid var(--border-base)' }}>
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
          className="flex items-center gap-1 px-4 py-1.5 flex-shrink-0"
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
          <button
            onClick={handlePasteOriginal}
            title="把下方輸入框的文字直接存成節點（不呼叫 AI，省 API）"
            className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all whitespace-nowrap flex-shrink-0"
            style={{ color: '#be185d', border: '1px solid rgba(244,114,182,0.4)', background: 'linear-gradient(135deg,rgba(244,114,182,0.12),rgba(96,165,250,0.12))', fontWeight: 600 }}
          >
            <span>📋</span><span className="hidden sm:inline">貼上原文</span>
          </button>
        </div>

        {/* Input row — fills remaining height */}
        <div className="flex items-end gap-3 px-4 py-3 flex-1 min-h-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… Enter to send · Shift+Enter for newline · ⌘/ to focus"
            className="flex-1 h-full bg-transparent text-sm resize-none outline-none placeholder-pink-200"
            style={{ lineHeight: '1.5rem', color: 'var(--text-body)' }}
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

        {error && <div className="px-4 pb-2 text-sm flex-shrink-0" style={{ color: '#e11d48' }}>{error}</div>}
      </div>

      {/* Resize grip (bottom-right) */}
      <div
        onPointerDown={startResize}
        className="absolute bottom-0 right-0 select-none"
        style={{ width: 18, height: 18, cursor: 'nwse-resize' }}
        title="拖移以調整大小"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" style={{ position: 'absolute', bottom: 2, right: 2 }}>
          <path d="M16 6 L6 16 M16 11 L11 16" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    </div>
  );
}
