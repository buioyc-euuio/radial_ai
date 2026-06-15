// Background service worker.

// Open the onboarding page on first install.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') })
  }
})

// Clicking the toolbar icon toggles the dock on a Gemini tab; if the user isn't
// on Gemini, send them there (so the click never silently does nothing).
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return
  if (tab.url && /^https:\/\/gemini\.google\.com\//.test(tab.url)) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_DOCK' }).catch(() => {
      // Content script not injected yet (tab predates install) — reload to inject.
      void chrome.tabs.reload(tab.id!)
    })
  } else {
    void chrome.tabs.create({ url: 'https://gemini.google.com/app' })
  }
})
