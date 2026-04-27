export function computeNodeNumbers(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
): Map<string, string> {
  const parentMap = new Map<string, string>();
  const childrenMap = new Map<string, string[]>();
  for (const edge of edges) {
    if (!parentMap.has(edge.target)) parentMap.set(edge.target, edge.source);
    if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
    childrenMap.get(edge.source)!.push(edge.target);
  }
  const numbers = new Map<string, string>();
  const visited = new Set<string>();
  function visit(id: string, prefix: string, idx: number) {
    if (visited.has(id)) return;
    visited.add(id);
    const num = prefix ? `${prefix}.${idx}` : `${idx}`;
    numbers.set(id, num);
    (childrenMap.get(id) ?? []).forEach((childId, i) => visit(childId, num, i + 1));
  }
  nodes.filter(n => !parentMap.has(n.id)).forEach((root, i) => visit(root.id, '', i + 1));
  nodes.forEach((n, i) => { if (!numbers.has(n.id)) numbers.set(n.id, `${i + 1}`); });
  return numbers;
}
