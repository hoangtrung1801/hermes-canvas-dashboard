import { describe, expect, it } from 'vitest'
import type { CanvasAction } from '../actions/canvasAction.types'
import { createMemoryTldrawTarget, executeTldrawAction, readTldrawObservation } from './tldrawActionExecutor'

describe('tldraw action executor', () => {
  it('creates, updates, moves, deletes, and reads shapes', () => {
    const target = createMemoryTldrawTarget('canvas_001')
    const actions: CanvasAction[] = [
      {
        type: 'create_task_card',
        id: 'shape:task_1',
        title: 'Task',
        body: 'Body',
        backgroundColor: '#fef3c7',
        x: 100,
        y: 120
      },
      { type: 'update_shape', shapeId: 'shape:task_1', patch: { props: { priority: 'high' } } },
      { type: 'move_shapes', shapeIds: ['shape:task_1'], dx: 20, dy: 10 },
      { type: 'read_canvas' }
    ]

    const results = actions.map((action) => executeTldrawAction(target, action))

    expect(results).toEqual([
      { actionType: 'create_task_card', createdShapeIds: ['shape:task_1'] },
      { actionType: 'update_shape', updatedShapeIds: ['shape:task_1'] },
      { actionType: 'move_shapes', updatedShapeIds: ['shape:task_1'] },
      { actionType: 'read_canvas' }
    ])
    expect(readTldrawObservation(target)).toMatchObject({
      canvasId: 'canvas_001',
      shapes: [
        {
          id: 'shape:task_1',
          type: 'task_card',
          x: 120,
          y: 130,
          props: { title: 'Task', body: 'Body', priority: 'high', backgroundColor: '#fef3c7' }
        }
      ]
    })

    expect(executeTldrawAction(target, { type: 'delete_shapes', shapeIds: ['shape:task_1'] })).toEqual({
      actionType: 'delete_shapes',
      deletedShapeIds: ['shape:task_1']
    })
    expect(readTldrawObservation(target).shapes).toEqual([])
  })

  it('mutates todo task props through helper actions', () => {
    const target = createMemoryTldrawTarget('canvas_001')

    executeTldrawAction(target, { type: 'create_todo_block', id: 'shape:todo_1', title: 'Todo', x: 0, y: 0 })

    expect(
      executeTldrawAction(target, {
        type: 'append_todo_task',
        shapeId: 'shape:todo_1',
        taskId: 'task_ship',
        text: 'Ship'
      })
    ).toEqual({ actionType: 'append_todo_task', updatedShapeIds: ['shape:todo_1'] })
    expect(
      executeTldrawAction(target, {
        type: 'set_todo_task_done',
        shapeId: 'shape:todo_1',
        taskId: 'task_ship',
        done: true
      })
    ).toEqual({ actionType: 'set_todo_task_done', updatedShapeIds: ['shape:todo_1'] })

    expect(readTldrawObservation(target).shapes[0].props).toMatchObject({
      tasks: [{ id: 'task_ship', text: 'Ship', done: true }]
    })
  })

  it('creates native tldraw note cards with formatted rich text', () => {
    const target = createMemoryTldrawTarget('canvas_001')

    expect(
      executeTldrawAction(target, {
        type: 'create_note_card',
        id: 'shape:note_1',
        title: 'Offline Sync',
        tag: 'Idea',
        content: 'Queue writes locally\nFlush when online',
        color: 'light-blue',
        size: 'l',
        x: 240,
        y: 260
      })
    ).toEqual({ actionType: 'create_note_card', createdShapeIds: ['shape:note_1'] })

    expect(readTldrawObservation(target)).toMatchObject({
      canvasId: 'canvas_001',
      shapes: [
        {
          id: 'shape:note_1',
          type: 'note',
          x: 240,
          y: 260,
          props: {
            color: 'light-blue',
            size: 'l',
            richText: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Offline Sync', marks: [{ type: 'bold' }] }]
                },
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Idea', marks: [{ type: 'bold' }] }]
                },
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Queue writes locally' }]
                },
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Flush when online' }]
                }
              ]
            }
          }
        }
      ]
    })
  })

  it('returns action-level errors for unknown shapes and unsupported headless editor actions', () => {
    const target = createMemoryTldrawTarget('canvas_001')

    expect(executeTldrawAction(target, { type: 'delete_shapes', shapeIds: ['shape:missing'] })).toEqual({
      actionType: 'delete_shapes',
      error: 'Unknown shape shape:missing'
    })
    expect(executeTldrawAction(target, { type: 'select_shapes', shapeIds: ['shape:missing'] })).toEqual({
      actionType: 'select_shapes',
      error: 'select_shapes requires a mounted tldraw editor'
    })
  })
})
