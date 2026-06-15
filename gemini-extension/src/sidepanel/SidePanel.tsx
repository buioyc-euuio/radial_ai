import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { requestImport, getConvId, onContentEvent } from './gemini-bridge'
import { Canvas } from './Canvas'
import { Inspector } from './Inspector'
import { Settings } from './Settings'
import { Notes } from './Notes'

// Bumped on every conversation switch so a slow in-flight import can't apply its
// (now stale) result over the newly-loaded chat.
let importGen = 0

// Import the current conversation, preserving user meta + applying a pending branch.
async function runImport(): Promise<boolean> {
  const gen = importGen
  const res = await requestImport()
  if (!res.ok) {
    useStore.getState().setImportError(res.error)
    return false
  }
  let branchParent: string | null | undefined
  if (res.conversationId) {
    const k = `pendingBranch:${res.conversationId}`
    const r = await chrome.storage.local.get(k)
    branchParent = r[k] as string | undefined
    if (branchParent) void chrome.storage.local.remove(k)
  }
  if (gen !== importGen) return false // superseded by a conversation switch
  useStore.getState().importNodes(res.conversationId, res.nodes, branchParent)
  return true
}

// After a new answer lands: re-import and summarize just the newest node.
async function autoImportAndSummarize() {
  if (!(await runImport())) return
  const st = useStore.getState()
  if (st.apiKey && st.autoSummary) {
    const newest = [...st.nodes].sort((a, b) => b.domOrder - a.domOrder)[0]
    if (newest && !st.meta[newest.id]?.summary) {
      try {
        await st.summarizeNode(newest.id)
      } catch {
        // Summarizer unavailable → node falls back to showing the QA text.
      }
    }
  }
}

export function SidePanel() {
  const { nodes, apiKey, importError, hydrate, setLoading } = useStore()
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sumProgress, setSumProgress] = useState<string | null>(null)
  const [tab, setTab] = useState<'canvas' | 'notes'>('canvas')

  // On open: load saved tree, then auto-import the live conversation.
  useEffect(() => {
    void (async () => {
      await hydrate(await getConvId())
      setImporting(true)
      await runImport()
      setImporting(false)
    })()
  }, [hydrate])

  // Auto-add a loading node on submit; finalize + summarize when the answer lands.
  const loadingTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    return onContentEvent(async (type) => {
      if (type === 'PENDING') {
        setLoading(true)
        setTab('canvas')
        clearTimeout(loadingTimer.current)
        loadingTimer.current = window.setTimeout(() => setLoading(false), 75000) // safety
      } else if (type === 'READY') {
        clearTimeout(loadingTimer.current)
        try {
          await autoImportAndSummarize()
        } finally {
          setLoading(false)
        }
      } else if (type === 'CONV_CHANGED') {
        // Switched chats: invalidate in-flight imports, show the new conversation's
        // cached tree at once, then re-import (Gemini renders the new chat async).
        importGen++
        clearTimeout(loadingTimer.current)
        setLoading(false)
        await hydrate(await getConvId())
        for (let i = 0; i < 5; i++) {
          if (await runImport()) break
          await new Promise((r) => setTimeout(r, 500))
        }
      }
    })
  }, [setLoading, hydrate])

  async function refresh() {
    setImporting(true)
    await runImport()
    setImporting(false)
  }

  async function summarizeAll() {
    const st = useStore.getState()
    const targets = st.nodes.filter((n) => !st.meta[n.id]?.summary)
    setError(null)
    for (let i = 0; i < targets.length; i++) {
      setSumProgress(`${i + 1}/${targets.length}`)
      try {
        await useStore.getState().summarizeNode(targets[i].id)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        break
      }
      await new Promise((r) => setTimeout(r, 400))
    }
    setSumProgress(null)
  }

  return (
    <div className="panel">
      <header className="head">
        <h1>
          Radial AI <span className="for">for Gemini</span>
        </h1>
        <div className="head-actions">
          <button
            className="gear"
            onClick={() => setHelpOpen((v) => !v)}
            title="快捷鍵說明"
            aria-label="快捷鍵說明"
          >
            ?
          </button>
          <button
            className="gear"
            onClick={refresh}
            title="重新整理"
            aria-label="重新整理"
            disabled={importing}
          >
            ↻
          </button>
          <button
            className="gear"
            onClick={() => setSettingsOpen((v) => !v)}
            title="設定"
            aria-label="設定"
          >
            ⚙
          </button>
        </div>
      </header>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {helpOpen && (
        <div className="help">
          <div className="settings-head">
            <strong>快捷鍵</strong>
            <button className="ins-close" onClick={() => setHelpOpen(false)} aria-label="關閉">
              ✕
            </button>
          </div>
          <ul>
            <li>
              <b>在 Gemini 回應上選字：</b>引用 <kbd>⌘K</kbd>/<kbd>L</kbd>/<kbd>C</kbd>/<kbd>E</kbd>、螢光筆 <kbd>H</kbd>、筆記 <kbd>D</kbd>
            </li>
            <li>
              <b>畫布：</b>點線→中間 <kbd>✕</kbd> 或 <kbd>Delete</kbd> 刪分支、<kbd>⌘Z</kbd> 復原
            </li>
            <li>
              <b>節點：</b>點一下＝跳到 Gemini 訊息;點圓點＝切換閱讀狀態;從邊緣拉線＝建立分支;點線＝選整條分支一起拖
            </li>
          </ul>
        </div>
      )}

      {nodes.length > 0 && (
        <div className="actions">
          <button
            className="secondary"
            onClick={summarizeAll}
            disabled={!apiKey || sumProgress !== null}
            title={apiKey ? '為所有未摘要的節點產生主題標題' : '請先在 ⚙ 設定 API 金鑰'}
          >
            {sumProgress ? `摘要中 ${sumProgress}` : '✨ 全部摘要'}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {nodes.length === 0 && (
        <p className={importError ? 'error' : 'hint'}>
          {importing
            ? '匯入中…'
            : (importError ??
              '在 Gemini 開啟一個對話，節點會自動匯入；送出新問題也會自動長出節點。')}
        </p>
      )}

      {nodes.length > 0 && (
        <>
          <div className="tabs">
            <button className={tab === 'canvas' ? 'on' : ''} onClick={() => setTab('canvas')}>
              畫布
            </button>
            <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>
              筆記
            </button>
          </div>
          {tab === 'canvas' ? (
            <>
              <Inspector />
              <Canvas />
            </>
          ) : (
            <Notes />
          )}
        </>
      )}
    </div>
  )
}
