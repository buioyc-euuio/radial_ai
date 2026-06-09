import { GEMINI, getConversationId } from './gemini-selectors'
import type { QAPair } from '../shared/messages'

/** Read the user's prompt text, stripping Gemini's hidden screen-reader label. */
function readUserText(userEl: HTMLElement | null): string {
  if (!userEl) return ''
  // Preferred: the dedicated query-text element (no "你說了" / "You said" label).
  const q = userEl.querySelector<HTMLElement>(GEMINI.userText)
  if (q) return (q.innerText ?? '').trim()
  // Fallback: whole user-query innerText minus the leading .cdk-visually-hidden label.
  const hidden = userEl.querySelector<HTMLElement>('.cdk-visually-hidden')
  let t = (userEl.innerText ?? '').trim()
  const h = (hidden?.innerText ?? '').trim()
  if (h && t.startsWith(h)) t = t.slice(h.length).trim()
  return t
}

/** Read the current Gemini conversation DOM into a flat list of QA nodes. */
export function parseConversation(): { conversationId: string | null; nodes: QAPair[] } {
  const conversationId = getConversationId()
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>(GEMINI.turnContainer),
  )

  const nodes: QAPair[] = []
  containers.forEach((container, i) => {
    const userEl = container.querySelector<HTMLElement>(GEMINI.userQuery)
    const modelEl = container.querySelector<HTMLElement>(GEMINI.modelMarkdown)

    const question = readUserText(userEl)
    const answerText = (modelEl?.innerText ?? '').trim()
    const answerHtml = modelEl?.innerHTML ?? ''

    // Skip empty/streaming-only shells (both sides blank).
    if (!question && !answerText) return

    nodes.push({
      id: container.id,
      question,
      answerText,
      answerHtml,
      domOrder: i,
      conversationId,
    })
  })

  return { conversationId, nodes }
}
