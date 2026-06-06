import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ComponentProps } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ThoughtNode from '../ThoughtNode'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}))

const mockDeleteNode = vi.fn()
let mockSelectedId: string | null = null

const mockCycleStatus = vi.fn()

vi.mock('../../store/canvasStore', () => ({
  useCanvasStore: () => ({
    get selectedNodeId() { return mockSelectedId },
    deleteNode: mockDeleteNode,
    cycleNodeStatus: mockCycleStatus,
    replayRevealed: null,
    nodes: [],
    edges: [],
  }),
}))

const renderNode = (id: string, data: Record<string, unknown>) =>
  render(<ThoughtNode {...({ id, data } as unknown as ComponentProps<typeof ThoughtNode>)} />)

beforeEach(() => {
  mockDeleteNode.mockClear()
  mockSelectedId = null
})

describe('ThoughtNode display', () => {
  it('shows the AI-generated title in the #N-title header', () => {
    renderNode('n1', {
      type: 'thoughtNode',
      prompt: 'What is quantum computing?',
      response: 'Quantum computing uses qubits.',
      title: 'Quantum Computing Explained',
      isLoading: false,
      isCollapsed: false,
    })
    // Header is "#<n>-<title>", so match the title as a substring.
    expect(screen.getByText(/Quantum Computing Explained/)).toBeInTheDocument()
  })

  it('shows the prompt in the body even when a title is set (title lives in the header)', () => {
    renderNode('n1', {
      type: 'thoughtNode',
      prompt: 'What is quantum computing?',
      response: 'Response',
      title: 'Quantum Computing Explained',
      isLoading: false,
      isCollapsed: false,
    })
    expect(screen.getByText('What is quantum computing?')).toBeInTheDocument()
  })

  it('shows the prompt in the body when there is no title', () => {
    renderNode('n1', {
      type: 'thoughtNode',
      prompt: 'Short question',
      response: 'Response',
      isLoading: false,
      isCollapsed: false,
    })
    expect(screen.getByText('Short question')).toBeInTheDocument()
  })

  it('renders the full prompt in the body (clamped to 3 lines via CSS, not truncated text)', () => {
    const longPrompt = 'A'.repeat(60)
    renderNode('n1', {
      type: 'thoughtNode',
      prompt: longPrompt,
      response: 'Response',
      isLoading: false,
      isCollapsed: false,
    })
    expect(screen.getByText(longPrompt)).toBeInTheDocument()
  })

  it('shows loading spinner when isLoading is true', () => {
    renderNode('n1', {
      type: 'thoughtNode',
      prompt: 'A prompt',
      response: '',
      isLoading: true,
      isCollapsed: false,
    })
    expect(screen.getByText('Thinking…')).toBeInTheDocument()
  })

  it('renders nothing for non-thoughtNode data', () => {
    const { container } = renderNode('n1', { type: 'placeholderNode', isDeleted: true })
    expect(container.firstChild).toBeNull()
  })
})

describe('ThoughtNode read-status toggle', () => {
  it('cycles read status when the status indicator is clicked', () => {
    renderNode('n1', {
      type: 'thoughtNode',
      prompt: 'Question',
      response: 'Answer',
      isLoading: false,
      isCollapsed: false,
    })
    fireEvent.click(screen.getByTitle(/閱讀狀態/))
    expect(mockCycleStatus).toHaveBeenCalledWith('n1')
  })
})

describe('ThoughtNode delete button', () => {
  it('calls deleteNode when delete button is clicked', () => {
    renderNode('n1', {
      type: 'thoughtNode',
      prompt: 'Question',
      response: 'Answer',
      title: 'Title',
      isLoading: false,
      isCollapsed: false,
    })
    const deleteBtn = screen.getByTitle('Delete node')
    fireEvent.click(deleteBtn)
    expect(mockDeleteNode).toHaveBeenCalledWith('n1')
  })
})

describe('ThoughtNode selected state', () => {
  it('renders selected indicator bar when node is selected', () => {
    mockSelectedId = 'n1'
    const { container } = renderNode('n1', {
      type: 'thoughtNode',
      prompt: 'Question',
      response: 'Answer',
      title: 'Title',
      isLoading: false,
      isCollapsed: false,
    })
    // Selected indicator bar has a gradient background and h-0.5 class
    const indicator = container.querySelector('.h-0\\.5')
    expect(indicator).toBeInTheDocument()
  })

  it('does not render selected indicator when node is not selected', () => {
    mockSelectedId = 'other-node'
    const { container } = renderNode('n1', {
      type: 'thoughtNode',
      prompt: 'Question',
      response: 'Answer',
      title: 'Title',
      isLoading: false,
      isCollapsed: false,
    })
    const indicator = container.querySelector('.h-0\\.5')
    expect(indicator).not.toBeInTheDocument()
  })
})
