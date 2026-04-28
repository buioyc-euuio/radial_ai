// Sequential numbering: each thoughtNode is numbered 1, 2, 3… in the order
// it appears in the nodes array (which mirrors insertion / creation order).
export function computeNodeNumbers(
  nodes: Array<{ id: string; data?: { type?: string } }>,
  _edges: unknown[],
): Map<string, string> {
  const numbers = new Map<string, string>();
  let counter = 1;
  for (const node of nodes) {
    if (node.data?.type === 'thoughtNode') {
      numbers.set(node.id, String(counter++));
    }
  }
  return numbers;
}
