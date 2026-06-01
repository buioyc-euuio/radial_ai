import { BaseEdge, getBezierPath, useStore, type EdgeProps } from '@xyflow/react';
import { getNodeBorderPoint, getExitPosition } from '../utils/floatingEdgeUtils';

const DEFAULT_W = 220;
const DEFAULT_H = 140;
const DEFAULT_STROKE = '#f472b6';

export default function FloatingEdge({ id, source, target, style, selected }: EdgeProps) {
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

  // Use the edge's own stroke color for the arrowhead, and render the marker
  // in a local <defs> so it paints on the very first frame. Relying on React
  // Flow's global marker definitions caused the arrow (and its color) to only
  // appear after a re-render was forced by moving a node.
  const strokeColor = (style?.stroke as string | undefined) ?? DEFAULT_STROKE;
  const markerId = `floating-arrow-${id}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="12"
          markerHeight="12"
          viewBox="-10 -10 20 20"
          orient="auto-start-reverse"
          refX="0"
          refY="0"
          markerUnits="userSpaceOnUse"
        >
          <polyline
            points="-6,-5 0,0 -6,5 -6,-5"
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: selected ? 2.5 : 1.5,
          stroke: strokeColor,
          ...style,
        }}
        markerEnd={`url(#${markerId})`}
      />
    </>
  );
}
