// Message protocol between the side panel and the Gemini content script.
// All payloads are plain JSON (no live DOM nodes cross the boundary).

export interface QAPair {
  /** Stable id from Gemini's <div class="conversation-container" id="..."> */
  id: string
  question: string
  answerText: string
  answerHtml: string
  /** Order in the conversation as read from the DOM. */
  domOrder: number
  conversationId: string | null
}

export type Request =
  | { type: 'PING' }
  | { type: 'IMPORT_CONVERSATION' }
  | { type: 'JUMP_TO'; id: string }

export type ImportResult =
  | { ok: true; conversationId: string | null; nodes: QAPair[] }
  | { ok: false; error: string }

export type JumpResult = { ok: boolean; error?: string }

export const GEMINI_URL_MATCH = /^https:\/\/gemini\.google\.com\//
