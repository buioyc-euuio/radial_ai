import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  addEdge, reconnectEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { NodeData, ContextCapsule, ThoughtNodeData, AnnotationNodeData, Project } from './types';
import { useAuthStore, hasDevKeyAccess } from './authStore';
import { calculateOptimalPosition } from '../utils/autoLayout';
import { isThoughtNode } from '../utils/nodeTypeGuards';
import {
  createTutorialProject, createAboutProject,
  STARTER_PROJECT_IDS, STARTER_SEED_VERSION,
} from '../data/starterProjects';

export type { Project } from './types'; // re-export for backward compatibility

const NODE_WIDTH = 220;
const NODE_VERTICAL_GAP = 60;
const NODE_HEIGHT_ESTIMATE = 140;

const MAIN_TIMELINE_X = 80;

/** Unwrap all <mark class="cssClass"> tags from an HTML string, preserving text content. */
function stripMarksByClass(html: string, cssClass: string): string {
  if (!html || typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll(`mark.${cssClass}`).forEach(mark => {
    const parent = mark.parentNode!;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  div.normalize();
  return div.innerHTML;
}

/** Unwrap <mark class="cssClass"> tags whose textContent starts with textHint. */
function stripMarkByText(html: string, cssClass: string, textHint: string): string {
  if (!html || typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  const needle = textHint.trim().slice(0, 40).toLowerCase();
  div.querySelectorAll(`mark.${cssClass}`).forEach(mark => {
    const t = (mark.textContent ?? '').trim().toLowerCase();
    if (needle && t && (t.startsWith(needle.slice(0, 20)) || needle.startsWith(t.slice(0, 20)))) {
      const parent = mark.parentNode!;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    }
  });
  div.normalize();
  return div.innerHTML;
}

const TITLE_SYSTEM_PROMPT = `After your main response, you MUST append exactly one line in this format:
<node_title>5-8 word summary of your response</node_title>
Do not skip this. The title should summarize the key point of your answer.`;

export function parseTitleFromResponse(raw: string): { response: string; title: string } {
  const match = raw.match(/<node_title>([\s\S]*?)<\/node_title>/);
  if (match) {
    const title = match[1].trim();
    const response = raw.replace(/<node_title>[\s\S]*?<\/node_title>/, '').trim();
    return { response, title };
  }
  // fallback: first 50 chars of response
  const title = raw.slice(0, 50) + (raw.length > 50 ? '…' : '');
  return { response: raw, title };
}

// ── IndexedDB storage adapter ────────────────────────────────────────────────
const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await idbGet<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await idbSet(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await idbDel(name);
  },
};

// ── Main timeline helpers ──────────────────────────────────────────────────────

// Returns the last node in the vertical main timeline chain.
// Default-timeline nodes are NOT connected by edges, so the last one is found by
// position: the lowest (max y) node sitting in the main-timeline column that has
// no incoming edge (i.e. it isn't a branch child).
function getMainTimelineLastNode(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData> | null {
  const hasIncoming = new Set(edges.map(e => e.target));
  const column = nodes.filter(n =>
    (n.data.type === 'thoughtNode' || n.data.type === 'placeholderNode')
    && Math.abs(n.position.x - MAIN_TIMELINE_X) < 40
    && !hasIncoming.has(n.id)
  );
  if (column.length === 0) return null;
  return column.sort((a, b) => b.position.y - a.position.y)[0];
}

// Pick edge handles based on relative position of source→target.
function getEdgeHandles(srcX: number, srcY: number, tgtX: number, tgtY: number): { sourceHandle: string; targetHandle: string } {
  const dy = tgtY - srcY;
  const dx = tgtX - srcX;
  if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
    return { sourceHandle: 'source-bottom', targetHandle: 'target-top' };
  }
  return { sourceHandle: 'source-right', targetHandle: 'target-left' };
}

// ── Node navigation history (module-level, not persisted) ────────────────────
let _navHistory: string[] = [];
let _navIndex = -1;
let _isNavigating = false;

function _navPush(id: string) {
  if (_isNavigating) return;
  _navHistory = _navHistory.slice(0, _navIndex + 1);
  _navHistory.push(id);
  _navIndex = _navHistory.length - 1;
}

function _navReset() {
  _navHistory = [];
  _navIndex = -1;
}

// ── Store interface ──────────────────────────────────────────────────────────
interface CanvasStore {
  // Navigation
  view: 'home' | 'canvas';
  projects: Project[];
  currentProjectId: string | null;

  // Working canvas state (loaded from current project)
  nodes: Node<NodeData>[];
  edges: Edge[];
  contextCapsules: ContextCapsule[];
  selectedNodeId: string | null;

  // Per-canvas AI persona
  systemPrompt: string;
  personaName: string;
  setSystemPrompt: (prompt: string) => void;
  setPersonaName: (name: string) => void;

  // Context scope (not persisted — resets to 'ancestry' each session)
  historyScope: 'ancestry' | 'global' | 'custom';
  setHistoryScope: (scope: 'ancestry' | 'global' | 'custom') => void;

  // Input palette mode: 'qa' (Send → Gemini) | 'raw' (Send → verbatim, no AI)
  inputMode: 'qa' | 'raw';
  setInputMode: (mode: 'qa' | 'raw') => void;

  // Global settings
  apiKey: string;
  geminiApiKey: string;
  model: string;
  theme: 'light' | 'dark';
  starterSeedVersion: number;
  toggleTheme: () => void;

  // Project management
  createProject: (name: string) => void;
  openProject: (id: string) => void;
  closeProject: () => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  importProject: (data: { name: string; nodes: Node<NodeData>[]; edges: Edge[]; systemPrompt?: string; personaName?: string }) => void;

  // Settings
  setApiKey: (key: string) => void;
  setGeminiApiKey: (key: string) => void;
  setModel: (model: string) => void;

  // Canvas actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  removeEdge: (edgeId: string) => void;
  addBlankNode: (position: { x: number; y: number }) => void;
  commitOriginalText: (text: string) => void;
  generateTitleForNode: (nodeId: string) => Promise<void>;
  retitleAllNodes: () => Promise<void>;

  // Birth-order replay animation (null = inactive; array = ids revealed so far)
  replayRevealed: string[] | null;
  setReplayRevealed: (ids: string[] | null) => void;
  addContextCapsule: (capsule: ContextCapsule) => void;
  removeContextCapsule: (id: string) => void;
  clearContextCapsules: () => void;
  addFullNodeCapsule: (nodeId: string) => void;
  setSelectedNode: (id: string | null) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  deleteNode: (nodeId: string) => void;
  updateNodeTitle: (nodeId: string, title: string) => void;
  updateNodePrompt: (nodeId: string, prompt: string) => void;
  toggleCollapse: (nodeId: string) => void;
  cycleNodeStatus: (nodeId: string) => void;
  addAnnotationNode: (parentNodeId: string, selectedText: string) => void;
  sendPrompt: (prompt: string) => Promise<void>;
  regenerateNode: (nodeId: string) => Promise<void>;

  // Inline highlights & annotations (reading panel)
  updateMarkedHtml: (nodeId: string, html: string) => void;
  addHighlight: (nodeId: string, text: string) => void;
  addPromptHighlight: (nodeId: string, text: string) => void;
  addQuoteHighlight: (nodeId: string, text: string) => void;
  addAnnotation: (nodeId: string, selectedText: string) => string;
  updateAnnotation: (nodeId: string, annotationId: string, noteHtml: string) => void;
  deleteAnnotation: (nodeId: string, annotationId: string) => void;
  addAnnotationMessage: (nodeId: string, annotationId: string, html: string) => void;
}

// ── Helper: save working nodes/edges back into the projects list ─────────────
function syncProject(
  projects: Project[],
  currentProjectId: string | null,
  nodes: Node<NodeData>[],
  edges: Edge[]
): { projects: Project[] } | object {
  if (!currentProjectId) return {};
  return {
    projects: projects.map(p =>
      p.id === currentProjectId
        ? { ...p, nodes, edges, updatedAt: Date.now() }
        : p
    ),
  };
}

// ── Ancestral path helpers ───────────────────────────────────────────────────

/** Legacy single-path traversal (kept for regenerateNode fallback). */
export function getAncestralPath(nodeId: string, nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData>[] {
  const path: Node<NodeData>[] = [];
  let currentId = nodeId;
  while (currentId) {
    const node = nodes.find(n => n.id === currentId);
    if (node) path.unshift(node);
    currentId = edges.find(e => e.target === currentId)?.source ?? '';
  }
  return path;
}

/**
 * DAG-aware ancestor collector. Starting from any number of parent node IDs,
 * walks backwards through directed thought-node edges, deduplicates, and
 * returns the result sorted chronologically (top-to-bottom, left-to-right).
 * The parent nodes themselves are included in the result.
 */
export function getDAGAncestors(
  parentIds: string[],
  nodes: Node<NodeData>[],
  edges: Edge[],
): Node<NodeData>[] {
  const visited = new Set<string>();
  const result: Node<NodeData>[] = [];
  const queue = [...parentIds];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = nodes.find(n => n.id === id);
    if (node && node.data.type === 'thoughtNode') result.push(node);

    // Walk backwards: follow only edges between thought nodes
    for (const edge of edges) {
      if (edge.target !== id) continue;
      const parentNode = nodes.find(n => n.id === edge.source);
      if (parentNode && parentNode.data.type === 'thoughtNode' && !visited.has(edge.source)) {
        queue.push(edge.source);
      }
    }
  }

  // Sort chronologically by canvas position (top → bottom, then left → right)
  return result.sort((a, b) => {
    const dy = a.position.y - b.position.y;
    return Math.abs(dy) > 5 ? dy : a.position.x - b.position.x;
  });
}

export function buildMessagesFromPath(path: Node<NodeData>[]): { role: 'user' | 'assistant'; content: string }[] {
  const msgs: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const node of path) {
    if (node.data.type !== 'thoughtNode') continue;
    const d = node.data as ThoughtNodeData;
    if (d.isDeleted) continue;
    if (d.prompt) msgs.push({ role: 'user', content: d.prompt });
    if (d.response) msgs.push({ role: 'assistant', content: d.response });
  }
  return msgs;
}

// ── Provider detection ───────────────────────────────────────────────────────
export function getModelProvider(model: string): 'anthropic' | 'google' {
  if (model.startsWith('gemini')) return 'google';
  return 'anthropic';
}

// ── API calls ────────────────────────────────────────────────────────────────
async function callClaudeAPI(
  apiKey: string, model: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  system?: string
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 4096, ...(system ? { system } : {}), messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`);
  }
  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find(c => c.type === 'text')?.text ?? '';
}

// Gemini REST API — equivalent to Python's genai.Client().models.generate_content()
// Uses v1beta endpoint with the same JSON structure as the Python SDK internally sends.
async function callGeminiAPI(
  apiKey: string, model: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  system?: string
): Promise<string> {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (system) {
    body.system_instruction = { parts: [{ text: system }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Gemini error ${res.status}`);
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callAI(
  model: string, anthropicKey: string, geminiKey: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  canvasSystemPrompt?: string,
): Promise<string> {
  const authState = useAuthStore.getState();
  const { devMode, credential } = authState;

  // Merge canvas persona prompt with the title-extraction instruction
  const systemPrompt = canvasSystemPrompt
    ? `${canvasSystemPrompt}\n\n${TITLE_SYSTEM_PROMPT}`
    : TITLE_SYSTEM_PROMPT;

  // Dev mode: route through backend proxy (uses server PROD_API_KEY, model locked server-side).
  // Available to whitelisted testers and to users within their free trial.
  if (devMode && hasDevKeyAccess(authState) && credential) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, messages, system: systemPrompt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string; code?: string };
      // Expired Google ID-token: drop the dead credential and prompt re-login.
      if (res.status === 401 || err.code === 'AUTH_EXPIRED') {
        useAuthStore.getState().markAuthExpired();
        throw new Error(err.error ?? '登入已過期，請重新登入');
      }
      throw new Error(err.error ?? `Server error ${res.status}`);
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  // BYOK: direct browser-to-API calls
  if (getModelProvider(model) === 'google') {
    if (!geminiKey) throw new Error('Please set your Google Gemini API key in Settings.');
    return callGeminiAPI(geminiKey, model, messages, systemPrompt);
  }
  if (!anthropicKey) throw new Error('Please set your Anthropic API key in Settings.');
  return callClaudeAPI(anthropicKey, model, messages, systemPrompt);
}

// ── New-node placement helpers (shared by sendPrompt & commitOriginalText) ────

/**
 * Decide which existing nodes a new node should descend from.
 * Priority: 2+ Shift-selected nodes (DAG merge) → context-capsule sources →
 * the single currently-selected node → none (root on the main timeline).
 */
function resolveParentIds(
  nodes: Node<NodeData>[], contextCapsules: ContextCapsule[], selectedNodeId: string | null,
): string[] {
  const selectedThoughtNodes = nodes.filter(n => n.selected && n.data.type === 'thoughtNode');
  const capsuleSourceIds = [...new Set(contextCapsules.map(c => c.sourceNodeId))].filter(Boolean);

  if (selectedThoughtNodes.length >= 2) {
    return [...new Set([...selectedThoughtNodes.map(n => n.id), ...capsuleSourceIds])];
  }
  if (capsuleSourceIds.length > 0) return capsuleSourceIds;
  // Single selected node becomes the branch point — "ask from whichever node is selected".
  if (selectedNodeId) {
    const sel = nodes.find(n => n.id === selectedNodeId);
    if (sel?.data.type === 'thoughtNode') return [sel.id];
  }
  return [];
}

/** Compute the new node's position, the edges linking it to its parents, and its DAG ancestors. */
function buildParentLinkage(
  nodes: Node<NodeData>[], edges: Edge[], parentIds: string[], newNodeId: string,
): { position: { x: number; y: number }; parentEdges: Edge[]; ancestors: Node<NodeData>[] } {
  let position = { x: MAIN_TIMELINE_X, y: 80 };
  const parentEdges: Edge[] = [];

  if (parentIds.length > 0) {
    const parentNodes = parentIds
      .map(id => nodes.find(n => n.id === id))
      .filter((n): n is Node<NodeData> => !!n);
    position = calculateOptimalPosition(parentNodes, nodes);
    for (const parentId of parentIds) {
      const srcNode = nodes.find(n => n.id === parentId);
      if (!srcNode) continue;
      const { sourceHandle, targetHandle } = getEdgeHandles(
        srcNode.position.x, srcNode.position.y, position.x, position.y,
      );
      parentEdges.push({
        id: `e_${parentId}_${newNodeId}`,
        source: parentId, target: newNodeId,
        sourceHandle, targetHandle,
        type: 'floatingEdge',
        markerEnd: { type: 'arrowclosed' as const },
        style: { stroke: '#f472b6' },
      });
    }
  } else {
    // Root on the main vertical timeline. Default-timeline nodes are stacked but
    // intentionally NOT connected by an edge (so no ancestral line between them).
    const lastMainNode = getMainTimelineLastNode(nodes, edges);
    if (lastMainNode) {
      position = {
        x: lastMainNode.position.x,
        y: lastMainNode.position.y + NODE_HEIGHT_ESTIMATE + NODE_VERTICAL_GAP,
      };
    }
  }

  const effectiveParentIds = parentIds.length > 0
    ? parentIds
    : parentEdges.length > 0 ? [parentEdges[0].source] : [];
  const ancestors = effectiveParentIds.length > 0
    ? getDAGAncestors(effectiveParentIds, nodes, edges)
    : [];

  return { position, parentEdges, ancestors };
}

// ── Auto-title via a free Gemini model (never the paid Anthropic key) ─────────
const TITLE_MODEL = 'gemini-3.1-flash-lite-preview';

const TITLE_GEN_SYSTEM = `你是「思維節點標題產生器」。會收到使用者的問題、引用的參考片段、以及一段回答內容，請濃縮出一個能精準概括核心主題的標題。
規則：
- 只輸出標題本身，不要任何引號、冒號、句號或多餘標點，也不要「標題：」之類的前綴。
- 盡量精簡：中文約 4–14 字，英文約 2–7 個單字。
- 使用與內容相同的語言。
- 聚焦在主題重點，而非泛泛而談。`;

/**
 * Generate a concise node title from its content using a FREE model. Routing:
 * a BYOK Gemini key calls Gemini directly; otherwise (free-trial / whitelist)
 * it goes through the server proxy, which is locked to a free model. The paid
 * Anthropic key is never used for titling. Returns null on any failure.
 */
async function generateNodeTitle(
  geminiKey: string, prompt: string, refsText: string, response: string,
): Promise<string | null> {
  const parts: string[] = [];
  if (prompt.trim()) parts.push(`【問題】\n${prompt.trim()}`);
  if (refsText.trim()) parts.push(`【引用片段】\n${refsText.trim().slice(0, 1500)}`);
  if (response.trim()) parts.push(`【回答】\n${response.trim().slice(0, 2500)}`);
  if (parts.length === 0) return null;
  const messages = [{ role: 'user' as const, content: parts.join('\n\n') }];

  try {
    let raw: string;
    if (geminiKey) {
      raw = await callGeminiAPI(geminiKey, TITLE_MODEL, messages, TITLE_GEN_SYSTEM);
    } else {
      const authState = useAuthStore.getState();
      if (!(authState.devMode && hasDevKeyAccess(authState) && authState.credential)) return null;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: authState.credential, messages, system: TITLE_GEN_SYSTEM }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
    const title = raw.trim().replace(/^["「『]|["」』]$/g, '').replace(/\s+/g, ' ').slice(0, 60);
    return title || null;
  } catch {
    return null; // titling is best-effort; never block the main flow
  }
}

// ── Store ────────────────────────────────────────────────────────────────────
export const useCanvasStore = create<CanvasStore>()(
  persist(
    (set, get) => ({
      // Navigation
      view: 'home',
      // Seed starter canvases (tutorial + about) into the default state so that
      // brand-new visitors with empty storage — for whom persist's `merge`
      // never runs — still see the two initial canvases. Returning users get
      // them re-seeded via the version check in `merge` below.
      projects: [createTutorialProject(), createAboutProject()],
      currentProjectId: null,

      // Working canvas
      nodes: [],
      edges: [],
      contextCapsules: [],
      selectedNodeId: null,
      replayRevealed: null,
      systemPrompt: '',
      personaName: '',
      historyScope: 'ancestry',
      inputMode: 'qa',

      // Settings
      apiKey: '',
      geminiApiKey: '',
      model: 'gemini-3.1-flash-lite-preview',
      theme: 'light',
      starterSeedVersion: STARTER_SEED_VERSION,

      // ── Project management ──────────────────────────────────────────────
      createProject: (name) => {
        const id = uuidv4();
        const now = Date.now();
        _navReset();
        set((state) => ({
          projects: [{ id, name, createdAt: now, updatedAt: now, nodes: [], edges: [] }, ...state.projects],
          currentProjectId: id,
          view: 'canvas',
          nodes: [],
          edges: [],
          contextCapsules: [],
          selectedNodeId: null,
        }));
      },

      openProject: (id) => set((state) => {
        const project = state.projects.find(p => p.id === id);
        if (!project) return {};
        const firstNode = project.nodes.find(n => n.data.type === 'thoughtNode') ?? null;
        _navReset();
        return {
          currentProjectId: id,
          view: 'canvas',
          nodes: project.nodes,
          edges: project.edges,
          contextCapsules: [],
          selectedNodeId: firstNode?.id ?? null,
          systemPrompt: project.systemPrompt ?? '',
          personaName: project.personaName ?? '',
        };
      }),

      closeProject: () => {
        _navReset();
        set({
          view: 'home',
          nodes: [],
          edges: [],
          contextCapsules: [],
          selectedNodeId: null,
          systemPrompt: '',
          personaName: '',
        });
      },

      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        ...(state.currentProjectId === id ? { currentProjectId: null, view: 'home' as const, nodes: [], edges: [] } : {}),
      })),

      renameProject: (id, name) => set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, name, updatedAt: Date.now() } : p),
      })),

      // Create a new canvas from imported data and open it.
      importProject: (data) => {
        const id = uuidv4();
        const now = Date.now();
        _navReset();
        const project: Project = {
          id, name: data.name, createdAt: now, updatedAt: now,
          nodes: data.nodes, edges: data.edges,
          systemPrompt: data.systemPrompt, personaName: data.personaName,
        };
        const firstNode = data.nodes.find(n => n.data.type === 'thoughtNode') ?? null;
        set((state) => ({
          projects: [project, ...state.projects],
          currentProjectId: id,
          view: 'canvas',
          nodes: data.nodes,
          edges: data.edges,
          contextCapsules: [],
          selectedNodeId: firstNode?.id ?? null,
          systemPrompt: data.systemPrompt ?? '',
          personaName: data.personaName ?? '',
        }));
      },

      // ── Settings ────────────────────────────────────────────────────────
      setApiKey: (key) => set({ apiKey: key }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setModel: (model) => set({ model }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      setSystemPrompt: (prompt) => set((state) => {
        if (!state.currentProjectId) return { systemPrompt: prompt };
        const projects = state.projects.map(p =>
          p.id === state.currentProjectId ? { ...p, systemPrompt: prompt, updatedAt: Date.now() } : p
        );
        return { systemPrompt: prompt, projects };
      }),

      setPersonaName: (name) => set((state) => {
        if (!state.currentProjectId) return { personaName: name };
        const projects = state.projects.map(p =>
          p.id === state.currentProjectId ? { ...p, personaName: name, updatedAt: Date.now() } : p
        );
        return { personaName: name, projects };
      }),

      setHistoryScope: (scope) => set({ historyScope: scope }),
      setInputMode: (mode) => set({ inputMode: mode }),

      // ── Canvas actions (with project sync) ──────────────────────────────
      onNodesChange: (changes) => set((state) => {
        const nodes = applyNodeChanges(changes, state.nodes) as Node<NodeData>[];
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      onEdgesChange: (changes) => set((state) => {
        const edges = applyEdgeChanges(changes, state.edges);
        return { edges, ...syncProject(state.projects, state.currentProjectId, state.nodes, edges) };
      }),

      onConnect: (connection) => set((state) => {
        const edges = addEdge(connection, state.edges);
        return { edges, ...syncProject(state.projects, state.currentProjectId, state.nodes, edges) };
      }),

      // Drag an edge endpoint onto a different node — rewires the lineage so the
      // "血親記憶" (ancestral memory) now traces through the new source/target.
      onReconnect: (oldEdge, newConnection) => set((state) => {
        const edges = reconnectEdge(oldEdge, newConnection, state.edges);
        return { edges, ...syncProject(state.projects, state.currentProjectId, state.nodes, edges) };
      }),

      // Sever a single edge — cuts the ancestral-memory link between two nodes.
      removeEdge: (edgeId) => set((state) => {
        const edges = state.edges.filter(e => e.id !== edgeId);
        return { edges, ...syncProject(state.projects, state.currentProjectId, state.nodes, edges) };
      }),

      // Create an empty thought node (double-click on blank canvas). It becomes the
      // selected node so the next prompt branches from it as a fresh starting point.
      addBlankNode: (position) => set((state) => {
        const id = uuidv4();
        const blankNode: Node<ThoughtNodeData> = {
          id, type: 'thoughtNode', position, selected: true,
          data: { type: 'thoughtNode', prompt: '', response: '', isLoading: false, isCollapsed: false },
        };
        const nodes = [
          ...state.nodes.map(n => (n.selected ? { ...n, selected: false } : n)),
          blankNode as Node<NodeData>,
        ];
        return {
          nodes,
          selectedNodeId: id,
          ...syncProject(state.projects, state.currentProjectId, nodes, state.edges),
        };
      }),

      // Drop user-pasted text (e.g. another LLM's answer) into a node — no AI call.
      // The response holds the original text verbatim; the prompt is "無" (no
      // question). If a blank node is selected (created via double-click + click),
      // fill IT in place; otherwise create a new manual node at the branch point.
      commitOriginalText: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const { nodes, edges, contextCapsules, selectedNodeId } = get();

        const sel = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : undefined;
        if (sel && isThoughtNode(sel) && !sel.data.prompt && !sel.data.response) {
          set((state) => {
            const newNodes = state.nodes.map(n =>
              n.id === sel.id && n.data.type === 'thoughtNode'
                ? { ...n, data: { ...n.data, prompt: '無', response: trimmed, manual: true, isLoading: false } }
                : n
            );
            return { nodes: newNodes, ...syncProject(state.projects, state.currentProjectId, newNodes, state.edges) };
          });
          get().generateTitleForNode(sel.id);
          return;
        }

        const newNodeId = uuidv4();
        const parentIds = resolveParentIds(nodes, contextCapsules, selectedNodeId);
        const { position, parentEdges, ancestors } = buildParentLinkage(nodes, edges, parentIds, newNodeId);
        const newNode: Node<ThoughtNodeData> = {
          id: newNodeId, type: 'thoughtNode', position,
          data: {
            type: 'thoughtNode', prompt: '無', response: trimmed, manual: true,
            isLoading: false, isCollapsed: false,
            ancestorIds: ancestors.map(n => n.id),
            references: contextCapsules.length > 0 ? [...contextCapsules] : undefined,
          },
        };
        set((state) => {
          const newNodes = [...state.nodes.map(n => ({ ...n, selected: false })), newNode as Node<NodeData>];
          const newEdges = parentEdges.length > 0 ? [...state.edges, ...parentEdges] : state.edges;
          return {
            nodes: newNodes, edges: newEdges,
            contextCapsules: [], selectedNodeId: newNodeId,
            ...syncProject(state.projects, state.currentProjectId, newNodes, newEdges),
          };
        });
        get().generateTitleForNode(newNodeId);
      },

      // Title a single node with a separate free-model call (best-effort).
      generateTitleForNode: async (nodeId) => {
        const { nodes, geminiApiKey } = get();
        const node = nodes.find(n => n.id === nodeId);
        if (!node || !isThoughtNode(node)) return;
        const d = node.data;
        const refsText = (d.references ?? []).map(r => r.text).join('\n');
        const title = await generateNodeTitle(geminiApiKey, d.prompt, refsText, d.response);
        if (!title) return;
        set((state) => {
          const newNodes = state.nodes.map(n =>
            n.id === nodeId && n.data.type === 'thoughtNode'
              ? { ...n, data: { ...n.data, title } }
              : n
          );
          return { nodes: newNodes, ...syncProject(state.projects, state.currentProjectId, newNodes, state.edges) };
        });
      },

      // Re-title every node on the canvas, sequentially (free-tier friendly).
      retitleAllNodes: async () => {
        const { nodes, generateTitleForNode } = get();
        const ids = nodes
          .filter(n => {
            if (n.data.type !== 'thoughtNode') return false;
            const d = n.data as ThoughtNodeData;
            return !!(d.prompt || d.response) && !d.isLoading;
          })
          .map(n => n.id);
        for (const id of ids) await generateTitleForNode(id);
      },

      setReplayRevealed: (ids) => set({ replayRevealed: ids }),

      addContextCapsule: (capsule) =>
        set((state) => ({ contextCapsules: [...state.contextCapsules, capsule] })),
      removeContextCapsule: (id) =>
        set((state) => ({ contextCapsules: state.contextCapsules.filter(c => c.id !== id) })),
      clearContextCapsules: () => set({ contextCapsules: [] }),

      addFullNodeCapsule: (nodeId) => {
        const { nodes, contextCapsules } = get();
        if (contextCapsules.find(c => c.sourceNodeId === nodeId && c.isFullNode)) return;
        const node = nodes.find(n => n.id === nodeId);
        if (!node || !isThoughtNode(node)) return;
        const data = node.data;
        const label = data.prompt.slice(0, 40) + (data.prompt.length > 40 ? '...' : '');
        set((state) => ({
          contextCapsules: [...state.contextCapsules, {
            id: uuidv4(), sourceNodeId: nodeId, sourceNodeLabel: label,
            text: `Prompt: ${data.prompt}\n\nResponse: ${data.response}`, isFullNode: true,
          }],
        }));
      },

      setSelectedNode: (id) => {
        if (id !== null) _navPush(id);
        set({ selectedNodeId: id });
      },

      navigateBack: () => {
        if (_navIndex > 0) {
          _navIndex--;
          _isNavigating = true;
          set({ selectedNodeId: _navHistory[_navIndex] });
          _isNavigating = false;
        }
      },

      navigateForward: () => {
        if (_navIndex < _navHistory.length - 1) {
          _navIndex++;
          _isNavigating = true;
          set({ selectedNodeId: _navHistory[_navIndex] });
          _isNavigating = false;
        }
      },

      deleteNode: (nodeId) => set((state) => {
        // Clean up quote-highlight marks in source nodes that were referenced by this node
        const deletedNode = state.nodes.find(n => n.id === nodeId);
        let nodes = state.nodes;
        if (deletedNode?.data.type === 'thoughtNode') {
          const refs = (deletedNode.data as ThoughtNodeData).references ?? [];
          if (refs.length > 0) {
            nodes = nodes.map(n => {
              if (n.data.type !== 'thoughtNode') return n;
              const d = n.data as ThoughtNodeData;
              if (!d.markedHtml) return n;
              const nodeRefs = refs.filter(r => r.sourceNodeId === n.id);
              if (nodeRefs.length === 0) return n;
              let html = d.markedHtml;
              for (const ref of nodeRefs) {
                html = ref.isFullNode
                  ? stripMarksByClass(html, 'quote-highlight')
                  : stripMarkByText(html, 'quote-highlight', ref.text);
              }
              return { ...n, data: { ...d, markedHtml: html } };
            });
          }
        }
        nodes = nodes.filter(n => n.id !== nodeId);
        const edges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
        return { nodes, edges, ...syncProject(state.projects, state.currentProjectId, nodes, edges) };
      }),

      updateNodeTitle: (nodeId, title) => set((state) => {
        const nodes = state.nodes.map(n =>
          n.id === nodeId && n.data.type === 'thoughtNode'
            ? { ...n, data: { ...n.data, title: title.trim() || undefined } } : n
        );
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      updateNodePrompt: (nodeId, prompt) => set((state) => {
        const nodes = state.nodes.map(n =>
          n.id === nodeId && n.data.type === 'thoughtNode'
            ? { ...n, data: { ...n.data, prompt, response: '', isLoading: true } } : n
        );
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      toggleCollapse: (nodeId) => set((state) => {
        const nodes = state.nodes.map(n =>
          n.id === nodeId && n.data.type === 'thoughtNode'
            ? { ...n, data: { ...n.data, isCollapsed: !(n.data as ThoughtNodeData).isCollapsed } } : n
        );
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      // Cycle a node's reading state: unread (dot) → read (check) → important (star).
      cycleNodeStatus: (nodeId) => set((state) => {
        const order = ['unread', 'read', 'important'] as const;
        const nodes = state.nodes.map(n => {
          if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
          const cur = (n.data as ThoughtNodeData).readStatus ?? 'unread';
          const next = order[(order.indexOf(cur) + 1) % order.length];
          return { ...n, data: { ...n.data, readStatus: next } };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      addAnnotationNode: (parentNodeId, selectedText) => {
        const { nodes } = get();
        const parentNode = nodes.find(n => n.id === parentNodeId);
        if (!parentNode) return;
        const annotationId = uuidv4();
        const annotationNode: Node<AnnotationNodeData> = {
          id: annotationId, type: 'annotationNode',
          position: { x: parentNode.position.x + NODE_WIDTH + 60, y: parentNode.position.y + 80 },
          data: { type: 'annotationNode', parentNodeId, selectedText, note: '' },
        };
        set((state) => {
          const nodes = [...state.nodes, annotationNode as Node<NodeData>];
          const edges = [...state.edges, {
            id: `e_annotation_${parentNodeId}_${annotationId}`,
            source: parentNodeId, target: annotationId,
            type: 'default', style: { strokeDasharray: '5,5', stroke: '#f9a8d4' }, animated: false,
          }];
          return { nodes, edges, ...syncProject(state.projects, state.currentProjectId, nodes, edges) };
        });
      },

      sendPrompt: async (userInput: string) => {
        const { nodes, edges, contextCapsules, apiKey, geminiApiKey, model, systemPrompt, historyScope, selectedNodeId } = get();

        // ── Determine parenthood, placement & ancestry (see shared helpers) ──
        const newNodeId = uuidv4();
        const parentIds = resolveParentIds(nodes, contextCapsules, selectedNodeId);
        const { position: newPosition, parentEdges, ancestors } =
          buildParentLinkage(nodes, edges, parentIds, newNodeId);

        const newNode: Node<ThoughtNodeData> = {
          id: newNodeId, type: 'thoughtNode', position: newPosition,
          data: {
            type: 'thoughtNode', prompt: userInput, response: '', isLoading: true, isCollapsed: false,
            ancestorIds: ancestors.map(n => n.id),
            references: contextCapsules.length > 0 ? [...contextCapsules] : undefined,
          },
        };

        set((state) => {
          // Deselect all nodes so multi-select doesn't persist to the next prompt
          const newNodes = [...state.nodes.map(n => ({ ...n, selected: false })), newNode as Node<NodeData>];
          const newEdges = parentEdges.length > 0 ? [...state.edges, ...parentEdges] : state.edges;
          return {
            nodes: newNodes, edges: newEdges,
            contextCapsules: [], selectedNodeId: newNodeId,
            ...syncProject(state.projects, state.currentProjectId, newNodes, newEdges),
          };
        });

        // ── Augment prompt with context capsules ─────────────────────────────
        let finalUserContent = userInput;
        if (contextCapsules.length > 0) {
          const contextParts = contextCapsules
            .map((c, i) => `【Context ${i + 1} (from: ${c.sourceNodeLabel})】:\n"${c.text}"`)
            .join('\n\n');
          finalUserContent = `${contextParts}\n\n【User Question】:\n${userInput}\n\nPlease answer based on the above references and our conversation history.`;
        }

        // ── Build message history based on selected scope ─────────────────────
        const chronoSort = (a: Node<NodeData>, b: Node<NodeData>) => {
          const dy = a.position.y - b.position.y;
          return Math.abs(dy) > 5 ? dy : a.position.x - b.position.x;
        };

        let historyNodes: Node<NodeData>[];
        if (historyScope === 'global') {
          // All thought nodes on canvas, sorted chronologically top→bottom, left→right
          historyNodes = nodes.filter(n => n.data.type === 'thoughtNode').sort(chronoSort);
        } else if (historyScope === 'custom') {
          // Only the manually Shift+Click selected nodes — no ancestor tracing
          historyNodes = nodes
            .filter(n => n.selected && n.data.type === 'thoughtNode')
            .sort(chronoSort);
        } else {
          // 'ancestry' (default): DAG ancestors from parent nodes
          historyNodes = ancestors;
        }

        const messages = [
          ...buildMessagesFromPath(historyNodes),
          { role: 'user' as const, content: finalUserContent },
        ];

        try {
          const rawResponse = await callAI(model, apiKey, geminiApiKey, messages, systemPrompt || undefined);
          const { response: cleanResponse, title } = parseTitleFromResponse(rawResponse);
          set((state) => {
            const updatedNodes = state.nodes.map(n =>
              n.id === newNodeId
                ? { ...n, data: { ...n.data, response: cleanResponse, title, isLoading: false } }
                : n
            );
            return { nodes: updatedNodes, ...syncProject(state.projects, state.currentProjectId, updatedNodes, state.edges) };
          });
          // Best-effort: refine the title with a separate free Gemini call (never blocks).
          get().generateTitleForNode(newNodeId);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          set((state) => {
            const updatedNodes = state.nodes.map(n =>
              n.id === newNodeId
                ? { ...n, data: { ...n.data, response: `Error: ${errorMsg}`, isLoading: false } }
                : n
            );
            return { nodes: updatedNodes, ...syncProject(state.projects, state.currentProjectId, updatedNodes, state.edges) };
          });
        }
      },

      // ── Highlights & annotations ────────────────────────────────────────
      updateMarkedHtml: (nodeId, html) => set((state) => {
        const nodes = state.nodes.map(n => {
          if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
          return { ...n, data: { ...n.data, markedHtml: html } as typeof n.data };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      addHighlight: (nodeId, text) => set((state) => {
        const nodes = state.nodes.map(n => {
          if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
          const d = n.data as ThoughtNodeData;
          if ((d.highlights ?? []).includes(text)) return n;
          return { ...n, data: { ...d, highlights: [...(d.highlights ?? []), text] } };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      addPromptHighlight: (nodeId, text) => set((state) => {
        const nodes = state.nodes.map(n => {
          if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
          const d = n.data as ThoughtNodeData;
          if ((d.promptHighlights ?? []).includes(text)) return n;
          return { ...n, data: { ...d, promptHighlights: [...(d.promptHighlights ?? []), text] } };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      addQuoteHighlight: (nodeId, text) => set((state) => {
        const nodes = state.nodes.map(n => {
          if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
          const d = n.data as ThoughtNodeData;
          if ((d.quoteHighlights ?? []).includes(text)) return n;
          return { ...n, data: { ...d, quoteHighlights: [...(d.quoteHighlights ?? []), text] } };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      addAnnotation: (nodeId, selectedText) => {
        const id = uuidv4();
        set((state) => {
          const nodes = state.nodes.map(n => {
            if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
            const d = n.data as ThoughtNodeData;
            const ann = { id, selectedText, noteHtml: '', messages: [], createdAt: Date.now() };
            return { ...n, data: { ...d, annotations: [...(d.annotations ?? []), ann] } };
          });
          return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
        });
        return id;
      },

      updateAnnotation: (nodeId, annotationId, noteHtml) => set((state) => {
        const nodes = state.nodes.map(n => {
          if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
          const d = n.data as ThoughtNodeData;
          return {
            ...n,
            data: {
              ...d,
              annotations: (d.annotations ?? []).map(a =>
                a.id === annotationId ? { ...a, noteHtml } : a
              ),
            },
          };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      addAnnotationMessage: (nodeId, annotationId, html) => set((state) => {
        const nodes = state.nodes.map(n => {
          if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
          const d = n.data as ThoughtNodeData;
          const msg = { id: uuidv4(), html, createdAt: Date.now() };
          return {
            ...n,
            data: {
              ...d,
              annotations: (d.annotations ?? []).map(a =>
                a.id === annotationId
                  ? { ...a, messages: [...(a.messages ?? []), msg] }
                  : a
              ),
            },
          };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      deleteAnnotation: (nodeId, annotationId) => set((state) => {
        const nodes = state.nodes.map(n => {
          if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
          const d = n.data as ThoughtNodeData;
          const ann = (d.annotations ?? []).find(a => a.id === annotationId);
          // Remove the corresponding note-highlight mark from markedHtml
          const markedHtml = ann && d.markedHtml
            ? stripMarkByText(d.markedHtml, 'note-highlight', ann.selectedText)
            : d.markedHtml;
          return {
            ...n,
            data: { ...d, markedHtml, annotations: (d.annotations ?? []).filter(a => a.id !== annotationId) },
          };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      regenerateNode: async (nodeId: string) => {
        const { nodes, edges, apiKey, geminiApiKey, model, systemPrompt } = get();
        const node = nodes.find(n => n.id === nodeId);
        if (!node || !isThoughtNode(node)) return;
        const data = node.data;

        set((state) => {
          const newNodes = state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, response: '' } } : n);
          return { nodes: newNodes, ...syncProject(state.projects, state.currentProjectId, newNodes, state.edges) };
        });

        // Use DAG ancestors from all direct parents of this node
        const parentIds = edges.filter(e => e.target === nodeId).map(e => e.source);
        const ancestors = parentIds.length > 0
          ? getDAGAncestors(parentIds, nodes, edges)
          : [];

        let userContent = data.prompt;
        if (data.references && data.references.length > 0) {
          const contextParts = data.references
            .map((c, i) => `【Context ${i + 1} (from: ${c.sourceNodeLabel})】:\n"${c.text}"`)
            .join('\n\n');
          userContent = `${contextParts}\n\n【User Question】:\n${data.prompt}\n\nPlease answer based on the above references and our conversation history.`;
        }

        const messages = [
          ...buildMessagesFromPath(ancestors),
          { role: 'user' as const, content: userContent },
        ];

        try {
          const rawResponse = await callAI(model, apiKey, geminiApiKey, messages, systemPrompt || undefined);
          const { response: cleanResponse, title } = parseTitleFromResponse(rawResponse);
          set((state) => {
            const newNodes = state.nodes.map(n =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, response: cleanResponse, title, isLoading: false } }
                : n
            );
            return { nodes: newNodes, ...syncProject(state.projects, state.currentProjectId, newNodes, state.edges) };
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          set((state) => {
            const newNodes = state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, response: `Error: ${errorMsg}`, isLoading: false } } : n);
            return { nodes: newNodes, ...syncProject(state.projects, state.currentProjectId, newNodes, state.edges) };
          });
        }
      },
    }),
    {
      name: 'radial-ai-canvas',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
        apiKey: state.apiKey,
        geminiApiKey: state.geminiApiKey,
        model: state.model,
        theme: state.theme,
        starterSeedVersion: state.starterSeedVersion,
      }),
      merge: (persisted, current) => {
        const p = persisted as Record<string, unknown>;

        // Migrate old model IDs
        const modelMap: Record<string, string> = {
          'gemini-1.5-flash': 'gemini-3-flash-preview',
          'gemini-1.5-flash-latest': 'gemini-3-flash-preview',
          'gemini-1.5-pro': 'gemini-3.1-pro-preview',
          'gemini-1.5-pro-latest': 'gemini-3.1-pro-preview',
          'gemini-2.0-flash': 'gemini-3-flash-preview',
          'gemini-2.5-pro': 'gemini-3.1-pro-preview',
          'gemini-2.5-pro-preview-05-06': 'gemini-3.1-pro-preview',
          'gemini-3-pro-preview': 'gemini-3.1-pro-preview',
        };
        const model = typeof p.model === 'string' ? (modelMap[p.model] ?? p.model) : current.model;

        // Migrate old single-canvas data (before multi-project)
        let projects = (p.projects as Project[] | undefined) ?? [];
        if (projects.length === 0 && Array.isArray(p.nodes) && p.nodes.length > 0) {
          const migratedId = 'migrated-1';
          projects = [{
            id: migratedId, name: 'My Canvas',
            createdAt: Date.now(), updatedAt: Date.now(),
            nodes: p.nodes as Node<NodeData>[],
            edges: (p.edges as Edge[]) ?? [],
          }];
        }

        // Seed/refresh the starter canvases (tutorial + about) for every
        // install. When the persisted seed version is behind, drop any old
        // starter copies and prepend fresh ones — without touching the user's
        // own projects.
        const seedVersion = (p.starterSeedVersion as number) ?? 0;
        if (seedVersion < STARTER_SEED_VERSION) {
          const userProjects = projects.filter(pr => !STARTER_PROJECT_IDS.has(pr.id));
          projects = [createTutorialProject(), createAboutProject(), ...userProjects];
        }

        return {
          ...current,
          projects,
          currentProjectId: (p.currentProjectId as string | null) ?? null,
          apiKey: (p.apiKey as string) ?? '',
          geminiApiKey: (p.geminiApiKey as string) ?? '',
          model,
          theme: (p.theme as 'light' | 'dark') ?? 'light',
          starterSeedVersion: STARTER_SEED_VERSION,
          view: 'home',
          nodes: [],
          edges: [],
          selectedNodeId: null,
        };
      },
    }
  )
);
