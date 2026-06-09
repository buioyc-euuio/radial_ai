import { parseConversation } from './parse'
import { initAnnotate } from './annotate'
import type { Request, ImportResult, JumpResult } from '../shared/messages'

// Content script: runs inside the Gemini page. Reads the DOM and answers
// requests from the side panel. Never sends DOM nodes back — only data.

// Selection toolbar (引用回覆 / 螢光筆 / 筆記) injected directly onto the page.
initAnnotate()

chrome.runtime.onMessage.addListener((msg: Request, _sender, sendResponse) => {
  switch (msg.type) {
    case 'PING': {
      sendResponse({ type: 'PONG' })
      return
    }

    case 'IMPORT_CONVERSATION': {
      try {
        const { conversationId, nodes } = parseConversation()
        if (nodes.length === 0) {
          sendResponse({
            ok: false,
            error: '在目前頁面找不到任何對話。請確認你在 gemini.google.com 的某個對話內。',
          } satisfies ImportResult)
          return
        }
        sendResponse({ ok: true, conversationId, nodes } satisfies ImportResult)
      } catch (e) {
        sendResponse({
          ok: false,
          error: `解析失敗：${String(e)}。Gemini 版面可能已更新，請回報以便修正 selector。`,
        } satisfies ImportResult)
      }
      return
    }

    case 'JUMP_TO': {
      const el = document.getElementById(msg.id)
      if (!el) {
        sendResponse({ ok: false, error: '找不到該訊息，可能已切換對話。' } satisfies JumpResult)
        return
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.animate(
        [{ backgroundColor: 'rgba(191, 219, 254, 0.55)' }, { backgroundColor: 'transparent' }],
        { duration: 1200, easing: 'ease-out' },
      )
      sendResponse({ ok: true } satisfies JumpResult)
      return
    }
  }
})
