import { Position } from '@xyflow/react';

/**
 * Returns the point where the line from the node's center toward (targetCX, targetCY)
 * intersects the node's bounding-box border.
 */
export function getNodeBorderPoint(
  nodeX: number, nodeY: number, nodeW: number, nodeH: number,
  targetCX: number, targetCY: number,
): { x: number; y: number } {
  const cx = nodeX + nodeW / 2;
  const cy = nodeY + nodeH / 2;
  const dx = targetCX - cx;
  const dy = targetCY - cy;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };

  const hw = nodeW / 2;
  const hh = nodeH / 2;

  const candidates: number[] = [];
  if (dx > 0) candidates.push(hw / dx);
  else if (dx < 0) candidates.push(-hw / dx);
  if (dy > 0) candidates.push(hh / dy);
  else if (dy < 0) candidates.push(-hh / dy);

  const t = Math.min(...candidates);
  return { x: cx + t * dx, y: cy + t * dy };
}

/** Returns which side of the bounding box the given border point lies on. */
export function getExitPosition(
  point: { x: number; y: number },
  nodeX: number, nodeY: number, nodeW: number, nodeH: number,
): Position {
  const dRight  = Math.abs(point.x - (nodeX + nodeW));
  const dLeft   = Math.abs(point.x - nodeX);
  const dBottom = Math.abs(point.y - (nodeY + nodeH));
  const dTop    = Math.abs(point.y - nodeY);
  const min = Math.min(dRight, dLeft, dBottom, dTop);
  if (min === dRight)  return Position.Right;
  if (min === dLeft)   return Position.Left;
  if (min === dBottom) return Position.Bottom;
  return Position.Top;
}
