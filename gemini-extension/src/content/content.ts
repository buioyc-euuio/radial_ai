import { initAnnotate } from './annotate'
import { initDock, toggleDock, notifyPanel } from './dock'
import { initWatch } from './watch'
import { doImport, scrollToNode } from './ops'
import type { Request } from '../shared/messages'

// Content script: runs inside the Gemini page.
initAnnotate() // selection toolbar (引用回覆 / 螢光筆 / 筆記)
void initDock() // injected dockable canvas panel (iframe)
initWatch((type, payload) => notifyPanel(type, payload)) // auto-add node on submit

chrome.runtime.onMessage.addListener((msg: Request, _sender, sendResponse) => {
  switch (msg.type) {
    case 'TOGGLE_DOCK':
      toggleDock()
      sendResponse({ ok: true })
      return
    case 'PING':
      sendResponse({ type: 'PONG' })
      return
    case 'IMPORT_CONVERSATION':
      sendResponse(doImport())
      return
    case 'JUMP_TO':
      sendResponse(
        scrollToNode(msg.id) ? { ok: true } : { ok: false, error: '找不到該訊息，可能已切換對話。' },
      )
      return
  }
})
