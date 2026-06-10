import { GEMINI } from './gemini-selectors'

// Detect "user submitted a prompt" → notify PENDING immediately, then watch the
// DOM until the streamed answer settles → notify READY with the new node id.

type Notify = (type: 'PENDING' | 'READY', payload?: unknown) => void
let submitting = false

function snapshotIds(): Set<string> {
  return new Set(
    Array.from(document.querySelectorAll<HTMLElement>(GEMINI.turnContainer)).map((e) => e.id),
  )
}

export function initWatch(notify: Notify) {
  const onSubmit = () => {
    if (submitting) return
    submitting = true
    const before = snapshotIds()
    notify('PENDING')

    let idle: number | undefined
    const finish = (id?: string) => {
      if (!submitting) return
      submitting = false
      obs.disconnect()
      clearTimeout(safety)
      notify('READY', id ? { id } : undefined)
    }
    const obs = new MutationObserver(() => {
      // Settle when the DOM stops changing for ~1.8s and a new turn exists.
      clearTimeout(idle)
      idle = window.setTimeout(() => {
        const fresh = Array.from(snapshotIds()).filter((id) => !before.has(id))
        if (fresh.length) finish(fresh[fresh.length - 1])
      }, 1800)
    })
    const target = document.querySelector(GEMINI.scrollContainer) ?? document.body
    obs.observe(target, { childList: true, subtree: true })
    const safety = window.setTimeout(() => finish(), 60000)
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
