import { GEMINI } from './gemini-selectors'

// Detect "user submitted a prompt" → notify PENDING immediately, then poll the
// NEW turn's answer text until it stops growing → notify READY. Polling the
// answer text (not generic DOM mutations) is robust against Gemini's constant
// background DOM activity, which made a mutation-idle heuristic never settle.

type Notify = (type: 'PENDING' | 'READY', payload?: unknown) => void

function snapshotIds(): Set<string> {
  return new Set(
    Array.from(document.querySelectorAll<HTMLElement>(GEMINI.turnContainer)).map((e) => e.id),
  )
}

export function initWatch(notify: Notify) {
  let active = false

  const onSubmit = () => {
    if (active) return
    active = true
    const before = snapshotIds()
    notify('PENDING')

    let last = ''
    let stable = 0
    let polls = 0
    let timer = 0

    const done = (id?: string) => {
      if (!active) return
      active = false
      clearTimeout(timer)
      notify('READY', id ? { id } : undefined)
    }

    const tick = () => {
      polls++
      const fresh = Array.from(snapshotIds()).filter((id) => !before.has(id))
      const newId = fresh[fresh.length - 1]
      if (newId) {
        const text =
          document
            .getElementById(newId)
            ?.querySelector<HTMLElement>(GEMINI.modelMarkdown)
            ?.innerText?.trim() ?? ''
        if (text) {
          if (text === last) stable++
          else {
            stable = 0
            last = text
          }
          if (stable >= 3) return done(newId) // ~2.1s of unchanged answer text
        }
      }
      if (polls > 80) return done(newId) // ~56s hard cap
      timer = window.setTimeout(tick, 700)
    }
    timer = window.setTimeout(tick, 700)
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
      if ((e.target as HTMLElement)?.closest?.(GEMINI.inputEditor)) onSubmit()
    },
    true,
  )
  document.addEventListener(
    'click',
    (e) => {
      if ((e.target as HTMLElement)?.closest?.(GEMINI.sendButton)) onSubmit()
    },
    true,
  )
}
