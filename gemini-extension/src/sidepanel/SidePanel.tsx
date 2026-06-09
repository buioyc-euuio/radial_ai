import { useEffect, useState } from 'react'
import { useStore } from './store'
import { requestImport, activeGeminiTab, convIdFromUrl } from './gemini-bridge'
import { GitTree } from './GitTree'
import { Inspector } from './Inspector'

export function SidePanel() {
  const { nodes, conversationId, hydrate, importNodes } = useStore()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // On open: load any saved tree for the conversation in the active Gemini tab.
  useEffect(() => {
    void (async () => {
      const tab = await activeGeminiTab()
      await hydrate(convIdFromUrl(tab?.url))
    })()
  }, [hydrate])

  async function onImport() {
    setError(null)
    setBusy(true)
    const res = await requestImport()
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    importNodes(res.conversationId, res.nodes)
  }

  return (
    <div className="panel">
      <header className="head">
        <h1>
          Radial AI <span className="for">for Gemini</span>
        </h1>
        <span className="phase">Phase 1</span>
      </header>

      <button className="primary" onClick={onImport} disabled={busy}>
        {busy ? '匯入中…' : nodes.length ? '重新匯入目前對話' : '匯入目前對話'}
      </button>

      {conversationId && nodes.length > 0 && (
        <p className="meta">
          {nodes.length} 個節點 · <code>{conversationId.slice(0, 12)}</code>
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {nodes.length === 0 && !error && (
        <p className="hint">
          在 Gemini 對話頁按「匯入」，把問答抓成一棵由上到下的樹。滑到節點看內容，點一下跳回原訊息。
        </p>
      )}

      {nodes.length > 0 && <Inspector />}
      {nodes.length > 0 && <GitTree />}
    </div>
  )
}
