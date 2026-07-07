import type { TLDefaultColorStyle, TLDefaultSizeStyle, TLGeoShapeProps, TLRichText } from 'tldraw'

type NoteCardInput = {
  title: string
  tag: string
  content?: string
  color?: TLDefaultColorStyle
  size?: TLDefaultSizeStyle
}

function boldParagraph(text: string) {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text, marks: [{ type: 'bold' }] }]
  }
}

function contentParagraph(text: string) {
  if (!text) return { type: 'paragraph' }
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }]
  }
}

export function createNoteCardRichText(input: Pick<NoteCardInput, 'title' | 'tag' | 'content'>): TLRichText {
  const contentLines = input.content ? input.content.split('\n') : []

  return {
    type: 'doc',
    content: [
      boldParagraph(input.title),
      boldParagraph(input.tag),
      ...contentLines.map(contentParagraph)
    ]
  }
}

export function createNoteCardProps(input: NoteCardInput): TLGeoShapeProps {
  return {
    geo: 'rectangle',
    w: 320,
    h: 180,
    color: input.color ?? 'yellow',
    labelColor: 'black',
    size: input.size ?? 'm',
    font: 'draw',
    fill: 'solid',
    dash: 'draw',
    align: 'start',
    verticalAlign: 'start',
    growY: 0,
    url: '',
    richText: createNoteCardRichText(input),
    scale: 1
  }
}
