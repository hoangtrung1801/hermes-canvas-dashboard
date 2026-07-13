import type { CanvasAction } from '../actions/canvasAction.types'
import { useBridgeStore } from '../state/bridgeStore'

type ComponentKind = 'project' | 'todo' | 'link' | 'note'

type InsertOption = {
  kind: ComponentKind
  label: string
  icon: 'project' | 'todo' | 'link' | 'note'
}

const INSERT_OPTIONS: InsertOption[] = [
  { kind: 'project', label: 'Project Card', icon: 'project' },
  { kind: 'todo', label: 'Todo Block', icon: 'todo' },
  { kind: 'link', label: 'Link Card', icon: 'link' },
  { kind: 'note', label: 'Note Card', icon: 'note' }
]

function nextInsertId(kind: ComponentKind) {
  return `shape:${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function getInsertPoint(editor: unknown, kind: ComponentKind) {
  const editorWithBounds = editor as {
    getViewportPageBounds?: () => { x: number; y: number; w: number; h: number }
  }
  const bounds = editorWithBounds.getViewportPageBounds?.()
  if (!bounds) return { x: 160, y: 160 }

  const dimensions = kind === 'project' ? { width: 360, height: 320 } : { width: 280, height: 160 }
  return {
    x: Math.round(bounds.x + bounds.w / 2 - dimensions.width / 2),
    y: Math.round(bounds.y + bounds.h / 2 - dimensions.height / 2)
  }
}

function buildCreateAction(kind: ComponentKind, id: string, x: number, y: number): CanvasAction {
  if (kind === 'todo') {
    return { type: 'create_todo_block', id, title: 'Todo', tasks: [], x, y }
  }

  if (kind === 'note') {
    return {
      type: 'create_note_card',
      id,
      title: 'New Note',
      tag: 'Idea',
      content: '',
      x,
      y
    }
  }

  if (kind === 'project') {
    return {
      type: 'create_project_card',
      id,
      title: 'New Project',
      status: 'planned',
      priority: 'medium',
      actions: [],
      x,
      y
    }
  }

  return {
    type: 'create_link_card',
    id,
    title: 'New Link',
    url: 'https://example.com',
    description: '',
    x,
    y
  }
}

function ComponentIcon({ icon }: { icon: InsertOption['icon'] }) {
  if (icon === 'project') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="6" width="14" height="10" rx="2" />
        <path d="M7 6V4h6v2M3 10h14" />
      </svg>
    )
  }

  if (icon === 'todo') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="3" />
        <path d="m7 10 2 2 4-5" />
      </svg>
    )
  }

  if (icon === 'note') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="4" y="3" width="12" height="14" rx="2" />
        <path d="M7 7h6M7 10h5M7 13h3" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 12 12 8" />
      <path d="M10 5h5v5" />
      <path d="M14 6 8 12" />
      <rect x="4" y="8" width="8" height="8" rx="2" />
    </svg>
  )
}

export function CanvasInsertMenu() {
  const bridge = useBridgeStore((state) => state.bridge)
  const adapter = useBridgeStore((state) => state.adapter)
  const editor = useBridgeStore((state) => state.editor)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const addLog = useBridgeStore((state) => state.addLog)
  const isReady = Boolean(bridge && adapter && editor)

  const insertComponent = (kind: ComponentKind) => {
    if (!bridge || !adapter || !editor) return

    const point = getInsertPoint(editor, kind)
    const shapeId = nextInsertId(kind)
    const createAction = buildCreateAction(kind, shapeId, point.x, point.y)
    const envelope = {
      type: 'canvas.action' as const,
      requestId: 'insert_' + Math.random().toString(36).substring(2, 9),
      canvasId: adapter.canvasId,
      actions: [createAction, { type: 'select_shapes' as const, shapeIds: [shapeId] }]
    }

    addLog('in', 'canvas.action (Insert Component)', envelope)
    const response = bridge.handleActionEnvelope(envelope)

    if ('error' in response) {
      addLog('error', 'canvas.error (Insert Component)', response.error)
      alert(`Error inserting component: ${response.error.message}`)
      return
    }

    setObservation(response.observation.state)
    addLog('out', 'canvas.result (Insert Component)', response.result)
    addLog('out', 'canvas.observation (Insert Component)', response.observation)
  }

  return (
    <div className="canvas-insert-actions">
      {INSERT_OPTIONS.map((option) => (
        <button
          key={option.kind}
          type="button"
          className="canvas-toolbar-button"
          aria-label={option.label}
          disabled={!isReady}
          title={isReady ? option.label : 'Canvas is still loading'}
          onClick={() => insertComponent(option.kind)}
        >
          <ComponentIcon icon={option.icon} />
        </button>
      ))}
    </div>
  )
}
