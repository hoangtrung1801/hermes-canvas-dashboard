import { describe, expect, it } from 'vitest'
import type { CanvasAction } from '../actions/canvasAction.types'
import { createMemoryTldrawTarget, executeTldrawAction, readTldrawObservation } from './tldrawActionExecutor'

describe('tldraw action executor', () => {
  it('includes mounted editor viewport bounds in observations', () => {
    const target = createMemoryTldrawTarget('canvas_001')
    target.editor = {
      getCurrentPageShapesSorted: () => [],
      getSelectedShapeIds: () => [],
      getCamera: () => ({ x: 1, y: 2, z: 1 }),
      getViewportPageBounds: () => ({ x: 10, y: 20, w: 800, h: 600 })
    } as never

    expect(readTldrawObservation(target).viewportPageBounds).toEqual({
      x: 10,
      y: 20,
      w: 800,
      h: 600
    })
  })

  it('creates, updates, moves, deletes, and reads shapes', () => {
    const target = createMemoryTldrawTarget('canvas_001')
    const actions: CanvasAction[] = [
      {
        type: 'create_link_card',
        id: 'shape:link_1',
        title: 'Docs',
        url: 'https://tldraw.dev',
        description: 'SDK docs',
        imageUrl: 'https://tldraw.dev/preview.png',
        backgroundColor: '#ecfccb',
        x: 100,
        y: 120
      },
      { type: 'update_shape', shapeId: 'shape:link_1', patch: { props: { description: 'Updated docs' } } },
      { type: 'move_shapes', shapeIds: ['shape:link_1'], dx: 20, dy: 10 },
      { type: 'read_canvas' }
    ]

    const results = actions.map((action) => executeTldrawAction(target, action))

    expect(results).toEqual([
      { actionType: 'create_link_card', createdShapeIds: ['shape:link_1'] },
      { actionType: 'update_shape', updatedShapeIds: ['shape:link_1'] },
      { actionType: 'move_shapes', updatedShapeIds: ['shape:link_1'] },
      { actionType: 'read_canvas' }
    ])
    expect(readTldrawObservation(target)).toMatchObject({
      canvasId: 'canvas_001',
      shapes: [
        {
          id: 'shape:link_1',
          type: 'link_card',
          x: 120,
          y: 130,
          props: {
            title: 'Docs',
            url: 'https://tldraw.dev',
            description: 'Updated docs',
            imageUrl: 'https://tldraw.dev/preview.png',
            backgroundColor: '#ecfccb'
          }
        }
      ]
    })

    expect(executeTldrawAction(target, { type: 'delete_shapes', shapeIds: ['shape:link_1'] })).toEqual({
      actionType: 'delete_shapes',
      deletedShapeIds: ['shape:link_1']
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

  it('creates and mutates an ordered project task board', () => {
    const target = createMemoryTldrawTarget('canvas_001')
    const actions: CanvasAction[] = [
      {
        type: 'create_project_card',
        id: 'shape:project_1',
        x: 40,
        y: 80,
        title: 'Launch',
        tasks: [{ id: 'task_copy', text: 'Write copy' }]
      },
      {
        type: 'append_project_task',
        shapeId: 'shape:project_1',
        taskId: 'task_ship',
        text: 'Ship'
      },
      {
        type: 'update_project_task_text',
        shapeId: 'shape:project_1',
        taskId: 'task_ship',
        text: 'Publish'
      },
      {
        type: 'move_project_task',
        shapeId: 'shape:project_1',
        taskId: 'task_ship',
        status: 'doing'
      },
      {
        type: 'update_project_card',
        shapeId: 'shape:project_1',
        title: 'Release'
      },
      {
        type: 'remove_project_task',
        shapeId: 'shape:project_1',
        taskId: 'task_copy'
      }
    ]

    expect(actions.map((action) => executeTldrawAction(target, action))).toEqual([
      { actionType: 'create_project_card', createdShapeIds: ['shape:project_1'] },
      { actionType: 'append_project_task', updatedShapeIds: ['shape:project_1'] },
      { actionType: 'update_project_task_text', updatedShapeIds: ['shape:project_1'] },
      { actionType: 'move_project_task', updatedShapeIds: ['shape:project_1'] },
      { actionType: 'update_project_card', updatedShapeIds: ['shape:project_1'] },
      { actionType: 'remove_project_task', updatedShapeIds: ['shape:project_1'] }
    ])
    expect(readTldrawObservation(target).shapes[0]).toMatchObject({
      id: 'shape:project_1',
      type: 'project_card',
      x: 40,
      y: 80,
      w: 960,
      h: 480,
      props: {
        title: 'Release',
        tasks: [{ id: 'task_ship', text: 'Publish', status: 'doing' }]
      }
    })
  })

  it('returns stable project task-level errors without mutation', () => {
    const target = createMemoryTldrawTarget('canvas_001')
    executeTldrawAction(target, {
      type: 'create_project_card',
      id: 'shape:project_1',
      x: 0,
      y: 0,
      title: 'Launch',
      tasks: [
        { id: 'task_ship', text: 'Ship' },
        { id: 'task_review', text: 'Review', status: 'doing' }
      ]
    })

    expect(
      executeTldrawAction(target, {
        type: 'append_project_task',
        shapeId: 'shape:project_1',
        taskId: 'task_ship',
        text: 'Duplicate'
      })
    ).toEqual({
      actionType: 'append_project_task',
      error: 'Duplicate project task task_ship'
    })
    expect(
      executeTldrawAction(target, {
        type: 'move_project_task',
        shapeId: 'shape:project_1',
        taskId: 'missing',
        status: 'done'
      })
    ).toEqual({
      actionType: 'move_project_task',
      error: 'Unknown project task missing'
    })
    expect(
      executeTldrawAction(target, {
        type: 'move_project_task',
        shapeId: 'shape:project_1',
        taskId: 'task_ship',
        status: 'doing',
        beforeTaskId: 'task_ship'
      })
    ).toEqual({
      actionType: 'move_project_task',
      error: 'Project task cannot move before itself'
    })
    expect(
      executeTldrawAction(target, {
        type: 'update_project_card',
        shapeId: 'shape:missing',
        title: 'Missing'
      })
    ).toEqual({
      actionType: 'update_project_card',
      error: 'Unknown project card shape:missing'
    })
  })

  it('creates built-in rectangle note cards with formatted rich text', () => {
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
          type: 'geo',
          x: 240,
          y: 260,
          props: {
            geo: 'rectangle',
            color: 'light-blue',
            size: 'l',
            richText: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Idea' }]
                },
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Offline Sync', marks: [{ type: 'bold' }] }]
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

  it('creates and updates a Docs Card in the memory executor', () => {
    const target = createMemoryTldrawTarget('canvas_001')

    expect(executeTldrawAction(target, {
      type: 'create_docs_card',
      id: 'shape:docs_1',
      title: '  Release notes ',
      content: '# Draft',
      x: 100,
      y: 120,
      w: 200,
      h: 200
    })).toEqual({
      actionType: 'create_docs_card',
      createdShapeIds: ['shape:docs_1']
    })

    expect(target.shapes.get('shape:docs_1')).toMatchObject({
      type: 'docs_card',
      x: 100,
      y: 120,
      props: {
        title: 'Release notes',
        content: '# Draft',
        w: 320,
        h: 360
      }
    })

    expect(executeTldrawAction(target, {
      type: 'update_docs_card',
      shapeId: 'shape:docs_1',
      content: '# Published'
    })).toEqual({
      actionType: 'update_docs_card',
      updatedShapeIds: ['shape:docs_1']
    })

    expect(target.shapes.get('shape:docs_1')?.props.content).toBe('# Published')
  })

  it('returns Docs Card update errors without mutation', () => {
    const target = createMemoryTldrawTarget('canvas_001')
    expect(executeTldrawAction(target, {
      type: 'update_docs_card',
      shapeId: 'shape:missing',
      title: 'Updated'
    })).toEqual({
      actionType: 'update_docs_card',
      error: 'Unknown docs card shape:missing'
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
