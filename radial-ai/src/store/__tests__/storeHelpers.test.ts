import { describe, it, expect } from 'vitest'
import { parseTitleFromResponse, getAncestralPath, buildMessagesFromPath } from '../canvasStore'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData, ThoughtNodeData, PlaceholderNodeData } from '../types'

// ── parseTitleFromResponse ────────────────────────────────────────────────────

describe('parseTitleFromResponse', () => {
  it('extracts title from <node_title> tag', () => {
    const raw = 'Here is my answer.\n<node_title>Brief answer title</node_title>'
    const { response, title } = parseTitleFromResponse(raw)
    expect(title).toBe('Brief answer title')
    expect(response).toBe('Here is my answer.')
  })

  it('trims whitespace inside the tag', () => {
    const raw = 'Answer.\n<node_title>  Trimmed Title  </node_title>'
    expect(parseTitleFromResponse(raw).title).toBe('Trimmed Title')
  })

  it('removes the tag from the response text', () => {
    const raw = 'Content here.\n<node_title>Title</node_title>\n'
    expect(parseTitleFromResponse(raw).response).not.toContain('<node_title>')
  })

  it('handles multiline tag content (takes first match)', () => {
    const raw = 'Content.\n<node_title>Multi\nLine</node_title>'
    const { title } = parseTitleFromResponse(raw)
    expect(title).toBeTruthy()
  })

  it('falls back to first 50 chars when tag is absent', () => {
    const raw = 'A'.repeat(60)
    const { response, title } = parseTitleFromResponse(raw)
    expect(response).toBe(raw)
    expect(title).toBe('A'.repeat(50) + '…')
  })

  it('fallback title has no ellipsis when response is short', () => {
    const raw = 'Short response'
    const { title } = parseTitleFromResponse(raw)
    expect(title).toBe('Short response')
    expect(title).not.toContain('…')
  })
})

// ── getAncestralPath ──────────────────────────────────────────────────────────

function makeThoughtNode(id: string, x = 0, y = 0): Node<NodeData> {
  return {
    id,
    type: 'thoughtNode',
    position: { x, y },
    data: {
      type: 'thoughtNode',
      prompt: `prompt-${id}`,
      response: `response-${id}`,
      isLoading: false,
      isCollapsed: false,
    } as ThoughtNodeData,
  }
}

function makeEdge(source: string, target: string): Edge {
  return { id: `e-${source}-${target}`, source, target }
}

describe('getAncestralPath', () => {
  it('returns just the node itself when it has no parent', () => {
    const nodes = [makeThoughtNode('n1')]
    const path = getAncestralPath('n1', nodes, [])
    expect(path.map(n => n.id)).toEqual(['n1'])
  })

  it('returns linear chain in correct order (oldest first)', () => {
    const nodes = [makeThoughtNode('n1'), makeThoughtNode('n2'), makeThoughtNode('n3')]
    const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3')]
    const path = getAncestralPath('n3', nodes, edges)
    expect(path.map(n => n.id)).toEqual(['n1', 'n2', 'n3'])
  })

  it('stops at root (no further parent)', () => {
    const nodes = [makeThoughtNode('root'), makeThoughtNode('child')]
    const edges = [makeEdge('root', 'child')]
    const path = getAncestralPath('child', nodes, edges)
    expect(path.map(n => n.id)).toEqual(['root', 'child'])
  })

  it('returns empty array for unknown node id', () => {
    const path = getAncestralPath('unknown', [], [])
    expect(path).toEqual([])
  })
})

// ── buildMessagesFromPath ─────────────────────────────────────────────────────

describe('buildMessagesFromPath', () => {
  it('builds user/assistant pairs from thought nodes', () => {
    const nodes = [makeThoughtNode('n1'), makeThoughtNode('n2')]
    const msgs = buildMessagesFromPath(nodes)
    expect(msgs).toEqual([
      { role: 'user', content: 'prompt-n1' },
      { role: 'assistant', content: 'response-n1' },
      { role: 'user', content: 'prompt-n2' },
      { role: 'assistant', content: 'response-n2' },
    ])
  })

  it('skips deleted placeholder nodes', () => {
    const placeholder: Node<NodeData> = {
      id: 'deleted',
      type: 'placeholderNode',
      position: { x: 0, y: 0 },
      data: { type: 'placeholderNode', isDeleted: true } as PlaceholderNodeData,
    }
    const nodes = [makeThoughtNode('n1'), placeholder, makeThoughtNode('n3')]
    const msgs = buildMessagesFromPath(nodes)
    expect(msgs.map(m => m.content)).not.toContain('prompt-deleted')
    expect(msgs.length).toBe(4)
  })

  it('skips nodes with isDeleted flag', () => {
    const deletedThought: Node<NodeData> = {
      id: 'del',
      type: 'thoughtNode',
      position: { x: 0, y: 0 },
      data: {
        type: 'thoughtNode',
        prompt: 'deleted prompt',
        response: 'deleted response',
        isDeleted: true,
        isLoading: false,
        isCollapsed: false,
      } as ThoughtNodeData,
    }
    const msgs = buildMessagesFromPath([deletedThought])
    expect(msgs).toHaveLength(0)
  })

  it('skips empty prompt/response', () => {
    const emptyNode: Node<NodeData> = {
      id: 'empty',
      type: 'thoughtNode',
      position: { x: 0, y: 0 },
      data: {
        type: 'thoughtNode',
        prompt: '',
        response: '',
        isLoading: true,
        isCollapsed: false,
      } as ThoughtNodeData,
    }
    const msgs = buildMessagesFromPath([emptyNode])
    // empty strings are falsy — they should not add messages
    expect(msgs).toHaveLength(0)
  })

  it('returns empty array for empty path', () => {
    expect(buildMessagesFromPath([])).toEqual([])
  })
})
