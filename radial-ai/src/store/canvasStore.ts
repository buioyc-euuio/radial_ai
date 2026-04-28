import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { NodeData, ContextCapsule, ThoughtNodeData, AnnotationNodeData } from './types';
import { useAuthStore } from './authStore';
import { calculateOptimalPosition } from '../utils/autoLayout';

const NODE_WIDTH = 220;
const NODE_VERTICAL_GAP = 60;
const NODE_HEIGHT_ESTIMATE = 140;
const BRANCH_HORIZONTAL_GAP = 60;
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

// ── Tutorial canvas (pre-created on first load) ───────────────────────────────
const TUTORIAL_PROJECT_ID = 'tutorial';

const TUTORIAL_NODES: Node<NodeData>[] = [
  // ── Node 1: Root / Overview ────────────────────────────────────────────────
  {
    id: 'tutorial-1', type: 'thoughtNode',
    position: { x: 80, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '什麼是 Radial AI v2？',
      response: `Radial AI 是一款打破傳統線性對話的 **AI 思維畫布**。\n\n## 核心概念\n\n左側**無限畫布**將每一次 AI 問答化為可視化的「思維節點」，右側**閱讀面板**提供深度閱讀與互動。所有節點以**有向箭頭**連接，清楚呈現思路的脈絡與分支。\n\n## v2 全新升級\n\n- **🔀 DAG 多父節點匯聚**：Shift+Click 選取多個節點，讓新節點從多個來源同時繼承脈絡\n- **🎯 Context Scope 切換器**：輸入框下方切換「血親 / 全局 / 自定義」三種歷史打包模式\n- **🤖 AI Persona**：為每個畫布設定獨立的系統指令，打造專屬 AI 角色\n- **✨ Floating Edges**：邊線動態連接節點最近邊框，拖曳後自動重路由\n\n## 本畫布本身就是示範！\n\n你現在看到的節點佈局示範了 DAG 結構 — **節點 #5 同時從 #2 與 #3 匯聚**。\n\n👉 點擊其他節點繼續探索，或切換到右側閱讀面板閱讀完整內容。`,
      title: 'Radial AI v2 — 產品概覽',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 2: Main timeline ──────────────────────────────────────────────────
  {
    id: 'tutorial-2', type: 'thoughtNode',
    position: { x: 80, y: 360 },
    data: {
      type: 'thoughtNode',
      prompt: '如何建立節點？主時間線怎麼運作？',
      response: `## 主時間線（Main Timeline）\n\n在底部輸入框輸入問題，按 **Enter** 發送。\n\n**沒有任何引用膠囊時** → 新節點自動加入**左側垂直時間線**，向下堆疊。\n\n---\n\n## 建立分支\n\n**有引用膠囊時** → 新節點出現在被引用節點的右側，以箭頭連接。\n\n### 如何引用？\n\n1. 點擊畫布節點 → 右側顯示完整內容\n2. 在右側選取文字\n3. 按 **⌘K**（或點工具列「引用」）\n4. 文字化為輸入框上方的**脈絡膠囊**\n5. 輸入問題 → Enter → 生成分支節點\n\n---\n\n## 快速鍵\n\n| 鍵 | 功能 |\n|----|------|\n| **Enter** | 發送訊息 |\n| **Shift+Enter** | 輸入框換行 |\n| **⌘/** | 聚焦輸入框 |\n| **Option+點擊節點** | 整個節點加入引用 |`,
      title: '主時間線與分支建立',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 3: Referencing & branching ───────────────────────────────────────
  {
    id: 'tutorial-3', type: 'thoughtNode',
    position: { x: 380, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '引用與脈絡膠囊怎麼用？',
      response: `## 脈絡膠囊（Context Capsule）\n\n膠囊是你傳給 AI 的「精準注意力錨點」。你選取的段落會以結構化方式組裝進最後一則 user message，確保 AI 聚焦在你關心的部分。\n\n---\n\n## 三種加入方式\n\n**1. 精準引用（文字片段）**\n- 在閱讀面板選取文字 → 按 **⌘K / L / C**\n- 最常用、最省 Token\n\n**2. 全節點引用**\n- 在畫布上 **Option（Alt）+ 點擊**節點\n- 整個節點的 Prompt + Response 都加入\n\n**3. Shift+Click 多選（v2 新功能）**\n- 在畫布上 **Shift+點擊 2 個以上**節點\n- 這些節點成為新節點的**多個父節點**（DAG 匯聚）\n- 系統自動追溯所有父節點的祖先歷史並去重合併\n\n---\n\n## 多重引用\n\n可以同時引用**不同節點的不同段落**。每個被引用節點都會以獨立箭頭指向新節點，引用關係清晰可見。`,
      title: '引用、膠囊與多父節點',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 4: Reading panel shortcuts ───────────────────────────────────────
  {
    id: 'tutorial-4', type: 'thoughtNode',
    position: { x: 680, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '閱讀面板有哪些功能？',
      response: `## 閱讀面板（Reading Panel）\n\n右側面板是深度互動的主要區域。點擊畫布任意節點，完整內容在此展開。\n\n---\n\n## 選取文字後的浮動工具列\n\n| 快速鍵 | 功能 |\n|--------|------|\n| **⌘K / L / C** | 引用為脈絡膠囊 |\n| **H / F** | 螢光筆標記 |\n| **N / A / E** | 建立側邊筆記 |\n\n---\n\n## 側邊筆記（Annotation）\n\n選取段落後按 **N**，在右側建立筆記卡。筆記中可以繼續和 AI 對話，追蹤特定段落的想法而不污染主對話。\n\n---\n\n## 版面切換\n\n右上角三個按鈕切換：\n- 🖼 **畫布全螢幕**\n- ⬛ **左右分割（預設）**\n- 📄 **閱讀面板全螢幕**\n\n---\n\n## 其他快速鍵\n\n| 鍵 | 功能 |\n|----|------|\n| **⌘/** | 聚焦輸入框 |\n| 滑鼠側鍵 X1/X2 | 節點歷史前進/後退 |`,
      title: '閱讀面板快速鍵全覽',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 5: v2 features (DAG convergence — has 2 parents: nodes 2 & 3) ────
  {
    id: 'tutorial-5', type: 'thoughtNode',
    position: { x: 380, y: 360 },
    data: {
      type: 'thoughtNode',
      prompt: 'v2 三大新功能怎麼用？（此節點示範 DAG 匯聚：同時從節點 #2 和 #3 繼承）',
      response: `## 🔀 DAG 多父節點匯聚\n\n**你現在看到的這個節點本身就是示範** — 它同時有兩個父節點（#2 和 #3），兩條箭頭都指向這裡。\n\n### 如何觸發？\n\n在畫布上 **Shift+Click 2 個以上**節點，然後在輸入框發送問題。系統會：\n1. 為每個父節點各自拉一條箭頭\n2. 自動追溯所有父節點的祖先歷史\n3. 去重合併後按時間順序排列，再送給 AI\n\n---\n\n## 🎯 Context Scope 切換器\n\n輸入框上方有三個模式按鈕：\n\n| 模式 | 說明 | 適合場景 |\n|------|------|----------|\n| 🔗 **血親路徑**（預設）| 只追溯直系祖先 | 一般對話，省 Token |\n| 🌐 **所有節點** | 畫布全部節點 | 跨分支綜合歸納 |\n| 👆 **自定義** | Shift+Click 選取的節點本身（不追祖先）| 精準指定脈絡 |\n\n---\n\n## 🤖 AI Persona\n\n點擊**左上角 🤖 Persona 按鈕**，為這個畫布設定：\n- **角色名稱**（e.g. 蘇格拉底、程式審查員）\n- **系統指令**（繁體中文回答、特定角色扮演、輸出格式要求…）\n\nPersona 存在畫布內，每個畫布可以有不同的 AI 角色。有設定時按鈕會發光提醒你。`,
      title: 'v2 新功能：DAG 匯聚 · Scope · Persona',
      isLoading: false, isCollapsed: false,
    },
  },
];

const TUTORIAL_EDGES: Edge[] = [
  // Main timeline: 1 → 2
  { id: 'e-t1-t2', source: 'tutorial-1', target: 'tutorial-2', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // Branch: 1 → 3
  { id: 'e-t1-t3', source: 'tutorial-1', target: 'tutorial-3', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // Branch: 3 → 4
  { id: 'e-t3-t4', source: 'tutorial-3', target: 'tutorial-4', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // DAG convergence: 2 → 5 (demonstrates multi-parent)
  { id: 'e-t2-t5', source: 'tutorial-2', target: 'tutorial-5', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#a78bfa' } },
  // DAG convergence: 3 → 5 (second parent)
  { id: 'e-t3-t5', source: 'tutorial-3', target: 'tutorial-5', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#a78bfa' } },
];

function createTutorialProject(): Project {
  const now = Date.now();
  return { id: TUTORIAL_PROJECT_ID, name: 'Tutorial', createdAt: now, updatedAt: now, nodes: TUTORIAL_NODES, edges: TUTORIAL_EDGES };
}

// ── Main timeline helpers ──────────────────────────────────────────────────────

// Returns the last node in the vertical main timeline chain.
function getMainTimelineLastNode(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData> | null {
  const relevant = nodes.filter(n => n.data.type === 'thoughtNode' || n.data.type === 'placeholderNode');
  if (relevant.length === 0) return null;
  const hasIncoming = new Set(edges.map(e => e.target));
  const roots = relevant.filter(n => !hasIncoming.has(n.id));
  if (roots.length === 0) return relevant.sort((a, b) => b.position.y - a.position.y)[0];
  const root = roots.sort((a, b) => a.position.y - b.position.y)[0];
  const mainEdges = edges.filter(e => e.sourceHandle === 'source-bottom' && e.targetHandle === 'target-top');
  let current: Node<NodeData> = root;
  while (true) {
    const next = mainEdges.find(e => e.source === current.id);
    if (!next) break;
    const nextNode = relevant.find(n => n.id === next.target);
    if (!nextNode) break;
    current = nextNode;
  }
  return current;
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

// ── Project (each canvas) ────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: Node<NodeData>[];
  edges: Edge[];
  systemPrompt?: string;
  personaName?: string;
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

  // Global settings
  apiKey: string;
  geminiApiKey: string;
  model: string;
  theme: 'light' | 'dark';
  tutorialSeeded: boolean;
  toggleTheme: () => void;

  // Project management
  createProject: (name: string) => void;
  openProject: (id: string) => void;
  closeProject: () => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;

  // Settings
  setApiKey: (key: string) => void;
  setGeminiApiKey: (key: string) => void;
  setModel: (model: string) => void;

  // Canvas actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
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
  const { devMode, credential, isWhitelisted } = useAuthStore.getState();

  // Merge canvas persona prompt with the title-extraction instruction
  const systemPrompt = canvasSystemPrompt
    ? `${canvasSystemPrompt}\n\n${TITLE_SYSTEM_PROMPT}`
    : TITLE_SYSTEM_PROMPT;

  // Dev mode: route through backend proxy (uses server PROD_API_KEY, model locked server-side)
  if (devMode && isWhitelisted && credential) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, messages, system: systemPrompt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
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

// ── Store ────────────────────────────────────────────────────────────────────
export const useCanvasStore = create<CanvasStore>()(
  persist(
    (set, get) => ({
      // Navigation
      view: 'home',
      projects: [],
      currentProjectId: null,

      // Working canvas
      nodes: [],
      edges: [],
      contextCapsules: [],
      selectedNodeId: null,
      systemPrompt: '',
      personaName: '',
      historyScope: 'ancestry',

      // Settings
      apiKey: '',
      geminiApiKey: '',
      model: 'gemini-3.1-flash-lite-preview',
      theme: 'light',
      tutorialSeeded: false,

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

      addContextCapsule: (capsule) =>
        set((state) => ({ contextCapsules: [...state.contextCapsules, capsule] })),
      removeContextCapsule: (id) =>
        set((state) => ({ contextCapsules: state.contextCapsules.filter(c => c.id !== id) })),
      clearContextCapsules: () => set({ contextCapsules: [] }),

      addFullNodeCapsule: (nodeId) => {
        const { nodes, contextCapsules } = get();
        if (contextCapsules.find(c => c.sourceNodeId === nodeId && c.isFullNode)) return;
        const node = nodes.find(n => n.id === nodeId);
        if (!node || node.data.type !== 'thoughtNode') return;
        const data = node.data as ThoughtNodeData;
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
        const { nodes, edges, contextCapsules, apiKey, geminiApiKey, model, systemPrompt, historyScope } = get();

        // ── Determine parent node IDs ────────────────────────────────────────
        // Multi-select (Shift+Click 2+ nodes) takes priority over capsule sources.
        const selectedThoughtNodes = nodes.filter(
          n => n.selected && n.data.type === 'thoughtNode'
        );
        const capsuleSourceIds = [...new Set(contextCapsules.map(c => c.sourceNodeId))].filter(Boolean);

        let parentIds: string[];
        if (selectedThoughtNodes.length >= 2) {
          // DAG convergence: merge all selected nodes + any capsule sources
          parentIds = [...new Set([...selectedThoughtNodes.map(n => n.id), ...capsuleSourceIds])];
        } else if (capsuleSourceIds.length > 0) {
          // Classic branch: capsule source nodes determine parenthood
          parentIds = capsuleSourceIds;
        } else {
          parentIds = [];
        }

        const newNodeId = uuidv4();
        let newPosition = { x: MAIN_TIMELINE_X, y: 80 };
        const parentEdges: Edge[] = [];

        if (parentIds.length > 0) {
          const parentNodes = parentIds
            .map(id => nodes.find(n => n.id === id))
            .filter((n): n is Node<NodeData> => !!n);

          // Use auto-layout to find the best collision-free position
          newPosition = calculateOptimalPosition(parentNodes, nodes);

          // One floating edge per parent
          for (const parentId of parentIds) {
            const srcNode = nodes.find(n => n.id === parentId);
            if (!srcNode) continue;
            const { sourceHandle, targetHandle } = getEdgeHandles(
              srcNode.position.x, srcNode.position.y, newPosition.x, newPosition.y
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
          // No parents → append on main vertical timeline
          const lastMainNode = getMainTimelineLastNode(nodes, edges);
          if (lastMainNode) {
            newPosition = {
              x: lastMainNode.position.x,
              y: lastMainNode.position.y + NODE_HEIGHT_ESTIMATE + NODE_VERTICAL_GAP,
            };
            parentEdges.push({
              id: `e_${lastMainNode.id}_${newNodeId}`,
              source: lastMainNode.id, target: newNodeId,
              sourceHandle: 'source-bottom', targetHandle: 'target-top',
              type: 'floatingEdge',
              markerEnd: { type: 'arrowclosed' as const },
              style: { stroke: '#f472b6' },
            });
          }
        }

        // ── Build deduplicated DAG conversation history ───────────────────────
        const effectiveParentIds = parentIds.length > 0
          ? parentIds
          : parentEdges.length > 0 ? [parentEdges[0].source] : [];

        const ancestors = effectiveParentIds.length > 0
          ? getDAGAncestors(effectiveParentIds, nodes, edges)
          : [];

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
        if (!node || node.data.type !== 'thoughtNode') return;
        const data = node.data as ThoughtNodeData;

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
        tutorialSeeded: state.tutorialSeeded,
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

        // Seed tutorial project once per install
        const tutorialSeeded = (p.tutorialSeeded as boolean) ?? false;
        if (!tutorialSeeded) {
          projects = [createTutorialProject(), ...projects];
        }

        return {
          ...current,
          projects,
          currentProjectId: (p.currentProjectId as string | null) ?? null,
          apiKey: (p.apiKey as string) ?? '',
          geminiApiKey: (p.geminiApiKey as string) ?? '',
          model,
          theme: (p.theme as 'light' | 'dark') ?? 'light',
          tutorialSeeded: true,
          view: 'home',
          nodes: [],
          edges: [],
          selectedNodeId: null,
        };
      },
    }
  )
);
