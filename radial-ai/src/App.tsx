import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore, getModelProvider } from './store/canvasStore';
import { computeNodeNumbers } from './utils/nodeNumbers';
import { buildCanvasJSON, buildCanvasMarkdown, safeFileStem, downloadText } from './utils/exportImport';
import type { NodeData } from './store/types';
import logo from './assets/logo-transparent.png';
import ThoughtNode from './components/ThoughtNode';
import AnnotationNode from './components/AnnotationNode';
import PlaceholderNode from './components/PlaceholderNode';
import ReadingPanel from './components/ReadingPanel';
import GlobalInputPalette from './components/GlobalInputPalette';
import ApiKeyModal from './components/ApiKeyModal';
import UsageBar from './components/UsageBar';
import FloatingEdge from './components/FloatingEdge';
import PersonaModal from './components/PersonaModal';
import HomePage from './components/HomePage';
import ReloginBanner from './components/ReloginBanner';

const nodeTypes: NodeTypes = {
  thoughtNode: ThoughtNode,
  annotationNode: AnnotationNode,
  placeholderNode: PlaceholderNode,
};

// All edge types use the floating (dynamic border-point) renderer
const edgeTypes: EdgeTypes = {
  floatingEdge: FloatingEdge,
  smoothstep: FloatingEdge,  // retrofit existing edges too
  default: FloatingEdge,
};

type ViewMode = 'split' | 'canvas' | 'panel';

// ── Layout icons ──────────────────────────────────────────────────────────────

const IconCanvasOnly = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="2" width="8" height="12" rx="1" />
    <rect x="10" y="2" width="5" height="12" rx="1" opacity="0.25" />
  </svg>
)

const IconSplit = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="2" width="6" height="12" rx="1" />
    <rect x="9" y="2" width="6" height="12" rx="1" />
  </svg>
)

const IconPanelOnly = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="2" width="5" height="12" rx="1" opacity="0.25" />
    <rect x="7" y="2" width="8" height="12" rx="1" />
  </svg>
)

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

// ── ViewMode toggle button ────────────────────────────────────────────────────

function ViewBtn({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
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
  )
}

// ── Draggable divider ─────────────────────────────────────────────────────────

function Divider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      className="relative flex-shrink-0 group cursor-col-resize z-20 select-none"
      style={{ width: 8 }}
      onMouseDown={onMouseDown}
    >
      {/* track line */}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--border-base)' }}
      />
      {/* active highlight */}
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px group-hover:w-0.5 transition-all"
        style={{ background: 'linear-gradient(180deg,#f472b6,#60a5fa)' }}
      />
      {/* drag dots */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-1 h-1 rounded-full" style={{ background: '#f472b6' }} />
        ))}
      </div>
    </div>
  )
}

// ── Canvas view ───────────────────────────────────────────────────────────────

function CanvasView() {
  const {
    closeProject,
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect, onReconnect, addBlankNode,
    setReplayRevealed, retitleAllNodes, replayRevealed,
    setSelectedNode, selectedNodeId,
    navigateBack, navigateForward,
    addFullNodeCapsule,
    apiKey, geminiApiKey, model,
    theme, toggleTheme,
    systemPrompt, personaName,
    projects, currentProjectId, renameProject,
  } = useCanvasStore();

  const currentProject = projects.find(p => p.id === currentProjectId);

  // Mouse side-button navigation (X1 = back, X2 = forward)
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); navigateBack(); }
      else if (e.button === 4) { e.preventDefault(); navigateForward(); }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [navigateBack, navigateForward]);

  // Browser back/forward gesture (trackpad swipe, browser nav buttons)
  // Uses history.pushState counter to determine swipe direction.
  const _browserCntRef = useRef(0);
  const _ignorePopRef = useRef(false);
  useEffect(() => {
    if (_ignorePopRef.current) { _ignorePopRef.current = false; return; }
    if (!selectedNodeId) return;
    _browserCntRef.current++;
    history.pushState({ _rc: _browserCntRef.current }, '');
  }, [selectedNodeId]);
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const newCnt = e.state?._rc ?? 0;
      _ignorePopRef.current = true;
      if (newCnt < _browserCntRef.current) navigateBack();
      else navigateForward();
      _browserCntRef.current = newCnt;
      setTimeout(() => { _ignorePopRef.current = false; }, 100);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [navigateBack, navigateForward]);

  // Keyboard shortcuts: ⌘[ / ⌘] for back/forward within node history
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement;
      const inInput = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      if (inInput) return;
      if (e.key === '[') { e.preventDefault(); navigateBack(); }
      else if (e.key === ']') { e.preventDefault(); navigateForward(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigateBack, navigateForward]);

  const activeProvider = getModelProvider(model);
  const activeKeySet = activeProvider === 'google' ? !!geminiApiKey : !!apiKey;
  const [showApiModal, setShowApiModal] = useState(!apiKey && !geminiApiKey);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [splitPercent, setSplitPercent] = useState(40);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss modal once a key is set
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing modal visibility to key presence
    if (activeKeySet) setShowApiModal(false);
  }, [activeKeySet]);

  // On small screens default to canvas-only
  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 768) setViewMode('canvas');
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Drag divider ────────────────────────────────────────────────────────────
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.max(20, Math.min(75, pct)));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.altKey || event.shiftKey) {
        addFullNodeCapsule(node.id);
      } else {
        setSelectedNode(node.id);
        // On mobile, clicking a node switches to panel view to read
        if (window.innerWidth < 768) setViewMode('panel');
      }
    },
    [setSelectedNode, addFullNodeCapsule]
  );

  // Click empty canvas → deselect, returning to default-timeline mode for the
  // next prompt (no reference → new node lands on the timeline).
  const handlePaneClick = useCallback(() => { setSelectedNode(null); }, [setSelectedNode]);

  // Capture the ReactFlow instance so we can map screen → flow coordinates.
  const rfInstanceRef = useRef<ReactFlowInstance<Node<NodeData>, Edge> | null>(null);

  // Double-click empty canvas → drop a fresh blank node under the cursor.
  const handlePaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('react-flow__pane')) return; // ignore nodes/edges/controls
    const inst = rfInstanceRef.current;
    if (!inst) return;
    const pos = inst.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addBlankNode({ x: pos.x - 110, y: pos.y - 20 }); // center the 220px node on the cursor
  }, [addBlankNode]);

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

  // Clean up the replay timer on unmount.
  useEffect(() => () => {
    if (replayTimerRef.current !== null) window.clearInterval(replayTimerRef.current);
  }, []);

  const [isRetitling, setIsRetitling] = useState(false);
  const handleRetitleAll = useCallback(async () => {
    if (isRetitling) return;
    setIsRetitling(true);
    try { await retitleAllNodes(); }
    finally { setIsRetitling(false); }
  }, [isRetitling, retitleAllNodes]);

  // ── Editable canvas title ─────────────────────────────────────────────────
  const commitTitle = useCallback(() => {
    if (currentProjectId && titleDraft.trim()) renameProject(currentProjectId, titleDraft.trim());
    setEditingTitle(false);
  }, [currentProjectId, titleDraft, renameProject]);

  // ── Export current canvas (JSON = lossless re-import, MD = for other LLMs) ──
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

  const modelShortName = model.includes('gemini')
    ? model.replace('gemini-', 'Gemini ').split('-').slice(0, 3).join(' ')
    : model.split('-').slice(0, 3).join(' ');

  return (
    <div className="flex flex-col w-full h-full" style={{ background: 'var(--bg-base)' }}>

      {/* SVG gradient def for edges */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-2 z-30"
        style={{
          background: 'var(--bg-topbar)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-base)',
          boxShadow: '0 1px 24px var(--shadow-topbar)',
        }}
      >
        {/* Left: logo + persona button */}
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
            onClick={() => setShowPersonaModal(true)}
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
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: '#f472b6' }}
              />
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

        {/* Right: hints + view toggles + theme + api key */}
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
            onClick={() => setShowApiModal(true)}
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

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden min-h-0">

        {/* Canvas pane */}
        {viewMode !== 'panel' && (
          <div
            className="relative flex flex-col overflow-hidden flex-shrink-0"
            style={{
              width: viewMode === 'canvas' ? '100%' : `${splitPercent}%`,
              minWidth: viewMode === 'split' ? '20%' : undefined,
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              onInit={(inst) => { rfInstanceRef.current = inst; }}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              onDoubleClick={handlePaneDoubleClick}
              nodesDraggable={true}
              zoomOnDoubleClick={false}
              multiSelectionKeyCode="Shift"
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color={theme === 'dark' ? 'rgba(244,114,182,0.1)' : '#fce7f3'} />
              <Controls showInteractive={false} />
              {viewMode !== 'canvas' ? null : (
                <MiniMap
                  nodeColor={(node) => {
                    if (node.type === 'annotationNode') return '#f9a8d4';
                    if (node.type === 'placeholderNode') return '#e5e7eb';
                    return '#818cf8';
                  }}
                  maskColor="rgba(253,242,248,0.6)"
                />
              )}
            </ReactFlow>

            {/* Canvas empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                <span className="text-3xl" style={{ color: 'var(--text-placeholder)' }}>✦</span>
                <p className="text-sm text-center px-8 leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                  Type a question below.<br />Your thoughts will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Draggable divider */}
        {viewMode === 'split' && <Divider onMouseDown={startDrag} />}

        {/* Reading panel pane */}
        {viewMode !== 'canvas' && (
          <div
            className="flex-1 relative overflow-hidden min-w-0"
            style={{
              background: 'var(--bg-surface)',
              minWidth: viewMode === 'split' ? '20%' : undefined,
              borderLeft: viewMode === 'split' ? undefined : '1px solid var(--border-base)',
            }}
          >
            {/* Back to split button (panel-only mode, mobile) */}
            {viewMode === 'panel' && (
              <button
                onClick={() => setViewMode(window.innerWidth < 768 ? 'canvas' : 'split')}
                title="Back to canvas"
                className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center rounded-xl transition-all sm:hidden"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-base)', color: '#be185d' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <ReadingPanel />
          </div>
        )}
      </div>

      {/* ── Global Input Palette ──────────────────────────────────────────────── */}
      <GlobalInputPalette />

      {showApiModal && <ApiKeyModal onClose={() => setShowApiModal(false)} />}
      {showPersonaModal && <PersonaModal onClose={() => setShowPersonaModal(false)} />}
      <UsageBar />
    </div>
  );
}

export default function App() {
  const { view, theme } = useCanvasStore();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return (
    <>
      <ReloginBanner />
      {view === 'home' ? <HomePage /> : <CanvasView />}
    </>
  );
}
