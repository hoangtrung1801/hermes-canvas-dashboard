import { describe, expect, it } from 'vitest'
import { renderDocsMarkdown } from './docsMarkdown'

describe('renderDocsMarkdown', () => {
  it('renders common Markdown blocks', () => {
    const result = renderDocsMarkdown(
      '# Heading\n\n**bold** and *italic*\n\n- one\n- two\n\n> quote\n\n`code`\n\n```ts\nconst ready = true\n```'
    )

    expect(result.error).toBeNull()
    expect(result.html).toContain('<h1>Heading</h1>')
    expect(result.html).toContain('<strong>bold</strong>')
    expect(result.html).toContain('<em>italic</em>')
    expect(result.html).toContain('<ul>')
    expect(result.html).toContain('<blockquote>')
    expect(result.html).toContain('<code>code</code>')
    expect(result.html).toContain('<pre><code class="language-ts">')
  })

  it('does not pass raw HTML through', () => {
    const result = renderDocsMarkdown('<script>alert(1)</script><b>raw</b>')
    expect(result.error).toBeNull()
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('<b>')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('rejects unsafe links while preserving their label', () => {
    const result = renderDocsMarkdown('[bad](javascript:alert(1)) [good](https://example.com)')
    expect(result.html).not.toContain('<a href="javascript:')
    expect(result.html).toContain('https://example.com')
    expect(result.html).toContain('>good</a>')
  })

  it('returns an empty result for empty content', () => {
    expect(renderDocsMarkdown('')).toEqual({ html: '', error: null })
  })
})
