import { useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { getModelProvider } from '../store/canvasStore';

const MODEL_GROUPS = [
  {
    provider: 'anthropic' as const,
    label: 'Anthropic — Claude',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
      { id: 'claude-opus-4-7', label: 'Opus 4.7' },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    ],
  },
  {
    provider: 'google' as const,
    label: 'Google — Gemini',
    models: [
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
      { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
    ],
  },
];

const DEV_GEMINI_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
const DEV_MODE_AVAILABLE = !!DEV_GEMINI_KEY && DEV_GEMINI_KEY !== 'your_gemini_api_key_here';

export default function ApiKeyModal({ onClose }: { onClose: () => void }) {
  const { apiKey, geminiApiKey, model, setApiKey, setGeminiApiKey, setModel, theme } = useCanvasStore();
  const [anthropicInput, setAnthropicInput] = useState(apiKey);
  const [geminiInput, setGeminiInput] = useState(geminiApiKey);
  const [selectedModel, setSelectedModel] = useState(model);
  const [devModeActive, setDevModeActive] = useState(false);

  const activeProvider = getModelProvider(selectedModel);
  const isDark = theme === 'dark';

  const handleDevMode = () => {
    if (!DEV_GEMINI_KEY) return;
    setGeminiInput(DEV_GEMINI_KEY);
    setSelectedModel('gemini-3.1-pro-preview');
    setDevModeActive(true);
  };

  const handleSave = () => {
    setApiKey(anthropicInput.trim());
    setGeminiApiKey(geminiInput.trim());
    setModel(selectedModel);
    onClose();
  };

  const activeModelStyle = (provider: 'anthropic' | 'google') => {
    if (isDark) {
      return provider === 'anthropic'
        ? { background: '#2d1520', border: '1.5px solid rgba(244,114,182,0.4)', color: '#f472b6' }
        : { background: '#0d2416', border: '1.5px solid rgba(52,211,153,0.4)', color: '#34d399' };
    }
    return provider === 'anthropic'
      ? { background: 'linear-gradient(90deg,#fdf2f8,#fce7f3)', border: '1.5px solid #f9a8d4', color: '#be185d' }
      : { background: 'linear-gradient(90deg,#ecfdf5,#d1fae5)', border: '1.5px solid #6ee7b7', color: '#065f46' };
  };

  const inactiveModelStyle = {
    background: 'var(--bg-inactive)',
    border: '1.5px solid var(--border-inactive)',
    color: 'var(--text-faint)',
  };

  const anthropicAreaStyle = {
    background: activeProvider === 'anthropic' ? 'var(--bg-subtle)' : 'var(--bg-inactive)',
    border: `1.5px solid ${activeProvider === 'anthropic' ? 'var(--border-accent)' : 'var(--border-inactive)'}`,
  };

  const geminiAreaStyle = isDark
    ? {
        background: activeProvider === 'google' ? '#0d2416' : 'var(--bg-inactive)',
        border: `1.5px solid ${activeProvider === 'google' ? 'rgba(52,211,153,0.35)' : 'var(--border-inactive)'}`,
      }
    : {
        background: activeProvider === 'google' ? '#f0fdf4' : '#fafbff',
        border: `1.5px solid ${activeProvider === 'google' ? '#6ee7b7' : '#f3f4f6'}`,
      };

  const inputStyle = {
    background: 'var(--bg-base)',
    border: '1px solid var(--border-base)',
    color: 'var(--text-body)',
  };

  const cancelStyle = {
    color: 'var(--text-muted)',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '12px',
    padding: '8px 16px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(253,242,248,0.7)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-base)',
          border: '1.5px solid var(--border-base)',
          boxShadow: '0 24px 80px var(--shadow-lg)',
        }}
      >
        {/* Top gradient bar */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)' }} />

        <div className="p-6">
          {/* Title */}
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f472b6,#60a5fa)' }}>
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <circle cx="8" cy="8" r="2" fill="white" />
                <line x1="8" y1="2" x2="8" y2="5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="8" y1="10.5" x2="8" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="2" y1="8" x2="5.5" y2="8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="10.5" y1="8" x2="14" y2="8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="font-bold text-lg"
              style={{ background:'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}
            >Settings</h2>
          </div>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Choose your model and configure API keys.</p>

          {/* Model selector */}
          <div className="mb-5">
            <div className="text-[10px] font-bold tracking-widest mb-2.5"
              style={{ background:'linear-gradient(90deg,#f472b6,#818cf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}
            >MODEL</div>
            <div className="space-y-2.5">
              {MODEL_GROUPS.map((group) => (
                <div key={group.provider}>
                  <div className="text-xs font-semibold mb-1.5"
                    style={{ color: group.provider === 'anthropic' ? (isDark ? '#f472b6' : '#be185d') : (isDark ? '#34d399' : '#059669') }}>
                    {group.label}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.models.map((m) => {
                      const active = selectedModel === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModel(m.id)}
                          className="text-left text-xs px-3 py-2 rounded-xl transition-all font-medium"
                          style={active ? activeModelStyle(group.provider) : inactiveModelStyle}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Keys */}
          <div className="space-y-2.5 mb-5">
            {/* Anthropic */}
            <div className="rounded-xl p-3 transition-all" style={anthropicAreaStyle}>
              <label className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold"
                  style={{ color: activeProvider === 'anthropic' ? (isDark ? '#f472b6' : '#be185d') : 'var(--text-muted)' }}>
                  Anthropic API Key
                </span>
                {activeProvider === 'anthropic' && (
                  <span className="text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: 'linear-gradient(90deg,#f472b6,#a78bfa)' }}>Active</span>
                )}
              </label>
              <input
                type="password"
                value={anthropicInput}
                onChange={(e) => setAnthropicInput(e.target.value)}
                placeholder="sk-ant-…"
                className="w-full text-sm rounded-lg px-3 py-2 outline-none placeholder-pink-200"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#f9a8d4')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-base)')}
              />
            </div>

            {/* Gemini */}
            <div className="rounded-xl p-3 transition-all" style={geminiAreaStyle}>
              <label className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold"
                  style={{ color: activeProvider === 'google' ? (isDark ? '#34d399' : '#059669') : 'var(--text-muted)' }}>
                  Google Gemini API Key
                </span>
                {activeProvider === 'google' && (
                  <span className="text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: 'linear-gradient(90deg,#34d399,#60a5fa)' }}>Active</span>
                )}
              </label>
              <input
                type="password"
                value={geminiInput}
                onChange={(e) => setGeminiInput(e.target.value)}
                placeholder="AIza…"
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ ...inputStyle, '--placeholder-color': isDark ? '#334155' : '#bbf7d0' } as React.CSSProperties}
                onFocus={(e) => (e.target.style.borderColor = '#6ee7b7')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-base)')}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mb-3">
            <button
              onClick={onClose}
              style={cancelStyle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              Cancel
            </button>
            <button onClick={handleSave}
              className="px-5 py-2 text-sm text-white font-semibold rounded-xl transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(90deg,#f472b6,#60a5fa)', boxShadow: '0 2px 12px rgba(244,114,182,0.3)' }}>
              Save
            </button>
          </div>

          {/* Dev Mode */}
          {DEV_MODE_AVAILABLE && (
            <div style={{ borderTop: '1px solid var(--border-base)', paddingTop: 12 }}>
              <button
                onClick={handleDevMode}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all"
                style={devModeActive ? {
                  background: isDark ? '#2d2008' : 'linear-gradient(90deg,#fef9c3,#fefce8)',
                  border: '1.5px solid #fde68a',
                  color: isDark ? '#fbbf24' : '#92400e',
                } : {
                  background: 'var(--bg-inactive)',
                  border: '1.5px dashed var(--border-inactive)',
                  color: 'var(--text-faint)',
                }}
                onMouseEnter={(e) => { if (!devModeActive) { (e.currentTarget as HTMLElement).style.borderColor = '#fde68a'; (e.currentTarget as HTMLElement).style.color = isDark ? '#fbbf24' : '#78350f'; } }}
                onMouseLeave={(e) => { if (!devModeActive) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-inactive)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; } }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${devModeActive ? 'animate-pulse' : ''}`}
                  style={{ background: devModeActive ? '#f59e0b' : 'var(--text-faint)' }} />
                {devModeActive ? 'Dev Mode Active — VITE_GOOGLE_API_KEY loaded' : 'Dev Mode'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
