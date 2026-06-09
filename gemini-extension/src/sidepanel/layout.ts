import type { QAPair } from '../shared/messages'
import type { NodeMeta } from './store'

export interface TreeLayout {
  /** Nodes top-to-bottom by domOrder. */
  order: QAPair[]
  rowOf: Record<string, number>
  laneOf: Record<string, number>
  laneCount: number
}

/**
 * Assign each node a horizontal lane for a git-graph render.
 * Standard sweep: the first (earliest) child continues its parent's lane;
 * extra children spill into new lanes. Parents are always above their children
 * (enforced by the UI: a node's parent must have a smaller domOrder), so this is
 * always a downward-flowing forest of trees.
 */
export function computeLayout(
  nodes: QAPair[],
  meta: Record<string, NodeMeta>,
): TreeLayout {
  const order = [...nodes].sort((a, b) => a.domOrder - b.domOrder)
  const idset = new Set(order.map((n) => n.id))

  const rowOf: Record<string, number> = {}
  order.forEach((n, i) => {
    rowOf[n.id] = i
  })

  // children, sorted top-to-bottom
  const children: Record<string, string[]> = {}
  for (const n of order) {
    const p = meta[n.id]?.parentId ?? null
    if (p && idset.has(p)) (children[p] ??= []).push(n.id)
  }
  for (const k in children) children[k].sort((a, b) => rowOf[a] - rowOf[b])

  const laneOf: Record<string, number> = {}
  const reserved: (string | null)[] = [] // reserved[lane] = node expected to land there
  let laneCount = 0

  const firstFree = (): number => {
    const idx = reserved.findIndex((r) => r === null)
    if (idx !== -1) return idx
    reserved.push(null)
    return reserved.length - 1
  }

  for (const n of order) {
    let lane = reserved.findIndex((r) => r === n.id)
    if (lane === -1) lane = firstFree() // a root / unreserved node
    else reserved[lane] = null // consume the reservation
    laneOf[n.id] = lane
    laneCount = Math.max(laneCount, lane + 1)

    const kids = children[n.id] ?? []
    kids.forEach((kid, idx) => {
      if (idx === 0) reserved[lane] = kid // main line continues
      else reserved[firstFree()] = kid // branch into a new lane
    })
  }

  return { order, rowOf, laneOf, laneCount }
}
