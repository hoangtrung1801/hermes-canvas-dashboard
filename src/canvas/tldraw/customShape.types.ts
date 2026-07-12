import { createShapePropsMigrationIds, createShapePropsMigrationSequence } from '@tldraw/tlschema'

export const TODO_BLOCK_TYPE = 'todo_block'
export const LINK_CARD_TYPE = 'link_card'
export const DEFAULT_TODO_BLOCK_COLOR = 'yellow'
export const DEFAULT_LINK_CARD_COLOR = 'light-blue'
export const HERMES_CARD_ASPECT_RATIO = 16 / 9
export const HERMES_CARD_MIN_WIDTH = 320
export const HERMES_CARD_MIN_HEIGHT = HERMES_CARD_MIN_WIDTH / HERMES_CARD_ASPECT_RATIO
export const HERMES_CARD_PREVIEW_WIDTH = 480

export type TodoTask = {
  id: string
  text: string
  done: boolean
}

export type TodoTaskInput =
  | string
  | {
      id?: string
      text: string
      done?: boolean
    }

export type TodoBlockProps = {
  w: number
  h: number
  title: string
  tasks: TodoTask[]
  color?: string
  backgroundColor?: string
}

export type LinkCardProps = {
  w: number
  h: number
  title: string
  url: string
  description: string
  imageUrl: string
  color?: string
  backgroundColor?: string
}

export type HermesCustomShapeType =
  | typeof TODO_BLOCK_TYPE
  | typeof LINK_CARD_TYPE

const todoBlockVersions = createShapePropsMigrationIds(TODO_BLOCK_TYPE, {
  AddColorProp: 1,
  NormalizeAspectRatio: 2
})

const linkCardVersions = createShapePropsMigrationIds(LINK_CARD_TYPE, {
  AddColorProp: 1,
  AddImageUrl: 2,
  NormalizeAspectRatio: 3
})

export function fitHermesCardDimensions(w?: number, h?: number) {
  const requestedWidth = typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 0
  const requestedHeight = typeof h === 'number' && Number.isFinite(h) && h > 0 ? h : 0
  const width = Math.max(
    HERMES_CARD_MIN_WIDTH,
    requestedWidth,
    requestedHeight * HERMES_CARD_ASPECT_RATIO
  )

  return { w: width, h: width / HERMES_CARD_ASPECT_RATIO }
}

function normalizeAspectRatio(props: Record<string, unknown>) {
  const dimensions = fitHermesCardDimensions(
    typeof props.w === 'number' ? props.w : undefined,
    typeof props.h === 'number' ? props.h : undefined
  )
  props.w = dimensions.w
  props.h = dimensions.h
}

function removeColorProp(props: Record<string, unknown>) {
  delete props.color
}

export const todoBlockMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: todoBlockVersions.AddColorProp,
      up: (props) => {
        props.color ??= DEFAULT_TODO_BLOCK_COLOR
      },
      down: removeColorProp
    },
    {
      id: todoBlockVersions.NormalizeAspectRatio,
      up: normalizeAspectRatio,
      down: () => {}
    }
  ]
})

export const linkCardMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: linkCardVersions.AddColorProp,
      up: (props) => {
        props.color ??= DEFAULT_LINK_CARD_COLOR
      },
      down: removeColorProp
    },
    {
      id: linkCardVersions.AddImageUrl,
      up: (props) => {
        props.imageUrl ??= ''
      },
      down: (props) => {
        delete props.imageUrl
      }
    },
    {
      id: linkCardVersions.NormalizeAspectRatio,
      up: normalizeAspectRatio,
      down: () => {}
    }
  ]
})

export function normalizeTodoTasks(tasks: TodoTaskInput[] = []): TodoTask[] {
  let generated = 0

  return tasks.map((task) => {
    if (typeof task === 'string') {
      generated += 1
      return {
        id: `task_${String(generated).padStart(4, '0')}`,
        text: task,
        done: false
      }
    }

    return {
      id: task.id ?? `task_${String(++generated).padStart(4, '0')}`,
      text: task.text,
      done: task.done ?? false
    }
  })
}

export function createTodoBlockProps(input: {
  title: string
  tasks?: TodoTaskInput[]
  w?: number
  h?: number
  color?: string
  backgroundColor?: string
}): TodoBlockProps {
  const dimensions = fitHermesCardDimensions(input.w, input.h)

  return {
    ...dimensions,
    title: input.title,
    tasks: normalizeTodoTasks(input.tasks ?? []),
    color: input.color ?? DEFAULT_TODO_BLOCK_COLOR,
    ...(input.backgroundColor ? { backgroundColor: input.backgroundColor } : {})
  }
}

export function createLinkCardProps(input: {
  title: string
  url: string
  description?: string
  imageUrl?: string
  w?: number
  h?: number
  color?: string
  backgroundColor?: string
}): LinkCardProps {
  const defaultWidth = input.imageUrl ? HERMES_CARD_PREVIEW_WIDTH : HERMES_CARD_MIN_WIDTH
  const dimensions = fitHermesCardDimensions(input.w ?? defaultWidth, input.h)

  return {
    ...dimensions,
    title: input.title,
    url: input.url,
    description: input.description ?? '',
    imageUrl: input.imageUrl ?? '',
    color: input.color ?? DEFAULT_LINK_CARD_COLOR,
    ...(input.backgroundColor ? { backgroundColor: input.backgroundColor } : {})
  }
}
