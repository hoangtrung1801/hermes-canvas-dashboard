import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function rule(pattern: RegExp) {
  return readFileSync('src/styles.css', 'utf8').match(pattern)?.groups?.body ?? ''
}

describe('docs card markdown scale', () => {
  it('compresses h1 so it cannot dwarf the body text', () => {
    const body = rule(/\.hermes-docs-content h1 \{(?<body>[\s\S]*?)\n\}/)
    expect(body).toMatch(/font-size:\s*calc\(var\(--hc-body\) \* 1\.25\)/)
    expect(body).toMatch(/font-weight:\s*700/)
  })

  it('scales h2 and h3 below h1', () => {
    expect(rule(/\.hermes-docs-content h2 \{(?<body>[\s\S]*?)\n\}/)).toMatch(
      /font-size:\s*calc\(var\(--hc-body\) \* 1\.12\)/
    )
    expect(rule(/\.hermes-docs-content h3 \{(?<body>[\s\S]*?)\n\}/)).toMatch(
      /font-size:\s*var\(--hc-body\)/
    )
  })

  it('styles the heading levels markdown-it can emit but the card never did', () => {
    const css = readFileSync('src/styles.css', 'utf8')
    expect(css).toMatch(/\.hermes-docs-content :where\(h4, h5, h6\)/)
  })
})
