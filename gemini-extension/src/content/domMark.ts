// Range-based <mark> helpers, ported from the radial_ai web app and extended
// with character-offset (re)anchoring so marks can be persisted and restored.

/** Wrap a Range in <mark> in-place. `decorate` runs on every created mark. */
export function applyMarkToRange(
  range: Range,
  className: string,
  container: HTMLElement,
  decorate?: (m: HTMLElement) => void,
): void {
  // Single-element fast path
  const mark = document.createElement('mark')
  mark.className = className
  decorate?.(mark)
  try {
    range.surroundContents(mark)
    container.normalize()
    return
  } catch {
    /* cross-element — fall through */
  }

  // Collect intersecting text nodes WITHOUT touching the DOM
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    if (range.intersectsNode(n)) textNodes.push(n as Text)
  }

  // Process in reverse so earlier offsets stay valid
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const textNode = textNodes[i]
    const startOff = textNode === range.startContainer ? range.startOffset : 0
    const endOff = textNode === range.endContainer ? range.endOffset : textNode.length
    if (startOff >= endOff) continue
    if (!(textNode.textContent?.slice(startOff, endOff).trim())) continue

    if (endOff < textNode.length) textNode.splitText(endOff)
    const toWrap = startOff > 0 ? textNode.splitText(startOff) : textNode

    const m = document.createElement('mark')
    m.className = className
    decorate?.(m)
    toWrap.parentNode?.insertBefore(m, toWrap)
    m.appendChild(toWrap)
  }

  container.normalize()
}

/** Character offset of (container, offset) within root's text content. */
export function offsetOf(root: HTMLElement, container: Node, offset: number): number {
  const r = document.createRange()
  r.setStart(root, 0)
  try {
    r.setEnd(container, offset)
  } catch {
    return 0
  }
  return r.toString().length
}

/** Build a Range spanning [start, end) character offsets within root. */
export function rangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let acc = 0
  let sNode: Text | null = null
  let sOff = 0
  let eNode: Text | null = null
  let eOff = 0
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = n as Text
    const len = t.length
    if (sNode === null && acc + len >= start) {
      sNode = t
      sOff = start - acc
    }
    if (acc + len >= end) {
      eNode = t
      eOff = end - acc
      break
    }
    acc += len
  }
  if (!sNode || !eNode) return null
  const r = document.createRange()
  try {
    r.setStart(sNode, sOff)
    r.setEnd(eNode, eOff)
  } catch {
    return null
  }
  return r
}
