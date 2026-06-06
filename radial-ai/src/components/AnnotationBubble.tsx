import { useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import type { Annotation, AnnotationMessage } from '../store/types';

const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const IconRobot = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="13" rx="2" />
    <path d="M12 8V4" />
    <circle cx="12" cy="3" r="1" />
    <circle cx="8.5" cy="14" r="1" fill="currentColor" strokeWidth="0" />
    <circle cx="15.5" cy="14" r="1" fill="currentColor" strokeWidth="0" />
    <path d="M9 17.5h6" />
    <path d="M2 13h1.5M22 13h-1.5" />
  </svg>
);

// ── Annotation bubble (multi-message thread + send + click-to-scroll) ─────────
export default function AnnotationBubble({
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
