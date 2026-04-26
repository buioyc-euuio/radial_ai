import { describe, it, expect, beforeEach, vi } from 'vitest'

// idb-keyval must be mocked before the store module is imported
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

import { useCanvasStore } from '../canvasStore'
import type { ContextCapsule } from '../types'

const capsule = (id: string): ContextCapsule => ({
  id,
  sourceNodeId: 'node-1',
  sourceNodeLabel: 'label',
  text: 'quoted text',
  isFullNode: false,
})

beforeEach(() => {
  // Merge-reset state fields without touching action functions
  useCanvasStore.setState({
    view: 'home',
    projects: [],
    currentProjectId: null,
    nodes: [],
    edges: [],
    contextCapsules: [],
    selectedNodeId: null,
    apiKey: '',
    geminiApiKey: '',
    model: 'claude-sonnet-4-6',
  })
})

describe('contextCapsules', () => {
  it('addContextCapsule appends capsule', () => {
    useCanvasStore.getState().addContextCapsule(capsule('c1'))
    expect(useCanvasStore.getState().contextCapsules).toHaveLength(1)
    expect(useCanvasStore.getState().contextCapsules[0].id).toBe('c1')
  })

  it('addContextCapsule allows multiple capsules', () => {
    useCanvasStore.getState().addContextCapsule(capsule('c1'))
    useCanvasStore.getState().addContextCapsule(capsule('c2'))
    expect(useCanvasStore.getState().contextCapsules).toHaveLength(2)
  })

  it('removeContextCapsule removes by id', () => {
    useCanvasStore.getState().addContextCapsule(capsule('c1'))
    useCanvasStore.getState().addContextCapsule(capsule('c2'))
    useCanvasStore.getState().removeContextCapsule('c1')
    const ids = useCanvasStore.getState().contextCapsules.map(c => c.id)
    expect(ids).toEqual(['c2'])
  })

  it('clearContextCapsules empties all', () => {
    useCanvasStore.getState().addContextCapsule(capsule('c1'))
    useCanvasStore.getState().addContextCapsule(capsule('c2'))
    useCanvasStore.getState().clearContextCapsules()
    expect(useCanvasStore.getState().contextCapsules).toHaveLength(0)
  })
})

describe('deleteNode', () => {
  it('converts thought node to placeholder', () => {
    useCanvasStore.setState({
      nodes: [{
        id: 'n1',
        type: 'thoughtNode',
        position: { x: 0, y: 0 },
        data: { type: 'thoughtNode', prompt: 'p', response: 'r', isLoading: false, isCollapsed: false },
      }],
    })
    useCanvasStore.getState().deleteNode('n1')
    const node = useCanvasStore.getState().nodes[0]
    expect(node.data.type).toBe('placeholderNode')
  })

  it('does not remove the node from the nodes array', () => {
    useCanvasStore.setState({
      nodes: [{
        id: 'n1',
        type: 'thoughtNode',
        position: { x: 0, y: 0 },
        data: { type: 'thoughtNode', prompt: 'p', response: 'r', isLoading: false, isCollapsed: false },
      }],
    })
    useCanvasStore.getState().deleteNode('n1')
    expect(useCanvasStore.getState().nodes).toHaveLength(1)
  })
})

describe('setSelectedNode', () => {
  it('updates selectedNodeId', () => {
    useCanvasStore.getState().setSelectedNode('node-xyz')
    expect(useCanvasStore.getState().selectedNodeId).toBe('node-xyz')
  })

  it('can be cleared to null', () => {
    useCanvasStore.getState().setSelectedNode('node-xyz')
    useCanvasStore.getState().setSelectedNode(null)
    expect(useCanvasStore.getState().selectedNodeId).toBeNull()
  })
})

describe('createProject', () => {
  it('adds a project and switches to canvas view', () => {
    useCanvasStore.getState().createProject('My Project')
    const state = useCanvasStore.getState()
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0].name).toBe('My Project')
    expect(state.view).toBe('canvas')
  })

  it('first project gets demo nodes', () => {
    useCanvasStore.getState().createProject('First')
    expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0)
  })

  it('second project starts empty', () => {
    useCanvasStore.getState().createProject('First')
    useCanvasStore.setState({ view: 'home' })
    // Manually add second project to simulate not-first
    useCanvasStore.setState(s => ({
      projects: [...s.projects, {
        id: 'p2',
        name: 'Second',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodes: [],
        edges: [],
      }],
    }))
    // Open second project
    useCanvasStore.getState().openProject('p2')
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
  })
})

describe('renameProject', () => {
  it('updates the project name', () => {
    useCanvasStore.getState().createProject('Old Name')
    const id = useCanvasStore.getState().projects[0].id
    useCanvasStore.getState().renameProject(id, 'New Name')
    expect(useCanvasStore.getState().projects[0].name).toBe('New Name')
  })
})

describe('deleteProject', () => {
  it('removes the project from the list', () => {
    useCanvasStore.getState().createProject('To Delete')
    const id = useCanvasStore.getState().projects[0].id
    useCanvasStore.getState().deleteProject(id)
    expect(useCanvasStore.getState().projects).toHaveLength(0)
  })

  it('resets to home view when current project is deleted', () => {
    useCanvasStore.getState().createProject('To Delete')
    const id = useCanvasStore.getState().currentProjectId!
    useCanvasStore.getState().deleteProject(id)
    expect(useCanvasStore.getState().view).toBe('home')
  })
})
