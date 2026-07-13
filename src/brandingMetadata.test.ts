import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('index.html branding metadata', () => {
  it('publishes the updated title, description, and favicon', () => {
    const indexHtmlPath = resolve(process.cwd(), 'index.html')
    const indexHtml = readFileSync(indexHtmlPath, 'utf8')

    expect(indexHtml).toContain('<title>Hermes Canvas Productivity | Visual Workspace</title>')
    expect(indexHtml).toContain(
      'content="Hermes Canvas Productivity is a real-time visual workspace for planning, organizing, and executing agent-driven work on an infinite canvas."'
    )
    expect(indexHtml).toContain(
      '<link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />'
    )
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/hermes-canvas-icon.png" />')
  })
})
