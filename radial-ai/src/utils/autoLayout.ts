import type { Node } from '@xyflow/react';
import type { NodeData } from '../store/types';

const NODE_W = 220;
const NODE_H = 100;  // estimated height for collision
const H_GAP = 80;    // horizontal clearance between nodes
const V_GAP = 60;    // vertical clearance between nodes
const SAFE_MARGIN = 40;

interface Rect { x: number; y: number; w: number; h: number }

function nodeRect(n: Node<NodeData>): Rect {
  return {
    x: n.position.x - SAFE_MARGIN,
    y: n.position.y - SAFE_MARGIN,
    w: (n.measured?.width ?? NODE_W) + SAFE_MARGIN * 2,
    h: (n.measured?.height ?? NODE_H) + SAFE_MARGIN * 2,
  };
}

function overlaps(ax: number, ay: number, existing: Rect[]): boolean {
  const r: Rect = { x: ax - SAFE_MARGIN, y: ay - SAFE_MARGIN, w: NODE_W + SAFE_MARGIN * 2, h: NODE_H + SAFE_MARGIN * 2 };
  return existing.some(e =>
    r.x < e.x + e.w && r.x + r.w > e.x &&
    r.y < e.y + e.h && r.y + r.h > e.y
  );
}

/**
 * Returns the best (x, y) position for a new node connected to `connectedNodes`,
 * avoiding overlap with all `allNodes`.
 *
 * Strategy:
 *   1. Target centroid: right of the rightmost parent, vertically centred.
 *   2. Spiral outward from that point until a collision-free slot is found.
 *   3. Among collision-free candidates, pick the one with lowest cost
 *      (sum of distances to each connected node).
 */
export function calculateOptimalPosition(
  connectedNodes: Node<NodeData>[],
  allNodes: Node<NodeData>[],
): { x: number; y: number } {
  if (connectedNodes.length === 0) {
    // No parents: place at a default offset from the bottom of the canvas
    const maxY = allNodes.reduce((m, n) => Math.max(m, n.position.y), 0);
    return { x: 100, y: maxY + NODE_H + V_GAP };
  }

  const existing = allNodes.map(nodeRect);

  // Target centroid: right of rightmost parent, vertically centred among parents
  const maxX = Math.max(...connectedNodes.map(n => n.position.x + (n.measured?.width ?? NODE_W)));
  const avgY = connectedNodes.reduce((s, n) => s + n.position.y, 0) / connectedNodes.length;
  const targetX = maxX + H_GAP;
  const targetY = avgY;

  // Fast path: target is free
  if (!overlaps(targetX, targetY, existing)) {
    return { x: targetX, y: targetY };
  }

  // Spiral search — try increasingly large offsets
  const stepX = NODE_W + H_GAP;
  const stepY = NODE_H + V_GAP;
  const candidates: Array<{ x: number; y: number; cost: number }> = [];

  for (let ring = 1; ring <= 12; ring++) {
    const offsets: [number, number][] = [];
    for (let i = -ring; i <= ring; i++) {
      offsets.push([ring, i], [-ring, i], [i, ring], [i, -ring]);
    }
    for (const [dx, dy] of offsets) {
      const cx = targetX + dx * stepX;
      const cy = targetY + dy * stepY;
      if (!overlaps(cx, cy, existing)) {
        const cost = connectedNodes.reduce((s, n) => {
          const ndx = cx - n.position.x;
          const ndy = cy - n.position.y;
          return s + Math.sqrt(ndx * ndx + ndy * ndy);
        }, 0);
        candidates.push({ x: cx, y: cy, cost });
      }
    }
    if (candidates.length > 0) break; // stop expanding once we have candidates
  }

  if (candidates.length === 0) {
    // Fallback: use target even if overlapping
    return { x: targetX, y: targetY };
  }

  candidates.sort((a, b) => a.cost - b.cost);
  return { x: candidates[0].x, y: candidates[0].y };
}
