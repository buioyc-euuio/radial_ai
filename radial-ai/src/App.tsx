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
import type { NodeData, ThoughtNodeData } from './store/types';
import CanvasTopBar, { type ViewMode } from './components/CanvasTopBar';
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
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect, onReconnect, addBlankNode,
    setSelectedNode, selectedNodeId,
    setInputMode,
    navigateBack, navigateForward,
    addFullNodeCapsule,
    apiKey, geminiApiKey, model,
    theme,
  } = useCanvasStore();

  // ReactFlow only re-renders its nodes/edges when THIS component re-renders, so
  // subscribe to the replay state here — that cascade is what lets ThoughtNode /
  // FloatingEdge pick up the per-step dim during the birth-order animation.
  const replayRevealed = useCanvasStore(s => s.replayRevealed);

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
        return;
      }
      setSelectedNode(node.id);
      const d = node.data as ThoughtNodeData;
      if (d?.type === 'thoughtNode' && !d.prompt && !d.response) {
        // Clicking a blank node → switch to 原文模式 and focus the input to paste.
        setInputMode('raw');
        window.dispatchEvent(new CustomEvent('radial:focus-palette'));
      } else if (window.innerWidth < 768) {
        // On mobile, clicking a content node switches to panel view to read.
        setViewMode('panel');
      }
    },
    [setSelectedNode, addFullNodeCapsule, setInputMode]
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
      <CanvasTopBar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenApiModal={() => setShowApiModal(true)}
        onOpenPersonaModal={() => setShowPersonaModal(true)}
      />

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        data-replay-step={replayRevealed ? replayRevealed.length : undefined}
        className="flex flex-1 overflow-hidden min-h-0"
      >

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
