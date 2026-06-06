import type { Node, Edge } from '@xyflow/react';

export type NodeType = 'thoughtNode' | 'annotationNode' | 'placeholderNode';

export interface AnnotationMessage {
  id: string;
  html: string;
  createdAt: number;
}

export interface Annotation {
  id: string;
  selectedText: string;
  noteHtml: string;
  messages?: AnnotationMessage[];
  createdAt: number;
}

export interface ContextCapsule {
  id: string;
  sourceNodeId: string;
  sourceNodeLabel: string;
  text: string;
  isFullNode: boolean;
}

export interface ThoughtNodeData extends Record<string, unknown> {
  prompt: string;
  response: string;
  title?: string;
  ancestorIds?: string[];
  references?: ContextCapsule[];
  isLoading?: boolean;
  isCollapsed?: boolean;
  isDeleted?: boolean;
  manual?: boolean;             // content pasted by the user (no AI call)
  readStatus?: 'unread' | 'read' | 'important'; // reading state shown in node header
  markedHtml?: string;          // response HTML with Range-based marks embedded
  highlights?: string[];        // legacy pen highlight (kept for backward compat)
  promptHighlights?: string[];  // legacy prompt highlight
  quoteHighlights?: string[];   // legacy quote highlight
  annotations?: Annotation[];
  type: 'thoughtNode';
}

export interface AnnotationNodeData extends Record<string, unknown> {
  parentNodeId: string;
  selectedText: string;
  note: string;
  type: 'annotationNode';
}

export interface PlaceholderNodeData extends Record<string, unknown> {
  type: 'placeholderNode';
  isDeleted: true;
}

export type NodeData = ThoughtNodeData | AnnotationNodeData | PlaceholderNodeData;

/** A saved canvas (one project = one infinite canvas). */
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

export interface HighlightRange {
  start: number;
  end: number;
  text: string;
}

export interface ApiKeyState {
  key: string;
  model: string;
}
