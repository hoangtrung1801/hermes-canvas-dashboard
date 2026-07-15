import { describe, expect, it } from 'vitest'
import {
  AUTO_FRAME_META_KEY,
  planAutoFrameLayout,
  type AutoFrameLayoutShape,
  type AutoFrameCardKind
} from './autoFrameLayout'

const PAGE_ID = 'page:page'

function shape(
  id: string,
  type: string,
  x: number,
  y: number,
  props: Record<string, unknown> = {},
  input: Partial<Pick<AutoFrameLayoutShape, 'parentId' | 'pageX' | 'pageY' | 'meta'>> = {}
): AutoFrameLayoutShape {
  return {
    id,
    type,
    parentId: input.parentId ?? PAGE_ID,
    x,
    y,
    pageX: input.pageX ?? x,
    pageY: input.pageY ?? y,
    props,
    meta: input.meta ?? {}
  }
}

function frame(
  id: string,
  kind: AutoFrameCardKind | null,
  x = 0,
  y = 0,
  props: Record<string, unknown> = { w: 400, h: 240, name: 'Frame', color: 'grey' }
) {
  return shape(id, 'frame', x, y, props, {
    meta: kind ? { [AUTO_FRAME_META_KEY]: { version: 1, kind } } : {}
  })
}

describe('planAutoFrameLayout', () => {
  it('creates one managed frame for every supported page-level card kind', () => {
    const plan = planAutoFrameLayout({
      pageId: PAGE_ID,
      mode: 'continuous',
      shapes: [
        shape('shape:project', 'project_card', 0, 0, { w: 960, h: 480 }),
        shape('shape:todo', 'todo_block', 1000, 0, { w: 320, h: 180 }),
        shape('shape:note', 'geo', 1400, 0, { geo: 'rectangle', w: 320, h: 180 }),
        shape('shape:link', 'link_card', 1800, 0, { w: 320, h: 180 }),
        shape('shape:ellipse', 'geo', 2200, 0, { geo: 'ellipse', w: 320, h: 180 })
      ]
    })

    expect(plan.frames.map(({ kind, title }) => ({ kind, title }))).toEqual([
      { kind: 'project', title: 'Projects' },
      { kind: 'todo', title: 'Todos' },
      { kind: 'note', title: 'Notes' },
      { kind: 'link', title: 'Links' }
    ])
    expect(plan.cardUpdates.map(({ id }) => id)).not.toContain('shape:ellipse')
  })

  it('leaves cards inside user-created frames untouched', () => {
    const manual = frame('shape:manual', null)
    const plan = planAutoFrameLayout({
      pageId: PAGE_ID,
      mode: 'continuous',
      shapes: [
        manual,
        shape('shape:todo', 'todo_block', 32, 64, { w: 320, h: 180 }, {
          parentId: manual.id,
          pageX: 132,
          pageY: 164
        })
      ]
    })

    expect(plan.frames).toEqual([])
    expect(plan.cardUpdates).toEqual([])
    expect(plan.deleteFrameIds).toEqual([])
  })

  it('lays non-project cards out in a tight two-column grid', () => {
    const plan = planAutoFrameLayout({
      pageId: PAGE_ID,
      mode: 'continuous',
      shapes: [
        shape('shape:todo_c', 'todo_block', 0, 500, { w: 320, h: 180 }),
        shape('shape:todo_b', 'todo_block', 500, 0, { w: 320, h: 180 }),
        shape('shape:todo_a', 'todo_block', 0, 0, { w: 320, h: 180 })
      ]
    })

    expect(plan.cardUpdates).toEqual([
      expect.objectContaining({ id: 'shape:todo_a', x: 32, y: 64 }),
      expect.objectContaining({ id: 'shape:todo_b', x: 376, y: 64 }),
      expect.objectContaining({ id: 'shape:todo_c', x: 32, y: 268 })
    ])
    expect(plan.frames[0]).toMatchObject({ w: 728, h: 480 })
  })

  it('keeps projects in one column and falls back for invalid dimensions', () => {
    const plan = planAutoFrameLayout({
      pageId: PAGE_ID,
      mode: 'continuous',
      shapes: [
        shape('shape:project_2', 'project_card', 100, 600, { w: Number.NaN, h: -1 }),
        shape('shape:project_1', 'project_card', 100, 100, { w: 960, h: 480 })
      ]
    })

    expect(plan.cardUpdates).toEqual([
      expect.objectContaining({ id: 'shape:project_1', x: 32, y: 64 }),
      expect.objectContaining({ id: 'shape:project_2', x: 32, y: 568 })
    ])
    expect(plan.frames[0]).toMatchObject({ w: 1024, h: 780 })
  })

  it('is idempotent after cards and their generated frame are settled', () => {
    const generated = frame(
      'shape:hermes-auto-frame-page-page-todo',
      'todo',
      100,
      200,
      { w: 400, h: 276, name: 'Todos', color: 'yellow' }
    )
    const plan = planAutoFrameLayout({
      pageId: PAGE_ID,
      mode: 'continuous',
      shapes: [
        generated,
        shape('shape:todo', 'todo_block', 32, 64, { w: 320, h: 180 }, {
          parentId: generated.id,
          pageX: 132,
          pageY: 264
        })
      ]
    })

    expect(plan.frames).toEqual([
      expect.objectContaining({ id: generated.id, x: 100, y: 200, w: 400, h: 276, create: false })
    ])
    expect(plan.cardUpdates).toEqual([])
  })

  it('deletes empty and duplicate managed frames without touching manual frames', () => {
    const canonical = frame('shape:hermes-auto-frame-page-page-todo', 'todo')
    const duplicate = frame('shape:auto-todo-copy', 'todo', 500)
    const emptyLink = frame('shape:auto-link', 'link', 1000)
    const manual = frame('shape:manual', null, 1500)
    const plan = planAutoFrameLayout({
      pageId: PAGE_ID,
      mode: 'continuous',
      shapes: [
        canonical,
        duplicate,
        emptyLink,
        manual,
        shape('shape:todo', 'todo_block', 32, 64, { w: 320, h: 180 }, {
          parentId: duplicate.id,
          pageX: 532,
          pageY: 64
        })
      ]
    })

    expect(plan.frames[0].id).toBe(canonical.id)
    expect(plan.deleteFrameIds).toEqual(['shape:auto-todo-copy', 'shape:auto-link'])
    expect(plan.deleteFrameIds).not.toContain(manual.id)
  })

  it('demotes an otherwise-empty generated frame that contains unsupported children', () => {
    const generated = frame('shape:auto-todo', 'todo')
    const plan = planAutoFrameLayout({
      pageId: PAGE_ID,
      mode: 'continuous',
      shapes: [
        generated,
        shape('shape:arrow', 'arrow', 20, 20, {}, { parentId: generated.id })
      ]
    })

    expect(plan.deleteFrameIds).toEqual([])
    expect(plan.demoteFrameIds).toEqual([generated.id])
  })

  it('avoids generated frame id collisions and overlaps for new continuous frames', () => {
    const occupiedId = 'shape:hermes-auto-frame-page-page-todo'
    const existingProject = frame(
      'shape:hermes-auto-frame-page-page-project',
      'project',
      0,
      0,
      { w: 1024, h: 576, name: 'Projects', color: 'light-violet' }
    )
    const plan = planAutoFrameLayout({
      pageId: PAGE_ID,
      mode: 'continuous',
      shapes: [
        existingProject,
        shape('shape:project', 'project_card', 32, 64, { w: 960, h: 480 }, {
          parentId: existingProject.id,
          pageX: 32,
          pageY: 64
        }),
        shape(occupiedId, 'arrow', 2000, 2000),
        shape('shape:todo', 'todo_block', 100, 100, { w: 320, h: 180 })
      ]
    })

    const todoFrame = plan.frames.find(({ kind }) => kind === 'todo')!
    expect(todoFrame.id).toBe(`${occupiedId}-2`)
    expect(todoFrame.x).toBeGreaterThanOrEqual(existingProject.x + 1024 + 64)
  })

  it('packs generated frames into ordered rows in tidy mode', () => {
    const plan = planAutoFrameLayout({
      pageId: PAGE_ID,
      mode: 'tidy',
      shapes: [
        shape('shape:project', 'project_card', 0, 0, { w: 2500, h: 480 }),
        shape('shape:todo', 'todo_block', 2800, 0, { w: 800, h: 180 }),
        shape('shape:note', 'geo', 0, 800, { geo: 'rectangle', w: 320, h: 180 }),
        shape('shape:link', 'link_card', 500, 800, { w: 320, h: 180 })
      ]
    })

    expect(plan.frames.map(({ kind }) => kind)).toEqual(['project', 'todo', 'note', 'link'])
    expect(plan.frames[1].y).toBeGreaterThan(plan.frames[0].y)
    expect(plan.frames[2].x).toBeGreaterThan(plan.frames[1].x)
  })
})
