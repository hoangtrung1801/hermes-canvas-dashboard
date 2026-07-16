import MarkdownIt from 'markdown-it'

export type DocsMarkdownResult = {
  html: string
  error: string | null
}

const markdown = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: false,
  typographer: false
})

export function renderDocsMarkdown(content: string): DocsMarkdownResult {
  if (!content) return { html: '', error: null }

  try {
    return { html: markdown.render(content), error: null }
  } catch (error) {
    return {
      html: '',
      error: error instanceof Error ? error.message : 'Unable to render Markdown'
    }
  }
}
