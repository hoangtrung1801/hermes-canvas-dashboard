import type { CanvasAction } from '../actions/canvasAction.types'
import type { CanvasAdapter } from '../adapters/canvasAdapter'
import type { CanvasObservationState } from '../blocks/block.types'
import { canvasActionEnvelopeSchema } from '../protocol/canvasMessages'
import { ActionExecutor, type ActionExecutionResult } from './ActionExecutor'
import { StateObserver } from './StateObserver'

type ActionEnvelope = {
  type: 'canvas.action'
  requestId: string
  canvasId: string
  actions: CanvasAction[]
}

type BridgeResponse = {
  result: {
    type: 'canvas.result'
    requestId: string
    ok: boolean
    results: ActionExecutionResult[]
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
  private readonly executor: ActionExecutor
  private readonly observer: StateObserver

  constructor(private readonly adapter: CanvasAdapter) {
    this.executor = new ActionExecutor(adapter)
    this.observer = new StateObserver(adapter)
  }

  handleActionEnvelope(
    envelope: ActionEnvelope
  ): BridgeResponse | BridgeErrorResponse {
    try {
      const validated = canvasActionEnvelopeSchema.parse(envelope)
      const results = validated.actions.map((action) => this.executor.execute(action))
      const ok = results.every((result) => !result.error)
      const observationState = this.observer.read()

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
          canvasId: this.adapter.canvasId,
          state: observationState
        }
      }
    } catch (error) {
      return {
        error: {
          type: 'canvas.error',
          requestId: envelope.requestId,
          message:
            error instanceof Error
              ? error.message
              : 'Canvas action handling failed'
        }
      }
    }
  }
}
