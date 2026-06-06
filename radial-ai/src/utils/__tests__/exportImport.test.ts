import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import type { NodeData } from '../../store/types';
import { buildCanvasJSON, buildCanvasMarkdown, parseCanvasImport, safeFileStem } from '../exportImport';

const nodes = [
  { id: 'a', type: 'thoughtNode', position: { x: 80, y: 80 }, data: { type: 'thoughtNode', prompt: 'Q1', response: 'A1', title: 'T1' } },
  { id: 'b', type: 'thoughtNode', position: { x: 80, y: 300 }, data: { type: 'thoughtNode', prompt: 'Q2', response: 'A2' } },
] as unknown as Node<NodeData>[];
const edges = [{ id: 'e', source: 'a', target: 'b' }];

describe('exportImport', () => {
  it('round-trips a canvas through JSON losslessly', () => {
    const json = buildCanvasJSON({ name: 'My Canvas', nodes, edges, systemPrompt: 'sp', personaName: 'pn' }, 123);
    const parsed = parseCanvasImport(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.name).toBe('My Canvas');
      expect(parsed.data.nodes).toHaveLength(2);
      expect(parsed.data.edges).toHaveLength(1);
      expect(parsed.data.systemPrompt).toBe('sp');
      expect(parsed.data.personaName).toBe('pn');
    }
  });

  it('builds readable Markdown with headings and Q/A', () => {
    const md = buildCanvasMarkdown('My Canvas', nodes);
    expect(md.startsWith('# My Canvas')).toBe(true);
    expect(md).toContain('## 1. T1');
    expect(md).toContain('**Q:** Q1');
    expect(md).toContain('A1');
    expect(md).toContain('## 2. Thought 2'); // untitled node falls back to "Thought N"
  });

  it('rejects files that are not a Radial AI canvas', () => {
    expect(parseCanvasImport('{"foo":1}').ok).toBe(false);
    expect(parseCanvasImport('not json at all').ok).toBe(false);
    expect(parseCanvasImport('{"format":"radial-ai/canvas"}').ok).toBe(false); // missing nodes/edges
  });

  it('sanitises filenames', () => {
    expect(safeFileStem('My/Canvas: 2024')).toBe('MyCanvas_2024');
    expect(safeFileStem('   ')).toBe('canvas');
  });
});
