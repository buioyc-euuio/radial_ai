import { create } from 'zustand'
import type { QAPair } from '../shared/messages'

export type ReadStatus = 'unread' | 'read' | 'important'

/** Per-node user-owned metadata that survives re-imports. */
export interface NodeMeta {
  /** Parent in the git-tree. Defaults to the previous node (linear spine). */
  parentId: string | null
  topic?: string
  status: ReadStatus
}

interface PersistShape {
  conversationId: string | null
  nodes: QAPair[]
  meta: Record<string, NodeMeta>
}

interface StoreState extends PersistShape {
  selectedId: string | null
  loaded: boolean
  hydrate: (conversationId: string | null) => Promise<void>
  importNodes: (conversationId: string | null, incoming: QAPair[]) => void
  setSelected: (id: string | null) => void
  setTopic: (id: string, topic: string) => void
  setParent: (id: string, parentId: string | null) => void
  cycleStatus: (id: string) => void
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

export const useStore = create<StoreState>((set, get) => ({
  conversationId: null,
  nodes: [],
  meta: {},
  selectedId: null,
  loaded: false,

  hydrate: async (conversationId) => {
    if (!conversationId) {
      set({ loaded: true })
      return
    }
    const res = await chrome.storage.local.get(keyFor(conversationId))
    const saved = res[keyFor(conversationId)] as PersistShape | undefined
    if (saved) set({ ...saved, loaded: true })
    else set({ conversationId, nodes: [], meta: {}, loaded: true })
  },

  importNodes: (conversationId, incoming) => {
    // Preserve existing meta (topic/status/parent) when re-importing the same chat.
    const prevMeta = get().conversationId === conversationId ? get().meta : {}
    const meta: Record<string, NodeMeta> = {}
    incoming.forEach((n, i) => {
      meta[n.id] = prevMeta[n.id] ?? {
        parentId: i > 0 ? incoming[i - 1].id : null,
        status: 'unread',
      }
    })
    const shape: PersistShape = { conversationId, nodes: incoming, meta }
    set(shape)
    persist(shape)
  },

  setSelected: (id) => set({ selectedId: id }),

  setTopic: (id, topic) => {
    const cur = get().meta[id] ?? { parentId: null, status: 'unread' as ReadStatus }
    const meta = { ...get().meta, [id]: { ...cur, topic: topic || undefined } }
    set({ meta })
    persist({ conversationId: get().conversationId, nodes: get().nodes, meta })
  },

  setParent: (id, parentId) => {
    const cur = get().meta[id] ?? { parentId: null, status: 'unread' as ReadStatus }
    const meta = { ...get().meta, [id]: { ...cur, parentId } }
    set({ meta })
    persist({ conversationId: get().conversationId, nodes: get().nodes, meta })
  },

  cycleStatus: (id) => {
    const cur = get().meta[id] ?? { parentId: null, status: 'unread' as ReadStatus }
    const status = STATUS_ORDER[(STATUS_ORDER.indexOf(cur.status) + 1) % STATUS_ORDER.length]
    const meta = { ...get().meta, [id]: { ...cur, status } }
    set({ meta })
    persist({ conversationId: get().conversationId, nodes: get().nodes, meta })
  },
}))
