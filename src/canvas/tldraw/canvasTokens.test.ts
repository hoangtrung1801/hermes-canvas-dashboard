import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = () => readFileSync('src/canvas/tldraw/canvasTokens.css', 'utf8')

describe('canvas token layer', () => {
  it('scopes the tokens away from :root so they cannot collide with the dark dashboard tokens', () => {
    expect(tokens()).toMatch(/^\.tl-container,/m)
    expect(tokens()).not.toMatch(/^:root/m)
  })

  it('also covers the portal roots, which render outside .tl-container', () => {
    const css = tokens()
    expect(css).toMatch(/^\.hermes-modal-backdrop,/m)
    expect(css).toMatch(/^\.hermes-docs-reader-backdrop \{/m)
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
      '--hc-accent-ink',
      '--hc-pad',
      '--hc-gap',
      '--hc-radius',
      '--hc-shadow'
    ]) {
      expect(css).toContain(`${token}:`)
    }
  })

  it('derives the readable ink from the accent rather than hardcoding it', () => {
    expect(tokens()).toMatch(/--hc-accent-ink:\s*color-mix\([^)]*var\(--hc-accent\)/)
  })

  it('re-declares the accent derivations on .hermes-shape so the per-shape override applies', () => {
    // Custom properties inherit their already-substituted value, so a
    // derivation declared only on the container would freeze at the default
    // accent and every card would look identical.
    const shapeRule = readFileSync('src/styles.css', 'utf8').match(
      /^\.hermes-shape \{(?<body>[\s\S]*?)\n\}/m
    )?.groups?.body ?? ''

    expect(shapeRule).toMatch(/--hc-accent-ink:\s*color-mix\([^)]*var\(--hc-accent\)/)
    expect(shapeRule).toMatch(/background:\s*color-mix\([^)]*var\(--hc-accent\)/)
  })

  it('is imported by the app entry point', () => {
    expect(readFileSync('src/main.tsx', 'utf8')).toMatch(/canvasTokens\.css/)
  })
})
