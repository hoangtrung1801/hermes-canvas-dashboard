import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence
} from '@tldraw/tlschema'
import type { TLDefaultColorStyle } from 'tldraw'

export const NOTE_CARD_TYPE = 'note_card'
export const NOTE_CARD_DEFAULT_WIDTH = 320
export const NOTE_CARD_DEFAULT_HEIGHT = 180
export const NOTE_CARD_MIN_WIDTH = 240
export const NOTE_CARD_MIN_HEIGHT = 140
export const DEFAULT_NOTE_CARD_COLOR: TLDefaultColorStyle = 'yellow'

export type NoteCardProps = {
  w: number
  h: number
  title: string
  tag: string
  content: string
  color: TLDefaultColorStyle
  backgroundColor?: string
}

export type NoteCardInput = {
  title: string
  tag: string
  content?: string
  color?: TLDefaultColorStyle
  w?: number
  h?: number
}

const noteCardVersions = createShapePropsMigrationIds(NOTE_CARD_TYPE, {
  NormalizeDimensions: 1
})

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function fitNoteCardDimensions(w?: number, h?: number) {
  return {
    w: Math.max(NOTE_CARD_MIN_WIDTH, finitePositive(w) ? w : NOTE_CARD_DEFAULT_WIDTH),
    h: Math.max(NOTE_CARD_MIN_HEIGHT, finitePositive(h) ? h : NOTE_CARD_DEFAULT_HEIGHT)
  }
}

function normalizeDimensions(props: Record<string, unknown>) {
  const dimensions = fitNoteCardDimensions(
    typeof props.w === 'number' ? props.w : undefined,
    typeof props.h === 'number' ? props.h : undefined
  )
  props.w = dimensions.w
  props.h = dimensions.h
}

export const noteCardMigrations = createShapePropsMigrationSequence({
  sequence: [{
    id: noteCardVersions.NormalizeDimensions,
    up: normalizeDimensions,
    down: () => {}
  }]
})

export function createNoteCardShapeProps(input: NoteCardInput): NoteCardProps {
  const title = input.title.trim()
  if (!title) throw new Error('Note Card title must not be blank')

  return {
    ...fitNoteCardDimensions(input.w, input.h),
    title,
    tag: input.tag.trim(),
    content: input.content ?? '',
    color: input.color ?? DEFAULT_NOTE_CARD_COLOR
  }
}
