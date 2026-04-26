import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function PlaceholderNode() {
  const handleStyle = { background: '#e5e7eb', border: '2px solid white', width: 10, height: 10 };
  return (
    <div
      className="rounded-2xl flex items-center justify-center"
      style={{ width: 220, height: 60, background: '#fafbff', border: '1.5px dashed #fce7f3' }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <span className="text-sm text-pink-200 italic">[Deleted Node]</span>
    </div>
  );
}

export default memo(PlaceholderNode);
