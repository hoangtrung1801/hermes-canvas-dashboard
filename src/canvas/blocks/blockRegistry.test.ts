import { describe, expect, it } from 'vitest'
import { blockRegistry } from './blockRegistry'

describe('blockRegistry', () => {
  it('returns defaults for supported block types', () => {
    expect(blockRegistry.task_card.defaultSize).toEqual({ w: 280, h: 160 })
    expect(blockRegistry.link_card.defaultProps).toEqual({ url: '' })
  })
})
