import { create } from 'zustand'
import type { QAPair } from '../shared/messages'
import { summarize, DEFAULT_MODEL } from './summarize'

export type ReadStatus = 'unread' | 'read' | 'important'

/** Per-node user-owned metadata that survives re-imports. */
export interface NodeMeta {
  /** Parent in the branch tree. Defaults to the previous node (linear). */
  parentId: string | null
  topic?: string
  /** AI-generated topic title for glanceability. */
  summary?: string
  status: ReadStatus
  /** Canvas position. */
  x: number
  y: number
}

interface PersistShape {
  conversationId: string | null
  nodes: QAPair[]
  meta: Record<string, NodeMeta>
}

interface StoreState extends PersistShape {
  selectedId: string | null
  loaded: boolean
  loading: boolean
  apiKey: string
  model: string
  hydrate: (conversationId: string | null) => Promise<void>
  importNodes: (
    conversationId: string | null,
    incoming: QAPair[],
    branchParentId?: string | null,
  ) => void
  setSelected: (id: string | null) => void
  setTopic: (id: string, topic: string) => void
  setParent: (id: string, parentId: string | null) => void
  cycleStatus: (id: string) => void
  setPosition: (id: string, x: number, y: number) => void
  persistNow: () => void
  setLoading: (v: boolean) => void
  pushHistory: () => void
  undo: () => void
  setSettings: (apiKey: string, model: string) => void
  setSummary: (id: string, summary: string) => void
  summarizeNode: (id: string) => Promise<void>
}

const STATUS_ORDER: ReadStatus[] = ['unread', 'read', 'important']
const keyFor = (cid: string | null) => `tree:${cid ?? 'unknown'}`

function persist(shape: PersistShape) {
  if (!shape.conversationId) return
  void chrome.storage.local.set({
    [keyFor(shape.conversationId)]: {
      conversationId: shape.conversationId,
      nodes: shape.nodes,
      meta: shape.meta,
    },
  })
}

const DEFAULT_META = (): NodeMeta => ({ parentId: null, status: 'unread', x: 20, y: 0 })

// Transient undo stack of meta snapshots (positions/parents/topics/status).
const history: Record<string, NodeMeta>[] = []

export const useStore = create<StoreState>((set, get) => ({
  conversationId: null,
  nodes: [],
  meta: {},
  selectedId: null,
  loaded: false,
  loading: false,
  apiKey: '',
  model: DEFAULT_MODEL,

  hydrate: async (conversationId) => {
    const keys = ['settings', keyFor(conversationId)]
    const res = await chrome.storage.local.get(keys)
    const settings = res['settings'] as { apiKey?: string; model?: string } | undefined
    if (settings) set({ apiKey: settings.apiKey ?? '', model: settings.model || DEFAULT_MODEL })

    const saved = conversationId
      ? (res[keyFor(conversationId)] as PersistShape | undefined)
      : undefined
    if (saved) set({ ...saved, loaded: true })
    else set({ conversationId, nodes: [], meta: {}, loaded: true })
  },

  importNodes: (conversationId, incoming, branchParentId) => {
    const prevMeta = get().conversationId === conversationId ? get().meta : {}
    const firstNewId = incoming.find((n) => !prevMeta[n.id])?.id
    const hasBranchParent = branchParentId && incoming.some((n) => n.id === branchParentId)

    const meta: Record<string, NodeMeta> = {}
    incoming.forEach((n, i) => {
      if (prevMeta[n.id]) {
        meta[n.id] = prevMeta[n.id] // preserve topic/summary/status/parent/position
        return
      }
      const parentId =
        hasBranchParent && n.id === firstNewId
          ? branchParentId!
          : i > 0
            ? incoming[i - 1].id
            : null
      meta[n.id] = { ...DEFAULT_META(), parentId, y: i * 70 }
    })

    const shape: PersistShape = { conversationId, nodes: incoming, meta }
    set(shape)
    persist(shape)
  },

  setSelected: (id) => set({ selectedId: id }),

  setTopic: (id, topic) => {
    get().pushHistory()
    const cur = get().meta[id] ?? DEFAULT_META()
    const meta = { ...get().meta, [id]: { ...cur, topic: topic || undefined } }
    set({ meta })
    persist({ conversationId: get().conversationId, nodes: get().nodes, meta })
  },

  setParent: (id, parentId) => {
    get().pushHistory()
    const cur = get().meta[id] ?? DEFAULT_META()
    const meta = { ...get().meta, [id]: { ...cur, parentId } }
    set({ meta })
    persist({ conversationId: get().conversationId, nodes: get().nodes, meta })
  },

  cycleStatus: (id) => {
    get().pushHistory()
    const cur = get().meta[id] ?? DEFAULT_META()
    const status = STATUS_ORDER[(STATUS_ORDER.indexOf(cur.status) + 1) % STATUS_ORDER.length]
    const meta = { ...get().meta, [id]: { ...cur, status } }
    set({ meta })
    persist({ conversationId: get().conversationId, nodes: get().nodes, meta })
  },

  setPosition: (id, x, y) => {
    const cur = get().meta[id] ?? DEFAULT_META()
    set({ meta: { ...get().meta, [id]: { ...cur, x, y } } })
  },

  persistNow: () => {
    persist({ conversationId: get().conversationId, nodes: get().nodes, meta: get().meta })
  },

  setLoading: (v) => set({ loading: v }),

  pushHistory: () => {
    history.push({ ...get().meta })
    if (history.length > 50) history.shift()
  },

  undo: () => {
    const prev = history.pop()
    if (!prev) return
    set({ meta: prev })
    persist({ conversationId: get().conversationId, nodes: get().nodes, meta: prev })
  },

  setSettings: (apiKey, model) => {
    set({ apiKey, model: model || DEFAULT_MODEL })
    void chrome.storage.local.set({ settings: { apiKey, model: model || DEFAULT_MODEL } })
  },

  setSummary: (id, summary) => {
    const cur = get().meta[id] ?? DEFAULT_META()
    const meta = { ...get().meta, [id]: { ...cur, summary: summary || undefined } }
    set({ meta })
    persist({ conversationId: get().conversationId, nodes: get().nodes, meta })
  },

  summarizeNode: async (id) => {
    const { apiKey, model, nodes } = get()
    if (!apiKey) throw new Error('尚未設定 Gemini API 金鑰')
    const n = nodes.find((x) => x.id === id)
    if (!n) return
    const summary = await summarize(apiKey, model, n.question, n.answerText)
    if (summary) get().setSummary(id, summary)
  },
}))
