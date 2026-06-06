import type { Node, Edge } from '@xyflow/react';
import type { NodeData, ThoughtNodeData } from '../store/types';

// Versioned envelope written by JSON export — lets another Radial AI (or a future
// version) recognise and re-import a canvas losslessly.
export interface CanvasExport {
  format: 'radial-ai/canvas';
  version: 1;
  name: string;
  exportedAt: number;
  systemPrompt?: string;
  personaName?: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
}

export interface CanvasImport {
  name: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  systemPrompt?: string;
  personaName?: string;
}

interface CanvasSource {
  name: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  systemPrompt?: string;
  personaName?: string;
}

/** Lossless JSON for Radial-AI → Radial-AI transfer (re-importable). */
export function buildCanvasJSON(src: CanvasSource, exportedAt: number): string {
  const env: CanvasExport = {
    format: 'radial-ai/canvas',
    version: 1,
    name: src.name,
    exportedAt,
    systemPrompt: src.systemPrompt || undefined,
    personaName: src.personaName || undefined,
    nodes: src.nodes,
    edges: src.edges,
  };
  return JSON.stringify(env, null, 2);
}

// Reading order: top→bottom, then left→right (matches the 'global' history scope).
function chrono(a: Node<NodeData>, b: Node<NodeData>): number {
  const dy = a.position.y - b.position.y;
  return Math.abs(dy) > 5 ? dy : a.position.x - b.position.x;
}

/** Human/LLM-readable Markdown transcript of every thought on the canvas. */
export function buildCanvasMarkdown(name: string, nodes: Node<NodeData>[]): string {
  const thoughts = nodes
    .filter(n => n.data.type === 'thoughtNode' && !(n.data as ThoughtNodeData).isDeleted)
    .sort(chrono);

  const out: string[] = [`# ${name}`, '', '> Exported from Radial AI', ''];
  thoughts.forEach((n, i) => {
    const d = n.data as ThoughtNodeData;
    out.push(`## ${i + 1}. ${d.title || `Thought ${i + 1}`}`, '');
    if (d.references?.length) {
      out.push('**引用 References:**', '');
      d.references.forEach(r => out.push(`> ${r.text.replace(/\s*\n\s*/g, ' ').trim()}`));
      out.push('');
    }
    if (d.prompt) out.push(`**Q:** ${d.prompt}`, '');
    if (d.response) out.push(d.response, '');
    out.push('---', '');
  });
  return out.join('\n');
}

/** Validate and unwrap an imported JSON canvas file. */
export function parseCanvasImport(
  text: string,
): { ok: true; data: CanvasImport } | { ok: false; error: string } {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, error: '檔案不是有效的 JSON' }; }
  const o = json as Record<string, unknown>;
  if (o?.format !== 'radial-ai/canvas') return { ok: false, error: '不是 Radial AI 畫布檔（format 不符）' };
  if (!Array.isArray(o.nodes) || !Array.isArray(o.edges)) return { ok: false, error: '檔案缺少 nodes / edges' };
  return {
    ok: true,
    data: {
      name: typeof o.name === 'string' && o.name.trim() ? o.name : 'Imported Canvas',
      nodes: o.nodes as Node<NodeData>[],
      edges: o.edges as Edge[],
      systemPrompt: typeof o.systemPrompt === 'string' ? o.systemPrompt : undefined,
      personaName: typeof o.personaName === 'string' ? o.personaName : undefined,
    },
  };
}

/** Sanitise a canvas name into a safe download filename stem. */
export function safeFileStem(name: string): string {
  return (name.trim() || 'canvas').replace(/[^\p{L}\p{N}\-_ ]/gu, '').replace(/\s+/g, '_').slice(0, 60) || 'canvas';
}

/** Trigger a client-side download of text content. */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
