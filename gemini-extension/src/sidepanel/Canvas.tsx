import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type NodeChange,
  type Connection,
  type Node as RFNode,
  type Edge as RFEdge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore, type NodeMeta } from './store'
import { QANode } from './QANode'
import { QAEdge } from './QAEdge'
import { jumpTo } from './gemini-bridge'

const nodeTypes = { qa: QANode }
const edgeTypes = { qaEdge: QAEdge }

/** All descendants of rootId (inclusive) following the parent links. */
function subtreeOf(rootId: string, meta: Record<string, NodeMeta>, ids: string[]): Set<string> {
  const children = new Map<string, string[]>()
  for (const id of ids) {
    const p = meta[id]?.parentId
    if (p) {
      const arr = children.get(p) ?? []
      arr.push(id)
      children.set(p, arr)
    }
  }
  const out = new Set<string>([rootId])
  const stack = [rootId]
  while (stack.length) {
    const c = stack.pop()!
    for (const k of children.get(c) ?? []) {
      if (!out.has(k)) {
        out.add(k)
        stack.push(k)
      }
    }
  }
  return out
}

export function Canvas() {
  const { nodes, meta, loading, setSelected, setPosition, persistNow, setParent, pushHistory } =
    useStore()

  const ordered = useMemo(() => [...nodes].sort((a, b) => a.domOrder - b.domOrder), [nodes])

  // selected set (for group-dragging a branch) + selected edge (for delete)
  const [selSet, setSelSet] = useState<Set<string>>(new Set())
  const [selEdge, setSelEdge] = useState<{ source: string; target: string } | null>(null)
  const selEdgeRef = useRef(selEdge)
  selEdgeRef.current = selEdge

  const [rf, setRf] = useState<ReactFlowInstance | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const rfNodes: RFNode[] = useMemo(() => {
    const arr: RFNode[] = ordered.map((n, i) => ({
      id: n.id,
      type: 'qa',
      position: { x: meta[n.id]?.x ?? 20, y: meta[n.id]?.y ?? i * 70 },
      data: { index: i },
      selected: selSet.has(n.id),
    }))
    if (loading) {
      const maxY = arr.reduce((m, n) => Math.max(m, n.position.y), 0)
      arr.push({
        id: '__loading__',
        type: 'qa',
        position: { x: 20, y: maxY + 70 },
        data: { index: ordered.length, loading: true },
        draggable: false,
        selectable: false,
      })
    }
    return arr
  }, [ordered, meta, loading, selSet])

  const rfEdges: RFEdge[] = useMemo(
    () =>
      ordered
        .filter((n) => meta[n.id]?.parentId && nodes.some((x) => x.id === meta[n.id]!.parentId))
        .map((n) => ({
          id: `${meta[n.id]!.parentId}>${n.id}`,
          source: meta[n.id]!.parentId!,
          target: n.id,
          type: 'qaEdge',
          selected: selEdge?.target === n.id && selEdge.source === meta[n.id]!.parentId,
        })),
    [ordered, meta, nodes, selEdge],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) setPosition(c.id, c.position.x, c.position.y)
      }
    },
    [setPosition],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return
      const s = nodes.find((n) => n.id === c.source)
      const t = nodes.find((n) => n.id === c.target)
      if (!s || !t) return
      const [earlier, later] = s.domOrder < t.domOrder ? [s, t] : [t, s]
      setParent(later.id, earlier.id)
    },
    [nodes, setParent],
  )

  // Undo (Ctrl/Cmd+Z) and edge delete (Delete/Backspace on a selected line).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        useStore.getState().undo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const edge = selEdgeRef.current
        if (edge) {
          e.preventDefault()
          setParent(edge.target, null) // detach → child becomes a root
          setSelEdge(null)
          setSelSet(new Set())
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setParent])

  // Responsive: keep the whole graph in view as the dock resizes / nodes change.
  useEffect(() => {
    if (rf) rf.fitView({ padding: 0.25, duration: 200 })
  }, [rf, ordered.length])
  useEffect(() => {
    if (!rf || !wrapRef.current) return
    const ro = new ResizeObserver(() => rf.fitView({ padding: 0.25 }))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [rf])

  return (
    <div className="canvas" ref={wrapRef}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setRf}
        onNodesChange={onNodesChange}
        onNodeDragStart={() => pushHistory()}
        onNodeDragStop={() => persistNow()}
        onConnect={onConnect}
        onNodeClick={(_, node) => {
          setSelSet(new Set([node.id]))
          setSelEdge(null)
          setSelected(node.id)
          void jumpTo(node.id)
        }}
        onEdgeClick={(_, edge) => {
          // Select the whole branch hanging off this line so it drags together.
          setSelEdge({ source: edge.source, target: edge.target })
          setSelSet(subtreeOf(edge.target, meta, ordered.map((n) => n.id)))
        }}
        onPaneClick={() => {
          setSelSet(new Set())
          setSelEdge(null)
          setSelected(null)
        }}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
