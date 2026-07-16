import { describe, expect, it } from 'vitest'
import { canvasActionBatchSchema, canvasActionSchema } from './canvasAction.schema'

describe('tldraw canvas action schema', () => {
  it('accepts core tldraw shape actions', () => {
    expect(
      canvasActionBatchSchema.parse([
        {
          type: 'create_shape',
          shape: {
            id: 'shape:box_1',
            type: 'geo',
            x: 100,
            y: 120,
            props: { w: 240, h: 140, geo: 'rectangle' }
          }
        },
        {
          type: 'update_shape',
          shapeId: 'shape:box_1',
          patch: { x: 140, props: { w: 300 } }
        },
        {
          type: 'delete_shapes',
          shapeIds: ['shape:box_1']
        }
      ])
    ).toHaveLength(3)
  })

  it('accepts project custom shape helper actions', () => {
    expect(
      canvasActionSchema.parse({
        type: 'create_todo_block',
        id: 'shape:todo_1',
        x: 80,
        y: 100,
        title: 'Launch',
        backgroundColor: '#fee2e2',
        tasks: [{ id: 'task_copy', text: 'Write copy', done: false }]
      })
    ).toMatchObject({ type: 'create_todo_block', title: 'Launch', backgroundColor: '#fee2e2' })

    expect(
      canvasActionSchema.parse({
        type: 'create_link_card',
        id: 'shape:link_1',
        x: 120,
        y: 320,
        title: 'Docs',
        url: 'https://tldraw.dev',
        imageUrl: 'https://tldraw.dev/preview.png',
        backgroundColor: '#ecfccb'
      })
    ).toMatchObject({
      type: 'create_link_card',
      title: 'Docs',
      imageUrl: 'https://tldraw.dev/preview.png',
      backgroundColor: '#ecfccb'
    })

    expect(() =>
      canvasActionSchema.parse({
        type: 'create_link_card',
        x: 120,
        y: 320,
        title: 'Unsafe preview',
        url: 'https://example.com',
        imageUrl: 'javascript:alert(1)'
      })
    ).toThrow()
  })

  it('accepts note card helper actions', () => {
    expect(
      canvasActionSchema.parse({
        type: 'create_note_card',
        id: 'shape:note_1',
        x: 180,
        y: 220,
        title: 'Offline Sync',
        tag: 'Idea',
        content: 'Queue writes locally\nFlush when online',
        color: 'yellow',
        size: 'm'
      })
    ).toMatchObject({
      type: 'create_note_card',
      title: 'Offline Sync',
      tag: 'Idea',
      content: 'Queue writes locally\nFlush when online',
      color: 'yellow',
      size: 'm'
    })
  })

  it('accepts Docs Card creation and partial updates', () => {
    expect(canvasActionSchema.parse({
      type: 'create_docs_card',
      title: 'Release notes',
      content: '# Notes',
      x: 20,
      y: 40
    })).toMatchObject({
      type: 'create_docs_card',
      title: 'Release notes',
      content: '# Notes'
    })

    expect(canvasActionSchema.parse({
      type: 'update_docs_card',
      shapeId: 'shape:docs_1',
      content: '# Updated'
    })).toEqual({
      type: 'update_docs_card',
      shapeId: 'shape:docs_1',
      content: '# Updated'
    })
  })

  it('rejects blank Docs Card titles and empty updates', () => {
    expect(() => canvasActionSchema.parse({
      type: 'create_docs_card',
      title: ' ',
      x: 20,
      y: 40
    })).toThrow()

    expect(() => canvasActionSchema.parse({
      type: 'update_docs_card',
      shapeId: 'shape:docs_1'
    })).toThrow()
  })

  it('accepts and trims the complete project task-board contract', () => {
    const parsed = canvasActionBatchSchema.parse([
      {
        type: 'create_project_card',
        id: 'shape:project_1',
        x: 40,
        y: 80,
        title: '  Website launch  ',
        tasks: [
          { id: 'task_copy', text: '  Finish copy  ' },
          { text: 'Review', status: 'doing' }
        ],
        w: 1000,
        h: 520,
        color: 'light-violet'
      },
      {
        type: 'update_project_card',
        shapeId: 'shape:project_1',
        title: '  Release  '
      },
      {
        type: 'append_project_task',
        shapeId: 'shape:project_1',
        taskId: 'task_ship',
        text: '  Ship  '
      },
      {
        type: 'update_project_task_text',
        shapeId: 'shape:project_1',
        taskId: 'task_ship',
        text: '  Publish  '
      },
      {
        type: 'move_project_task',
        shapeId: 'shape:project_1',
        taskId: 'task_ship',
        status: 'done',
        beforeTaskId: null
      },
      {
        type: 'remove_project_task',
        shapeId: 'shape:project_1',
        taskId: 'task_ship'
      }
    ])

    expect(parsed).toMatchObject([
      {
        type: 'create_project_card',
        title: 'Website launch',
        tasks: [
          { text: 'Finish copy', status: 'todo' },
          { text: 'Review', status: 'doing' }
        ]
      },
      { type: 'update_project_card', title: 'Release' },
      { type: 'append_project_task', text: 'Ship', status: 'todo' },
      { type: 'update_project_task_text', text: 'Publish' },
      { type: 'move_project_task', status: 'done', beforeTaskId: null },
      { type: 'remove_project_task' }
    ])
  })

  it('rejects legacy project fields and invalid task-board payloads', () => {
    const invalid = [
      { type: 'create_project_card', x: 0, y: 0, title: '   ' },
      {
        type: 'create_project_card',
        x: 0,
        y: 0,
        title: 'Project',
        tasks: [
          { id: 'same', text: 'A' },
          { id: 'same', text: 'B' }
        ]
      },
      {
        type: 'create_project_card',
        x: 0,
        y: 0,
        title: 'Project',
        tasks: [{ text: 'A', status: 'paused' }]
      },
      { type: 'create_project_card', x: 0, y: 0, title: 'Project', status: 'active' },
      { type: 'create_project_card', x: 0, y: 0, title: 'Project', priority: 'high' },
      { type: 'create_project_card', x: 0, y: 0, title: 'Project', dueDate: '2026-07-31' },
      { type: 'update_project_card', shapeId: 'shape:project_1', status: 'done' },
      {
        type: 'append_project_task',
        shapeId: 'shape:project_1',
        taskId: '',
        text: 'Ship'
      },
      {
        type: 'move_project_task',
        shapeId: 'shape:project_1',
        taskId: 'task_a',
        status: 'planned'
      },
      { type: 'append_project_action', shapeId: 'shape:project_1', actionId: 'a', text: 'Legacy' },
      { type: 'set_project_action_done', shapeId: 'shape:project_1', actionId: 'a', done: true }
    ]

    for (const action of invalid) {
      expect(() => canvasActionSchema.parse(action)).toThrow()
    }
  })

  it('rejects invalid note card helper actions', () => {
    expect(() =>
      canvasActionSchema.parse({
        type: 'create_note_card',
        x: 0,
        y: 0,
        title: '',
        tag: 'Idea'
      })
    ).toThrow()

    expect(() =>
      canvasActionSchema.parse({
        type: 'create_note_card',
        x: 0,
        y: 0,
        title: 'Draft',
        tag: ''
      })
    ).toThrow()

    expect(() =>
      canvasActionSchema.parse({
        type: 'create_note_card',
        x: 0,
        y: 0,
        title: 'Draft',
        tag: 'Idea',
        color: 'magenta'
      })
    ).toThrow()

    expect(() =>
      canvasActionSchema.parse({
        type: 'create_note_card',
        x: 0,
        y: 0,
        title: 'Draft',
        tag: 'Idea',
        size: 'xxl'
      })
    ).toThrow()
  })

  it('rejects empty action batches and malformed urls', () => {
    expect(() => canvasActionBatchSchema.parse([])).toThrow()
    expect(() =>
      canvasActionSchema.parse({
        type: 'create_link_card',
        title: 'Bad',
        url: 'not a url',
        x: 0,
        y: 0
      })
    ).toThrow()
  })

  it('rejects removed task card helper actions', () => {
    const removedActionType = ['create', 'task', 'card'].join('_')

    expect(() =>
      canvasActionSchema.parse({
        type: removedActionType,
        id: 'shape:task_1',
        x: 120,
        y: 140,
        title: 'Design'
      })
    ).toThrow()
  })
})
