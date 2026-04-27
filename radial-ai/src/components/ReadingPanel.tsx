import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '../store/canvasStore';
import type { ThoughtNodeData, Annotation, AnnotationMessage } from '../store/types';
import { renderMarkdown } from '../utils/markdown';
import { computeNodeNumbers } from '../utils/nodeNumbers';

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconQuote = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
)
const IconHighlight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
)
const IconNote = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)
const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const IconPanelClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const IconPanelOpen = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const IconRobot = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="13" rx="2"/>
    <path d="M12 8V4"/>
    <circle cx="12" cy="3" r="1"/>
    <circle cx="8.5" cy="14" r="1" fill="currentColor" strokeWidth="0"/>
    <circle cx="15.5" cy="14" r="1" fill="currentColor" strokeWidth="0"/>
    <path d="M9 17.5h6"/>
    <path d="M2 13h1.5M22 13h-1.5"/>
  </svg>
)

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolbarButton({ icon, label, shortcut, onClick }: {
  icon: React.ReactNode; label: string; shortcut?: string; onClick: () => void;
}) {
  return (
    <div className="relative group">
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        aria-label={label}
        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
        style={{ color: '#be185d', background: 'linear-gradient(90deg,var(--bg-subtle),var(--bg-subtle-blue))', border: '1px solid #f9a8d4' }}
      >
        {icon}
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(31,41,55,0.9)', backdropFilter: 'blur(4px)' }}>
        {label}{shortcut && <span className="ml-1.5 opacity-60">{shortcut}</span>}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: 'rgba(31,41,55,0.9)' }} />
      </div>
    </div>
  );
}

// ── Apply Range-based mark to DOM ─────────────────────────────────────────────
// Wraps text nodes in-place (never extracts block elements) to avoid forced
// line breaks on cross-paragraph selections.

function applyMarkToRange(range: Range, className: string, container: HTMLElement): void {
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

// ── Annotation bubble (multi-message thread + send + click-to-scroll) ─────────

function AnnotationBubble({
  annotation, nodeId, autoFocus, onFocusHandled, onScrollTo, onSendToAI,
  onHoverStart, onHoverEnd, onInputFocus, onInputBlur,
}: {
  annotation: Annotation;
  nodeId: string;
  autoFocus: boolean;
  onFocusHandled: () => void;
  onScrollTo: (text: string) => void;
  onSendToAI: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
}) {
  const { updateAnnotation, deleteAnnotation, addAnnotationMessage } = useCanvasStore();
  const inputRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef('');
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (!inputRef.current) return;
    if (annotation.noteHtml !== draftRef.current && inputRef.current.innerHTML !== annotation.noteHtml) {
      inputRef.current.innerHTML = annotation.noteHtml;
      draftRef.current = annotation.noteHtml;
    }
  }, [annotation.noteHtml]);

  useEffect(() => {
    if (!autoFocus || !inputRef.current) return;
    inputRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(inputRef.current);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    onFocusHandled();
  }, [autoFocus, onFocusHandled]);

  const sendMessage = useCallback(() => {
    const html = inputRef.current?.innerHTML ?? '';
    const text = inputRef.current?.textContent?.trim() ?? '';
    if (!text) return;
    addAnnotationMessage(nodeId, annotation.id, html);
    if (inputRef.current) inputRef.current.innerHTML = '';
    draftRef.current = '';
    updateAnnotation(nodeId, annotation.id, '');
  }, [nodeId, annotation.id, addAnnotationMessage, updateAnnotation]);

  const messages: AnnotationMessage[] = annotation.messages ?? [];

  return (
    <div
      data-annotation-id={annotation.id}
      className="rounded-xl overflow-hidden relative"
      style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-base)', boxShadow: '0 2px 10px var(--shadow-sm)' }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      {/* Quoted text — click to scroll to it in response */}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onScrollTo(annotation.selectedText)}
        className="w-full text-left px-3 pt-2.5 pb-2 transition-all"
        title="Jump to selection in response"
        style={{ borderBottom: messages.length > 0 || annotation.noteHtml ? '1px solid var(--border-base)' : undefined }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <div className="text-[11px] italic leading-relaxed pl-2 pr-1"
          style={{ color: 'var(--text-faint)', borderLeft: '2px solid #bfdbfe' }}>
          &ldquo;{annotation.selectedText.length > 70
            ? annotation.selectedText.slice(0, 70) + '…'
            : annotation.selectedText}&rdquo;
          <span className="ml-1 not-italic" style={{ color: '#818cf8', fontSize: '10px' }}>↑</span>
        </div>
      </button>

      {/* Sent messages */}
      {messages.length > 0 && (
        <div className="px-3 pt-2 space-y-1.5">
          {messages.map(msg => (
            <div key={msg.id} className="text-sm leading-relaxed py-1.5 px-2 rounded-lg"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text-body)' }}
              dangerouslySetInnerHTML={{ __html: msg.html }} />
          ))}
        </div>
      )}

      {/* Input + send */}
      <div className="relative px-3 pt-2 pb-2">
        <div
          ref={inputRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          onInput={() => {
            if (!inputRef.current) return;
            const html = inputRef.current.innerHTML;
            draftRef.current = html;
            updateAnnotation(nodeId, annotation.id, html);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
              e.preventDefault();
              sendMessage();
            }
          }}
          className="text-sm outline-none min-h-[2rem] pr-8 annotation-note leading-relaxed"
          style={{ wordBreak: 'break-word', color: 'var(--text-body)' }}
          data-placeholder={messages.length > 0 ? '繼續留言… Enter 送出' : 'Write a note… Enter 送出'}
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={sendMessage}
          title="Send (Enter)"
          className="absolute bottom-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg transition-all"
          style={{ color: '#be185d', background: 'var(--bg-subtle)', border: '1px solid var(--border-base)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg,#f472b6,#60a5fa)';
            (e.currentTarget as HTMLElement).style.color = 'white';
            (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)';
            (e.currentTarget as HTMLElement).style.color = '#be185d';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)';
          }}
        >
          <IconSend />
        </button>
      </div>

      {/* Action buttons: AI + Delete */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSendToAI}
          title="Ask AI about this annotation"
          className="w-5 h-5 flex items-center justify-center rounded transition-all"
          style={{ color: '#818cf8', background: 'transparent' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg,#818cf8,#60a5fa)';
            (e.currentTarget as HTMLElement).style.color = 'white';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#818cf8';
          }}
        >
          <IconRobot />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => deleteAnnotation(nodeId, annotation.id)}
          title="Delete note"
          className="w-5 h-5 flex items-center justify-center rounded text-xs transition-colors"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Toolbar & source types ────────────────────────────────────────────────────

type SelectionSource = 'response' | 'prompt' | 'annotation';

interface ToolbarState {
  x: number;
  y: number;
  selectedText: string;
  source: SelectionSource;
  annotationId?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReadingPanel() {
  const {
    selectedNodeId, nodes, edges, setSelectedNode,
    addContextCapsule, updateMarkedHtml,
    addAnnotation, updateAnnotation, sendPrompt,
  } = useCanvasStore();

  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [promptBoxHeight, setPromptBoxHeight] = useState(70);
  const [annotationsPanelOpen, setAnnotationsPanelOpen] = useState(true);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null);
  const activeAnnotationId = focusedAnnotationId ?? hoveredAnnotationId;
  const promptBoxHeightRef = useRef(70);
  promptBoxHeightRef.current = promptBoxHeight;

  const responseRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const newAnnIdRef = useRef<string | null>(null);
  const promptHandleIndicatorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const pendingScrollTextRef = useRef<string | null>(null);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const nodeData = selectedNode?.data.type === 'thoughtNode'
    ? (selectedNode.data as ThoughtNodeData)
    : null;

  const annotations: Annotation[] = nodeData?.annotations ?? [];
  const nodeNumbers = useMemo(() => computeNodeNumbers(nodes, edges), [nodes, edges]);

  // The displayed HTML — uses markedHtml if available (contains Range-based marks)
  const highlightedHtml = useMemo(() => {
    if (!nodeData) return '';
    return nodeData.markedHtml ?? renderMarkdown(nodeData.response);
  }, [nodeData]);

  // Set innerHTML via ref — prevents React's reconciler from touching the DOM
  // (which would clear the browser's native text selection)
  useEffect(() => {
    if (!responseRef.current) return;
    responseRef.current.innerHTML = highlightedHtml;
  }, [highlightedHtml]);

  // Highlight the note-highlight mark corresponding to the hovered/focused annotation
  useEffect(() => {
    if (!responseRef.current) return;
    responseRef.current.querySelectorAll('mark.note-highlight.active').forEach(m => m.classList.remove('active'));
    if (!activeAnnotationId) return;
    const ann = annotations.find(a => a.id === activeAnnotationId);
    if (!ann) return;
    const search = ann.selectedText.slice(0, 25);
    Array.from(responseRef.current.querySelectorAll('mark.note-highlight')).forEach(m => {
      const t = m.textContent ?? '';
      if (t && (ann.selectedText.includes(t) || t.includes(search.slice(0, 15)))) {
        m.classList.add('active');
      }
    });
  }, [activeAnnotationId, annotations, highlightedHtml]);

  // Scroll to quoted text after switching node via ref card / annotation click
  useEffect(() => {
    const target = pendingScrollTextRef.current;
    if (!target || !responseRef.current || !scrollContainerRef.current) return;

    const search = target.slice(0, 40);
    const marks = Array.from(responseRef.current.querySelectorAll('mark'));
    const byMark = marks.find(m => m.textContent?.startsWith(search.slice(0, 20)));

    const scrollTo = (el: Element) => {
      pendingScrollTextRef.current = null;
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    };

    if (byMark) { scrollTo(byMark); return; }

    // Fall back: find plain text in response
    const walker = document.createTreeWalker(responseRef.current, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if ((n.textContent ?? '').includes(search)) {
        const el = (n as Text).parentElement;
        if (el) { scrollTo(el); return; }
      }
    }

    // Last resort: scroll to top
    pendingScrollTextRef.current = null;
    scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, [highlightedHtml]);

  // Reset when node changes
  useEffect(() => {
    setToolbar(null);
    savedRangeRef.current = null;
    window.getSelection()?.removeAllRanges();
  }, [selectedNodeId]);

  // ── Jump to referenced node ───────────────────────────────────────────────
  const handleRefClick = useCallback((sourceNodeId: string, text: string) => {
    pendingScrollTextRef.current = text;
    setSelectedNode(sourceNodeId);
  }, [setSelectedNode]);

  // ── Scroll to annotation's selected text in response ─────────────────────
  const handleAnnotationScrollTo = useCallback((text: string) => {
    if (!responseRef.current || !scrollContainerRef.current) return;
    const search = text.slice(0, 40);
    const marks = Array.from(responseRef.current.querySelectorAll('mark'));
    const byMark = marks.find(m => m.textContent?.includes(search.slice(0, 20)));
    const scrollTo = (el: Element) => {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    };
    if (byMark) { scrollTo(byMark); return; }
    const walker = document.createTreeWalker(responseRef.current, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if ((n.textContent ?? '').includes(search)) {
        const el = (n as Text).parentElement;
        if (el) { scrollTo(el); return; }
      }
    }
  }, []);

  // ── Send annotation thread to AI ─────────────────────────────────────────
  const handleAnnotationAI = useCallback((annotation: Annotation) => {
    if (!selectedNodeId) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    const label = node?.data.type === 'thoughtNode'
      ? (node.data as ThoughtNodeData).prompt.slice(0, 40) + (((node.data as ThoughtNodeData).prompt.length > 40) ? '…' : '')
      : selectedNodeId;

    // Reference the annotated text as context
    addContextCapsule({ id: uuidv4(), sourceNodeId: selectedNodeId, sourceNodeLabel: label, text: annotation.selectedText, isFullNode: false });

    // Build prompt from all notes + messages
    const toText = (html: string) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent?.trim() ?? '';
    };
    const parts: string[] = [];
    if (annotation.noteHtml) { const t = toText(annotation.noteHtml); if (t) parts.push(t); }
    for (const msg of annotation.messages ?? []) { const t = toText(msg.html); if (t) parts.push(t); }

    const promptText = parts.length > 0 ? parts.join('\n') : annotation.selectedText;
    sendPrompt(promptText);
  }, [selectedNodeId, nodes, addContextCapsule, sendPrompt]);

  // ── Click on note-highlight mark → focus that annotation's input ──────────
  const handleResponseClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const mark = target.closest('mark.note-highlight') as HTMLElement | null;
    if (!mark) return;
    const markText = mark.textContent ?? '';
    const ann = annotations.find(a =>
      markText && (a.selectedText.includes(markText) || markText.includes(a.selectedText.slice(0, 20)))
    );
    if (!ann) return;
    setAnnotationsPanelOpen(true);
    setTimeout(() => {
      const inputEl = document.querySelector(`[data-annotation-id="${ann.id}"] [contenteditable]`) as HTMLElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  }, [annotations]);

  // ── Quote ─────────────────────────────────────────────────────────────────
  const quoteToContext = useCallback((text: string, sourceNodeId: string) => {
    const range = savedRangeRef.current;
    const node = nodes.find(n => n.id === sourceNodeId);
    const prompt = node?.data.type === 'thoughtNode' ? (node.data as ThoughtNodeData).prompt : '';
    const label = prompt.slice(0, 40) + (prompt.length > 40 ? '…' : '');
    addContextCapsule({ id: uuidv4(), sourceNodeId, sourceNodeLabel: label, text, isFullNode: false });

    // Apply quote highlight via Range
    if (range && responseRef.current) {
      try { applyMarkToRange(range, 'quote-highlight', responseRef.current); } catch {}
      updateMarkedHtml(sourceNodeId, responseRef.current.innerHTML);
    }

    savedRangeRef.current = null;
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
    window.dispatchEvent(new CustomEvent('radial:focus-palette'));
  }, [nodes, addContextCapsule, updateMarkedHtml]);

  // ── Highlight ─────────────────────────────────────────────────────────────
  const handleHighlight = useCallback(() => {
    if (!toolbar || !selectedNodeId) return;
    const range = savedRangeRef.current;

    if (toolbar.source === 'annotation' && toolbar.annotationId && range) {
      const noteEl = document.querySelector(`[data-annotation-id="${toolbar.annotationId}"]`);
      if (noteEl) {
        try { applyMarkToRange(range, 'pen-highlight', noteEl as HTMLElement); } catch {}
        updateAnnotation(selectedNodeId, toolbar.annotationId, noteEl.innerHTML);
      }
    } else if (toolbar.source === 'response' && responseRef.current && range) {
      try { applyMarkToRange(range, 'pen-highlight', responseRef.current); } catch {}
      updateMarkedHtml(selectedNodeId, responseRef.current.innerHTML);
    }

    savedRangeRef.current = null;
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }, [toolbar, selectedNodeId, updateMarkedHtml, updateAnnotation]);

  // ── Note ──────────────────────────────────────────────────────────────────
  const handleNote = useCallback(() => {
    if (!toolbar || !selectedNodeId) return;
    const range = savedRangeRef.current;

    // Apply note-highlight (blue) via Range in response
    if (range && responseRef.current && toolbar.source === 'response') {
      try { applyMarkToRange(range, 'note-highlight', responseRef.current); } catch {}
      updateMarkedHtml(selectedNodeId, responseRef.current.innerHTML);
    }

    const id = addAnnotation(selectedNodeId, toolbar.selectedText);
    newAnnIdRef.current = id;
    savedRangeRef.current = null;
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }, [toolbar, selectedNodeId, addAnnotation, updateMarkedHtml]);

  // ── Prompt resize ─────────────────────────────────────────────────────────
  const startPromptResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = promptBoxHeightRef.current;
    const onMove = (ev: MouseEvent) => {
      setPromptBoxHeight(Math.max(28, Math.min(500, startH + ev.clientY - startY)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // ── MouseUp → save Range + show toolbar ───────────────────────────────────
  useEffect(() => {
    const onMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const text = selection.toString().trim();
      if (!text) return;

      const range = selection.getRangeAt(0);
      const ancestor = range.commonAncestorContainer;
      const inResponse = !!(responseRef.current?.contains(ancestor));
      const inPromptBox = !!(promptRef.current?.contains(ancestor));

      const el = ancestor.nodeType === Node.TEXT_NODE
        ? (ancestor as Text).parentElement
        : (ancestor as Element);
      const noteEl = el?.closest('[data-annotation-id]');
      const annotationId = noteEl?.getAttribute('data-annotation-id') ?? undefined;
      const inAnnotation = !!annotationId;

      let source: SelectionSource | null = null;
      if (inResponse) source = 'response';
      else if (inPromptBox) source = 'prompt';
      else if (inAnnotation) source = 'annotation';
      if (!source) return;

      // Save Range IMMEDIATELY (before any async op)
      savedRangeRef.current = range.cloneRange();

      const rect = range.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      setToolbar({
        x: rect.left + rect.width / 2 - (panelRect?.left ?? 0),
        y: rect.top - (panelRect?.top ?? 0),
        selectedText: text,
        source,
        annotationId,
      });
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  // ── Dismiss toolbar on outside click ──────────────────────────────────────
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setToolbar(null);
        savedRangeRef.current = null;
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Use e.code (physical key) instead of e.key so shortcuts work even when
  // the OS input method is Chinese/Japanese (IME changes e.key, not e.code).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === 'KeyK') {
        e.preventDefault();
        if (toolbar && selectedNodeId) quoteToContext(toolbar.selectedText, selectedNodeId);
        return;
      }
      if (!toolbar) return;
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (inInput || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      switch (e.code) {
        case 'KeyL': case 'KeyC':
          e.preventDefault();
          if (selectedNodeId) quoteToContext(toolbar.selectedText, selectedNodeId);
          break;
        case 'KeyH': case 'KeyF':
          e.preventDefault();
          handleHighlight();
          break;
        case 'KeyN': case 'KeyA': case 'KeyE':
          if (toolbar.source !== 'annotation') { e.preventDefault(); handleNote(); }
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toolbar, selectedNodeId, quoteToContext, handleHighlight, handleNote]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!nodeData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: 'var(--text-placeholder)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#fce7f3,#dbeafe)' }}>
          <span className="text-2xl">✦</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>Click a node to read</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-placeholder)' }}>Select text for Cmd+K to quote</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="relative h-full flex flex-col overflow-hidden">

      {/* Floating toolbar */}
      {toolbar && (
        <div
          className="absolute z-50 flex items-center gap-1 rounded-xl px-2 py-1.5 pointer-events-auto"
          onMouseDown={(e) => e.preventDefault()}
          style={{
            left: toolbar.x, top: toolbar.y,
            transform: 'translate(-50%, calc(-100% - 10px))',
            background: 'var(--bg-overlay)', border: '1px solid var(--border-base)',
            boxShadow: '0 4px 24px var(--shadow-md)', backdropFilter: 'blur(8px)',
          }}
        >
          <ToolbarButton icon={<IconQuote />}    label="引用"   shortcut="⌘K / L" onClick={() => selectedNodeId && quoteToContext(toolbar.selectedText, selectedNodeId)} />
          <ToolbarButton icon={<IconHighlight />} label="螢光筆" shortcut="H"      onClick={handleHighlight} />
          {toolbar.source !== 'annotation' && (
            <ToolbarButton icon={<IconNote />}   label="筆記"   shortcut="N"      onClick={handleNote} />
          )}
        </div>
      )}

      {/* ── Header: Prompt (resizable) ──────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col px-8 pt-4" style={{ background: 'var(--bg-panel-header)' }}>
        {nodeData.title && (
          <h1 className="text-xl font-bold leading-snug m-0 mb-3"
            style={{ background: 'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {nodeData.title}
          </h1>
        )}
        <div className="text-[10px] font-bold tracking-widest mb-1" style={{ color: '#f472b6' }}>PROMPT</div>

        <div style={{ height: promptBoxHeight, overflowY: 'auto', overflowX: 'hidden' }}>
          <p
            ref={promptRef as React.RefObject<HTMLParagraphElement>}
            className="text-base font-semibold leading-snug m-0 pb-1 select-text"
            style={{ color: 'var(--text-primary)' }}
          >
            {nodeData.prompt}
          </p>

          {nodeData.references && nodeData.references.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-bold tracking-widest mb-1.5" style={{ color: '#818cf8' }}>REF</div>
              <div className="space-y-1.5">
                {nodeData.references.map((ref) => {
                  const refNode = nodes.find(n => n.id === ref.sourceNodeId);
                  const refData = refNode?.data.type === 'thoughtNode' ? (refNode.data as ThoughtNodeData) : null;
                  const nodeNum = nodeNumbers.get(ref.sourceNodeId) ?? '?';
                  const nodeTitle = refData?.title ?? ref.sourceNodeLabel ?? `Node ${nodeNum}`;
                  return (
                    <button
                      key={ref.id}
                      onClick={() => handleRefClick(ref.sourceNodeId, ref.text)}
                      className="w-full text-left rounded-xl p-2.5 transition-all"
                      style={{ background: 'var(--bg-base)', border: '1.5px solid var(--border-base)', boxShadow: '0 1px 4px var(--shadow-sm)', cursor: 'pointer' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#f9a8d4';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px var(--shadow-md)';
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px var(--shadow-sm)';
                        (e.currentTarget as HTMLElement).style.transform = '';
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'linear-gradient(135deg,#fce7f3,#dbeafe)', color: '#be185d' }}>
                          #{nodeNum}
                        </span>
                        <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{nodeTitle}</span>
                        <span className="ml-auto text-[10px] flex-shrink-0" style={{ color: '#818cf8' }}>↗</span>
                      </div>
                      <p className="text-[11px] italic leading-relaxed m-0 pl-2"
                        style={{ color: 'var(--text-muted)', borderLeft: '2px solid #f9a8d4' }}>
                        &ldquo;{ref.text.length > 90 ? ref.text.slice(0, 90) + '…' : ref.text}&rdquo;
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Drag handle */}
        <div
          className="flex justify-center items-center cursor-ns-resize select-none"
          style={{ height: 14, marginTop: 4, borderBottom: '1px solid var(--border-base)' }}
          onMouseDown={startPromptResize}
          onMouseEnter={() => { if (promptHandleIndicatorRef.current) promptHandleIndicatorRef.current.style.opacity = '0.75'; }}
          onMouseLeave={() => { if (promptHandleIndicatorRef.current) promptHandleIndicatorRef.current.style.opacity = '0.2'; }}
        >
          <div ref={promptHandleIndicatorRef}
            style={{ width: 36, height: 3, borderRadius: 2, background: 'linear-gradient(90deg,#f472b6,#60a5fa)', opacity: 0.2, transition: 'opacity 0.15s', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* ── Body: Response + (Collapsible) Annotations ─────────────────────── */}
      <div className="flex-1 overflow-hidden flex min-h-0" style={{ background: 'var(--bg-surface)' }}>

        {/* Response */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-8 py-6 pb-28 min-w-0">
          {nodeData.isLoading ? (
            <div className="flex items-center gap-2 py-4">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#f9a8d4 #f9a8d4 #60a5fa #60a5fa' }} />
              <span className="text-sm" style={{ background: 'linear-gradient(90deg,#ec4899,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Thinking…
              </span>
            </div>
          ) : (
            <div ref={responseRef} className="reading-panel-content select-text" onClick={handleResponseClick} />
          )}
        </div>

        {/* Annotation panel (collapsible) */}
        {annotations.length > 0 && (
          <>
            {/* Toggle button */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAnnotationsPanelOpen(v => !v)}
              title={annotationsPanelOpen ? 'Collapse annotations' : 'Expand annotations'}
              className="flex-shrink-0 flex items-center justify-center transition-all"
              style={{
                width: 20,
                background: 'var(--bg-surface)',
                borderLeft: '1px solid var(--border-base)',
                color: 'var(--text-faint)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)';
                (e.currentTarget as HTMLElement).style.color = '#be185d';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
              }}
            >
              {annotationsPanelOpen ? <IconPanelClose /> : <IconPanelOpen />}
            </button>

            {/* Annotation list */}
            {annotationsPanelOpen && (
              <div className="w-64 flex-shrink-0 overflow-y-auto px-3 py-4 space-y-3"
                style={{ borderLeft: '1px solid var(--border-base)' }}>
                {annotations.map(ann => (
                  <AnnotationBubble
                    key={ann.id}
                    annotation={ann}
                    nodeId={selectedNodeId!}
                    autoFocus={newAnnIdRef.current === ann.id}
                    onFocusHandled={() => { newAnnIdRef.current = null; }}
                    onScrollTo={handleAnnotationScrollTo}
                    onSendToAI={() => handleAnnotationAI(ann)}
                    onHoverStart={() => setHoveredAnnotationId(ann.id)}
                    onHoverEnd={() => setHoveredAnnotationId(null)}
                    onInputFocus={() => setFocusedAnnotationId(ann.id)}
                    onInputBlur={() => setFocusedAnnotationId(null)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
