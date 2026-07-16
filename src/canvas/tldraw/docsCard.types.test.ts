import { describe, expect, it } from 'vitest'
import {
  createDocsCardProps,
  fitDocsCardDimensions,
  DOCS_CARD_DEFAULT_HEIGHT,
  DOCS_CARD_DEFAULT_WIDTH,
  DOCS_CARD_MIN_HEIGHT,
  DOCS_CARD_MIN_WIDTH
} from './docsCard.types'

describe('Docs Card model', () => {
  it('creates the portrait default without changing Markdown source', () => {
    expect(createDocsCardProps({
      title: '  Release notes  ',
      content: '# Heading\n\n- Item'
    })).toEqual({
      w: DOCS_CARD_DEFAULT_WIDTH,
      h: DOCS_CARD_DEFAULT_HEIGHT,
      title: 'Release notes',
      content: '# Heading\n\n- Item'
    })
  })

  it('fits each dimension independently to the minimum bounds', () => {
    expect(fitDocsCardDimensions(100, 200)).toEqual({
      w: DOCS_CARD_MIN_WIDTH,
      h: DOCS_CARD_MIN_HEIGHT
    })
    expect(fitDocsCardDimensions(700, 900)).toEqual({ w: 700, h: 900 })
    expect(fitDocsCardDimensions(undefined, undefined)).toEqual({
      w: DOCS_CARD_DEFAULT_WIDTH,
      h: DOCS_CARD_DEFAULT_HEIGHT
    })
  })

  it('rejects blank titles in the prop factory', () => {
    expect(() => createDocsCardProps({ title: '  ', content: '' })).toThrow('title')
  })
})
