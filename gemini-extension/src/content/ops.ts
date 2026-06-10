import { parseConversation } from './parse'
import { GEMINI } from './gemini-selectors'
import type { ImportResult } from '../shared/messages'

/** Parse the current conversation (shared by the runtime + postMessage paths). */
export function doImport(): ImportResult {
  try {
    const { conversationId, nodes } = parseConversation()
    if (nodes.length === 0) {
      return {
        ok: false,
        error: '在目前頁面找不到任何對話。請確認你在 gemini.google.com 的某個對話內。',
      }
    }
    return { ok: true, conversationId, nodes }
  } catch (e) {
    return {
      ok: false,
      error: `解析失敗：${String(e)}。Gemini 版面可能已更新，請回報以便修正 selector。`,
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
