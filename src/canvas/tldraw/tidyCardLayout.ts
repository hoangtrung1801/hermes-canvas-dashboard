import { LINK_CARD_TYPE, TODO_BLOCK_TYPE } from './customShape.types'

export type TidyCardShape = {
  id: string
  type: string
  x: number
  y: number
  props: Record<string, unknown>
}

export type TidyCardPlacement = {
  id: string
  type: string
  x: number
  y: number
}

type CardKind = 'todo' | 'note' | 'link'

const CARD_KIND_ORDER: CardKind[] = ['todo', 'note', 'link']
const COLUMN_GAP = 56
const ROW_GAP = 32

function cardKind(shape: TidyCardShape): CardKind | null {
  if (shape.type === TODO_BLOCK_TYPE) return 'todo'
  if (shape.type === LINK_CARD_TYPE) return 'link'
  if (shape.type === 'geo' && shape.props.geo === 'rectangle') return 'note'
  return null
}

function dimension(shape: TidyCardShape, key: 'w' | 'h', fallback: number) {
  const value = shape.props[key]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Creates compact type-based columns while keeping each column's existing visual order.
 * Unsupported canvas shapes are intentionally left out of the result.
 */
export function createTidyCardLayout(shapes: TidyCardShape[]): TidyCardPlacement[] {
  const cards = shapes
    .map((shape) => ({ shape, kind: cardKind(shape) }))
    .filter((entry): entry is { shape: TidyCardShape; kind: CardKind } => entry.kind !== null)

  if (cards.length === 0) return []

  const originX = Math.min(...cards.map(({ shape }) => shape.x))
  const originY = Math.min(...cards.map(({ shape }) => shape.y))
  const placements: TidyCardPlacement[] = []
  let columnX = originX

  for (const kind of CARD_KIND_ORDER) {
    const column = cards
      .filter((entry) => entry.kind === kind)
      .map((entry) => entry.shape)
      .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))

    if (column.length === 0) continue

    let rowY = originY
    let columnWidth = 0
    for (const shape of column) {
      placements.push({ id: shape.id, type: shape.type, x: columnX, y: rowY })
      columnWidth = Math.max(columnWidth, dimension(shape, 'w', 320))
      rowY += dimension(shape, 'h', 180) + ROW_GAP
    }

    columnX += columnWidth + COLUMN_GAP
  }

  return placements
}
