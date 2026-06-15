import { useMemo, useState } from 'react'
import { useStore } from './store'
import { jumpTo } from './gemini-bridge'

/** Controls for the selected node: AI summary + topic tag + re-parent + jump. */
export function Inspector() {
  const { nodes, meta, selectedId, apiKey, setTopic, setName, setParent, setSelected, summarizeNode } =
    useStore()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const order = useMemo(() => [...nodes].sort((a, b) => a.domOrder - b.domOrder), [nodes])

  if (!selectedId) return null
  const node = nodes.find((n) => n.id === selectedId)
  if (!node) return null

  const m = meta[selectedId]
  const idx = order.findIndex((n) => n.id === selectedId)
  const parentChoices = order.filter((n) => n.domOrder < node.domOrder)

  async function onSummarize() {
    if (!selectedId) return
    setErr(null)
    setBusy(true)
    try {
      await summarizeNode(selectedId)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inspector">
      <div className="ins-head">
        <span className="ins-idx">{idx + 1}</span>
        {(m?.name || m?.summary) && <span className="ins-summary">{m.name ?? m.summary}</span>}
        <button className="ins-jump" onClick={() => jumpTo(selectedId)}>
          跳到訊息 ↗
        </button>
        <button className="ins-close" onClick={() => setSelected(null)} title="取消選取">
          ✕
        </button>
      </div>

      <div className="ins-q">{node.question || '（圖片／無文字提問）'}</div>

      <label className="ins-field">
        <span>名稱</span>
        <input
          key={selectedId + '-name'}
          defaultValue={m?.name ?? ''}
          placeholder="自訂節點名稱…"
          onBlur={(e) => setName(selectedId, e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
      </label>

      <div className="ins-field">
        <span>摘要</span>
        <button
          className="ins-ai"
          onClick={onSummarize}
          disabled={busy || !apiKey}
          title={apiKey ? '用 Gemini 產生主題標題' : '請先在右上 ⚙ 設定 API 金鑰'}
        >
          {busy ? '摘要中…' : m?.summary ? '✨ 重新摘要' : '✨ AI 摘要'}
        </button>
      </div>
      {err && <p className="error">{err}</p>}

      <label className="ins-field">
        <span>主題</span>
        <input
          key={selectedId + '-topic'}
          defaultValue={m?.topic ?? ''}
          placeholder="未分類"
          onBlur={(e) => setTopic(selectedId, e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
      </label>

      <label className="ins-field">
        <span>父節點</span>
        <select
          value={m?.parentId ?? ''}
          onChange={(e) => setParent(selectedId, e.target.value || null)}
        >
          <option value="">（根節點）</option>
          {parentChoices.map((p) => {
            const pi = order.findIndex((n) => n.id === p.id)
            const label = p.question.slice(0, 20) || '（圖片）'
            return (
              <option key={p.id} value={p.id}>
                {pi + 1}　{label}
              </option>
            )
          })}
        </select>
      </label>
    </div>
  )
}
