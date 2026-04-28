import { BaseEdge, getBezierPath, useStore, type EdgeProps } from '@xyflow/react';
import { getNodeBorderPoint, getExitPosition } from '../utils/floatingEdgeUtils';

const DEFAULT_W = 220;
const DEFAULT_H = 140;

export default function FloatingEdge({ id, source, target, style, markerEnd, selected }: EdgeProps) {
  const sourceNode = useStore(s => s.nodeLookup.get(source));
  const targetNode = useStore(s => s.nodeLookup.get(target));

  if (!sourceNode || !targetNode) return null;

  const sw = sourceNode.measured?.width  ?? DEFAULT_W;
  const sh = sourceNode.measured?.height ?? DEFAULT_H;
  const tw = targetNode.measured?.width  ?? DEFAULT_W;
  const th = targetNode.measured?.height ?? DEFAULT_H;

  const sx = sourceNode.internals.positionAbsolute.x;
  const sy = sourceNode.internals.positionAbsolute.y;
  const tx = targetNode.internals.positionAbsolute.x;
  const ty = targetNode.internals.positionAbsolute.y;

  const scx = sx + sw / 2;
  const scy = sy + sh / 2;
  const tcx = tx + tw / 2;
  const tcy = ty + th / 2;

  const sp = getNodeBorderPoint(sx, sy, sw, sh, tcx, tcy);
  const tp = getNodeBorderPoint(tx, ty, tw, th, scx, scy);

  const sourcePosition = getExitPosition(sp, sx, sy, sw, sh);
  const targetPosition = getExitPosition(tp, tx, ty, tw, th);

  const [edgePath] = getBezierPath({
    sourceX: sp.x, sourceY: sp.y, sourcePosition,
    targetX: tp.x, targetY: tp.y, targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        strokeWidth: selected ? 2.5 : 1.5,
        stroke: '#f472b6',
        ...style,
      }}
      markerEnd={markerEnd}
    />
  );
}
