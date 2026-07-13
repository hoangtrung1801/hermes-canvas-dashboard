import { describe, expect, it } from 'vitest'
import { createTidyCardLayout, type TidyCardShape } from './tidyCardLayout'

function shape(
  id: string,
  type: string,
  x: number,
  y: number,
  props: Record<string, unknown>
): TidyCardShape {
  return { id, type, x, y, props }
}

describe('createTidyCardLayout', () => {
  it('arranges todo, note, and link cards into type columns', () => {
    const result = createTidyCardLayout([
      shape('shape:project_1', 'project_card', 100, 300, { w: 360, h: 320 }),
      shape('shape:link_1', 'link_card', 900, 500, { w: 300, h: 120 }),
      shape('shape:todo_2', 'todo_block', 500, 400, { w: 360, h: 240 }),
      shape('shape:note_1', 'geo', 300, 200, { geo: 'rectangle', w: 320, h: 180 }),
      shape('shape:todo_1', 'todo_block', 700, 100, { w: 320, h: 220 })
    ])

    expect(result).toEqual([
      { id: 'shape:project_1', type: 'project_card', x: 100, y: 100 },
      { id: 'shape:todo_1', type: 'todo_block', x: 516, y: 100 },
      { id: 'shape:todo_2', type: 'todo_block', x: 516, y: 352 },
      { id: 'shape:note_1', type: 'geo', x: 932, y: 100 },
      { id: 'shape:link_1', type: 'link_card', x: 1308, y: 100 }
    ])
  })

  it('ignores shapes that are not supported card components', () => {
    expect(
      createTidyCardLayout([
        shape('shape:arrow_1', 'arrow', 0, 0, {}),
        shape('shape:ellipse_1', 'geo', 10, 10, { geo: 'ellipse', w: 100, h: 100 })
      ])
    ).toEqual([])
  })
})
