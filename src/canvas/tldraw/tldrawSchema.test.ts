import { describe, expect, it } from 'vitest'
import { createHermesTldrawSchema } from './tldrawSchema'

describe('createHermesTldrawSchema', () => {
  it('creates a schema for supported custom shape types only', () => {
    const schema = createHermesTldrawSchema()

    expect(Object.keys(schema.types)).toEqual(
      expect.arrayContaining(['shape', 'binding', 'asset', 'document', 'page'])
    )
    expect(JSON.stringify(schema)).toContain('todo_block')
    expect(JSON.stringify(schema)).toContain('link_card')
    expect(JSON.stringify(schema)).not.toContain(['task', 'card'].join('_'))
  })
})
