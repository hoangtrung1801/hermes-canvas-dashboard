import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('card colour discipline', () => {
  it('routes every .hermes-* colour through a token', () => {
    const css = readFileSync('src/styles.css', 'utf8')

    // Collect each .hermes-* rule body and look for raw hex literals.
    const offenders: string[] = []
    const rulePattern = /^(\.hermes-[^{]*)\{([^}]*)\}/gm

    for (const match of css.matchAll(rulePattern)) {
      const [, selector, body] = match
      if (/#[0-9a-fA-F]{3,8}\b/.test(body)) offenders.push(selector.trim())
    }

    expect(offenders).toEqual([])
  })
})
