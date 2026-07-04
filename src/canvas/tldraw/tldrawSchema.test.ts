import { describe, expect, it } from 'vitest'
import { createHermesTldrawSchema } from './tldrawSchema'

describe('createHermesTldrawSchema', () => {
  it('creates a schema that knows the project custom shape types', () => {
    const schema = createHermesTldrawSchema()

    expect(Object.keys(schema.types)).toEqual(
      expect.arrayContaining(['shape', 'binding', 'asset', 'document', 'page'])
    )
  })
})
