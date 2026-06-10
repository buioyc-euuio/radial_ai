// Background service worker.
// Clicking the toolbar icon toggles the injected dock on the active Gemini tab.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_DOCK' }).catch(() => {
    // No content script (not a Gemini tab, or needs a refresh) — ignore.
  })
})
