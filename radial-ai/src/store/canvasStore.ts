import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { NodeData, ContextCapsule, ThoughtNodeData, AnnotationNodeData } from './types';

const NODE_WIDTH = 220;
const NODE_VERTICAL_GAP = 60;
const NODE_HEIGHT_ESTIMATE = 140;
const BRANCH_HORIZONTAL_GAP = 60;
const MAIN_TIMELINE_X = 80;

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
  {
    id: 'tutorial-1', type: 'thoughtNode',
    position: { x: 80, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '什麼是 Radial AI？',
      response: `Radial AI 是一個將 AI 對話以**樹狀圖**呈現的無限畫布工具。\n\n不同於傳統的線性聊天，Radial AI 讓你能夠：\n\n- **分支**：從任何節點延伸出新的對話分支\n- **引用**：選取文字並引用為脈絡膠囊，讓 AI 理解你的意圖\n- **視覺化**：在畫布上看見你的思維地圖\n\n**左側畫布** 展示節點結構，**右側閱讀面板** 提供完整的閱讀與互動體驗。\n\n👉 點擊其他節點繼續探索！`,
      title: 'Radial AI 入門指南',
      isLoading: false, isCollapsed: false,
    },
  },
  {
    id: 'tutorial-2', type: 'thoughtNode',
    position: { x: 80, y: 300 },
    data: {
      type: 'thoughtNode',
      prompt: '如何建立新的思考節點？',
      response: `## 建立節點\n\n在畫面底部的**輸入框**輸入你的問題，按下 **Enter** 發送。\n\n### 兩種新增模式\n\n**1. 主時間線（無引用）**\n輸入框沒有任何引用膠囊時，新節點自動加入**垂直時間線**（左側縱向排列）。\n\n**2. 分支（有引用）**\n先從閱讀面板引用文字，新節點會以**分支**出現在被引用節點的右側，並以箭頭連接。若同時引用多個節點，每個被引用節點都會各自拉一條箭頭指向新節點。\n\n💡 **快速鍵**：按 **⌘/** 聚焦到輸入框`,
      title: '建立思考節點的方法',
      isLoading: false, isCollapsed: false,
    },
  },
  {
    id: 'tutorial-3', type: 'thoughtNode',
    position: { x: 380, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '如何引用其他節點的內容？',
      response: `## 引用功能\n\n1. 點擊左側畫布中的節點 → 右側顯示完整內容\n2. 在右側**選取文字**\n3. 浮動工具列出現 → 點擊 **引用**（或按 **⌘K**）\n4. 選取的文字以**脈絡膠囊**形式出現在輸入框上方\n5. 輸入問題按 Enter → AI 根據引用脈絡回答\n\n### 多重引用\n你可以同時引用**多個節點**的內容！每個被引用的節點都會以**獨立的箭頭**連接到新節點，讓引用關係清晰可見。\n\n### 全節點引用\n按住 **Alt/Shift** 點擊節點，可以將整個節點加入為引用。`,
      title: '引用與脈絡膠囊功能',
      isLoading: false, isCollapsed: false,
    },
  },
  {
    id: 'tutorial-4', type: 'thoughtNode',
    position: { x: 680, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '閱讀面板有哪些互動功能？',
      response: `## 閱讀面板互動功能\n\n右側閱讀面板是你與內容互動的主要區域：\n\n### 文字操作（選取文字後）\n\n| 快速鍵 | 功能 |\n|--------|------|\n| **⌘K / L / C** | 引用到脈絡膠囊 |\n| **H / F** | 螢光筆（藍色標記） |\n| **N / A / E** | 建立側邊筆記 |\n\n### 全域快速鍵\n- **⌘/** → 聚焦輸入框\n- **Alt+點擊節點** → 全節點引用\n\n### 筆記功能\n選取文字後建立筆記，可以在筆記中繼續與 AI 對話，追蹤特定段落的想法。`,
      title: '閱讀面板的互動功能',
      isLoading: false, isCollapsed: false,
    },
  },
];

const TUTORIAL_EDGES: Edge[] = [
  { id: 'e-tutorial-1-2', source: 'tutorial-1', target: 'tutorial-2', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'smoothstep', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  { id: 'e-tutorial-1-3', source: 'tutorial-1', target: 'tutorial-3', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  { id: 'e-tutorial-3-4', source: 'tutorial-3', target: 'tutorial-4', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
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
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  if (getModelProvider(model) === 'google') {
    if (!geminiKey) throw new Error('Please set your Google Gemini API key in Settings.');
    return callGeminiAPI(geminiKey, model, messages, TITLE_SYSTEM_PROMPT);
  }
  if (!anthropicKey) throw new Error('Please set your Anthropic API key in Settings.');
  return callClaudeAPI(anthropicKey, model, messages, TITLE_SYSTEM_PROMPT);
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

      // Settings
      apiKey: '',
      geminiApiKey: '',
      model: 'claude-sonnet-4-6',
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
        const nodes = state.nodes.map(n =>
          n.id === nodeId ? { ...n, data: { type: 'placeholderNode' as const, isDeleted: true as const } } : n
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
        const { nodes, edges, contextCapsules, apiKey, geminiApiKey, model } = get();

        // Unique source node IDs from all context capsules (deduped)
        const referenceSourceIds = [...new Set(contextCapsules.map(c => c.sourceNodeId))].filter(Boolean);
        const primarySourceNodeId = referenceSourceIds[0] ?? null;

        const newNodeId = uuidv4();
        let newPosition = { x: MAIN_TIMELINE_X, y: 80 };
        const parentEdges: Edge[] = [];

        if (primarySourceNodeId) {
          const sourceNode = nodes.find(n => n.id === primarySourceNodeId);
          if (sourceNode) {
            const branchX = sourceNode.position.x + NODE_WIDTH + BRANCH_HORIZONTAL_GAP;
            const childIds = edges.filter(e => e.source === primarySourceNodeId).map(e => e.target);
            const children = nodes.filter(n => childIds.includes(n.id));
            if (children.length === 0) {
              newPosition = { x: branchX, y: sourceNode.position.y };
            } else {
              const lowest = [...children].sort((a, b) => b.position.y - a.position.y)[0];
              newPosition = { x: branchX, y: lowest.position.y + NODE_HEIGHT_ESTIMATE + NODE_VERTICAL_GAP };
            }
          }
          // One edge per unique reference source
          for (const sourceId of referenceSourceIds) {
            const srcNode = nodes.find(n => n.id === sourceId);
            if (!srcNode) continue;
            const { sourceHandle, targetHandle } = getEdgeHandles(srcNode.position.x, srcNode.position.y, newPosition.x, newPosition.y);
            parentEdges.push({ id: `e_${sourceId}_${newNodeId}`, source: sourceId, target: newNodeId, sourceHandle, targetHandle, type: 'smoothstep', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } });
          }
        } else {
          // No references: append to main vertical timeline
          const lastMainNode = getMainTimelineLastNode(nodes, edges);
          if (lastMainNode) {
            newPosition = { x: lastMainNode.position.x, y: lastMainNode.position.y + NODE_HEIGHT_ESTIMATE + NODE_VERTICAL_GAP };
            parentEdges.push({ id: `e_${lastMainNode.id}_${newNodeId}`, source: lastMainNode.id, target: newNodeId, sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'smoothstep', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } });
          }
        }

        // Compute ancestorIds (primary lineage only)
        let newAncestorIds: string[] = [];
        if (primarySourceNodeId) {
          const sourceNode = nodes.find(n => n.id === primarySourceNodeId);
          if (sourceNode && sourceNode.data.type === 'thoughtNode') {
            const sourceData = sourceNode.data as ThoughtNodeData;
            newAncestorIds = [...(sourceData.ancestorIds ?? []), primarySourceNodeId];
          } else {
            newAncestorIds = [primarySourceNodeId];
          }
        } else {
          const lastMainNode = getMainTimelineLastNode(nodes, edges);
          if (lastMainNode) {
            if (lastMainNode.data.type === 'thoughtNode') {
              const lastData = lastMainNode.data as ThoughtNodeData;
              newAncestorIds = [...(lastData.ancestorIds ?? []), lastMainNode.id];
            } else {
              newAncestorIds = [lastMainNode.id];
            }
          }
        }

        const newNode: Node<ThoughtNodeData> = {
          id: newNodeId, type: 'thoughtNode', position: newPosition,
          data: {
            type: 'thoughtNode', prompt: userInput, response: '', isLoading: true, isCollapsed: false,
            ancestorIds: newAncestorIds,
            references: contextCapsules.length > 0 ? [...contextCapsules] : undefined,
          },
        };

        set((state) => {
          const newNodes = [...state.nodes, newNode as Node<NodeData>];
          const newEdges = parentEdges.length > 0 ? [...state.edges, ...parentEdges] : state.edges;
          return { nodes: newNodes, edges: newEdges, contextCapsules: [], selectedNodeId: newNodeId, ...syncProject(state.projects, state.currentProjectId, newNodes, newEdges) };
        });

        const ancestralPath = primarySourceNodeId
          ? getAncestralPath(primarySourceNodeId, get().nodes, get().edges)
          : getAncestralPath(newNodeId, get().nodes, get().edges).slice(0, -1);

        let finalUserContent = userInput;
        if (contextCapsules.length > 0) {
          const contextParts = contextCapsules.map((c, i) => `【Context ${i + 1} (from: ${c.sourceNodeLabel})】:\n"${c.text}"`).join('\n\n');
          finalUserContent = `${contextParts}\n\n【User Question】:\n${userInput}\n\nPlease answer based on the above references and our conversation history.`;
        }

        const messages = [...buildMessagesFromPath(ancestralPath), { role: 'user' as const, content: finalUserContent }];

        try {
          const rawResponse = await callAI(model, apiKey, geminiApiKey, messages);
          const { response: cleanResponse, title } = parseTitleFromResponse(rawResponse);
          set((state) => {
            const nodes = state.nodes.map(n =>
              n.id === newNodeId
                ? { ...n, data: { ...n.data, response: cleanResponse, title, isLoading: false } }
                : n
            );
            return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          set((state) => {
            const nodes = state.nodes.map(n => n.id === newNodeId ? { ...n, data: { ...n.data, response: `Error: ${errorMsg}`, isLoading: false } } : n);
            return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
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
          return {
            ...n,
            data: { ...d, annotations: (d.annotations ?? []).filter(a => a.id !== annotationId) },
          };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      regenerateNode: async (nodeId: string) => {
        const { nodes, edges, apiKey, geminiApiKey, model } = get();
        const node = nodes.find(n => n.id === nodeId);
        if (!node || node.data.type !== 'thoughtNode') return;
        const data = node.data as ThoughtNodeData;

        set((state) => {
          const newNodes = state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, response: '' } } : n);
          return { nodes: newNodes, ...syncProject(state.projects, state.currentProjectId, newNodes, state.edges) };
        });

        const path = getAncestralPath(nodeId, nodes, edges);
        const messages = [...buildMessagesFromPath(path.slice(0, -1)), { role: 'user' as const, content: data.prompt }];

        try {
          const rawResponse = await callAI(model, apiKey, geminiApiKey, messages);
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
