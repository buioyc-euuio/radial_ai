import { initAnnotate } from './annotate'
import { initDock, toggleDock, notifyPanel } from './dock'
import { initWatch } from './watch'
import type { Request } from '../shared/messages'

// Content script: runs inside the Gemini page.
initAnnotate() // selection toolbar (引用回覆 / 螢光筆 / 筆記)
void initDock() // injected dockable canvas panel (iframe) + postMessage RPC
initWatch((type, payload) => notifyPanel(type, payload)) // auto-add node on submit

// The only runtime message is the toolbar-icon toggle from the background worker.
// Panel ↔ content-script communication goes over postMessage (see dock.ts).
chrome.runtime.onMessage.addListener((msg: Request) => {
  if (msg.type === 'TOGGLE_DOCK') toggleDock()
})
