export const TODO_BLOCK_TYPE = 'todo_block'
export const TASK_CARD_TYPE = 'task_card'
export const LINK_CARD_TYPE = 'link_card'

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

export type TaskCardProps = {
  w: number
  h: number
  title: string
  body: string
  status: string
  priority: string
  color?: string
  backgroundColor?: string
}

export type LinkCardProps = {
  w: number
  h: number
  title: string
  url: string
  description: string
  color?: string
  backgroundColor?: string
}

export type HermesCustomShapeType =
  | typeof TODO_BLOCK_TYPE
  | typeof TASK_CARD_TYPE
  | typeof LINK_CARD_TYPE

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
    ...(input.color ? { color: input.color } : {}),
    ...(input.backgroundColor ? { backgroundColor: input.backgroundColor } : {})
  }
}

export function createTaskCardProps(input: {
  title: string
  body?: string
  status?: string
  priority?: string
  w?: number
  h?: number
  color?: string
  backgroundColor?: string
}): TaskCardProps {
  return {
    w: input.w ?? 280,
    h: input.h ?? 160,
    title: input.title,
    body: input.body ?? '',
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    ...(input.color ? { color: input.color } : {}),
    ...(input.backgroundColor ? { backgroundColor: input.backgroundColor } : {})
  }
}

export function createLinkCardProps(input: {
  title: string
  url: string
  description?: string
  w?: number
  h?: number
  color?: string
  backgroundColor?: string
}): LinkCardProps {
  return {
    w: input.w ?? 300,
    h: input.h ?? 120,
    title: input.title,
    url: input.url,
    description: input.description ?? '',
    ...(input.color ? { color: input.color } : {}),
    ...(input.backgroundColor ? { backgroundColor: input.backgroundColor } : {})
  }
}
