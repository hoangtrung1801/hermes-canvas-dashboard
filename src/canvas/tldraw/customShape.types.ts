import { createShapePropsMigrationIds, createShapePropsMigrationSequence } from '@tldraw/tlschema'

export const TODO_BLOCK_TYPE = 'todo_block'
export const LINK_CARD_TYPE = 'link_card'
export const DEFAULT_TODO_BLOCK_COLOR = 'yellow'
export const DEFAULT_LINK_CARD_COLOR = 'light-blue'

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
  AddColorProp: 1
})

const linkCardVersions = createShapePropsMigrationIds(LINK_CARD_TYPE, {
  AddColorProp: 1,
  AddImageUrl: 2
})

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
  return {
    w: input.w ?? 320,
    h: input.h ?? 220,
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
  return {
    w: input.w ?? 300,
    h: input.h ?? (input.imageUrl ? 300 : 120),
    title: input.title,
    url: input.url,
    description: input.description ?? '',
    imageUrl: input.imageUrl ?? '',
    color: input.color ?? DEFAULT_LINK_CARD_COLOR,
    ...(input.backgroundColor ? { backgroundColor: input.backgroundColor } : {})
  }
}
