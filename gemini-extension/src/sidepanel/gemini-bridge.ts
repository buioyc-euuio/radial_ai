import { GEMINI_URL_MATCH, type ImportResult } from '../shared/messages'

/** The active tab, but only if it's a Gemini conversation. */
export async function activeGeminiTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url || !GEMINI_URL_MATCH.test(tab.url)) return null
  return tab
}

export function convIdFromUrl(url?: string): string | null {
  if (!url) return null
  const m = url.match(/\/app\/([^/?#]+)/)
  return m ? m[1] : null
}

export async function requestImport(): Promise<ImportResult> {
  const tab = await activeGeminiTab()
  if (!tab?.id) {
    return { ok: false, error: '請先切到 gemini.google.com 的對話分頁，再按匯入。' }
  }
  try {
    return (await chrome.tabs.sendMessage(tab.id, {
      type: 'IMPORT_CONVERSATION',
    })) as ImportResult
  } catch {
    return {
      ok: false,
      error: '無法連線到頁面。請重新整理 Gemini 分頁後再試（擴充載入前開的分頁需重整）。',
    }
  }
}

/** Scroll the Gemini tab to a message and flash it. */
export async function jumpTo(id: string): Promise<void> {
  const tab = await activeGeminiTab()
  if (!tab?.id) return
  chrome.tabs.sendMessage(tab.id, { type: 'JUMP_TO', id }).catch(() => {})
}
