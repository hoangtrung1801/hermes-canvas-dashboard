import { describe, expect, it } from 'vitest'
import { createMemoryTldrawTarget } from '../tldraw/tldrawActionExecutor'
import { CanvasBridge } from './CanvasBridge'

describe('CanvasBridge', () => {
  it('executes a tldraw create_shape request and returns an observation', () => {
    const bridge = new CanvasBridge(createMemoryTldrawTarget('canvas_001'))

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_001',
      canvasId: 'canvas_001',
      actions: [
        {
          type: 'create_shape',
          shape: {
            id: 'shape:text_1',
            type: 'text',
            x: 80,
            y: 120,
            props: { text: 'Hello from Hermes' }
          }
        }
      ]
    })

    if ('error' in response) {
      throw new Error('expected bridge response, received error')
    }

    expect(response.result.ok).toBe(true)
    expect(response.result.results[0]).toEqual({
      actionType: 'create_shape',
      createdShapeIds: ['shape:text_1']
    })
    expect(response.observation.state.shapes[0]).toMatchObject({
      id: 'shape:text_1',
      type: 'text',
      props: { text: 'Hello from Hermes' }
    })
  })

  it('executes todo block task mutations', () => {
    const bridge = new CanvasBridge(createMemoryTldrawTarget('canvas_001'))

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_todo',
      canvasId: 'canvas_001',
      actions: [
        {
          type: 'create_todo_block',
          id: 'shape:todo_1',
          title: 'Launch checklist',
          x: 100,
          y: 160,
          tasks: [{ id: 'task_docs', text: 'Write docs' }]
        },
        { type: 'append_todo_task', shapeId: 'shape:todo_1', taskId: 'task_ship', text: 'Ship feature' },
        { type: 'set_todo_task_done', shapeId: 'shape:todo_1', taskId: 'task_docs', done: true },
        { type: 'remove_todo_task', shapeId: 'shape:todo_1', taskId: 'task_ship' }
      ]
    })

    if ('error' in response) {
      throw new Error('expected bridge response, received error')
    }

    expect(response.result.ok).toBe(true)
    expect(response.result.results).toEqual([
      { actionType: 'create_todo_block', createdShapeIds: ['shape:todo_1'] },
      { actionType: 'append_todo_task', updatedShapeIds: ['shape:todo_1'] },
      { actionType: 'set_todo_task_done', updatedShapeIds: ['shape:todo_1'] },
      { actionType: 'remove_todo_task', updatedShapeIds: ['shape:todo_1'] }
    ])
    expect(response.observation.state.shapes[0].props.tasks).toEqual([
      { id: 'task_docs', text: 'Write docs', done: true }
    ])
  })

  it('keeps project batch result context after an action-level failure', () => {
    const bridge = new CanvasBridge(createMemoryTldrawTarget('canvas_001'))
    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_project',
      canvasId: 'canvas_001',
      actions: [
        {
          type: 'create_project_card',
          id: 'shape:project_1',
          x: 0,
          y: 0,
          title: 'Launch',
          actions: [{ id: 'action_ship', text: 'Ship' }]
        },
        {
          type: 'append_project_action',
          shapeId: 'shape:project_1',
          actionId: 'action_ship',
          text: 'Duplicate'
        },
        {
          type: 'set_project_action_done',
          shapeId: 'shape:project_1',
          actionId: 'action_ship',
          done: true
        }
      ]
    })

    if ('error' in response) throw new Error('expected action results')
    expect(response.result).toMatchObject({
      ok: false,
      results: [
        { actionType: 'create_project_card', createdShapeIds: ['shape:project_1'] },
        {
          actionType: 'append_project_action',
          error: 'Duplicate project action action_ship'
        },
        { actionType: 'set_project_action_done', updatedShapeIds: ['shape:project_1'] }
      ]
    })
    expect(response.observation.state.shapes[0].props.actions).toEqual([
      { id: 'action_ship', text: 'Ship', done: true }
    ])
  })

  it('returns an action-level error for unknown shapes', () => {
    const bridge = new CanvasBridge(createMemoryTldrawTarget('canvas_001'))

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_missing',
      canvasId: 'canvas_001',
      actions: [{ type: 'delete_shapes', shapeIds: ['shape:missing'] }]
    })

    if ('error' in response) {
      throw new Error('expected bridge response, received error')
    }

    expect(response.result.ok).toBe(false)
    expect(response.result.results[0]).toEqual({
      actionType: 'delete_shapes',
      error: 'Unknown shape shape:missing'
    })
  })

  it('returns a bridge error for invalid envelopes', () => {
    const bridge = new CanvasBridge(createMemoryTldrawTarget('canvas_001'))

    const response = bridge.handleActionEnvelope({
      type: 'canvas.action',
      requestId: 'req_invalid',
      canvasId: 'canvas_001',
      actions: [{ type: 'create_link_card', title: 'Bad', url: 'not a url', x: 0, y: 0 } as any]
    })

    expect(response).toMatchObject({
      error: {
        type: 'canvas.error',
        requestId: 'req_invalid'
      }
    })
  })
})
