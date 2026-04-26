import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReadingPanel from '../ReadingPanel'
import type { Node } from '@xyflow/react'
import type { NodeData, ThoughtNodeData } from '../../store/types'

const mockAddCapsule = vi.fn()
let mockSelectedId: string | null = null
let mockNodes: Node<NodeData>[] = []

vi.mock('../../store/canvasStore', () => ({
  useCanvasStore: () => ({
    get selectedNodeId() { return mockSelectedId },
    get nodes() { return mockNodes },
    addContextCapsule: mockAddCapsule,
    addHighlight: vi.fn(),
    addAnnotation: vi.fn().mockReturnValue('new-ann-id'),
    updateAnnotation: vi.fn(),
    deleteAnnotation: vi.fn(),
  }),
}))

const makeNode = (overrides: Partial<ThoughtNodeData> = {}): Node<NodeData> => ({
  id: 'node-1',
  type: 'thoughtNode',
  position: { x: 0, y: 0 },
  data: {
    type: 'thoughtNode',
    prompt: 'What is React?',
    response: 'React is a JavaScript library for building user interfaces.',
    title: 'React overview',
    isLoading: false,
    isCollapsed: false,
    ...overrides,
  } as ThoughtNodeData,
})

beforeEach(() => {
  mockAddCapsule.mockClear()
  mockSelectedId = null
  mockNodes = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ReadingPanel — empty state', () => {
  it('shows "Click a node to read" when no node is selected', () => {
    render(<ReadingPanel />)
    expect(screen.getByText('Click a node to read')).toBeInTheDocument()
  })

  it('shows keyboard shortcut hint in empty state', () => {
    render(<ReadingPanel />)
    expect(screen.getByText(/Cmd\+K/)).toBeInTheDocument()
  })
})

describe('ReadingPanel — node content', () => {
  beforeEach(() => {
    mockSelectedId = 'node-1'
    mockNodes = [makeNode()]
  })

  it('shows PROMPT header label', () => {
    render(<ReadingPanel />)
    expect(screen.getByText('PROMPT')).toBeInTheDocument()
  })

  it('displays the node prompt text', () => {
    render(<ReadingPanel />)
    expect(screen.getByText('What is React?')).toBeInTheDocument()
  })

  it('displays the AI response content', () => {
    render(<ReadingPanel />)
    expect(screen.getByText(/React is a JavaScript library/)).toBeInTheDocument()
  })

  it('shows loading spinner when isLoading is true', () => {
    mockNodes = [makeNode({ isLoading: true, response: '' })]
    render(<ReadingPanel />)
    expect(screen.getByText('Thinking…')).toBeInTheDocument()
  })

  it('does not show response content while loading', () => {
    mockNodes = [makeNode({ isLoading: true, response: '' })]
    render(<ReadingPanel />)
    expect(screen.queryByText(/React is a JavaScript library/)).not.toBeInTheDocument()
  })
})

describe('ReadingPanel — floating toolbar', () => {
  beforeEach(() => {
    mockSelectedId = 'node-1'
    mockNodes = [makeNode()]
  })

  it('toolbar is not visible before any selection', () => {
    render(<ReadingPanel />)
    expect(screen.queryByRole('button', { name: /引用/ })).not.toBeInTheDocument()
  })

  it('shows 3-icon toolbar after mouseup with text selected inside response div', () => {
    const { container } = render(<ReadingPanel />)

    const responseDiv = container.querySelector('.reading-panel-content')!
    expect(responseDiv).toBeTruthy()

    const mockRange = {
      getBoundingClientRect: () => ({ left: 100, right: 200, top: 50, bottom: 70, width: 100, height: 20, x: 100, y: 50, toJSON: () => ({}) }),
      commonAncestorContainer: responseDiv,
    }
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'React is a JavaScript library',
      getRangeAt: () => mockRange,
      removeAllRanges: vi.fn(),
    } as unknown as Selection)

    fireEvent.mouseUp(document)

    expect(screen.getByRole('button', { name: '引用 (⌘K)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '螢光筆標記' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增筆記' })).toBeInTheDocument()
  })

  it('toolbar disappears when clicking outside the panel', () => {
    const { container } = render(<ReadingPanel />)

    const responseDiv = container.querySelector('.reading-panel-content')!
    const mockRange = {
      getBoundingClientRect: () => ({ left: 100, right: 200, top: 50, bottom: 70, width: 100, height: 20, x: 100, y: 50, toJSON: () => ({}) }),
      commonAncestorContainer: responseDiv,
    }
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'some text',
      getRangeAt: () => mockRange,
      removeAllRanges: vi.fn(),
    } as unknown as Selection)

    fireEvent.mouseUp(document)
    expect(screen.getByRole('button', { name: '引用 (⌘K)' })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('button', { name: '引用 (⌘K)' })).not.toBeInTheDocument()
  })

  it('Quote button calls addContextCapsule with selected text', () => {
    const { container } = render(<ReadingPanel />)
    const responseDiv = container.querySelector('.reading-panel-content')!

    const mockRange = {
      getBoundingClientRect: () => ({ left: 100, right: 200, top: 50, bottom: 70, width: 100, height: 20, x: 100, y: 50, toJSON: () => ({}) }),
      commonAncestorContainer: responseDiv,
    }
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'selected text to quote',
      getRangeAt: () => mockRange,
      removeAllRanges: vi.fn(),
    } as unknown as Selection)

    fireEvent.mouseUp(document)
    fireEvent.click(screen.getByRole('button', { name: '引用 (⌘K)' }))

    expect(mockAddCapsule).toHaveBeenCalledOnce()
    expect(mockAddCapsule.mock.calls[0][0].text).toBe('selected text to quote')
  })

  it('toolbar is hidden when selection is empty (collapsed)', () => {
    render(<ReadingPanel />)

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: true,
      toString: () => '',
      getRangeAt: vi.fn(),
      removeAllRanges: vi.fn(),
    } as unknown as Selection)

    fireEvent.mouseUp(document)
    expect(screen.queryByRole('button', { name: '引用 (⌘K)' })).not.toBeInTheDocument()
  })

  it('toolbar resets when switching to a different node', () => {
    const { container, rerender } = render(<ReadingPanel />)
    const responseDiv = container.querySelector('.reading-panel-content')!

    const mockRange = {
      getBoundingClientRect: () => ({ left: 100, right: 200, top: 50, bottom: 70, width: 100, height: 20, x: 100, y: 50, toJSON: () => ({}) }),
      commonAncestorContainer: responseDiv,
    }
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'text',
      getRangeAt: () => mockRange,
      removeAllRanges: vi.fn(),
    } as unknown as Selection)

    fireEvent.mouseUp(document)
    expect(screen.getByRole('button', { name: '引用 (⌘K)' })).toBeInTheDocument()

    mockSelectedId = 'node-2'
    mockNodes = [{
      id: 'node-2',
      type: 'thoughtNode',
      position: { x: 0, y: 0 },
      data: {
        type: 'thoughtNode',
        prompt: 'Different prompt',
        response: 'Different response',
        isLoading: false,
        isCollapsed: false,
      } as ThoughtNodeData,
    }]
    rerender(<ReadingPanel />)

    expect(screen.queryByRole('button', { name: '引用 (⌘K)' })).not.toBeInTheDocument()
  })
})
