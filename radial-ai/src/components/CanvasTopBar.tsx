import { useState, useRef, useCallback, useEffect } from 'react';
import { useCanvasStore, getModelProvider } from '../store/canvasStore';
import { computeNodeNumbers } from '../utils/nodeNumbers';
import { buildCanvasJSON, buildCanvasMarkdown, safeFileStem, downloadText } from '../utils/exportImport';
import logo from '../assets/logo-transparent.png';

export type ViewMode = 'split' | 'canvas' | 'panel';

// ── View-mode + theme icons ─────────────────────────────────────────────────────
const IconCanvasOnly = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="2" width="8" height="12" rx="1" />
    <rect x="10" y="2" width="5" height="12" rx="1" opacity="0.25" />
  </svg>
);
const IconSplit = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="2" width="6" height="12" rx="1" />
    <rect x="9" y="2" width="6" height="12" rx="1" />
  </svg>
);
const IconPanelOnly = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="2" width="5" height="12" rx="1" opacity="0.25" />
    <rect x="7" y="2" width="8" height="12" rx="1" />
  </svg>
);
const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

function ViewBtn({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
      style={active
        ? { background: 'linear-gradient(135deg,#fce7f3,#dbeafe)', color: '#be185d' }
        : { color: '#d1d5db', background: 'transparent' }}
    >
      {icon}
    </button>
  );
}

interface Props {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  onOpenApiModal: () => void;
  onOpenPersonaModal: () => void;
}

export default function CanvasTopBar({ viewMode, setViewMode, onOpenApiModal, onOpenPersonaModal }: Props) {
  const {
    closeProject, projects, currentProjectId, renameProject,
    systemPrompt, personaName,
    replayRevealed, setReplayRevealed, retitleAllNodes,
    theme, toggleTheme, model, apiKey, geminiApiKey,
  } = useCanvasStore();

  const currentProject = projects.find(p => p.id === currentProjectId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isRetitling, setIsRetitling] = useState(false);

  // ── Birth-order replay: dim all, light up in node-number order, then restore ──
  const replayTimerRef = useRef<number | null>(null);
  const startReplay = useCallback(() => {
    if (replayTimerRef.current !== null) return; // already playing
    const all = useCanvasStore.getState().nodes;
    const numbers = computeNodeNumbers(all);
    const ordered = all
      .filter(n => n.data.type === 'thoughtNode' && numbers.get(n.id))
      .sort((a, b) => Number(numbers.get(a.id)) - Number(numbers.get(b.id)))
      .map(n => n.id);
    if (ordered.length === 0) return;
    setReplayRevealed([]); // dim everything
    let i = 0;
    replayTimerRef.current = window.setInterval(() => {
      i++;
      setReplayRevealed(ordered.slice(0, i));
      if (i >= ordered.length) {
        window.clearInterval(replayTimerRef.current!);
        replayTimerRef.current = null;
        window.setTimeout(() => setReplayRevealed(null), 900); // back to normal
      }
    }, 450);
  }, [setReplayRevealed]);

  useEffect(() => () => {
    if (replayTimerRef.current !== null) window.clearInterval(replayTimerRef.current);
  }, []);

  const handleRetitleAll = useCallback(async () => {
    if (isRetitling) return;
    setIsRetitling(true);
    try { await retitleAllNodes(); }
    finally { setIsRetitling(false); }
  }, [isRetitling, retitleAllNodes]);

  const commitTitle = useCallback(() => {
    if (currentProjectId && titleDraft.trim()) renameProject(currentProjectId, titleDraft.trim());
    setEditingTitle(false);
  }, [currentProjectId, titleDraft, renameProject]);

  // Export current canvas (JSON = lossless re-import, MD = for other LLMs).
  const handleExport = useCallback((fmt: 'json' | 'md') => {
    setShowExportMenu(false);
    const state = useCanvasStore.getState();
    const name = state.projects.find(p => p.id === state.currentProjectId)?.name ?? 'canvas';
    const stem = safeFileStem(name);
    if (fmt === 'json') {
      const json = buildCanvasJSON(
        { name, nodes: state.nodes, edges: state.edges, systemPrompt: state.systemPrompt, personaName: state.personaName },
        Date.now(),
      );
      downloadText(`${stem}.radial.json`, json, 'application/json');
    } else {
      downloadText(`${stem}.md`, buildCanvasMarkdown(name, state.nodes), 'text/markdown');
    }
  }, []);

  const activeProvider = getModelProvider(model);
  const activeKeySet = activeProvider === 'google' ? !!geminiApiKey : !!apiKey;
  const modelShortName = model.includes('gemini')
    ? model.replace('gemini-', 'Gemini ').split('-').slice(0, 3).join(' ')
    : model.split('-').slice(0, 3).join(' ');

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between px-4 py-2 z-30"
      style={{
        background: 'var(--bg-topbar)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-base)',
        boxShadow: '0 1px 24px var(--shadow-topbar)',
      }}
    >
      {/* Left: logo + title + persona + replay */}
      <div className="flex items-center gap-2.5">
        <button onClick={closeProject} className="flex items-center gap-2 group" title="Back to Home">
          <img
            src={logo}
            alt="Radial AI"
            className="w-7 h-7 rounded-xl object-cover transition-opacity group-hover:opacity-80"
          />
          <span
            className="font-bold text-sm"
            style={{ background: 'linear-gradient(90deg, #ec4899, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            Radial AI
          </span>
        </button>

        {/* Editable canvas title */}
        {currentProject && (editingTitle ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            autoFocus
            className="text-sm font-semibold rounded-lg px-2 py-1 outline-none max-w-[220px]"
            style={{ background: 'var(--bg-subtle)', border: '1.5px solid var(--border-accent)', color: 'var(--text-body)' }}
          />
        ) : (
          <button
            onClick={() => { setTitleDraft(currentProject.name); setEditingTitle(true); }}
            title="點擊編輯畫布標題"
            className="text-sm font-semibold px-2 py-1 rounded-lg transition-colors truncate max-w-[220px]"
            style={{ color: 'var(--text-body)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {currentProject.name}
          </button>
        ))}

        {/* Persona trigger */}
        <button
          onClick={onOpenPersonaModal}
          title={systemPrompt ? `Persona: ${personaName || 'Custom'}` : 'Set AI Persona'}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
          style={systemPrompt ? {
            background: 'linear-gradient(135deg,rgba(244,114,182,0.15),rgba(96,165,250,0.15))',
            border: '1px solid rgba(244,114,182,0.4)',
            color: '#f472b6',
          } : {
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-base)',
            color: 'var(--text-faint)',
          }}
        >
          <span>🤖</span>
          {systemPrompt
            ? <span className="hidden sm:inline font-medium">{personaName || 'GEM自訂'}</span>
            : <span className="hidden sm:inline">GEM自訂</span>
          }
          {systemPrompt && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#f472b6' }} />
          )}
        </button>

        {/* Birth-order replay animation */}
        <button
          onClick={startReplay}
          disabled={replayRevealed !== null}
          title="播放節點誕生動畫（依節點編號依序亮起）"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-base)',
            color: replayRevealed !== null ? 'var(--text-faint)' : '#f472b6',
          }}
        >
          <span>{replayRevealed !== null ? '◉' : '▶'}</span>
          <span className="hidden sm:inline">{replayRevealed !== null ? '播放中…' : '誕生動畫'}</span>
        </button>
      </div>

      {/* Right: hints + view toggles + export + retitle + theme + api key */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-pink-300 hidden lg:inline">Click node → read</span>
        <span className="text-pink-200 hidden lg:inline">·</span>
        <span className="text-xs text-blue-300 hidden lg:inline">⌘K → quote</span>

        {/* View mode toggle group */}
        <div
          className="flex items-center gap-0.5 rounded-xl p-0.5 hidden sm:flex"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-base)' }}
        >
          <ViewBtn icon={<IconCanvasOnly />} label="Canvas only" active={viewMode === 'canvas'} onClick={() => setViewMode('canvas')} />
          <ViewBtn icon={<IconSplit />}      label="Split view"   active={viewMode === 'split'}  onClick={() => setViewMode('split')} />
          <ViewBtn icon={<IconPanelOnly />}  label="Panel only"  active={viewMode === 'panel'}  onClick={() => setViewMode('panel')} />
        </div>

        {/* Export current canvas */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(v => !v)}
            title="匯出此畫布"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-base)', color: '#60a5fa' }}
          >
            <span>⤓</span><span className="hidden md:inline">匯出</span>
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
              <div
                className="absolute right-0 mt-1 z-50 rounded-xl overflow-hidden min-w-[190px]"
                style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-base)', boxShadow: '0 8px 32px var(--shadow-md)', backdropFilter: 'blur(8px)' }}
              >
                <button
                  onClick={() => handleExport('md')}
                  className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-black/5"
                  style={{ color: 'var(--text-body)' }}
                >
                  📄 匯出 Markdown
                  <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>給其他 LLM 閱讀</div>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-black/5"
                  style={{ color: 'var(--text-body)', borderTop: '1px solid var(--border-base)' }}
                >
                  🧩 匯出 JSON
                  <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>可重新匯入 Radial AI（完整保留）</div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* AI rename all node titles (free Gemini) */}
        <button
          onClick={handleRetitleAll}
          disabled={isRetitling}
          title="用免費 Gemini 重新命名所有節點標題"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all"
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-base)',
            color: isRetitling ? 'var(--text-faint)' : '#a78bfa',
          }}
        >
          <span>{isRetitling ? '⏳' : '✨'}</span>
          <span className="hidden md:inline">{isRetitling ? '命名中…' : 'AI命名'}</span>
        </button>

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
          onClick={onOpenApiModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={activeKeySet ? {
            background: activeProvider === 'google'
              ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
              : 'linear-gradient(135deg, #fce7f3, #dbeafe)',
            color: activeProvider === 'google' ? '#065f46' : '#be185d',
            border: `1px solid ${activeProvider === 'google' ? '#6ee7b7' : '#f9a8d4'}`,
          } : {
            background: 'linear-gradient(135deg, #fff1f2, #fff0f5)',
            color: '#e11d48',
            border: '1px solid #fecdd3',
          }}
        >
          <span>{activeKeySet ? '⚙' : '⚠'}</span>
          <span className="hidden sm:inline">
            {activeKeySet ? `${activeProvider === 'google' ? 'Gemini' : 'Claude'} · ${modelShortName}` : 'Set API Key'}
          </span>
        </button>
      </div>
    </div>
  );
}
