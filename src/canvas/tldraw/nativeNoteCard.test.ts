import { describe, expect, it } from 'vitest'
import { createNoteCardProps } from './nativeNoteCard'

describe('note card rectangle props', () => {
  it('creates default tldraw rectangle props with bold title and tag paragraphs', () => {
    const props = createNoteCardProps({
      title: 'Offline Sync',
      tag: 'Idea',
      content: 'Queue writes locally'
    })

    expect(props).toMatchObject({
      geo: 'rectangle',
      w: 320,
      h: 180,
      color: 'yellow',
      labelColor: 'black',
      size: 'm',
      font: 'draw',
      fill: 'solid',
      dash: 'draw',
      align: 'start',
      verticalAlign: 'start',
      growY: 0,
      url: '',
      scale: 1
    })
    expect(props.richText).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Offline Sync', marks: [{ type: 'bold' }] }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Idea', marks: [{ type: 'bold' }] }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Queue writes locally' }]
        }
      ]
    })
  })

  it('preserves content line breaks as normal rich text paragraphs', () => {
    expect(
      createNoteCardProps({
        title: 'Research',
        tag: 'Note',
        content: 'Line one\n\nLine three',
        color: 'light-blue',
        size: 'l'
      })
    ).toMatchObject({
      color: 'light-blue',
      size: 'l',
      richText: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Research', marks: [{ type: 'bold' }] }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Note', marks: [{ type: 'bold' }] }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Line one' }]
          },
          {
            type: 'paragraph'
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Line three' }]
          }
        ]
      }
    })
  })

  it('omits content paragraphs when content is empty', () => {
    expect(
      createNoteCardProps({
        title: 'Quick capture',
        tag: 'Idea',
        content: ''
      }).richText.content
    ).toHaveLength(2)
  })
})
