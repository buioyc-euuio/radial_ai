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

// ── Demo nodes (shown when a new project is created) ─────────────────────────
const DEMO_NODES: Node<NodeData>[] = [
  {
    id: 'demo-1', type: 'thoughtNode',
    position: { x: 80, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: 'What is Radial AI?',
      response: `Radial AI is an innovative chat interface that visualizes conversations as a **tree graph** on an infinite canvas.\n\nUnlike traditional linear chats, Radial AI lets you:\n\n- **Branch** discussions from any specific context\n- **Trace** ancestral history automatically\n- **Quote** precise text segments as context capsules\n- **Visualize** the flow of ideas spatially\n\nThe **left canvas** shows your thought map, while the **right reading panel** gives you a focused, distraction-free reading experience.`,
      title: 'Infinite canvas AI conversation tool',
      isLoading: false, isCollapsed: false,
    },
  },
  {
    id: 'demo-2', type: 'thoughtNode',
    position: { x: 80, y: 300 },
    data: {
      type: 'thoughtNode',
      prompt: 'How does ancestral tracing work?',
      response: `## Ancestral Tracing\n\nWhen you send a new prompt, Radial AI traces the **directed edges backward** on the canvas to build the conversation history.\n\n### Algorithm\n1. Start from the current node\n2. Follow parent edges upward through the graph\n3. Build a \`messages\` array: \`[user, assistant, user, assistant…]\`\n4. Send only the direct lineage to the AI\n\nThis ensures **precise context** and **lower token cost** — irrelevant conversation branches are never sent.`,
      title: 'Graph-based ancestral history tracing',
      isLoading: false, isCollapsed: false,
    },
  },
  {
    id: 'demo-3', type: 'thoughtNode',
    position: { x: 380, y: 190 },
    data: {
      type: 'thoughtNode',
      prompt: 'Explain the Split View design',
      response: `## Split View Architecture\n\nThe interface is divided into two panes:\n\n**Left Pane — Canvas:**\n- Infinite canvas powered by React Flow\n- Thought Cards show only brief summaries\n- Drag, drop, and connect nodes freely\n- Click a card to view its full content\n\n**Right Pane — Reading Panel:**\n- Full prompt and AI response displayed here\n- Select any text to get a floating toolbar\n- Use **Cmd/Ctrl + K** to quote selections as context capsules\n- All text interaction happens here — no canvas pointer conflicts\n\n**Bottom — Global Input Palette:**\n- Type your question and press Enter to send\n- Context Capsules appear here when you quote text from the panel`,
      title: 'Dual-pane Split View architecture',
      isLoading: false, isCollapsed: false,
    },
  },
];

const DEMO_EDGES: Edge[] = [
  // demo-1 (x:80) → demo-2 (x:80, below): vertical chain → bottom→top
  { id: 'e-demo-1-2', source: 'demo-1', target: 'demo-2', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'smoothstep', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // demo-1 (x:80) → demo-3 (x:380, right): horizontal branch → right→left
  { id: 'e-demo-1-3', source: 'demo-1', target: 'demo-3', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
];

// ── Project (each canvas) ────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: Node<NodeData>[];
  edges: Edge[];
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
  deleteNode: (nodeId: string) => void;
  updateNodePrompt: (nodeId: string, prompt: string) => void;
  toggleCollapse: (nodeId: string) => void;
  addAnnotationNode: (parentNodeId: string, selectedText: string) => void;
  sendPrompt: (prompt: string) => Promise<void>;
  regenerateNode: (nodeId: string) => Promise<void>;

  // Inline highlights & annotations (reading panel)
  addHighlight: (nodeId: string, text: string) => void;
  addAnnotation: (nodeId: string, selectedText: string) => string;
  updateAnnotation: (nodeId: string, annotationId: string, noteHtml: string) => void;
  deleteAnnotation: (nodeId: string, annotationId: string) => void;
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

      // ── Project management ──────────────────────────────────────────────
      createProject: (name) => {
        const id = uuidv4();
        const now = Date.now();
        const isFirst = get().projects.length === 0;
        const initialNodes = isFirst ? DEMO_NODES : [];
        const initialEdges = isFirst ? DEMO_EDGES : [];
        set((state) => ({
          projects: [{ id, name, createdAt: now, updatedAt: now, nodes: initialNodes, edges: initialEdges }, ...state.projects],
          currentProjectId: id,
          view: 'canvas',
          nodes: initialNodes,
          edges: initialEdges,
          contextCapsules: [],
          selectedNodeId: isFirst ? 'demo-1' : null,
        }));
      },

      openProject: (id) => set((state) => {
        const project = state.projects.find(p => p.id === id);
        if (!project) return {};
        const firstNode = project.nodes.find(n => n.data.type === 'thoughtNode') ?? null;
        return {
          currentProjectId: id,
          view: 'canvas',
          nodes: project.nodes,
          edges: project.edges,
          contextCapsules: [],
          selectedNodeId: firstNode?.id ?? null,
        };
      }),

      closeProject: () => set({
        view: 'home',
        nodes: [],
        edges: [],
        contextCapsules: [],
        selectedNodeId: null,
      }),

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

      setSelectedNode: (id) => set({ selectedNodeId: id }),

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
        const primaryCapsule = contextCapsules.find(c => !c.isFullNode) ?? contextCapsules[0];
        const primarySourceNodeId = primaryCapsule?.sourceNodeId ?? null;
        const newNodeId = uuidv4();
        let newPosition = { x: 0, y: 0 };
        let parentEdge: Edge | null = null;

        if (primarySourceNodeId) {
          const sourceNode = nodes.find(n => n.id === primarySourceNodeId);
          if (sourceNode) {
            const xOffset = edges.filter(e => e.source === primarySourceNodeId).length * (NODE_WIDTH + BRANCH_HORIZONTAL_GAP);
            newPosition = { x: sourceNode.position.x + NODE_WIDTH + BRANCH_HORIZONTAL_GAP + xOffset, y: sourceNode.position.y };
          }
          // Branch: new node is to the right → right→left handles
          parentEdge = { id: `e_${primarySourceNodeId}_${newNodeId}`, source: primarySourceNodeId, target: newNodeId, sourceHandle: 'source-right', targetHandle: 'target-left', type: 'smoothstep', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } };
        } else {
          const lastMainNode = [...nodes]
            .filter(n => n.data.type === 'thoughtNode' || n.data.type === 'placeholderNode')
            .sort((a, b) => b.position.y - a.position.y)[0];
          if (lastMainNode) {
            newPosition = { x: lastMainNode.position.x, y: lastMainNode.position.y + NODE_HEIGHT_ESTIMATE + NODE_VERTICAL_GAP };
            // Main chain: new node is below → bottom→top handles
            parentEdge = { id: `e_${lastMainNode.id}_${newNodeId}`, source: lastMainNode.id, target: newNodeId, sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'smoothstep', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } };
          }
        }

        // Compute ancestorIds using materialized path
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
          // Main chain: find the last main node
          const lastMainNode = [...nodes]
            .filter(n => n.data.type === 'thoughtNode' || n.data.type === 'placeholderNode')
            .sort((a, b) => b.position.y - a.position.y)[0];
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
          const newEdges = parentEdge ? [...state.edges, parentEdge] : state.edges;
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
      addHighlight: (nodeId, text) => set((state) => {
        const nodes = state.nodes.map(n => {
          if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
          const d = n.data as ThoughtNodeData;
          if ((d.highlights ?? []).includes(text)) return n;
          return { ...n, data: { ...d, highlights: [...(d.highlights ?? []), text] } };
        });
        return { nodes, ...syncProject(state.projects, state.currentProjectId, nodes, state.edges) };
      }),

      addAnnotation: (nodeId, selectedText) => {
        const id = uuidv4();
        set((state) => {
          const nodes = state.nodes.map(n => {
            if (n.id !== nodeId || n.data.type !== 'thoughtNode') return n;
            const d = n.data as ThoughtNodeData;
            const ann = { id, selectedText, noteHtml: '', createdAt: Date.now() };
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

        return {
          ...current,
          projects,
          currentProjectId: (p.currentProjectId as string | null) ?? null,
          apiKey: (p.apiKey as string) ?? '',
          geminiApiKey: (p.geminiApiKey as string) ?? '',
          model,
          theme: (p.theme as 'light' | 'dark') ?? 'light',
          view: 'home',
          nodes: [],
          edges: [],
          selectedNodeId: null,
        };
      },
    }
  )
);
