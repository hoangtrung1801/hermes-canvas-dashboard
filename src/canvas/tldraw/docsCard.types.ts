import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence
} from '@tldraw/tlschema'

export const DOCS_CARD_TYPE = 'docs_card'
export const DOCS_CARD_DEFAULT_WIDTH = 480
export const DOCS_CARD_DEFAULT_HEIGHT = 640
export const DOCS_CARD_MIN_WIDTH = 320
export const DOCS_CARD_MIN_HEIGHT = 360

export type DocsCardProps = {
  w: number
  h: number
  title: string
  content: string
}

export type DocsCardInput = {
  title: string
  content?: string
  w?: number
  h?: number
}

const docsCardVersions = createShapePropsMigrationIds(DOCS_CARD_TYPE, {
  NormalizeDimensions: 1
})

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function fitDocsCardDimensions(w?: number, h?: number) {
  return {
    w: Math.max(DOCS_CARD_MIN_WIDTH, finitePositive(w) ? w : DOCS_CARD_DEFAULT_WIDTH),
    h: Math.max(DOCS_CARD_MIN_HEIGHT, finitePositive(h) ? h : DOCS_CARD_DEFAULT_HEIGHT)
  }
}

function normalizeDimensions(props: Record<string, unknown>) {
  const dimensions = fitDocsCardDimensions(
    typeof props.w === 'number' ? props.w : undefined,
    typeof props.h === 'number' ? props.h : undefined
  )
  props.w = dimensions.w
  props.h = dimensions.h
}

export const docsCardMigrations = createShapePropsMigrationSequence({
  sequence: [{
    id: docsCardVersions.NormalizeDimensions,
    up: normalizeDimensions,
    down: () => {}
  }]
})

export function createDocsCardProps(input: DocsCardInput): DocsCardProps {
  const title = input.title.trim()
  if (!title) throw new Error('Docs Card title must not be blank')

  return {
    ...fitDocsCardDimensions(input.w, input.h),
    title,
    content: input.content ?? ''
  }
}
