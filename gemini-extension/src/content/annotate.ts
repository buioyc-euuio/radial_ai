// Injected selection toolbar on the Gemini page: 引用回覆 / 螢光筆 / 筆記.
// Highlights & notes are written into Gemini's response DOM and persisted to
// chrome.storage (anchored by character offset), then restored on load / nav.

import { GEMINI, getConversationId } from './gemini-selectors'
import { applyMarkToRange, offsetOf, rangeFromOffsets } from './domMark'
import type { SavedMark } from '../shared/messages'

type MarkType = 'pen' | 'note'

const CLASS: Record<MarkType, string> = { pen: 'radial-pen', note: 'radial-note' }

let currentCid: string | null = null
let marks: SavedMark[] = []
let pending: { nodeId: string; el: HTMLElement; range: Range; text: string } | null = null
let toolbarEl: HTMLDivElement | null = null
let popoverEl: HTMLDivElement | null = null
let toolbarVisible = false

// Cached dock geometry, so the bottom bar can center within the Gemini area.
let dockState: { open: boolean; side: string; size: number } = {
  open: false,
  side: 'right',
  size: 440,
}
void chrome.storage.local.get('dock').then((r) => {
  if (r.dock) dockState = r.dock as typeof dockState
})
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'local' && c.dock?.newValue) dockState = c.dock.newValue as typeof dockState
})

// ── persistence ─────────────────────────────────────────────────────────────
const keyFor = (cid: string) => `marks:${cid}`
async function loadMarks(cid: string): Promise<SavedMark[]> {
  const res = await chrome.storage.local.get(keyFor(cid))
  return (res[keyFor(cid)] as SavedMark[]) ?? []
}
function saveMarks() {
  if (!currentCid) return
  void chrome.storage.local.set({ [keyFor(currentCid)]: marks })
}

// ── DOM lookup helpers ───────────────────────────────────────────────────────
function contentElFor(node: Node | null): { nodeId: string; el: HTMLElement } | null {
  const start = node instanceof Element ? node : (node?.parentElement ?? null)
  const container = start?.closest<HTMLElement>(GEMINI.turnContainer)
  if (!container?.id) return null
  const el = container.querySelector<HTMLElement>(GEMINI.modelMarkdown)
  if (!el) return null
  return { nodeId: container.id, el }
}

function currentSelection() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  const text = sel.toString().trim()
  if (!text) return null
  const info = contentElFor(range.commonAncestorContainer)
  if (!info || !info.el.contains(range.commonAncestorContainer)) return null
  return { ...info, range, text }
}

// ── apply / restore marks ────────────────────────────────────────────────────
function applyMark(m: SavedMark): void {
  const container = document.getElementById(m.nodeId)
  const el = container?.querySelector<HTMLElement>(GEMINI.modelMarkdown)
  if (!el) return
  if (el.querySelector(`mark[data-mark-id="${m.id}"]`)) return // already applied
  const range = rangeFromOffsets(el, m.start, m.end)
  if (!range) return
  applyMarkToRange(range, CLASS[m.type], el, (mk) => {
    mk.dataset.markId = m.id
    mk.dataset.markType = m.type
    if (m.note) mk.dataset.note = m.note
  })
}
function applyAll() {
  for (const m of marks) applyMark(m)
}

function unwrap(id: string) {
  document.querySelectorAll<HTMLElement>(`mark[data-mark-id="${id}"]`).forEach((mk) => {
    const parent = mk.parentNode
    if (!parent) return
    while (mk.firstChild) parent.insertBefore(mk.firstChild, mk)
    parent.removeChild(mk)
    parent.normalize()
  })
}

// ── mutate marks ─────────────────────────────────────────────────────────────
function createMark(type: MarkType): SavedMark | null {
  if (!pending) return null
  const { el, nodeId, range, text } = pending
  const start = offsetOf(el, range.startContainer, range.startOffset)
  const end = offsetOf(el, range.endContainer, range.endOffset)
  if (end <= start) return null
  const m: SavedMark = { id: crypto.randomUUID(), nodeId, type, start, end, text }
  marks.push(m)
  applyMark(m)
  saveMarks()
  return m
}
function updateNote(id: string, note: string) {
  const m = marks.find((x) => x.id === id)
  if (!m) return
  m.note = note || undefined
  document.querySelectorAll<HTMLElement>(`mark[data-mark-id="${id}"]`).forEach((mk) => {
    if (note) mk.dataset.note = note
    else delete mk.dataset.note
  })
  saveMarks()
}
function removeMark(id: string) {
  marks = marks.filter((x) => x.id !== id)
  unwrap(id)
  saveMarks()
}

// ── actions ──────────────────────────────────────────────────────────────────
function clearSelection() {
  window.getSelection()?.removeAllRanges()
  pending = null
  hideToolbar()
}

function actHighlight() {
  createMark('pen')
  clearSelection()
}
function actNote() {
  const rect = pending?.range.getBoundingClientRect()
  const m = createMark('note')
  clearSelection()
  if (m && rect) openPopover(m.id, 'note', rect, '')
}
function actQuote() {
  if (!pending) return
  const text = pending.text
  // Record a pending branch: the next imported reply should hang off this node.
  const cid = getConversationId()
  if (cid) void chrome.storage.local.set({ [`pendingBranch:${cid}`]: pending.nodeId })
  const editor = document.querySelector<HTMLElement>(GEMINI.inputEditor)
  clearSelection()
  if (!editor) return
  editor.focus()
  const sel = window.getSelection()
  sel?.selectAllChildren(editor)
  sel?.collapseToEnd()
  document.execCommand('insertText', false, `> ${text}\n\n`)
}

// ── toolbar UI ───────────────────────────────────────────────────────────────
function buildToolbar() {
  toolbarEl = document.createElement('div')
  toolbarEl.className = 'radial-toolbar'
  toolbarEl.style.display = 'none'
  toolbarEl.innerHTML = `
    <button data-act="quote">❝ 引用回覆 <kbd>⌘K</kbd></button>
    <button data-act="pen">✎ 螢光筆 <kbd>H</kbd></button>
    <button data-act="note">＋ 筆記 <kbd>D</kbd></button>`
  toolbarEl.addEventListener('mousedown', (e) => e.preventDefault())
  toolbarEl.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act
    if (act === 'quote') actQuote()
    else if (act === 'pen') actHighlight()
    else if (act === 'note') actNote()
  })
  document.body.appendChild(toolbarEl)
}
// Anchor the toolbar to Gemini's input box: same width & x as the composer, with
// its bottom edge sitting just above the composer's top. Never covers the text.
function reposition() {
  if (!toolbarEl || !pending) return
  const sel = pending.range.getBoundingClientRect()
  if (sel.width === 0 && sel.height === 0) {
    hideToolbar()
    return
  }
  const th = toolbarEl.offsetHeight || 36
  const box =
    document.querySelector<HTMLElement>(GEMINI.inputBox) ??
    document.querySelector<HTMLElement>(GEMINI.inputEditor)
  const rect = box?.getBoundingClientRect()

  if (rect && rect.width > 0) {
    toolbarEl.style.left = `${rect.left}px`
    toolbarEl.style.width = `${rect.width}px`
    toolbarEl.style.top = `${rect.top - th - 6}px`
    return
  }

  // Fallback: centered bottom of the non-dock area.
  let availLeft = 8
  let availRight = window.innerWidth - 8
  let bottomGap = 96
  if (dockState.open) {
    if (dockState.side === 'right') availRight = window.innerWidth - dockState.size - 8
    else if (dockState.side === 'left') availLeft = dockState.size + 8
    else if (dockState.side === 'bottom') bottomGap = dockState.size + 20
  }
  const tw = toolbarEl.offsetWidth || 280
  toolbarEl.style.width = ''
  toolbarEl.style.left = `${Math.max(availLeft, (availLeft + availRight) / 2 - tw / 2)}px`
  toolbarEl.style.top = `${window.innerHeight - th - bottomGap}px`
}
function showToolbar() {
  if (!toolbarEl) buildToolbar()
  if (!toolbarEl) return
  toolbarEl.style.display = 'flex'
  toolbarVisible = true
  reposition()
  document.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)
}
function hideToolbar() {
  if (toolbarEl) toolbarEl.style.display = 'none'
  toolbarVisible = false
  document.removeEventListener('scroll', reposition, true)
  window.removeEventListener('resize', reposition)
}

// ── popover (note editor / remove) ───────────────────────────────────────────
function closePopover() {
  popoverEl?.remove()
  popoverEl = null
}
function openPopover(id: string, type: MarkType, rect: DOMRect, note: string) {
  closePopover()
  popoverEl = document.createElement('div')
  popoverEl.className = 'radial-popover'
  const noteUi =
    type === 'note'
      ? `<textarea class="radial-note-input" placeholder="寫下筆記…">${note}</textarea>
         <div class="radial-pop-row"><button data-act="save">儲存</button><button data-act="remove" class="ghost">移除</button></div>`
      : `<div class="radial-pop-row"><button data-act="remove" class="ghost">移除螢光筆</button></div>`
  popoverEl.innerHTML = noteUi
  popoverEl.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`
  popoverEl.style.top = `${rect.bottom + 6}px`
  popoverEl.addEventListener('mousedown', (e) => e.stopPropagation())
  popoverEl.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act
    if (act === 'save') {
      const v = popoverEl?.querySelector<HTMLTextAreaElement>('.radial-note-input')?.value.trim() ?? ''
      updateNote(id, v)
      closePopover()
    } else if (act === 'remove') {
      removeMark(id)
      closePopover()
    }
  })
  document.body.appendChild(popoverEl)
  const ta = popoverEl.querySelector<HTMLTextAreaElement>('.radial-note-input')
  if (ta) {
    ta.focus()
    // Enter saves; Shift+Enter inserts a newline.
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        updateNote(id, ta.value.trim())
        closePopover()
      }
    })
  }
}

// ── note hover tooltip ───────────────────────────────────────────────────────
let tipEl: HTMLDivElement | null = null
function showTip(text: string, rect: DOMRect) {
  if (!tipEl) {
    tipEl = document.createElement('div')
    tipEl.className = 'radial-tip'
    document.body.appendChild(tipEl)
  }
  tipEl.textContent = text
  tipEl.style.left = `${rect.left}px`
  tipEl.style.top = `${rect.bottom + 4}px`
  tipEl.style.display = 'block'
}
function hideTip() {
  if (tipEl) tipEl.style.display = 'none'
}

// ── styles ───────────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('radial-annotate-style')) return
  const style = document.createElement('style')
  style.id = 'radial-annotate-style'
  style.textContent = `
    mark.radial-pen { background: #fff04d !important; color: inherit !important; border-radius: 2px; }
    mark.radial-note { background: #fbcfe8 !important; color: inherit !important; border-radius: 2px; cursor: pointer; }
    .radial-toolbar {
      position: fixed; z-index: 2147483600; box-sizing: border-box;
      display: flex; justify-content: center; gap: 8px; padding: 4px; border-radius: 12px;
      background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 6px 24px rgba(15,23,42,.18);
      font-family: 'Google Sans', Roboto, system-ui, sans-serif;
    }
    .radial-toolbar button {
      display: inline-flex; align-items: center; gap: 5px; border: none; background: none;
      font-size: 13px; color: #be185d; padding: 5px 9px; border-radius: 8px; cursor: pointer; white-space: nowrap;
    }
    .radial-toolbar button:hover { background: #fdf2f8; }
    .radial-toolbar kbd {
      font-size: 10px; color: #94a3b8; border: 1px solid #e2e8f0; border-radius: 4px; padding: 0 4px;
    }
    .radial-popover {
      position: fixed; z-index: 2147483600; width: 260px; padding: 8px;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 8px 28px rgba(15,23,42,.2);
      font-family: 'Google Sans', Roboto, system-ui, sans-serif;
    }
    .radial-note-input {
      width: 100%; min-height: 56px; resize: vertical; box-sizing: border-box;
      font-size: 13px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 8px; outline: none;
      font-family: inherit;
    }
    .radial-pop-row { display: flex; gap: 6px; margin-top: 6px; }
    .radial-popover button {
      font-size: 12px; padding: 5px 12px; border-radius: 7px; border: none; cursor: pointer;
      background: #2563eb; color: #fff;
    }
    .radial-popover button.ghost { background: #fff; color: #dc2626; border: 1px solid #e2e8f0; }
    .radial-tip {
      position: fixed; z-index: 2147483600; max-width: 280px; display: none;
      background: #1f2937; color: #fff; font-size: 12px; line-height: 1.45; padding: 6px 9px;
      border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.25); pointer-events: none;
      font-family: 'Google Sans', Roboto, system-ui, sans-serif; white-space: pre-wrap;
    }`
  document.head.appendChild(style)
}

// ── global events ────────────────────────────────────────────────────────────
function onMouseUp() {
  setTimeout(() => {
    const info = currentSelection()
    if (!info) return
    pending = { nodeId: info.nodeId, el: info.el, range: info.range.cloneRange(), text: info.text }
    showToolbar()
  }, 0)
}
function onMouseDown(e: MouseEvent) {
  const t = e.target as Node
  if (toolbarEl?.contains(t) || popoverEl?.contains(t)) return
  hideToolbar()
  if (!(t instanceof Element && t.closest('.radial-popover'))) closePopover()
}
function onClick(e: MouseEvent) {
  const mk = (e.target as Element).closest<HTMLElement>('mark[data-mark-id]')
  if (!mk) return
  const id = mk.dataset.markId!
  const type = (mk.dataset.markType as MarkType) ?? 'pen'
  openPopover(id, type, mk.getBoundingClientRect(), mk.dataset.note ?? '')
}
function onOver(e: MouseEvent) {
  const mk = (e.target as Element).closest<HTMLElement>('mark[data-mark-type="note"]')
  if (mk?.dataset.note) showTip(mk.dataset.note, mk.getBoundingClientRect())
}
function onOut(e: MouseEvent) {
  if ((e.target as Element).closest?.('mark[data-mark-type="note"]')) hideTip()
}
function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === 'KeyK') {
    if (toolbarVisible && pending) {
      e.preventDefault()
      actQuote()
    }
    return
  }
  if (!toolbarVisible) return
  const t = e.target as HTMLElement
  // Only skip when typing in a field. We match on e.code (physical key), which is
  // independent of the active IME / keyboard layout — so E works in 中文 or English.
  if (
    t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable ||
    e.metaKey || e.ctrlKey || e.altKey || e.shiftKey
  )
    return
  switch (e.code) {
    case 'KeyL':
    case 'KeyC':
    case 'KeyE':
      e.preventDefault()
      actQuote()
      break
    case 'KeyH':
    case 'KeyF':
      e.preventDefault()
      actHighlight()
      break
    case 'KeyD':
      e.preventDefault()
      actNote()
      break
  }
}

// ── conversation sync + late-render re-apply ─────────────────────────────────
let applyTimer: number | undefined
function scheduleApply() {
  clearTimeout(applyTimer)
  applyTimer = window.setTimeout(applyAll, 300)
}
async function syncConversation() {
  const cid = getConversationId()
  if (cid === currentCid) return
  currentCid = cid
  marks = cid ? await loadMarks(cid) : []
  scheduleApply()
}

export function initAnnotate() {
  injectStyles()
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('click', onClick)
  document.addEventListener('mouseover', onOver)
  document.addEventListener('mouseout', onOut)
  document.addEventListener('keydown', onKeyDown)

  void syncConversation()
  window.setInterval(syncConversation, 1000) // detect SPA navigation between chats

  // Re-apply marks as Gemini renders messages in.
  const obs = new MutationObserver(() => scheduleApply())
  obs.observe(document.body, { childList: true, subtree: true })
}
