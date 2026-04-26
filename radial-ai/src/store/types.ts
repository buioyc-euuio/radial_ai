export type NodeType = 'thoughtNode' | 'annotationNode' | 'placeholderNode';

export interface Annotation {
  id: string;
  selectedText: string;
  noteHtml: string;
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
  highlights?: string[];
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

export interface HighlightRange {
  start: number;
  end: number;
  text: string;
}

export interface ApiKeyState {
  key: string;
  model: string;
}
