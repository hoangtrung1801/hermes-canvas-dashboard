import { describe, expect, it } from 'vitest'
import { CanvasBridge } from './CanvasBridge'
import type { CanvasAdapter } from '../adapters/canvasAdapter'
import type { CanvasBlock } from '../blocks/block.types'

function createFakeAdapter(): CanvasAdapter {
  let blockCounter = 0
  const blocks = new Map<string, any>()

  return {
    canvasId: 'canvas_001',
    createText(input) {
      blockCounter += 1
      const block: CanvasBlock = {
        id: `block_${blockCounter}`,
        type: 'text',
        x: input.x,
        y: input.y,
        text: input.text,
        shapeIds: [`shape_${blockCounter}`]
      }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createBox(input) {
      blockCounter += 1
      const block: CanvasBlock = {
        id: `block_${blockCounter}`,
        type: 'box',
        x: input.x,
        y: input.y,
        shapeIds: [`shape_${blockCounter}`]
      }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createNote(input) {
      blockCounter += 1
      const block: CanvasBlock = {
        id: `block_${blockCounter}`,
        type: 'note',
        x: input.x,
        y: input.y,
        text: input.text,
        shapeIds: [`shape_${blockCounter}`]
      }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createTaskCard(input) {
      blockCounter += 1
      const block: CanvasBlock = {
        id: `block_${blockCounter}`,
        type: 'task_card',
        name: input.name,
        x: input.x,
        y: input.y,
        shapeIds: [`shape_${blockCounter}`]
      }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createLinkCard(input) {
      blockCounter += 1
      const block: CanvasBlock = {
        id: `block_${blockCounter}`,
        type: 'link_card',
        name: input.name,
        x: input.x,
        y: input.y,
        shapeIds: [`shape_${blockCounter}`]
      }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    createArrow(input) {
      blockCounter += 1
      const block: CanvasBlock = {
        id: `block_${blockCounter}`,
        type: 'box',
        name: input.label,
        x: 0,
        y: 0,
        shapeIds: [`shape_${blockCounter}`]
      }
      blocks.set(block.id, block)
      return { block, shapeIds: block.shapeIds }
    },
    updateText({ blockId, text }) {
      const block = blocks.get(blockId)
      if (!block) return null
      const next = { ...block, text }
      blocks.set(blockId, next)
      return next
    },
    moveBlock({ blockId, x, y }) {
      const block = blocks.get(blockId)
      if (!block) return null
      const next = { ...block, x, y }
      blocks.set(blockId, next)
      return next
    },
    deleteBlock({ blockId }) {
      const block = blocks.get(blockId)
      if (!block) return []
      blocks.delete(blockId)
      return block.shapeIds
    },
    getBlockById(blockId) {
      return blocks.get(blockId) ?? null
    },
    getBlockByName(name) {
      return [...blocks.values()].find((block) => block.name === name) ?? null
    },
    getCanvasState() {
      return {
        canvasId: 'canvas_001',
        selectedShapeIds: [],
        viewport: { x: 0, y: 0, w: 1200, h: 800 },
        blocks: [...blocks.values()]
      }
    },
    zoomToFit() {}
  }
}

describe('CanvasBridge', () => {
  it('executes a create_text request and returns an observation', () => {
    const bridge = new CanvasBridge(createFakeAdapter())

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_001',
      canvasId: 'canvas_001',
      actions: [{ type: 'create_text', text: 'Hello from Hermes', x: 80, y: 120 }]
    })

    if ('error' in response) {
      throw new Error('expected bridge response, received error')
    }

    expect(response.result.ok).toBe(true)
    expect(response.result.results[0].createdBlockIds).toHaveLength(1)
    expect(response.observation.state.blocks[0].text).toBe('Hello from Hermes')
  })

  it('resolves get_block_by_name requests against the current canvas state', () => {
    const bridge = new CanvasBridge(createFakeAdapter())

    bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_seed',
      canvasId: 'canvas_001',
      actions: [{ type: 'create_task_card', name: 'Import Book Modal', x: 140, y: 220 }]
    })

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_lookup',
      canvasId: 'canvas_001',
      actions: [{ type: 'get_block_by_name', name: 'Import Book Modal' }]
    })

    if ('error' in response) {
      throw new Error('expected bridge response, received error')
    }

    expect(response.result.results[0].matchedBlockIds).toHaveLength(1)
    expect(response.observation.state.blocks[0].name).toBe('Import Book Modal')
  })
})
