import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GlobalInputPalette from '../GlobalInputPalette'
import type { ContextCapsule } from '../../store/types'

const mockSendPrompt = vi.fn().mockResolvedValue(undefined)
const mockRemoveCapsule = vi.fn()
let mockCapsules: ContextCapsule[] = []

vi.mock('../../store/canvasStore', () => ({
  useCanvasStore: () => ({
    get contextCapsules() { return mockCapsules },
    removeContextCapsule: mockRemoveCapsule,
    sendPrompt: mockSendPrompt,
  }),
}))

beforeEach(() => {
  mockSendPrompt.mockClear()
  mockRemoveCapsule.mockClear()
  mockCapsules = []
})

describe('GlobalInputPalette — send behaviour', () => {
  it('sends prompt on Enter when not composing', async () => {
    render(<GlobalInputPalette />)
    const textarea = screen.getByRole('textbox')

    await userEvent.type(textarea, 'Hello world')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(mockSendPrompt).toHaveBeenCalledWith('Hello world')
    })
  })

  it('clears input after sending', async () => {
    render(<GlobalInputPalette />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    await userEvent.type(textarea, 'Test message')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    await waitFor(() => expect(textarea.value).toBe(''))
  })

  it('does NOT send on Enter when IME is composing (isComposing=true)', () => {
    render(<GlobalInputPalette />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, { target: { value: '你好' } })

    // jsdom does not honour isComposing in KeyboardEventInit, so we must
    // override the property on a manually-constructed event.
    const composingEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(composingEvent, 'isComposing', { get: () => true })
    textarea.dispatchEvent(composingEvent)

    expect(mockSendPrompt).not.toHaveBeenCalled()
  })

  it('does NOT send on Shift+Enter', async () => {
    render(<GlobalInputPalette />)
    const textarea = screen.getByRole('textbox')

    await userEvent.type(textarea, 'Line one')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(mockSendPrompt).not.toHaveBeenCalled()
  })

  it('does NOT send when input is empty', () => {
    render(<GlobalInputPalette />)
    const textarea = screen.getByRole('textbox')

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(mockSendPrompt).not.toHaveBeenCalled()
  })

  it('does NOT send when input is only whitespace', () => {
    render(<GlobalInputPalette />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(mockSendPrompt).not.toHaveBeenCalled()
  })

  it('Send button is disabled when input is empty', () => {
    render(<GlobalInputPalette />)
    const button = screen.getByRole('button', { name: 'Send' })
    expect(button).toBeDisabled()
  })

  it('Send button is enabled when input has text', async () => {
    render(<GlobalInputPalette />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Some text')
    const button = screen.getByRole('button', { name: 'Send' })
    expect(button).not.toBeDisabled()
  })
})

describe('GlobalInputPalette — context capsules', () => {
  it('renders capsule text', () => {
    mockCapsules = [{
      id: 'cap-1',
      sourceNodeId: 'node-1',
      sourceNodeLabel: 'My Node',
      text: 'Quoted text snippet',
      isFullNode: false,
    }]
    render(<GlobalInputPalette />)
    expect(screen.getByText('Quoted text snippet')).toBeInTheDocument()
  })

  it('calls removeContextCapsule when × is clicked', () => {
    mockCapsules = [{
      id: 'cap-1',
      sourceNodeId: 'node-1',
      sourceNodeLabel: 'Label',
      text: 'Some quote',
      isFullNode: false,
    }]
    render(<GlobalInputPalette />)
    const removeBtn = screen.getByRole('button', { name: '×' })
    fireEvent.click(removeBtn)
    expect(mockRemoveCapsule).toHaveBeenCalledWith('cap-1')
  })

  it('shows [Full] prefix for full-node capsules', () => {
    mockCapsules = [{
      id: 'cap-full',
      sourceNodeId: 'node-1',
      sourceNodeLabel: 'My Node',
      text: 'Full node content here',
      isFullNode: true,
    }]
    render(<GlobalInputPalette />)
    expect(screen.getByText(/\[Full\]/)).toBeInTheDocument()
  })
})
