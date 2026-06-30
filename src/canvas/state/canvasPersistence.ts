import type { ExcalidrawAdapterSnapshot, ExcalidrawElementLike } from '../adapters/ExcalidrawAdapter'

const CANVAS_PERSISTENCE_VERSION = 1

type CanvasPersistenceEnv = {
  VITE_CANVAS_STATE_URL?: string
}

export type CanvasPersistenceSnapshot = {
  version: typeof CANVAS_PERSISTENCE_VERSION
  canvasId: string
  elements: ExcalidrawElementLike[]
  adapter: ExcalidrawAdapterSnapshot
}

export function canvasStateEndpoint(
  canvasId: string,
  env: CanvasPersistenceEnv = import.meta.env
): string {
  const baseUrl = env.VITE_CANVAS_STATE_URL?.trim() || 'http://localhost:8787/canvas-state'
  return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(canvasId)}`
}

export async function loadCanvasSnapshot(canvasId: string): Promise<CanvasPersistenceSnapshot | null> {
  try {
    const response = await fetch(canvasStateEndpoint(canvasId))
    if (response.status === 404) return null
    if (!response.ok) return null

    const parsed = await response.json()
    if (!isCanvasPersistenceSnapshot(parsed) || parsed.canvasId !== canvasId) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export async function saveCanvasSnapshot(snapshot: CanvasPersistenceSnapshot): Promise<void> {
  try {
    await fetch(canvasStateEndpoint(snapshot.canvasId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    })
  } catch {
    // Canvas interaction should continue even when the local file server is unavailable.
  }
}

export function createCanvasSnapshot(input: {
  canvasId: string
  elements: readonly ExcalidrawElementLike[]
  adapter: ExcalidrawAdapterSnapshot
}): CanvasPersistenceSnapshot {
  return {
    version: CANVAS_PERSISTENCE_VERSION,
    canvasId: input.canvasId,
    elements: input.elements.map((element) => ({ ...element })),
    adapter: input.adapter
  }
}

function isCanvasPersistenceSnapshot(value: unknown): value is CanvasPersistenceSnapshot {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  if (record.version !== CANVAS_PERSISTENCE_VERSION) return false
  if (typeof record.canvasId !== 'string') return false
  if (!Array.isArray(record.elements)) return false
  if (!record.adapter || typeof record.adapter !== 'object') return false

  const adapter = record.adapter as Record<string, unknown>
  return (
    Array.isArray(adapter.blocks) &&
    typeof adapter.sequence === 'number' &&
    typeof adapter.todoTaskSequence === 'number'
  )
}
