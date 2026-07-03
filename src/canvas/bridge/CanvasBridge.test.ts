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
    createTodoBlock(input) {
      blockCounter += 1
      const tasks = (input.tasks ?? []).map((task, index) =>
        typeof task === 'string'
          ? { id: `task_${index + 1}`, text: task, done: false }
          : { id: task.id ?? `task_${index + 1}`, text: task.text, done: task.done ?? false }
      )
      const block: CanvasBlock = {
        id: `block_${blockCounter}`,
        type: 'todo_block',
        name: input.name,
        x: input.x,
        y: input.y,
        text: input.name,
        props: { tasks },
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
      const fromBlock = blocks.get(input.fromBlockId)
      const toBlock = blocks.get(input.toBlockId)
      if (!fromBlock || !toBlock) return null

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
    appendTodoTask({ blockId, text, taskId }) {
      const block = blocks.get(blockId)
      if (!block || block.type !== 'todo_block') return null

      const task = { id: taskId ?? `task_${block.props.tasks.length + 1}`, text, done: false }
      const next = {
        ...block,
        props: { ...block.props, tasks: [...block.props.tasks, task] }
      }
      blocks.set(blockId, next)

      return { block: next, task }
    },
    setTodoTaskDone({ blockId, taskId, done }) {
      const block = blocks.get(blockId)
      if (!block || block.type !== 'todo_block') return null
      if (!block.props.tasks.some((task: { id: string }) => task.id === taskId)) return null

      const next = {
        ...block,
        props: {
          ...block.props,
          tasks: block.props.tasks.map((task: { id: string }) =>
            task.id === taskId ? { ...task, done } : task
          )
        }
      }
      blocks.set(blockId, next)

      return next
    },
    removeTodoTask({ blockId, taskId }) {
      const block = blocks.get(blockId)
      if (!block || block.type !== 'todo_block') return null
      if (!block.props.tasks.some((task: { id: string }) => task.id === taskId)) return null

      const next = {
        ...block,
        props: {
          ...block.props,
          tasks: block.props.tasks.filter((task: { id: string }) => task.id !== taskId)
        }
      }
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
    zoomToFit() {},
    zoomToBlock() {}
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

  it('executes todo block task mutations', () => {
    const bridge = new CanvasBridge(createFakeAdapter())

    const createResponse = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_todo_create',
      canvasId: 'canvas_001',
      actions: [
        {
          type: 'create_todo_block',
          name: 'Launch checklist',
          x: 100,
          y: 160,
          tasks: [{ id: 'task_docs', text: 'Write docs' }]
        }
      ]
    })

    if ('error' in createResponse) {
      throw new Error('expected bridge response, received error')
    }

    const blockId = createResponse.result.results[0].createdBlockIds?.[0]
    expect(blockId).toBeDefined()

    const updateResponse = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_todo_update',
      canvasId: 'canvas_001',
      actions: [
        { type: 'append_todo_task', blockId: blockId!, taskId: 'task_ship', text: 'Ship feature' },
        { type: 'set_todo_task_done', blockId: blockId!, taskId: 'task_docs', done: true },
        { type: 'remove_todo_task', blockId: blockId!, taskId: 'task_ship' }
      ]
    })

    if ('error' in updateResponse) {
      throw new Error('expected bridge response, received error')
    }

    expect(updateResponse.result.ok).toBe(true)
    expect(updateResponse.result.results[0].createdTaskIds).toEqual(['task_ship'])
    expect(updateResponse.result.results[1].updatedTaskIds).toEqual(['task_docs'])
    expect(updateResponse.result.results[2].deletedTaskIds).toEqual(['task_ship'])
    expect(updateResponse.observation.state.blocks[0].props?.tasks).toEqual([
      { id: 'task_docs', text: 'Write docs', done: true }
    ])
  })

  it('returns todo block data by block id', () => {
    const bridge = new CanvasBridge(createFakeAdapter())

    const createResponse = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_todo_create',
      canvasId: 'canvas_001',
      actions: [
        {
          type: 'create_todo_block',
          name: 'Launch checklist',
          x: 100,
          y: 160,
          tasks: [{ id: 'task_docs', text: 'Write docs' }]
        }
      ]
    })

    if ('error' in createResponse) {
      throw new Error('expected bridge response, received error')
    }

    const blockId = createResponse.result.results[0].createdBlockIds?.[0]
    expect(blockId).toBeDefined()

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_todo_read',
      canvasId: 'canvas_001',
      actions: [{ type: 'get_todo_block_data', blockId: blockId! }]
    })

    if ('error' in response) {
      throw new Error('expected bridge response, received error')
    }

    expect(response.result.ok).toBe(true)
    expect(response.result.results[0]).toMatchObject({
      actionType: 'get_todo_block_data',
      matchedBlockIds: [blockId],
      todoBlock: {
        id: blockId,
        name: 'Launch checklist',
        tasks: [{ id: 'task_docs', text: 'Write docs', done: false }]
      }
    })
  })

  it('returns an action error when todo block data is requested for an unknown block', () => {
    const bridge = new CanvasBridge(createFakeAdapter())

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_todo_missing',
      canvasId: 'canvas_001',
      actions: [{ type: 'get_todo_block_data', blockId: 'block_missing' }]
    })

    if ('error' in response) {
      throw new Error('expected bridge response, received error')
    }

    expect(response.result.ok).toBe(false)
    expect(response.result.results[0]).toEqual({
      actionType: 'get_todo_block_data',
      error: 'Unknown block block_missing'
    })
  })

  it('returns an action-level error for create_arrow when an endpoint is missing', () => {
    const bridge = new CanvasBridge(createFakeAdapter())

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_arrow_missing',
      canvasId: 'canvas_001',
      actions: [
        { type: 'create_task_card', name: 'Source', x: 100, y: 120 },
        { type: 'create_arrow', fromBlockId: 'block_1', toBlockId: 'block_missing', label: 'Missing' }
      ]
    })

    if ('error' in response) {
      throw new Error('expected bridge response, received error')
    }

    expect(response.result.ok).toBe(false)
    expect(response.result.results[1]).toEqual({
      actionType: 'create_arrow',
      error: 'Unknown arrow endpoint block_missing'
    })
  })

  it('returns an action error when todo block data is requested for a non-todo block', () => {
    const bridge = new CanvasBridge(createFakeAdapter())

    const createResponse = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_text_create',
      canvasId: 'canvas_001',
      actions: [{ type: 'create_text', text: 'Hello', x: 80, y: 120 }]
    })

    if ('error' in createResponse) {
      throw new Error('expected bridge response, received error')
    }

    const blockId = createResponse.result.results[0].createdBlockIds?.[0]
    expect(blockId).toBeDefined()

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_todo_wrong_type',
      canvasId: 'canvas_001',
      actions: [{ type: 'get_todo_block_data', blockId: blockId! }]
    })

    if ('error' in response) {
      throw new Error('expected bridge response, received error')
    }

    expect(response.result.ok).toBe(false)
    expect(response.result.results[0]).toEqual({
      actionType: 'get_todo_block_data',
      error: `Block ${blockId} is not a todo block`
    })
  })
})
