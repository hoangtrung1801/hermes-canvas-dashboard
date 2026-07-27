import type { CanvasAction } from '../actions/canvasAction.types'
import { canvasActionEnvelopeSchema } from '../protocol/canvasMessages'
import {
  executeTldrawAction,
  readTldrawObservation,
  type TldrawActionResult,
  type TldrawExecutorTarget
} from '../tldraw/tldrawActionExecutor'
import type { CanvasObservationState } from '../tldraw/tldrawObservation'

type ActionEnvelope = {
  type: 'canvas.action'
  requestId: string
  canvasId: string
  actions: CanvasAction[]
}

export type CanvasActionOrigin = 'api' | 'canvas'

type BridgeResponse = {
  result: {
    type: 'canvas.result'
    requestId: string
    ok: boolean
    results: TldrawActionResult[]
  }
  observation: {
    type: 'canvas.observation'
    requestId: string
    canvasId: string
    state: CanvasObservationState
  }
}

type BridgeErrorResponse = {
  error: {
    type: 'canvas.error'
    requestId: string
    message: string
  }
}

export class CanvasBridge {
  constructor(private readonly target: TldrawExecutorTarget) {}

  handleActionEnvelope(
    envelope: ActionEnvelope,
    options: { origin?: CanvasActionOrigin } = {}
  ): BridgeResponse | BridgeErrorResponse {
    try {
      const validated = canvasActionEnvelopeSchema.parse(envelope)
      const origin = options.origin ?? 'api'
      const results = validated.actions.map((action) =>
        executeTldrawAction(this.target, action, { origin })
      )
      const ok = results.every((result) => !result.error)
      const observationState = readTldrawObservation(this.target)

      return {
        result: {
          type: 'canvas.result',
          requestId: validated.requestId,
          ok,
          results
        },
        observation: {
          type: 'canvas.observation',
          requestId: validated.requestId,
          canvasId: this.target.canvasId,
          state: observationState
        }
      }
    } catch (error) {
      return {
        error: {
          type: 'canvas.error',
          requestId: envelope.requestId,
          message: error instanceof Error ? error.message : 'Canvas action handling failed'
        }
      }
    }
  }
}
