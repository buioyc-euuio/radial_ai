// The panel runs inside an iframe injected onto the Gemini page. It talks to the
// content script (its parent window) via postMessage RPC. Both ends validate the
// message origin + source so another frame on the tab can't forge messages.

import { GEMINI_ORIGIN, type ImportResult } from '../shared/messages'

let reqId = 0
const pending = new Map<number, (v: unknown) => void>()

function fromContentScript(e: MessageEvent): boolean {
  return e.origin === GEMINI_ORIGIN && e.source === window.parent
}

window.addEventListener('message', (e) => {
  if (!fromContentScript(e)) return
  const d = e.data as { __radial?: string; id?: number; payload?: unknown }
  if (!d || d.__radial !== 'res' || d.id == null) return
  const resolve = pending.get(d.id)
  if (resolve) {
    pending.delete(d.id)
    resolve(d.payload)
  }
})

function rpc<T>(type: string, payload?: unknown): Promise<T> {
  return new Promise<T>((resolve) => {
    const id = ++reqId
    pending.set(id, resolve as (v: unknown) => void)
    window.parent.postMessage({ __radial: 'req', id, type, payload }, GEMINI_ORIGIN)
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        resolve({ ok: false, error: '與 Gemini 頁面連線逾時，請重新整理分頁。' } as T)
      }
    }, 8000)
  })
}

export async function requestImport(): Promise<ImportResult> {
  return rpc<ImportResult>('IMPORT')
}

export async function jumpTo(id: string): Promise<void> {
  await rpc('JUMP', { id })
}

export function jumpMark(markId: string): void {
  void rpc('JUMP_MARK', { markId })
}

export async function getConvId(): Promise<string | null> {
  const r = await rpc<{ conversationId: string | null }>('CONV_ID')
  return r?.conversationId ?? null
}

/** Subscribe to push events from the content script (e.g. auto-node on submit). */
export function onContentEvent(
  handler: (type: string, payload: { id?: string } | undefined) => void,
): () => void {
  const fn = (e: MessageEvent) => {
    if (!fromContentScript(e)) return
    const d = e.data as { __radial?: string; type?: string; payload?: { id?: string } }
    if (d?.__radial === 'evt' && d.type) handler(d.type, d.payload)
  }
  window.addEventListener('message', fn)
  return () => window.removeEventListener('message', fn)
}
