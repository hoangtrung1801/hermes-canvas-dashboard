import { blockRegistry } from '../blocks/blockRegistry'
import type { CanvasBlock, CanvasObservationState } from '../blocks/block.types'
import type { AdapterCreateResult, CanvasAdapter } from './canvasAdapter'

type EditorLike = {
  createShape(shape: Record<string, unknown>): unknown
  updateShape(shape: Record<string, unknown>): unknown
  deleteShape(shapeId: string): unknown
  getCurrentPageShapes(): Array<Record<string, unknown>>
  getSelectedShapeIds(): string[]
  getViewportPageBounds(): { x: number; y: number; w: number; h: number }
  zoomToFit(): void
}

export class TldrawAdapter implements CanvasAdapter {
  private readonly blocks = new Map<string, CanvasBlock>()
  private sequence = 0

  constructor(
    private readonly editor: EditorLike,
    public readonly canvasId: string
  ) {}

  createText(input: { text: string; x: number; y: number; name?: string }): AdapterCreateResult {
    return this.createBlock('text', input)
  }

  createBox(input: { x: number; y: number; w?: number; h?: number; name?: string; text?: string }): AdapterCreateResult {
    return this.createBlock('box', input)
  }

  createNote(input: { x: number; y: number; text: string; name?: string }): AdapterCreateResult {
    return this.createBlock('note', input)
  }

  createTaskCard(input: { x: number; y: number; name: string; text?: string; props?: Record<string, unknown> }): AdapterCreateResult {
    return this.createBlock('task_card', input)
  }

  createLinkCard(input: { x: number; y: number; name: string; url: string; props?: Record<string, unknown> }): AdapterCreateResult {
    return this.createBlock('link_card', input)
  }

  createArrow(input: { fromBlockId: string; toBlockId: string; label?: string }): AdapterCreateResult {
    const blockId = this.nextId('block')
    const shapeId = this.nextId('shape')
    const block: CanvasBlock = {
      id: blockId,
      type: 'box',
      name: input.label,
      x: 0,
      y: 0,
      text: input.label,
      props: { fromBlockId: input.fromBlockId, toBlockId: input.toBlockId },
      shapeIds: [shapeId]
    }

    this.editor.createShape({ id: shapeId, type: 'arrow', props: input })
    this.blocks.set(blockId, block)

    return { block, shapeIds: [shapeId] }
  }

  updateText(input: { blockId: string; text: string }): CanvasBlock | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return null

    const next = { ...existing, text: input.text }
    this.blocks.set(input.blockId, next)
    this.editor.updateShape({ id: existing.shapeIds[0], props: { text: input.text } })

    return next
  }

  moveBlock(input: { blockId: string; x: number; y: number }): CanvasBlock | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return null

    const next = { ...existing, x: input.x, y: input.y }
    this.blocks.set(input.blockId, next)
    this.editor.updateShape({ id: existing.shapeIds[0], x: input.x, y: input.y })

    return next
  }

  deleteBlock(input: { blockId: string }): string[] {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return []

    existing.shapeIds.forEach((shapeId) => this.editor.deleteShape(shapeId))
    this.blocks.delete(input.blockId)

    return existing.shapeIds
  }

  getBlockById(blockId: string): CanvasBlock | null {
    return this.blocks.get(blockId) ?? null
  }

  getBlockByName(name: string): CanvasBlock | null {
    return [...this.blocks.values()].find((block) => block.name === name) ?? null
  }

  getCanvasState(): CanvasObservationState {
    return {
      canvasId: this.canvasId,
      selectedShapeIds: this.editor.getSelectedShapeIds(),
      viewport: this.editor.getViewportPageBounds(),
      blocks: [...this.blocks.values()]
    }
  }

  zoomToFit(): void {
    this.editor.zoomToFit()
  }

  private createBlock(
    type: CanvasBlock['type'],
    input: {
      x: number
      y: number
      name?: string
      text?: string
      props?: Record<string, unknown>
      w?: number
      h?: number
    }
  ): AdapterCreateResult {
    const definition = blockRegistry[type]
    const blockId = this.nextId('block')
    const shapeId = this.nextId('shape')
    const block: CanvasBlock = {
      id: blockId,
      type,
      name: input.name,
      x: input.x,
      y: input.y,
      w: input.w ?? definition.defaultSize.w,
      h: input.h ?? definition.defaultSize.h,
      text: input.text ?? input.name,
      props: { ...definition.defaultProps, ...input.props },
      shapeIds: [shapeId]
    }

    this.editor.createShape({
      id: shapeId,
      type: type === 'text' ? 'text' : 'geo',
      x: block.x,
      y: block.y,
      props: {
        text: block.text,
        w: block.w,
        h: block.h
      }
    })

    this.blocks.set(blockId, block)
    return { block, shapeIds: [shapeId] }
  }

  private nextId(prefix: 'block' | 'shape'): string {
    this.sequence += 1
    return `${prefix}_${this.sequence.toString().padStart(4, '0')}`
  }
}
