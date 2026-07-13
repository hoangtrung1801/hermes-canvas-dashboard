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

  it('accepts and trims the complete project action contract', () => {
    const actions = [
      {
        type: 'create_project_card',
        id: 'shape:project_1',
        x: 40,
        y: 80,
        title: '  Website launch  ',
        status: 'active',
        priority: 'high',
        dueDate: '2026-07-31',
        actions: [{ id: 'action_copy', text: '  Finish copy  ' }],
        w: 420,
        h: 340,
        color: 'light-violet'
      },
      {
        type: 'update_project_card',
        shapeId: 'shape:project_1',
        status: 'blocked',
        dueDate: null
      },
      {
        type: 'append_project_action',
        shapeId: 'shape:project_1',
        actionId: 'action_ship',
        text: '  Ship  '
      },
      {
        type: 'update_project_action_text',
        shapeId: 'shape:project_1',
        actionId: 'action_ship',
        text: '  Publish  '
      },
      {
        type: 'set_project_action_done',
        shapeId: 'shape:project_1',
        actionId: 'action_copy',
        done: true
      },
      {
        type: 'remove_project_action',
        shapeId: 'shape:project_1',
        actionId: 'action_ship'
      }
    ]

    expect(canvasActionBatchSchema.parse(actions)).toMatchObject([
      {
        type: 'create_project_card',
        title: 'Website launch',
        actions: [{ text: 'Finish copy' }]
      },
      { type: 'update_project_card', dueDate: null },
      { type: 'append_project_action', text: 'Ship' },
      { type: 'update_project_action_text', text: 'Publish' },
      { type: 'set_project_action_done', done: true },
      { type: 'remove_project_action' }
    ])
  })

  it('rejects invalid project fields and empty metadata updates', () => {
    const invalid = [
      { type: 'create_project_card', x: 0, y: 0, title: '   ' },
      { type: 'create_project_card', x: 0, y: 0, title: 'Project', status: 'paused' },
      { type: 'create_project_card', x: 0, y: 0, title: 'Project', priority: 'urgent' },
      { type: 'create_project_card', x: 0, y: 0, title: 'Project', dueDate: '2026-02-30' },
      {
        type: 'create_project_card',
        x: 0,
        y: 0,
        title: 'Project',
        actions: [
          { id: 'same', text: 'A' },
          { id: 'same', text: 'B' }
        ]
      },
      { type: 'update_project_card', shapeId: 'shape:project_1' },
      {
        type: 'append_project_action',
        shapeId: 'shape:project_1',
        actionId: '',
        text: 'Ship'
      },
      {
        type: 'update_project_action_text',
        shapeId: 'shape:project_1',
        actionId: 'a',
        text: '   '
      }
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
