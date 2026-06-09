// ⚠️ THE ONLY FILE THAT NEEDS MAINTENANCE WHEN GEMINI CHANGES ITS LAYOUT.
// Selectors verified against the real gemini.google.com DOM (2026-06, "lr26" build).
//
// Key win: each QA turn pair lives in `.conversation-container` and already has a
// STABLE `id` attribute (e.g. id="810d3beb5b3d88c1"). We use that id directly as the
// node id — no hashing needed — which makes jump-to and de-duplication trivial.

export const GEMINI = {
  /** Each QA turn pair. Carries a stable `id` attribute we reuse as the node id. */
  turnContainer: '.conversation-container[id]',
  /** The user's prompt (Angular custom element). */
  userQuery: 'user-query',
  /** The actual prompt text inside user-query (excludes the screen-reader label). */
  userText: 'user-query .query-text',
  /** The model's rendered markdown body. */
  modelMarkdown: 'message-content .markdown-main-panel, .markdown.markdown-main-panel',
  /** The scrolling list that holds all turns. */
  scrollContainer: 'infinite-scroller[data-test-id="chat-history-container"]',
  /** The prompt input (Quill contenteditable). */
  inputEditor: 'rich-textarea .ql-editor',
  /** The send button. */
  sendButton: 'button.send-button',
} as const

/** Conversation id from the URL, e.g. /app/<id>. */
export function getConversationId(): string | null {
  const m = location.pathname.match(/\/app\/([^/?#]+)/)
  return m ? m[1] : null
}
