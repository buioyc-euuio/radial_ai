// ── Apply a Range-based <mark> to the DOM ─────────────────────────────────────
// Wraps text nodes in-place (never extracts block elements) to avoid forced
// line breaks on cross-paragraph selections.
export function applyMarkToRange(range: Range, className: string, container: HTMLElement): void {
  // Single-element fast path
  const mark = document.createElement('mark');
  mark.className = className;
  try {
    range.surroundContents(mark);
    container.normalize();
    return;
  } catch { /* cross-element — fall through */ }

  // Collect intersecting text nodes WITHOUT touching the DOM
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (range.intersectsNode(n)) textNodes.push(n as Text);
  }

  // Process in reverse so earlier offsets stay valid
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const textNode = textNodes[i];
    const startOff = textNode === range.startContainer ? range.startOffset : 0;
    const endOff   = textNode === range.endContainer   ? range.endOffset   : textNode.length;
    if (startOff >= endOff) continue;
    // Skip whitespace-only segments (e.g. the '\n' node between </p> and <p>)
    if (!(textNode.textContent?.slice(startOff, endOff).trim())) continue;

    // Split at end first (preserves startOff validity)
    if (endOff < textNode.length) textNode.splitText(endOff);
    const toWrap = startOff > 0 ? textNode.splitText(startOff) : textNode;

    const m = document.createElement('mark');
    m.className = className;
    toWrap.parentNode?.insertBefore(m, toWrap);
    m.appendChild(toWrap);
  }

  container.normalize();
}
