import { parseConversation } from './parse'
import { GEMINI } from './gemini-selectors'
import type { ImportResult } from '../shared/messages'

/** Parse the current conversation (shared by the runtime + postMessage paths). */
export function doImport(): ImportResult {
  try {
    const { conversationId, nodes } = parseConversation()
    if (nodes.length === 0) {
      // On a real conversation URL but found no message nodes → likely still
      // loading, or Gemini changed its layout. Otherwise: just not in a chat yet.
      return conversationId
        ? {
            ok: false,
            error: '在這個對話抓不到訊息 — Gemini 可能仍在載入,或版面已更新。請稍候/重整;若持續發生請回報。',
          }
        : { ok: false, error: '在 Gemini 開啟一個對話,就會自動匯入。' }
    }
    return { ok: true, conversationId, nodes }
  } catch (e) {
    return {
      ok: false,
      error: `解析失敗:${String(e)}。Gemini 版面可能已更新,請回報以便修正。`,
    }
  }
}

/** Scroll a specific highlight/note mark into the center of the viewport. */
export function scrollToMark(markId: string): boolean {
  const el = document.querySelector<HTMLElement>(`mark[data-mark-id="${markId}"]`)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.animate(
    [{ backgroundColor: 'rgba(37, 99, 235, 0.35)' }, { backgroundColor: '' }],
    { duration: 1200, easing: 'ease-out' },
  )
  return true
}

/** Scroll the Gemini chat so the node's prompt box top aligns to the viewport top. */
export function scrollToNode(id: string): boolean {
  const el = document.getElementById(id)
  if (!el) return false
  const target = el.querySelector<HTMLElement>(GEMINI.userQuery) ?? el
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.animate(
    [{ backgroundColor: 'rgba(191, 219, 254, 0.55)' }, { backgroundColor: 'transparent' }],
    { duration: 1200, easing: 'ease-out' },
  )
  return true
}
