import { useMemo, useState } from 'react'
import { useStore, type ReadStatus } from './store'
import { jumpTo } from './gemini-bridge'
import { computeLayout } from './layout'

const STATUS_COLOR: Record<ReadStatus, string> = {
  unread: '#cbd5e1',
  read: '#16a34a',
  important: '#f59e0b',
}

const TOPIC_COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']
export function topicColor(topic: string): string {
  let h = 0
  for (let i = 0; i < topic.length; i++) h = (h * 31 + topic.charCodeAt(i)) >>> 0
  return TOPIC_COLORS[h % TOPIC_COLORS.length]
}

const ROW_H = 32
const LANE_W = 16
const PAD = 12
const DOT_R = 5.5

/** Compact top-to-bottom git-graph of the imported conversation. */
export function GitTree() {
  const { nodes, meta, selectedId, setSelected, cycleStatus } = useStore()
  const [hoverId, setHoverId] = useState<string | null>(null)

  const { order, rowOf, laneOf, laneCount } = useMemo(
    () => computeLayout(nodes, meta),
    [nodes, meta],
  )

  const railW = PAD * 2 + (laneCount - 1) * LANE_W
  const height = order.length * ROW_H
  const cx = (lane: number) => PAD + lane * LANE_W
  const cy = (row: number) => row * ROW_H + ROW_H / 2

  const edges = order
    .map((n) => ({ child: n.id, parent: meta[n.id]?.parentId ?? null }))
    .filter((e) => e.parent && rowOf[e.parent] != null)

  return (
    <div className="tree" style={{ position: 'relative', height }}>
      <svg className="rail-svg" width={railW} height={height} style={{ zIndex: 2 }}>
        {edges.map((e) => {
          const x1 = cx(laneOf[e.parent!])
          const y1 = cy(rowOf[e.parent!])
          const x2 = cx(laneOf[e.child])
          const y2 = cy(rowOf[e.child])
          const d =
            x1 === x2
              ? `M${x1},${y1} L${x2},${y2}`
              : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`
          return <path key={`${e.parent}>${e.child}`} d={d} className="rail-edge" />
        })}

        {order.map((n, i) => {
          const m = meta[n.id]
          const status = m?.status ?? 'unread'
          const color = m?.topic ? topicColor(m.topic) : STATUS_COLOR[status]
          const isSel = selectedId === n.id
          return (
            <g key={n.id}>
              {isSel && (
                <circle cx={cx(laneOf[n.id])} cy={cy(i)} r={DOT_R + 3} className="dot-ring" />
              )}
              <circle
                cx={cx(laneOf[n.id])}
                cy={cy(i)}
                r={DOT_R}
                fill={color}
                className="svg-dot"
                onClick={() => cycleStatus(n.id)}
              >
                <title>{`閱讀狀態：${status}（點擊切換）`}</title>
              </circle>
            </g>
          )
        })}
      </svg>

      {order.map((n, i) => {
        const m = meta[n.id]
        const selected = selectedId === n.id
        return (
          <div
            key={n.id}
            className={`row${selected ? ' selected' : ''}`}
            style={{ height: ROW_H, paddingLeft: railW + 4 }}
            onMouseEnter={() => setHoverId(n.id)}
            onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
            onClick={() => {
              setSelected(n.id)
              jumpTo(n.id)
            }}
          >
            <span className="idx">#{i + 1}</span>
            {m?.topic && (
              <span
                className="chip"
                style={{ background: topicColor(m.topic) + '22', color: topicColor(m.topic) }}
              >
                {m.topic}
              </span>
            )}

            {hoverId === n.id && (
              <div className="hovercard" style={{ left: railW }}>
                <div className="hq">{n.question || '（圖片／無文字提問）'}</div>
                <div className="ha">{n.answerText.slice(0, 240) || '（無回應文字）'}</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
