import { LINK_CARD_TYPE, TODO_BLOCK_TYPE } from './customShape.types'
import { PROJECT_CARD_TYPE } from './projectCard.types'

export type AutoFrameCardKind = 'project' | 'todo' | 'note' | 'link'
export type AutoFrameMode = 'continuous' | 'tidy'

export type AutoFrameLayoutShape = {
  id: string
  type: string
  parentId: string
  x: number
  y: number
  pageX: number
  pageY: number
  props: Record<string, unknown>
  meta: Record<string, unknown>
}

export type PlannedFrame = {
  id: string
  kind: AutoFrameCardKind
  title: string
  color: string
  x: number
  y: number
  w: number
  h: number
  create: boolean
  meta: Record<string, unknown>
}

export type AutoFrameCardUpdate = {
  id: string
  type: string
  parentId: string
  x: number
  y: number
}

export type AutoFramePlan = {
  frames: PlannedFrame[]
  cardUpdates: AutoFrameCardUpdate[]
  deleteFrameIds: string[]
  demoteFrameIds: string[]
}

export type AutoFrameLayoutInput = {
  pageId: string
  shapes: AutoFrameLayoutShape[]
  mode: AutoFrameMode
}

export const AUTO_FRAME_META_KEY = 'hermesAutoFrame'
export const AUTO_FRAME_KIND_ORDER = ['project', 'todo', 'note', 'link'] as const

const KIND_CONFIG: Record<AutoFrameCardKind, { title: string; color: string }> = {
  project: { title: 'Projects', color: 'light-violet' },
  todo: { title: 'Todos', color: 'yellow' },
  note: { title: 'Notes', color: 'green' },
  link: { title: 'Links', color: 'light-blue' }
}

const FRAME_PADDING = 32
const FRAME_CONTENT_TOP = 64
const CARD_GAP = 24
const OUTER_GAP = 64
const MAX_FRAME_ROW_WIDTH = 3200
const FRAME_MIN_WIDTH = 400
const FRAME_MIN_HEIGHT = 240
const CARD_FALLBACK_WIDTH = 320
const CARD_FALLBACK_HEIGHT = 180

export function readAutoFrameKind(meta: Record<string, unknown>): AutoFrameCardKind | null {
  const value = meta[AUTO_FRAME_META_KEY]
  if (!value || typeof value !== 'object') return null
  const candidate = value as { version?: unknown; kind?: unknown }
  if (candidate.version !== 1) return null
  return AUTO_FRAME_KIND_ORDER.includes(candidate.kind as AutoFrameCardKind)
    ? candidate.kind as AutoFrameCardKind
    : null
}

export function getAutoFrameCardKind(shape: Pick<AutoFrameLayoutShape, 'type' | 'props'>) {
  if (shape.type === PROJECT_CARD_TYPE) return 'project' as const
  if (shape.type === TODO_BLOCK_TYPE) return 'todo' as const
  if (shape.type === LINK_CARD_TYPE) return 'link' as const
  if (shape.type === 'geo' && shape.props.geo === 'rectangle') return 'note' as const
  return null
}

function preferredFrameId(pageId: string, kind: AutoFrameCardKind) {
  const safePageId = pageId.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `shape:hermes-auto-frame-${safePageId}-${kind}`
}

function nextFrameId(pageId: string, kind: AutoFrameCardKind, usedIds: Set<string>) {
  const preferred = preferredFrameId(pageId, kind)
  if (!usedIds.has(preferred)) return preferred
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${preferred}-${suffix}`
    if (!usedIds.has(candidate)) return candidate
  }
}

function dimension(shape: AutoFrameLayoutShape, key: 'w' | 'h', fallback: number) {
  const value = shape.props[key]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function samePosition(shape: AutoFrameLayoutShape, parentId: string, x: number, y: number) {
  return shape.parentId === parentId && shape.x === x && shape.y === y
}

function overlaps(
  a: Pick<PlannedFrame, 'x' | 'y' | 'w' | 'h'>,
  b: Pick<PlannedFrame, 'x' | 'y' | 'w' | 'h'>
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function canonicalFrame(
  frames: AutoFrameLayoutShape[],
  pageId: string,
  kind: AutoFrameCardKind
) {
  const preferred = preferredFrameId(pageId, kind)
  return [...frames].sort((a, b) => {
    if (a.id === preferred) return -1
    if (b.id === preferred) return 1
    return a.id.localeCompare(b.id)
  })[0]
}

function layoutCards(cards: AutoFrameLayoutShape[], kind: AutoFrameCardKind, frameId: string) {
  const ordered = [...cards].sort(
    (a, b) => a.pageY - b.pageY || a.pageX - b.pageX || a.id.localeCompare(b.id)
  )
  const columnCount = kind === 'project' ? 1 : Math.min(2, ordered.length)
  const rowCount = Math.ceil(ordered.length / columnCount)
  const columnWidths = Array.from({ length: columnCount }, () => 0)
  const rowHeights = Array.from({ length: rowCount }, () => 0)

  ordered.forEach((card, index) => {
    const column = index % columnCount
    const row = Math.floor(index / columnCount)
    columnWidths[column] = Math.max(
      columnWidths[column],
      dimension(card, 'w', CARD_FALLBACK_WIDTH)
    )
    rowHeights[row] = Math.max(
      rowHeights[row],
      dimension(card, 'h', CARD_FALLBACK_HEIGHT)
    )
  })

  const columnX = columnWidths.map((_, index) =>
    FRAME_PADDING + columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0) + index * CARD_GAP
  )
  const rowY = rowHeights.map((_, index) =>
    FRAME_CONTENT_TOP + rowHeights.slice(0, index).reduce((sum, height) => sum + height, 0) + index * CARD_GAP
  )
  const updates = ordered.flatMap((card, index) => {
    const x = columnX[index % columnCount]
    const y = rowY[Math.floor(index / columnCount)]
    return samePosition(card, frameId, x, y)
      ? []
      : [{ id: card.id, type: card.type, parentId: frameId, x, y }]
  })

  return {
    updates,
    w: Math.max(
      FRAME_MIN_WIDTH,
      FRAME_PADDING * 2 + columnWidths.reduce((sum, width) => sum + width, 0) +
        Math.max(0, columnCount - 1) * CARD_GAP
    ),
    h: Math.max(
      FRAME_MIN_HEIGHT,
      FRAME_CONTENT_TOP + FRAME_PADDING + rowHeights.reduce((sum, height) => sum + height, 0) +
        Math.max(0, rowCount - 1) * CARD_GAP
    )
  }
}

function packFrames(frames: PlannedFrame[], originX: number, originY: number) {
  let x = originX
  let y = originY
  let rowHeight = 0

  for (const frame of frames) {
    if (x !== originX && x + frame.w - originX > MAX_FRAME_ROW_WIDTH) {
      x = originX
      y += rowHeight + OUTER_GAP
      rowHeight = 0
    }
    frame.x = x
    frame.y = y
    x += frame.w + OUTER_GAP
    rowHeight = Math.max(rowHeight, frame.h)
  }
}

export function planAutoFrameLayout(input: AutoFrameLayoutInput): AutoFramePlan {
  const usedIds = new Set(input.shapes.map((shape) => shape.id))
  const managedFrames = input.shapes.filter(
    (shape) => shape.type === 'frame' && readAutoFrameKind(shape.meta) !== null
  )
  const managedFrameIds = new Set(managedFrames.map((shape) => shape.id))
  const childrenByParent = new Map<string, AutoFrameLayoutShape[]>()
  for (const shape of input.shapes) {
    const children = childrenByParent.get(shape.parentId) ?? []
    children.push(shape)
    childrenByParent.set(shape.parentId, children)
  }
  const cards = input.shapes
    .map((shape) => ({ shape, kind: getAutoFrameCardKind(shape) }))
    .filter(
      (entry): entry is { shape: AutoFrameLayoutShape; kind: AutoFrameCardKind } =>
        entry.kind !== null &&
        (entry.shape.parentId === input.pageId || managedFrameIds.has(entry.shape.parentId))
    )

  const frames: PlannedFrame[] = []
  const cardUpdates: AutoFrameCardUpdate[] = []
  const deleteFrameIds: string[] = []
  const demoteFrameIds: string[] = []
  const occupied: PlannedFrame[] = managedFrames.map((shape) => ({
    id: shape.id,
    kind: readAutoFrameKind(shape.meta)!,
    title: '',
    color: '',
    x: shape.x,
    y: shape.y,
    w: dimension(shape, 'w', FRAME_MIN_WIDTH),
    h: dimension(shape, 'h', FRAME_MIN_HEIGHT),
    create: false,
    meta: shape.meta
  }))

  for (const kind of AUTO_FRAME_KIND_ORDER) {
    const kindCards = cards.filter((entry) => entry.kind === kind).map((entry) => entry.shape)
    const kindFrames = managedFrames.filter((candidate) => readAutoFrameKind(candidate.meta) === kind)
    const existing = canonicalFrame(kindFrames, input.pageId, kind)

    if (kindCards.length === 0) {
      for (const candidate of kindFrames) {
        const unsupportedChildren = (childrenByParent.get(candidate.id) ?? [])
          .filter((child) => getAutoFrameCardKind(child) === null)
        if (unsupportedChildren.length > 0) demoteFrameIds.push(candidate.id)
        else deleteFrameIds.push(candidate.id)
      }
      continue
    }

    const id = existing?.id ?? nextFrameId(input.pageId, kind, usedIds)
    usedIds.add(id)
    const config = KIND_CONFIG[kind]
    const grid = layoutCards(kindCards, kind, id)
    let x = existing?.x ?? Math.min(...kindCards.map((card) => card.pageX)) - FRAME_PADDING
    const y = existing?.y ?? Math.min(...kindCards.map((card) => card.pageY)) - FRAME_CONTENT_TOP
    let w = grid.w
    let h = grid.h

    if (existing) {
      for (const child of (childrenByParent.get(existing.id) ?? [])) {
        if (getAutoFrameCardKind(child) !== null) continue
        w = Math.max(w, child.x + dimension(child, 'w', CARD_FALLBACK_WIDTH) + FRAME_PADDING)
        h = Math.max(h, child.y + dimension(child, 'h', CARD_FALLBACK_HEIGHT) + FRAME_PADDING)
      }
    } else if (input.mode === 'continuous') {
      const candidate = { x, y, w, h }
      let collision = occupied.find((frame) => overlaps(candidate, frame))
      while (collision) {
        x = collision.x + collision.w + OUTER_GAP
        candidate.x = x
        collision = occupied.find((frame) => overlaps(candidate, frame))
      }
    }

    const plannedFrame: PlannedFrame = {
      id,
      kind,
      title: config.title,
      color: config.color,
      x,
      y,
      w,
      h,
      create: !existing,
      meta: {
        ...(existing?.meta ?? {}),
        [AUTO_FRAME_META_KEY]: { version: 1, kind }
      }
    }
    frames.push(plannedFrame)
    occupied.push(plannedFrame)
    cardUpdates.push(...grid.updates)

    for (const duplicate of kindFrames.filter((candidate) => candidate.id !== existing?.id)) {
      const unsupportedChildren = (childrenByParent.get(duplicate.id) ?? [])
        .filter((child) => getAutoFrameCardKind(child) === null)
      if (unsupportedChildren.length > 0) demoteFrameIds.push(duplicate.id)
      else deleteFrameIds.push(duplicate.id)
    }
  }

  if (input.mode === 'tidy' && frames.length > 0) {
    const originX = Math.min(...cards.map(({ shape }) => shape.pageX))
    const originY = Math.min(...cards.map(({ shape }) => shape.pageY))
    packFrames(frames, originX, originY)
  }

  return { frames, cardUpdates, deleteFrameIds, demoteFrameIds }
}
