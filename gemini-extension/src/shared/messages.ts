export interface QAPair {
  id: string
  question: string
  answerText: string
  domOrder: number
  conversationId: string | null
}

export type ImportResult =
  | { ok: true; conversationId: string | null; nodes: QAPair[] }
  | { ok: false; error: string }

/** Background → content-script message (toolbar icon toggles the dock). */
export type Request = { type: 'TOGGLE_DOCK' }

/** A highlight/note mark on the Gemini page, persisted under `marks:<cid>`. */
export interface SavedMark {
  id: string
  nodeId: string
  type: 'pen' | 'note'
  start: number
  end: number
  text: string
  note?: string
}

/** Origin of the host page the content script runs on. */
export const GEMINI_ORIGIN = 'https://gemini.google.com'
