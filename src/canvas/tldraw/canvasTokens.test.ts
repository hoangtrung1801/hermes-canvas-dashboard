import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = () => readFileSync('src/canvas/tldraw/canvasTokens.css', 'utf8')

describe('canvas token layer', () => {
  it('scopes the tokens to the tldraw container so they cannot collide with the dark dashboard tokens', () => {
    expect(tokens()).toMatch(/^\.tl-container \{/m)
  })

  it('defines the full vocabulary', () => {
    const css = tokens()
    for (const token of [
      '--hc-surface',
      '--hc-ink',
      '--hc-ink-strong',
      '--hc-ink-muted',
      '--hc-line',
      '--hc-accent',
      '--hc-tint',
      '--hc-pad',
      '--hc-gap',
      '--hc-radius',
      '--hc-shadow'
    ]) {
      expect(css).toContain(`${token}:`)
    }
  })

  it('derives the tint from the accent rather than hardcoding it', () => {
    expect(tokens()).toMatch(/--hc-tint:\s*color-mix\([^)]*var\(--hc-accent\)/)
  })

  it('is imported by the app entry point', () => {
    expect(readFileSync('src/main.tsx', 'utf8')).toMatch(/canvasTokens\.css/)
  })
})
