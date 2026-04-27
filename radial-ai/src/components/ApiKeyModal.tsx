import { useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { getModelProvider } from '../store/canvasStore';
import { useAuthStore } from '../store/authStore';

const MODEL_GROUPS = [
  {
    provider: 'anthropic' as const,
    label: 'Anthropic — Claude',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', devOnly: false },
      { id: 'claude-opus-4-7', label: 'Opus 4.7', devOnly: false },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', devOnly: false },
    ],
  },
  {
    provider: 'google' as const,
    label: 'Google — Gemini',
    models: [
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', devOnly: true },
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', devOnly: false },
      { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', devOnly: false, recommended: true },
      { id: 'gemma-3-27b-it', label: 'Gemma 3 27B', devOnly: false },
      { id: 'gemma-4-31b-it', label: 'Gemma 4 31B', devOnly: false },
    ],
  },
];

const DEV_GEMINI_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
const DEV_MODE_AVAILABLE = !!DEV_GEMINI_KEY && DEV_GEMINI_KEY !== 'your_gemini_api_key_here';

export default function ApiKeyModal({ onClose }: { onClose: () => void }) {
  const { apiKey, geminiApiKey, model, setApiKey, setGeminiApiKey, setModel, theme } = useCanvasStore();
  const { isWhitelisted, devMode, setDevMode } = useAuthStore();
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
                    {group.models.filter(m => !m.devOnly || DEV_MODE_AVAILABLE).map((m) => {
                      const active = selectedModel === m.id;
                      const lockedOut = devMode && isWhitelisted && m.id !== 'gemini-3.1-flash-lite-preview';
                      return (
                        <button
                          key={m.id}
                          onClick={() => !lockedOut && setSelectedModel(m.id)}
                          disabled={lockedOut}
                          title={lockedOut ? '白名單模式已鎖定此模型' : (m as { recommended?: boolean }).recommended ? 'Recommended' : undefined}
                          className="text-left text-xs px-3 py-2 rounded-xl transition-all font-medium flex items-center gap-1"
                          style={lockedOut
                            ? { ...inactiveModelStyle, opacity: 0.35, cursor: 'not-allowed' }
                            : active ? activeModelStyle(group.provider) : inactiveModelStyle}
                        >
                          {m.label}
                          {!lockedOut && (m as { recommended?: boolean }).recommended && (
                            <span style={{ fontSize: 11 }}>♛</span>
                          )}
                          {lockedOut && <span style={{ fontSize: 10, opacity: 0.5 }}>🔒</span>}
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
            {devMode && isWhitelisted ? (
              /* Dev mode: show a single locked placeholder row */
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-inactive)', border: '1.5px solid var(--border-inactive)', opacity: 0.7 }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>API Key</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ background: '#f59e0b' }}>開發者模式</span>
                </div>
                <input
                  type="password"
                  value="whitelistkey"
                  readOnly
                  disabled
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none cursor-not-allowed"
                  style={{ ...inputStyle, opacity: 0.6 }}
                />
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                  🔒 使用開發者提供的 API Key，無法修改
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}
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

          {/* Whitelist Dev Mode toggle */}
          <div style={{ borderTop: '1px solid var(--border-base)', paddingTop: 12 }}>
            {isWhitelisted ? (
              /* Toggle row */
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className="text-xs font-semibold" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                    Developer Mode
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    {devMode ? '使用開發者 API Key（模型已鎖定）' : '使用你自己的 API Key'}
                  </p>
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => setDevMode(!devMode)}
                  className="relative flex-shrink-0 w-10 h-5 rounded-full transition-all"
                  style={{ background: devMode ? '#f59e0b' : 'var(--bg-inactive)', border: '1.5px solid', borderColor: devMode ? '#f59e0b' : 'var(--border-inactive)' }}
                  title={devMode ? '關閉 Developer Mode' : '開啟 Developer Mode'}
                >
                  <span
                    className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all"
                    style={{ background: 'white', left: devMode ? 'calc(100% - 1rem)' : '0.1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                  />
                </button>
              </div>
            ) : (
              /* Non-whitelisted: show hint */
              <div className="flex items-center gap-2 px-1 opacity-50 select-none" title="僅限白名單測試人員使用">
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Developer Mode</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-inactive)', color: 'var(--text-faint)', border: '1px solid var(--border-inactive)' }}>
                  僅限白名單
                </span>
              </div>
            )}

            {/* Legacy local Dev Mode (VITE key) — shown only when available */}
            {DEV_MODE_AVAILABLE && !isWhitelisted && (
              <button
                onClick={handleDevMode}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all"
                style={devModeActive ? {
                  background: isDark ? '#2d2008' : 'linear-gradient(90deg,#fef9c3,#fefce8)',
                  border: '1.5px solid #fde68a',
                  color: isDark ? '#fbbf24' : '#92400e',
                } : {
                  background: 'var(--bg-inactive)',
                  border: '1.5px dashed var(--border-inactive)',
                  color: 'var(--text-faint)',
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${devModeActive ? 'animate-pulse' : ''}`}
                  style={{ background: devModeActive ? '#f59e0b' : 'var(--text-faint)' }} />
                {devModeActive ? 'Local Dev Key Active' : 'Local Dev Key'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
