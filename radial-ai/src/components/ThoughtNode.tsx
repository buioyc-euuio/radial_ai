import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ThoughtNodeData } from '../store/types';
import { useCanvasStore } from '../store/canvasStore';
import { computeNodeNumbers } from '../utils/nodeNumbers';

function ThoughtNode({ id, data }: NodeProps) {
  const nodeData = data as ThoughtNodeData;
  const { selectedNodeId, deleteNode, nodes, replayRevealed } = useCanvasStore();
  const isSelected = selectedNodeId === id;
  const dimmed = Array.isArray(replayRevealed) && !replayRevealed.includes(id);

  const nodeNum = useMemo(() => {
    const map = computeNodeNumbers(nodes);
    return map.get(id) ?? '';
  }, [nodes, id]);

  if (nodeData.type !== 'thoughtNode') return null;

  const isBlank = !nodeData.prompt && !nodeData.response && !nodeData.isLoading;
  // Manual ("貼上原文") nodes have prompt "無", so preview their response instead.
  const preview = nodeData.manual
    ? (nodeData.response || nodeData.prompt || '')
    : (nodeData.prompt || nodeData.response || '');
  const displayText = nodeData.title
    ?? (preview.length > 55 ? preview.slice(0, 55) + '…' : preview);

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
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg,#f472b6,#60a5fa)' }} />
          <span
            className="text-[10px] font-bold tracking-wide"
            style={{ background: 'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            Thought {nodeNum ? `#${nodeNum}` : ''}
          </span>
        </div>
        <button
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
          className="text-gray-300 hover:text-red-400 text-xs w-4 h-4 flex items-center justify-center rounded transition-colors"
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
            空白節點 · 在下方輸入問題開始
          </p>
        ) : (
          <p className="text-xs text-gray-600 leading-relaxed m-0">{displayText}</p>
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
