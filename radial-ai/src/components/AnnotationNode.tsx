import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AnnotationNodeData } from '../store/types';
import { useCanvasStore } from '../store/canvasStore';
import { v4 as uuidv4 } from 'uuid';

function AnnotationNode({ id, data, selected }: NodeProps) {
  const nodeData = data as AnnotationNodeData;
  const [note, setNote] = useState(nodeData.note ?? '');
  const { addContextCapsule, deleteNode } = useCanvasStore();

  const handleAskAI = () => {
    addContextCapsule({
      id: uuidv4(),
      sourceNodeId: nodeData.parentNodeId,
      sourceNodeLabel: 'Annotation',
      text: `"${nodeData.selectedText}"\n\nNote: ${note}`,
      isFullNode: false,
    });
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        width: 260,
        background: 'white',
        border: selected ? '1.5px solid #f472b6' : '1.5px solid #fce7f3',
        boxShadow: selected
          ? '0 0 0 3px rgba(244,114,182,0.15), 0 4px 20px rgba(236,72,153,0.12)'
          : '0 2px 16px rgba(236,72,153,0.08)',
      }}
    >
      <Handle type="target" position={Position.Left}
        style={{ background: 'linear-gradient(135deg,#f472b6,#60a5fa)', border: '2px solid white', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right}
        style={{ background: 'linear-gradient(135deg,#f472b6,#60a5fa)', border: '2px solid white', width: 10, height: 10 }} />

      {/* Header — drag handle */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: 'linear-gradient(90deg,#fdf2f8,#eff6ff)', borderBottom: '1px solid #fce7f3', cursor: 'grab' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm select-none">✎</span>
          <span className="text-xs font-semibold select-none"
            style={{ background:'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}
          >Annotation</span>
        </div>
        <button onClick={() => deleteNode(id)} className="text-pink-200 hover:text-red-400 text-xs transition-colors">✕</button>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <div className="text-[10px] font-bold tracking-widest text-pink-300 mb-1">SELECTED TEXT</div>
        <div className="text-xs text-gray-500 italic rounded-xl px-2.5 py-2 mb-2 line-clamp-3"
          style={{ background: '#fdf2f8', border: '1px solid #fce7f3' }}>
          "{nodeData.selectedText}"
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add your notes…"
          className="w-full text-xs rounded-xl p-2 resize-none outline-none text-gray-700 placeholder-pink-200"
          style={{ background: '#fafbff', border: '1px solid #dbeafe' }}
          rows={3}
          onFocus={(e) => (e.target.style.borderColor = '#93c5fd')}
          onBlur={(e) => (e.target.style.borderColor = '#dbeafe')}
        />
        <button
          onClick={handleAskAI}
          className="mt-2 w-full text-white text-xs font-semibold py-1.5 rounded-xl transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(90deg,#f472b6,#60a5fa)' }}
        >
          Ask AI
        </button>
      </div>
    </div>
  );
}

export default memo(AnnotationNode);
