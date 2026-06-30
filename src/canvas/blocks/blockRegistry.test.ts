import { describe, expect, it } from 'vitest'
import { blockRegistry } from './blockRegistry'

describe('blockRegistry', () => {
  it('returns defaults for supported block types', () => {
    expect(blockRegistry.todo_block.defaultProps).toEqual({ tasks: [] })
    expect(blockRegistry.task_card.defaultSize).toEqual({ w: 280, h: 160 })
    expect(blockRegistry.link_card.defaultProps).toEqual({ url: '' })
  })
})
