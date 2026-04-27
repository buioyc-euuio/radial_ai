import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ThoughtNodeData } from '../store/types';
import { useCanvasStore } from '../store/canvasStore';
import { computeNodeNumbers } from '../utils/nodeNumbers';

function ThoughtNode({ id, data }: NodeProps) {
  const nodeData = data as ThoughtNodeData;
  const { selectedNodeId, deleteNode, nodes, edges } = useCanvasStore();
  const isSelected = selectedNodeId === id;

  const nodeNum = useMemo(() => {
    const map = computeNodeNumbers(nodes, edges);
    return map.get(id) ?? '';
  }, [nodes, edges, id]);

  if (nodeData.type !== 'thoughtNode') return null;

  const displayText = nodeData.title
    ?? (nodeData.prompt.length > 55 ? nodeData.prompt.slice(0, 55) + '…' : nodeData.prompt);

  const handleStyle = {
    background: 'linear-gradient(135deg,#f472b6,#60a5fa)',
    border: '2px solid white',
    width: 10,
    height: 10,
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all select-none"
      style={{
        width: 220,
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
