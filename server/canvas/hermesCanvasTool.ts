import type { CanvasAction } from '../../src/canvas/actions/canvasAction.types'

export function createHermesCanvasToolPayload(
  canvasId: string,
  actions: CanvasAction[]
) {
  return {
    type: 'canvas.action' as const,
    requestId: `req_${Date.now()}`,
    canvasId,
    actions
  }
}
