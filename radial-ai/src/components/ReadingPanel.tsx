import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '../store/canvasStore';
import type { ThoughtNodeData, Annotation } from '../store/types';
import { renderMarkdown } from '../utils/markdown';

// ── SVG Icons ────────────────────────────────────────────────────────────────

const IconQuote = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
)

const IconHighlight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
)

const IconNote = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)

// ── Toolbar button with tooltip ───────────────────────────────────────────────

function ToolbarButton({
  icon, label, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
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
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(31,41,55,0.9)', backdropFilter: 'blur(4px)' }}
      >
        {label}
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
          style={{ borderTopColor: 'rgba(31,41,55,0.9)' }}
        />
      </div>
    </div>
  )
}

// ── Annotation bubble ─────────────────────────────────────────────────────────

function AnnotationBubble({
  annotation, nodeId, autoFocus, onFocusHandled,
}: {
  annotation: Annotation;
  nodeId: string;
  autoFocus: boolean;
  onFocusHandled: () => void;
}) {
  const { updateAnnotation, deleteAnnotation } = useCanvasStore();
  const editRef = useRef<HTMLDivElement>(null);
  const lastSyncedRef = useRef(annotation.noteHtml);

  // Sync external HTML changes (e.g., highlights applied by toolbar)
  useEffect(() => {
    if (!editRef.current) return;
    if (annotation.noteHtml !== lastSyncedRef.current) {
      editRef.current.innerHTML = annotation.noteHtml;
      lastSyncedRef.current = annotation.noteHtml;
    }
  }, [annotation.noteHtml]);

  // Auto-focus new annotations
  useEffect(() => {
    if (!autoFocus || !editRef.current) return;
    editRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editRef.current);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    onFocusHandled();
  }, [autoFocus, onFocusHandled]);

  return (
    <div
      className="rounded-xl p-3 relative"
      style={{
        background: 'var(--bg-overlay)',
        border: '1px solid var(--border-base)',
        boxShadow: '0 2px 10px var(--shadow-sm)',
      }}
    >
      {/* Quoted text anchor */}
      <div
        className="text-[11px] italic leading-relaxed mb-2 pl-2 pr-4"
        style={{ color: 'var(--text-faint)', borderLeft: '2px solid #f9a8d4' }}
      >
        &ldquo;{annotation.selectedText.length > 70
          ? annotation.selectedText.slice(0, 70) + '…'
          : annotation.selectedText}&rdquo;
      </div>

      {/* Editable note */}
      <div
        ref={editRef}
        data-annotation-id={annotation.id}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          if (!editRef.current) return;
          const html = editRef.current.innerHTML;
          lastSyncedRef.current = html;
          updateAnnotation(nodeId, annotation.id, html);
        }}
        className="text-sm text-gray-700 outline-none min-h-[3rem] annotation-note leading-relaxed"
        data-placeholder="Write a note…"
        style={{ wordBreak: 'break-word' }}
      />

      {/* Delete */}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => deleteAnnotation(nodeId, annotation.id)}
        title="Delete note"
        className="absolute top-2 right-2 text-gray-300 hover:text-red-400 w-5 h-5 flex items-center justify-center rounded text-xs transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

// ── Highlight application (response area) ─────────────────────────────────────

function applyHighlightsToHtml(html: string, highlights: string[]): string {
  if (!highlights.length || typeof document === 'undefined') return html;
  const container = document.createElement('div');
  container.innerHTML = html;

  for (const hl of highlights) {
    if (!hl.trim()) continue;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) textNodes.push(n as Text);

    for (const textNode of textNodes) {
      const content = textNode.textContent ?? '';
      if (!content.includes(hl)) continue;
      const parts = content.split(hl);
      const frag = document.createDocumentFragment();
      parts.forEach((part, i) => {
        if (part) frag.appendChild(document.createTextNode(part));
        if (i < parts.length - 1) {
          const mark = document.createElement('mark');
          mark.className = 'radial-highlight';
          mark.textContent = hl;
          frag.appendChild(mark);
        }
      });
      textNode.parentNode?.replaceChild(frag, textNode);
    }
  }
  return container.innerHTML;
}

// ── Toolbar state ─────────────────────────────────────────────────────────────

interface ToolbarState {
  x: number;
  y: number;
  selectedText: string;
  source: 'response' | 'annotation';
  annotationId?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReadingPanel() {
  const {
    selectedNodeId, nodes,
    addContextCapsule, addHighlight, addAnnotation, updateAnnotation,
  } = useCanvasStore();

  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const newAnnIdRef = useRef<string | null>(null);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const nodeData = selectedNode?.data.type === 'thoughtNode'
    ? (selectedNode.data as ThoughtNodeData)
    : null;

  const annotations: Annotation[] = nodeData?.annotations ?? [];

  // Highlighted HTML (memoised to avoid re-running DOM parsing on unrelated renders)
  const highlightedHtml = useMemo(() => {
    if (!nodeData) return '';
    const base = renderMarkdown(nodeData.response);
    return applyHighlightsToHtml(base, nodeData.highlights ?? []);
  }, [nodeData]);

  // Reset toolbar when node changes
  useEffect(() => {
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }, [selectedNodeId]);

  // ── Quote handler ───────────────────────────────────────────────────────────
  const quoteToContext = useCallback((text: string) => {
    if (!selectedNodeId) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    const prompt = node?.data.type === 'thoughtNode' ? (node.data as ThoughtNodeData).prompt : '';
    const label = prompt.slice(0, 40) + (prompt.length > 40 ? '…' : '');
    addContextCapsule({
      id: uuidv4(),
      sourceNodeId: selectedNodeId,
      sourceNodeLabel: label,
      text,
      isFullNode: false,
    });
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }, [selectedNodeId, nodes, addContextCapsule]);

  // ── Highlight handler ───────────────────────────────────────────────────────
  const handleHighlight = useCallback(() => {
    if (!toolbar || !selectedNodeId) return;

    if (toolbar.source === 'annotation' && toolbar.annotationId) {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const mark = document.createElement('mark');
        mark.className = 'radial-highlight';
        try {
          range.surroundContents(mark);
        } catch {
          const frag = range.extractContents();
          mark.appendChild(frag);
          range.insertNode(mark);
        }
        const noteEl = document.querySelector(`[data-annotation-id="${toolbar.annotationId}"]`);
        if (noteEl) {
          updateAnnotation(selectedNodeId, toolbar.annotationId, noteEl.innerHTML);
        }
      }
    } else {
      addHighlight(selectedNodeId, toolbar.selectedText);
    }

    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }, [toolbar, selectedNodeId, addHighlight, updateAnnotation]);

  // ── Note handler ────────────────────────────────────────────────────────────
  const handleNote = useCallback(() => {
    if (!toolbar || !selectedNodeId) return;
    const id = addAnnotation(selectedNodeId, toolbar.selectedText);
    newAnnIdRef.current = id;
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }, [toolbar, selectedNodeId, addAnnotation]);

  // ── Document-level mouseup → show toolbar ──────────────────────────────────
  useEffect(() => {
    const onMouseUp = () => {
      const selection = window.getSelection();
      if (!selection) return;

      if (selection.isCollapsed) {
        setToolbar(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) { setToolbar(null); return; }

      const range = selection.getRangeAt(0);
      const ancestor = range.commonAncestorContainer;

      const inResponse = !!(responseRef.current?.contains(ancestor));

      const el = ancestor.nodeType === Node.TEXT_NODE
        ? (ancestor as Text).parentElement
        : (ancestor as Element);
      const noteEl = el?.closest('[data-annotation-id]');
      const annotationId = noteEl?.getAttribute('data-annotation-id') ?? undefined;
      const inAnnotation = !!annotationId;

      if (!inResponse && !inAnnotation) { setToolbar(null); return; }

      const rect = range.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      setToolbar({
        x: rect.left + rect.width / 2 - (panelRect?.left ?? 0),
        y: rect.top - (panelRect?.top ?? 0),
        selectedText: text,
        source: inAnnotation ? 'annotation' : 'response',
        annotationId,
      });
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  // ── Dismiss toolbar when clicking outside panel ─────────────────────────────
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setToolbar(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ── Cmd/Ctrl+K → quote ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (toolbar) quoteToContext(toolbar.selectedText);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toolbar, quoteToContext]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!nodeData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: 'var(--text-placeholder)' }}>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#fce7f3,#dbeafe)' }}
        >
          <span className="text-2xl">✦</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>Click a node to read</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-placeholder)' }}>Select text here for Cmd+K to quote</p>
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
            left: toolbar.x,
            top: toolbar.y,
            transform: 'translate(-50%, calc(-100% - 10px))',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-base)',
            boxShadow: '0 4px 24px var(--shadow-md)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ToolbarButton icon={<IconQuote />} label="引用 (⌘K)" onClick={() => quoteToContext(toolbar.selectedText)} />
          <ToolbarButton icon={<IconHighlight />} label="螢光筆標記" onClick={handleHighlight} />
          {toolbar.source === 'response' && (
            <ToolbarButton icon={<IconNote />} label="新增筆記" onClick={handleNote} />
          )}
        </div>
      )}

      {/* Header: Title + Prompt + References */}
      <div
        className="flex-shrink-0 px-8 pt-5 pb-0"
        style={{ borderBottom: '1px solid var(--border-base)', background: 'var(--bg-panel-header)' }}
      >
        {/* AI Title */}
        {nodeData.title && (
          <h1
            className="text-xl font-bold leading-snug m-0 mb-4"
            style={{ background: 'linear-gradient(90deg,#ec4899,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {nodeData.title}
          </h1>
        )}

        {/* Prompt */}
        <div
          className="text-[10px] font-bold tracking-widest mb-1.5"
          style={{ color: '#f472b6' }}
        >
          PROMPT
        </div>
        <p className="text-base font-semibold text-gray-800 leading-snug m-0">
          {nodeData.prompt}
        </p>

        {/* References */}
        {nodeData.references && nodeData.references.length > 0 && (
          <div className="mt-3 mb-0">
            <div
              className="text-[10px] font-bold tracking-widest mb-1.5"
              style={{ color: '#818cf8' }}
            >
              REF
            </div>
            <ol className="m-0 p-0 list-none space-y-1.5">
              {nodeData.references.map((ref, i) => (
                <li key={ref.id} className="flex gap-2 items-start">
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5"
                    style={{ background: 'linear-gradient(135deg,#fce7f3,#dbeafe)', color: '#be185d' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-xs text-gray-500 leading-relaxed italic">
                    &ldquo;{ref.text.length > 120 ? ref.text.slice(0, 120) + '…' : ref.text}&rdquo;
                    <span className="not-italic text-gray-400 ml-1">— {ref.sourceNodeLabel}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="h-5" />
      </div>

      {/* Body: Response + Annotations side by side */}
      <div className="flex-1 overflow-hidden flex min-h-0" style={{ background: 'var(--bg-surface)' }}>
        {/* Response */}
        <div className="flex-1 overflow-y-auto px-8 py-6 pb-28 min-w-0">
          {nodeData.isLoading ? (
            <div className="flex items-center gap-2 py-4">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#f9a8d4 #f9a8d4 #60a5fa #60a5fa' }}
              />
              <span
                className="text-sm"
                style={{ background: 'linear-gradient(90deg,#ec4899,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                Thinking…
              </span>
            </div>
          ) : (
            <div
              ref={responseRef}
              className="reading-panel-content select-text"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          )}
        </div>

        {/* Annotation strip */}
        {annotations.length > 0 && (
          <div
            className="w-60 flex-shrink-0 overflow-y-auto px-3 py-4 space-y-3"
            style={{ borderLeft: '1px solid var(--border-base)' }}
          >
            {annotations.map(ann => (
              <AnnotationBubble
                key={ann.id}
                annotation={ann}
                nodeId={selectedNodeId!}
                autoFocus={newAnnIdRef.current === ann.id}
                onFocusHandled={() => { newAnnIdRef.current = null; }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
