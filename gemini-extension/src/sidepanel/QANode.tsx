import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useStore, type ReadStatus } from './store'

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

function QANodeImpl({ id, data }: NodeProps) {
  const d = data as { index: number; loading?: boolean }
  const index = d.index
  const { nodes, meta, selectedId, cycleStatus } = useStore()
  const [hover, setHover] = useState(false)

  if (d.loading) {
    return (
      <div className="qa-node loading">
        <Handle type="target" position={Position.Top} className="qa-handle" />
        <span className="qa-spinner" />
        <span className="qa-num">產生中…</span>
      </div>
    )
  }

  const n = nodes.find((x) => x.id === id)
  if (!n) return null
  const m = meta[id]
  const status = m?.status ?? 'unread'
  const color = m?.topic ? topicColor(m.topic) : STATUS_COLOR[status]

  return (
    <div
      className={`qa-node${selectedId === id ? ' sel' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Handle type="target" position={Position.Top} className="qa-handle" />

      <span
        className="qa-dot"
        style={{ background: color }}
        title={`閱讀狀態：${status}（點擊切換）`}
        onClick={(e) => {
          e.stopPropagation()
          cycleStatus(id)
        }}
      />
      <span className="qa-num">#{index + 1}</span>
      {m?.summary ? (
        <span className="qa-summary" title="已 AI 摘要">
          <span className="qa-ai">✨</span>
          {m.summary}
        </span>
      ) : (
        // Fallback when there's no AI summary: show the QA text itself.
        <span className="qa-summary dim">{(n.question || n.answerText || '（無文字）').slice(0, 22)}</span>
      )}

      {hover && (
        <div className="qa-tip">
          {m?.summary && <div className="qa-sum">{m.summary}</div>}
          <div className="qa-q">{n.question || '（圖片／無文字提問）'}</div>
          <div className="qa-a">{n.answerText.slice(0, 180) || '（無回應文字）'}</div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="qa-handle" />
    </div>
  )
}

export const QANode = memo(QANodeImpl)
