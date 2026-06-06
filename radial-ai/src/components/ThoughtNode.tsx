import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ThoughtNodeData } from '../store/types';
import { useCanvasStore } from '../store/canvasStore';
import { computeNodeNumbers } from '../utils/nodeNumbers';

// ── Read-status indicator (header bullet → toggle button) ─────────────────────
const STATUS_META = {
  unread: { label: '未讀', next: '已閱' },
  read: { label: '已閱', next: '重要' },
  important: { label: '重要', next: '未讀' },
} as const;

function StatusIndicator({ status }: { status: 'unread' | 'read' | 'important' }) {
  if (status === 'read') {
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === 'important') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  }
  return <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg,#f472b6,#60a5fa)' }} />;
}

function ThoughtNode({ id, data }: NodeProps) {
  const nodeData = data as ThoughtNodeData;
  const { selectedNodeId, deleteNode, nodes, replayRevealed, cycleNodeStatus } = useCanvasStore();
  const isSelected = selectedNodeId === id;
  const dimmed = Array.isArray(replayRevealed) && !replayRevealed.includes(id);

  const nodeNum = useMemo(() => {
    const map = computeNodeNumbers(nodes);
    return map.get(id) ?? '';
  }, [nodes, id]);

  if (nodeData.type !== 'thoughtNode') return null;

  const isBlank = !nodeData.prompt && !nodeData.response && !nodeData.isLoading;
  const status = nodeData.readStatus ?? 'unread';
  // Header: "#N-title" (title comes from the free Gemini namer or a manual edit
  // in the reading panel — both write nodeData.title, so this stays in sync).
  const headerLabel = `#${nodeNum}${nodeData.title ? `-${nodeData.title}` : ''}`;

  // Handles are invisible — FloatingEdge computes its own border-point endpoints
  const handleStyle = { opacity: 0, width: 8, height: 8 };

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all select-none"
      style={{
        width: 220,
        opacity: dimmed ? 0.12 : 1,
        transition: 'opacity 0.45s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        background: isSelected ? 'var(--bg-panel-header)' : 'var(--bg-base)',
        border: isSelected
          ? '1.5px solid #f472b6'
          : '1.5px solid var(--border-base)',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(244,114,182,0.2), 0 6px 24px var(--shadow-md)'
          : '0 2px 12px var(--shadow-sm)',
      }}
    >
      <Handle type="target" position={Position.Top} id="target-top" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" style={handleStyle} />
      <Handle type="target" position={Position.Left} id="target-left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="source-right" style={handleStyle} />

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{
          background: isSelected ? 'var(--bg-node-header-active)' : 'var(--bg-node-header)',
          borderBottom: '1px solid var(--border-base)',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); cycleNodeStatus(id); }}
            title={`閱讀狀態：${STATUS_META[status].label}（點擊改為「${STATUS_META[status].next}」）`}
            className="w-4 h-4 flex items-center justify-center rounded-full transition-colors flex-shrink-0 hover:bg-black/10"
          >
            <StatusIndicator status={status} />
          </button>
          <span
            className="text-[10px] font-bold tracking-wide truncate"
            style={{ background: 'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {headerLabel}
          </span>
        </div>
        <button
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
          className="text-gray-300 hover:text-red-400 text-xs w-4 h-4 flex items-center justify-center rounded transition-colors flex-shrink-0 ml-1"
          title="Delete node"
        >
          ✕
        </button>
      </div>

      {/* Prompt preview */}
      <div className="px-3 py-2.5">
        {nodeData.isLoading ? (
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
              style={{ borderColor: '#f9a8d4 #f9a8d4 #60a5fa #60a5fa' }}
            />
            <span className="text-xs text-pink-300">Thinking…</span>
          </div>
        ) : isBlank ? (
          <p className="text-xs italic leading-relaxed m-0" style={{ color: 'var(--text-placeholder)' }}>
            空白節點 · 點我貼上原文，或在下方提問
          </p>
        ) : (
          <p
            className="text-xs text-gray-600 leading-relaxed m-0"
            style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }}
          >
            {nodeData.prompt}
          </p>
        )}
      </div>

      {/* Selected indicator bar */}
      {isSelected && (
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg,#f472b6,#60a5fa)' }} />
      )}
    </div>
  );
}

export default memo(ThoughtNode);
