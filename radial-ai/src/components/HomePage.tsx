import { useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import ApiKeyModal from './ApiKeyModal';
import { getModelProvider } from '../store/canvasStore';
import logo from '../assets/logo-transparent.png';

// ── Theme icons ───────────────────────────────────────────────────────────────

const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
)

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function HomePage() {
  const { projects, createProject, openProject, deleteProject, renameProject, apiKey, geminiApiKey, model, theme, toggleTheme } = useCanvasStore();
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeProvider = getModelProvider(model);
  const activeKeySet = activeProvider === 'google' ? !!geminiApiKey : !!apiKey;

  const handleCreate = () => {
    const name = newName.trim() || 'Untitled Canvas';
    createProject(name);
    setNewName('');
    setShowNewModal(false);
  };

  const handleRenameSubmit = (id: string) => {
    const name = renameValue.trim();
    if (name) renameProject(id, name);
    setRenamingId(null);
  };

  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  const modalBackdrop = theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(253,242,248,0.7)';

  return (
    <div className="min-h-full" style={{ background: 'var(--bg-base)' }}>
      {/* SVG gradient def */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="hg-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3"
        style={{
          background: 'var(--bg-topbar)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-base)',
          boxShadow: '0 1px 24px var(--shadow-topbar)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Radial AI" className="w-7 h-7 rounded-xl object-cover flex-shrink-0" />
          <span className="font-bold text-sm"
            style={{ background: 'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Radial AI
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: '#f472b6', background: 'var(--bg-subtle)', border: '1px solid var(--border-base)' }}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>

          <button
            onClick={() => setShowApiModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={activeKeySet ? {
              background: activeProvider === 'google'
                ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)'
                : 'linear-gradient(135deg,#fce7f3,#dbeafe)',
              color: activeProvider === 'google' ? '#065f46' : '#be185d',
              border: `1px solid ${activeProvider === 'google' ? '#6ee7b7' : '#f9a8d4'}`,
            } : {
              background: 'linear-gradient(135deg,#fff1f2,#fff0f5)',
              color: '#e11d48',
              border: '1px solid #fecdd3',
            }}
          >
            <span>{activeKeySet ? '⚙' : '⚠'}</span>
            <span>{activeKeySet ? `${activeProvider === 'google' ? 'Gemini' : 'Claude'} · ${model.split('-').slice(0, 3).join(' ')}` : 'Set API Key'}</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="pt-20 px-6 pb-12 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="mb-10 mt-2">
          <h1 className="text-4xl font-bold mb-2"
            style={{ background: 'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Your Canvases
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Each canvas is an infinite space for AI-powered thinking.</p>
        </div>

        {/* New canvas button + grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* New canvas card */}
          <button
            onClick={() => { setNewName(''); setShowNewModal(true); }}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl p-8 transition-all hover:scale-[1.02]"
            style={{
              border: '2px dashed var(--border-base)',
              background: 'linear-gradient(135deg,var(--bg-subtle),var(--bg-subtle-blue))',
              minHeight: 160,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: 'linear-gradient(135deg,#f472b6,#60a5fa)' }}>
              <span className="text-white text-xl font-bold leading-none">+</span>
            </div>
            <span className="text-sm font-semibold"
              style={{ background: 'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              New Canvas
            </span>
          </button>

          {/* Existing project cards */}
          {sorted.map((project) => (
            <div
              key={project.id}
              className="group relative flex flex-col justify-between rounded-2xl p-5 transition-all hover:scale-[1.01] cursor-pointer"
              style={{
                background: 'var(--bg-base)',
                border: '1.5px solid var(--border-base)',
                boxShadow: '0 2px 16px var(--shadow-sm)',
                minHeight: 160,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px var(--shadow-md)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px var(--shadow-sm)'; }}
              onClick={() => openProject(project.id)}
            >
              {/* Top row */}
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--bg-panel-header)', border: '1px solid var(--border-base)' }}>
                    <span className="text-sm">✦</span>
                  </div>
                  {/* Action buttons — shown on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1"
                    onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setRenamingId(project.id); setRenameValue(project.name); }}
                      className="text-[10px] px-2 py-1 rounded-lg transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ec4899'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      title="Rename"
                    >✎</button>
                    <button
                      onClick={() => setConfirmDeleteId(project.id)}
                      className="text-[10px] px-2 py-1 rounded-lg transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      title="Delete"
                    >✕</button>
                  </div>
                </div>

                {/* Name — inline rename */}
                {renamingId === project.id ? (
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(project.id);
                      if (e.key === 'Escape') setRenamingId(null);
                      e.stopPropagation();
                    }}
                    className="w-full text-sm font-semibold rounded-lg px-2 py-1 outline-none text-gray-800"
                    style={{ background: 'var(--bg-subtle)', border: '1.5px solid var(--border-accent)' }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="text-sm font-semibold text-gray-800 leading-snug mb-1 line-clamp-2">
                    {project.name}
                  </div>
                )}
              </div>

              {/* Bottom row */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span>{project.nodes.filter(n => n.type === 'thoughtNode').length} thoughts</span>
                  <span>·</span>
                  <span>{timeAgo(project.updatedAt)}</span>
                </div>
                <div className="text-xs text-pink-300 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  Open →
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {projects.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <img src={logo} alt="Radial AI" className="w-16 h-16 rounded-2xl object-cover"
              style={{ boxShadow: '0 4px 24px rgba(236,72,153,0.15)' }} />
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-faint)' }}>
              No canvases yet. Click <strong className="text-pink-400">New Canvas</strong> to start your first AI thinking space.
            </p>
          </div>
        )}
      </div>

      {/* New canvas modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: modalBackdrop, backdropFilter: 'blur(12px)' }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-base)', border: '1.5px solid var(--border-base)', boxShadow: '0 24px 80px var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1" style={{ background: 'linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)' }} />
            <div className="p-6">
              <h2 className="font-bold text-base mb-1"
                style={{ background: 'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                New Canvas
              </h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>Give your canvas a name to get started.</p>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewModal(false); }}
                placeholder="e.g. Product Strategy, Research Notes…"
                className="w-full text-sm rounded-xl px-3 py-2.5 outline-none text-gray-800 placeholder-pink-200 mb-4"
                style={{ background: 'var(--bg-subtle)', border: '1.5px solid var(--border-accent)' }}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-sm rounded-xl transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  Cancel
                </button>
                <button onClick={handleCreate}
                  className="px-5 py-2 text-sm text-white font-semibold rounded-xl transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(90deg,#f472b6,#60a5fa)', boxShadow: '0 2px 12px rgba(244,114,182,0.3)' }}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: modalBackdrop, backdropFilter: 'blur(12px)' }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-base)', border: '1.5px solid var(--border-base)', boxShadow: '0 24px 80px var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1" style={{ background: 'linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)' }} />
            <div className="p-6">
              <h2 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Delete Canvas?</h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-faint)' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>
                  "{projects.find(p => p.id === confirmDeleteId)?.name}"
                </strong>{' '}
                will be permanently deleted.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 text-sm rounded-xl transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { deleteProject(confirmDeleteId); setConfirmDeleteId(null); }}
                  className="px-5 py-2 text-sm text-white font-semibold rounded-xl transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(90deg,#f87171,#fb923c)', boxShadow: '0 2px 12px rgba(248,113,113,0.3)' }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showApiModal && <ApiKeyModal onClose={() => setShowApiModal(false)} />}
    </div>
  );
}
