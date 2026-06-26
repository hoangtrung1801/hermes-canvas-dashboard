import type { CanvasAdapter } from '../adapters/canvasAdapter'
import type { CanvasObservationState } from '../blocks/block.types'

export class StateObserver {
  constructor(private readonly adapter: CanvasAdapter) {}

  read(): CanvasObservationState {
    return this.adapter.getCanvasState()
  }

  findBlockByName(name: string) {
    return this.adapter.getBlockByName(name)
  }

  findBlockById(blockId: string) {
    return this.adapter.getBlockById(blockId)
  }
}
