import type { CanvasBlock, CanvasObservationState } from '../blocks/block.types'

export type AdapterCreateResult = {
  block: CanvasBlock
  shapeIds: string[]
}

export interface CanvasAdapter {
  readonly canvasId: string
  createText(input: { text: string; x: number; y: number; name?: string }): AdapterCreateResult
  createBox(input: { x: number; y: number; w?: number; h?: number; name?: string; text?: string }): AdapterCreateResult
  createNote(input: { x: number; y: number; text: string; name?: string }): AdapterCreateResult
  createTaskCard(input: { x: number; y: number; name: string; text?: string; props?: Record<string, unknown> }): AdapterCreateResult
  createLinkCard(input: { x: number; y: number; name: string; url: string; props?: Record<string, unknown> }): AdapterCreateResult
  createArrow(input: { fromBlockId: string; toBlockId: string; label?: string }): AdapterCreateResult
  updateText(input: { blockId: string; text: string }): CanvasBlock | null
  moveBlock(input: { blockId: string; x: number; y: number }): CanvasBlock | null
  deleteBlock(input: { blockId: string }): string[]
  getBlockById(blockId: string): CanvasBlock | null
  getBlockByName(name: string): CanvasBlock | null
  getCanvasState(): CanvasObservationState
  zoomToFit(): void
}
