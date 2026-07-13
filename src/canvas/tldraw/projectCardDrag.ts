import type { ProjectTaskStatus } from './projectCard.types'

export type ProjectDragRect = {
  left: number
  right: number
  top: number
  bottom: number
}

export type ProjectDropZone = {
  status: ProjectTaskStatus
  rect: ProjectDragRect
  tasks: Array<{ id: string; rect: ProjectDragRect }>
}

export function resolveProjectTaskDrop(
  x: number,
  y: number,
  zones: ProjectDropZone[]
): { status: ProjectTaskStatus; beforeTaskId: string | null } | null {
  const zone = zones.find(
    ({ rect }) =>
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  )
  if (!zone) return null

  const before = zone.tasks.find(
    ({ rect }) => y < rect.top + (rect.bottom - rect.top) / 2
  )
  return {
    status: zone.status,
    beforeTaskId: before?.id ?? null
  }
}
