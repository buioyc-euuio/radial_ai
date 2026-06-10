import { useEffect, useMemo, useState } from 'react'
import { useStore } from './store'
import { jumpMark } from './gemini-bridge'
import type { SavedMark } from '../shared/messages'

/** A scrollable stack of notes (quoted text + note), ordered by chat position,
 *  click to jump to the corresponding text segment (centered in the chat). */
export function Notes() {
  const { conversationId, nodes } = useStore()
  const [marks, setMarks] = useState<SavedMark[]>([])

  useEffect(() => {
    if (!conversationId) {
      setMarks([])
      return
    }
    const key = `marks:${conversationId}`
    const load = async () => {
      const r = await chrome.storage.local.get(key)
      setMarks(((r[key] as SavedMark[]) ?? []).filter((m) => m.type === 'note'))
    }
    void load()
    const onChg = (c: Record<string, unknown>, area: string) => {
      if (area === 'local' && c[key]) void load()
    }
    chrome.storage.onChanged.addListener(onChg)
    return () => chrome.storage.onChanged.removeListener(onChg)
  }, [conversationId])

  const ordered = useMemo(() => {
    const dm = new Map(nodes.map((n) => [n.id, n.domOrder]))
    return [...marks].sort(
      (a, b) => (dm.get(a.nodeId) ?? 1e9) - (dm.get(b.nodeId) ?? 1e9) || a.start - b.start,
    )
  }, [marks, nodes])

  if (ordered.length === 0) {
    return (
      <div className="notes-empty">
        還沒有筆記。在 Gemini 回應上選字 → 筆記（<kbd>D</kbd>）。
      </div>
    )
  }

  return (
    <div className="notes">
      {ordered.map((m) => (
        <button key={m.id} className="note-card" onClick={() => jumpMark(m.id)} title="跳到對應文字">
          <div className="note-quote">{m.text}</div>
          {m.note && <div className="note-body">{m.note}</div>}
        </button>
      ))}
    </div>
  )
}
