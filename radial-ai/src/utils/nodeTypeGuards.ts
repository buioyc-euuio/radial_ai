import type { Node } from '@xyflow/react';
import type { NodeData, ThoughtNodeData, AnnotationNodeData } from '../store/types';

/** Narrow a canvas node to a thought node (removes the need for `as ThoughtNodeData`). */
export function isThoughtNode(node: Node<NodeData>): node is Node<ThoughtNodeData> {
  return node.data.type === 'thoughtNode';
}

/** Narrow a canvas node to an annotation node. */
export function isAnnotationNode(node: Node<NodeData>): node is Node<AnnotationNodeData> {
  return node.data.type === 'annotationNode';
}
