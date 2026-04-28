import { useState, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';

interface Props {
  onClose: () => void;
}

export default function PersonaModal({ onClose }: Props) {
  const { systemPrompt, personaName, setSystemPrompt, setPersonaName } = useCanvasStore();
  const [name, setName] = useState(personaName);
  const [prompt, setPrompt] = useState(systemPrompt);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    setPersonaName(name.trim());
    setSystemPrompt(prompt.trim());
    onClose();
  };

  const handleClear = () => {
    setName('');
    setPrompt('');
    setPersonaName('');
    setSystemPrompt('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-base)',
          border: '1.5px solid var(--border-base)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1" style={{ background: 'linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)' }} />

        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🤖</span>
            <h2
              className="font-bold text-base"
              style={{ background: 'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              AI Persona
            </h2>
          </div>
          <p className="text-xs mb-5" style={{ color: 'var(--text-faint)' }}>
            為這個畫布設定 AI 的角色與指令。留空則使用預設行為。
          </p>

          {/* Persona Name */}
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
            角色名稱
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. 蘇格拉底、程式審查員、創意寫作夥伴…"
            className="w-full text-sm rounded-xl px-3 py-2.5 outline-none mb-4"
            style={{
              background: 'var(--bg-subtle)',
              border: '1.5px solid var(--border-base)',
              color: 'var(--text-body)',
            }}
            onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = '#f472b6'; }}
            onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-base)'; }}
          />

          {/* System Prompt */}
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
            系統指令 (System Prompt)
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={'你是一位嚴謹的學術顧問，以蘇格拉底式問答引導使用者深入思考。\n回答時請用繁體中文，語氣親切但邏輯嚴謹。'}
            rows={6}
            className="w-full text-sm rounded-xl px-3 py-2.5 outline-none resize-none mb-5"
            style={{
              background: 'var(--bg-subtle)',
              border: '1.5px solid var(--border-base)',
              color: 'var(--text-body)',
              lineHeight: '1.6',
            }}
            onFocus={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#f472b6'; }}
            onBlur={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border-base)'; }}
          />

          <div className="flex justify-between items-center gap-2">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-xs rounded-xl transition-colors"
              style={{ color: '#f87171', border: '1px solid var(--border-base)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              清除 Persona
            </button>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-xl transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 text-sm text-white font-semibold rounded-xl transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(90deg,#f472b6,#60a5fa)', boxShadow: '0 2px 12px rgba(244,114,182,0.3)' }}
              >
                套用
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
