// Injected dockable panel: an iframe (extension page) embedded into the Gemini
// page, dockable left/right/top/bottom, with a drag-to-resize divider that
// pushes Gemini's content to make room. The iframe talks to us via postMessage.

import { GEMINI, getConversationId } from './gemini-selectors'
import { doImport, scrollToNode, scrollToMark } from './ops'

type Side = 'left' | 'right' | 'top' | 'bottom'
interface DockState {
  open: boolean
  side: Side
  size: number
}

const DEFAULT: DockState = { open: false, side: 'right', size: 440 }
const MIN = 240
// This extension's own origin (the iframe's origin), e.g. chrome-extension://<id>.
const EXT_ORIGIN = chrome.runtime.getURL('').replace(/\/$/, '')
let state: DockState = { ...DEFAULT }
let root: HTMLDivElement | null = null
let iframe: HTMLIFrameElement | null = null

const isHorizontal = (s: Side) => s === 'left' || s === 'right'
function clampSize(side: Side, s: number): number {
  const max = isHorizontal(side) ? window.innerWidth - 140 : window.innerHeight - 140
  return Math.max(MIN, Math.min(s, Math.max(MIN, max)))
}

function save() {
  void chrome.storage.local.set({ dock: state })
}

// ── make Gemini genuinely narrower (true split, not an overlay) ──────────────
// Override the app shell's size directly: `calc(100vw - dock)` beats Gemini's own
// 100vw/100% so its %-based content actually reflows into the remaining space.
function geminiRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(GEMINI.appRoot)
}
const PUSH_PROPS = ['width', 'height', 'margin-left', 'margin-top', 'overflow', 'box-sizing', 'transition']
function sizeEl(el: HTMLElement) {
  el.style.setProperty('box-sizing', 'border-box', 'important')
  el.style.setProperty('transition', 'width 0.1s ease, height 0.1s ease', 'important')
  el.style.setProperty('overflow', 'hidden', 'important')
  el.style.removeProperty('margin-left')
  el.style.removeProperty('margin-top')
  const s = state.size
  if (isHorizontal(state.side)) {
    el.style.setProperty('width', `calc(100vw - ${s}px)`, 'important')
    el.style.setProperty('height', '', 'important')
    if (state.side === 'left') el.style.setProperty('margin-left', `${s}px`, 'important')
  } else {
    el.style.setProperty('height', `calc(100vh - ${s}px)`, 'important')
    el.style.setProperty('width', '', 'important')
    if (state.side === 'top') el.style.setProperty('margin-top', `${s}px`, 'important')
  }
}
function applyPush() {
  const root = geminiRoot()
  if (!root) return // shell not found → overlay instead of mutating <body> (which breaks Gemini)
  document.documentElement.style.setProperty('overflow', 'hidden', 'important')
  sizeEl(root)
}
function clearPush() {
  const root = geminiRoot()
  for (const el of [root, document.body]) {
    if (!el) continue
    PUSH_PROPS.forEach((p) => el.style.removeProperty(p))
  }
  document.documentElement.style.removeProperty('overflow')
}

// ── position the dock ────────────────────────────────────────────────────────
function positionRoot() {
  if (!root) return
  const st = root.style
  ;['left', 'right', 'top', 'bottom', 'width', 'height'].forEach((p) => st.removeProperty(p))
  const s = `${state.size}px`
  if (state.side === 'right') Object.assign(st, { right: '0', top: '0', bottom: '0', width: s })
  else if (state.side === 'left') Object.assign(st, { left: '0', top: '0', bottom: '0', width: s })
  else if (state.side === 'top') Object.assign(st, { top: '0', left: '0', right: '0', height: s })
  else Object.assign(st, { bottom: '0', left: '0', right: '0', height: s })
  root.dataset.side = state.side
}

// ── build / destroy ──────────────────────────────────────────────────────────
function injectStyle() {
  if (document.getElementById('radial-dock-style')) return
  const style = document.createElement('style')
  style.id = 'radial-dock-style'
  style.textContent = `
    #radial-dock { position: fixed; z-index: 2147483000; display: flex; flex-direction: column;
      background: #fff; box-shadow: 0 0 24px rgba(0,0,0,.18); font-family: 'Google Sans', Roboto, system-ui, sans-serif; }
    .radial-dock-bar { display: flex; align-items: center; gap: 3px; padding: 4px 8px; flex: 0 0 auto;
      border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
    .radial-dock-title { font-size: 12px; font-weight: 600; color: #0f172a; }
    .radial-dock-spacer { flex: 1; }
    .radial-dock-bar button { border: none; background: none; cursor: pointer; font-size: 13px;
      color: #64748b; padding: 2px 6px; border-radius: 6px; line-height: 1; }
    .radial-dock-bar button:hover { background: #e2e8f0; color: #0f172a; }
    .radial-dock-bar button.on { color: #2563eb; background: #eff6ff; }
    .radial-frame { border: none; width: 100%; flex: 1; min-height: 0; display: block; }
    .radial-resizer { position: absolute; z-index: 5; display: flex; align-items: center; justify-content: center; }
    .radial-resizer::before { content: ''; border-radius: 999px; background: #cbd5e1; }
    #radial-dock[data-side="right"] .radial-resizer,
    #radial-dock[data-side="left"]  .radial-resizer { top: 0; bottom: 0; width: 11px; cursor: ew-resize; }
    #radial-dock[data-side="right"] .radial-resizer { left: -5px; }
    #radial-dock[data-side="left"]  .radial-resizer { right: -5px; }
    #radial-dock[data-side="right"] .radial-resizer::before,
    #radial-dock[data-side="left"]  .radial-resizer::before { width: 3px; height: 40px; }
    #radial-dock[data-side="top"]    .radial-resizer,
    #radial-dock[data-side="bottom"] .radial-resizer { left: 0; right: 0; height: 11px; cursor: ns-resize; }
    #radial-dock[data-side="top"]    .radial-resizer { bottom: -5px; }
    #radial-dock[data-side="bottom"] .radial-resizer { top: -5px; }
    #radial-dock[data-side="top"]    .radial-resizer::before,
    #radial-dock[data-side="bottom"] .radial-resizer::before { height: 3px; width: 40px; }
    .radial-resizer:hover::before { background: #2563eb; }`
  document.head.appendChild(style)
}

function build() {
  injectStyle()
  root = document.createElement('div')
  root.id = 'radial-dock'
  root.innerHTML = `
    <div class="radial-dock-bar">
      <span class="radial-dock-title">Radial AI</span>
      <span class="radial-dock-spacer"></span>
      <button data-dock="left"   title="停靠左">⬅</button>
      <button data-dock="right"  title="停靠右">➡</button>
      <button data-dock="top"    title="停靠上">⬆</button>
      <button data-dock="bottom" title="停靠下">⬇</button>
      <button data-dock="close"  title="關閉">✕</button>
    </div>
    <iframe class="radial-frame" src="${chrome.runtime.getURL('sidepanel.html')}" allow="clipboard-write"></iframe>
    <div class="radial-resizer"></div>`
  document.documentElement.appendChild(root)
  iframe = root.querySelector('iframe')

  root.querySelector('.radial-dock-bar')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.dock
    if (!act) return
    if (act === 'close') {
      toggle()
      return
    }
    state.side = act as Side
    state.size = clampSize(state.side, state.size)
    positionRoot()
    applyPush()
    markActiveSide()
    save()
  })
  setupResizer(root.querySelector('.radial-resizer') as HTMLElement)

  positionRoot()
  applyPush()
  markActiveSide()
}

function markActiveSide() {
  root?.querySelectorAll<HTMLButtonElement>('.radial-dock-bar button[data-dock]').forEach((b) => {
    b.classList.toggle('on', b.dataset.dock === state.side)
  })
}

function setupResizer(handle: HTMLElement) {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startSize = state.size
    if (iframe) iframe.style.pointerEvents = 'none' // let mousemove pass over the iframe
    const onMove = (ev: MouseEvent) => {
      let s = startSize
      if (state.side === 'right') s = startSize - (ev.clientX - startX)
      else if (state.side === 'left') s = startSize + (ev.clientX - startX)
      else if (state.side === 'top') s = startSize + (ev.clientY - startY)
      else s = startSize - (ev.clientY - startY)
      state.size = clampSize(state.side, s)
      positionRoot()
      applyPush()
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (iframe) iframe.style.pointerEvents = ''
      document.body.style.removeProperty('user-select')
      save()
    }
    document.body.style.setProperty('user-select', 'none', 'important')
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}

// ── toggle ───────────────────────────────────────────────────────────────────
function toggle() {
  state.open = !state.open
  if (state.open) {
    if (!root) build()
    else {
      root.style.display = 'flex'
      positionRoot()
      applyPush()
    }
  } else {
    if (root) root.style.display = 'none'
    clearPush()
  }
  save()
}

// ── postMessage RPC for the iframe ───────────────────────────────────────────
function initRpc() {
  window.addEventListener('message', (e) => {
    const d = e.data as {
      __radial?: string
      id?: number
      type?: string
      payload?: { id?: string; markId?: string }
    }
    if (!d || d.__radial !== 'req') return
    // Only accept requests from our own iframe — reject the page / other frames.
    if (!iframe || e.source !== iframe.contentWindow || e.origin !== EXT_ORIGIN) return
    let payload: unknown
    if (d.type === 'IMPORT') payload = doImport()
    else if (d.type === 'JUMP') payload = { ok: scrollToNode(d.payload?.id ?? '') }
    else if (d.type === 'JUMP_MARK') payload = { ok: scrollToMark(d.payload?.markId ?? '') }
    else if (d.type === 'CONV_ID') payload = { conversationId: getConversationId() }
    else return
    ;(e.source as Window).postMessage({ __radial: 'res', id: d.id, payload }, EXT_ORIGIN)
  })
}

/** Push an event from the content script down to the panel iframe. */
export function notifyPanel(type: string, payload?: unknown) {
  iframe?.contentWindow?.postMessage({ __radial: 'evt', type, payload }, EXT_ORIGIN)
}

// Detect SPA navigation between chats (URL is the only reliable cross-context
// signal — patching history from the isolated world wouldn't catch the page's
// own router calls) and tell the panel to re-import the new conversation.
let lastCid = getConversationId()
function watchConversation() {
  window.setInterval(() => {
    const cid = getConversationId()
    if (cid !== lastCid) {
      lastCid = cid
      notifyPanel('CONV_CHANGED', { conversationId: cid })
    }
  }, 500)
}

export async function initDock() {
  const r = await chrome.storage.local.get('dock')
  if (r.dock) state = { ...DEFAULT, ...(r.dock as DockState) }
  initRpc()
  watchConversation()
  // Make sure Gemini's layout is restored if the page unloads while docked.
  window.addEventListener('pagehide', () => clearPush())
  if (state.open) build()
  window.addEventListener('resize', () => {
    if (!state.open) return
    state.size = clampSize(state.side, state.size)
    positionRoot()
    applyPush()
  })
}

export function toggleDock() {
  toggle()
}
