import {
  DefaultColorStyle,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence
} from '@tldraw/tlschema'
import { T } from '@tldraw/validate'

export const PROJECT_CARD_TYPE = 'project_card'
export const PROJECT_CARD_DEFAULT_WIDTH = 960
export const PROJECT_CARD_DEFAULT_HEIGHT = 480
export const PROJECT_CARD_MIN_WIDTH = 760
export const PROJECT_CARD_MIN_HEIGHT = 320
export const DEFAULT_PROJECT_CARD_COLOR = 'light-violet'

export const PROJECT_TASK_STATUSES = ['todo', 'doing', 'done', 'blocked'] as const

export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number]

export type ProjectTask = {
  id: string
  text: string
  status: ProjectTaskStatus
}

export type ProjectTaskInput = {
  id?: string
  text: string
  status?: ProjectTaskStatus
}

export type ProjectCardProps = {
  w: number
  h: number
  title: string
  tasks: ProjectTask[]
  color: string
}

const projectCardVersions = createShapePropsMigrationIds(PROJECT_CARD_TYPE, {
  AddProjectFields: 1,
  TaskBoardFields: 2
})

export const projectCardMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: projectCardVersions.AddProjectFields,
      up: (props) => {
        props.status ??= 'planned'
        props.priority ??= 'medium'
        props.actions ??= []
        props.color ??= DEFAULT_PROJECT_CARD_COLOR
      },
      down: (props) => {
        delete props.status
        delete props.priority
        delete props.dueDate
        delete props.actions
        delete props.color
      }
    },
    {
      id: projectCardVersions.TaskBoardFields,
      up: (props) => {
        delete props.status
        delete props.priority
        delete props.dueDate
        delete props.actions
        props.tasks ??= []
        props.w = Math.max(
          PROJECT_CARD_MIN_WIDTH,
          Number(props.w) || PROJECT_CARD_DEFAULT_WIDTH
        )
        props.h = Math.max(
          PROJECT_CARD_MIN_HEIGHT,
          Number(props.h) || PROJECT_CARD_DEFAULT_HEIGHT
        )
      },
      down: (props) => {
        delete props.tasks
        props.status = 'planned'
        props.priority = 'medium'
        props.actions = []
      }
    }
  ]
})

const projectTaskValidator = T.object({
  id: T.string,
  text: T.string,
  status: T.literalEnum(...PROJECT_TASK_STATUSES)
})

export const projectCardProps = {
  w: T.number,
  h: T.number,
  title: T.string,
  tasks: T.arrayOf(projectTaskValidator),
  color: DefaultColorStyle
}

function nonBlank(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} must not be empty`)
  return trimmed
}

function isProjectTaskStatus(status: string): status is ProjectTaskStatus {
  return (PROJECT_TASK_STATUSES as readonly string[]).includes(status)
}

export function nextProjectTaskId(tasks: Pick<ProjectTask, 'id'>[]) {
  const used = new Set(tasks.map((task) => task.id))

  for (let index = 1; ; index += 1) {
    const id = `task_${String(index).padStart(4, '0')}`
    if (!used.has(id)) return id
  }
}

export function normalizeProjectTasks(inputs: ProjectTaskInput[] = []): ProjectTask[] {
  const supplied = inputs.flatMap((task) => {
    if (task.id === undefined) return []
    return [nonBlank(task.id, 'Project task id')]
  })
  const duplicate = supplied.find((id, index) => supplied.indexOf(id) !== index)
  if (duplicate) throw new Error(`Duplicate project task ${duplicate}`)

  const used = new Set(supplied)
  return inputs.map((input) => {
    let id = input.id?.trim()
    if (!id) {
      id = nextProjectTaskId([...used].map((usedId) => ({ id: usedId })))
      used.add(id)
    }

    const status = input.status ?? 'todo'
    if (!isProjectTaskStatus(status)) {
      throw new Error(`Invalid project task status ${status}`)
    }

    return {
      id,
      text: nonBlank(input.text, 'Project task text'),
      status
    }
  })
}

export function appendProjectTask(tasks: ProjectTask[], task: ProjectTask): ProjectTask[] {
  const id = nonBlank(task.id, 'Project task id')
  if (tasks.some((item) => item.id === id)) {
    throw new Error(`Duplicate project task ${id}`)
  }
  if (!isProjectTaskStatus(task.status)) {
    throw new Error(`Invalid project task status ${task.status}`)
  }

  return [
    ...tasks,
    {
      id,
      text: nonBlank(task.text, 'Project task text'),
      status: task.status
    }
  ]
}

export function updateProjectTaskText(
  tasks: ProjectTask[],
  taskId: string,
  text: string
): ProjectTask[] {
  if (!tasks.some((task) => task.id === taskId)) {
    throw new Error(`Unknown project task ${taskId}`)
  }
  const nextText = nonBlank(text, 'Project task text')
  return tasks.map((task) => (task.id === taskId ? { ...task, text: nextText } : task))
}

export function removeProjectTask(tasks: ProjectTask[], taskId: string): ProjectTask[] {
  if (!tasks.some((task) => task.id === taskId)) {
    throw new Error(`Unknown project task ${taskId}`)
  }
  return tasks.filter((task) => task.id !== taskId)
}

export function moveProjectTask(
  tasks: ProjectTask[],
  taskId: string,
  status: ProjectTaskStatus,
  beforeTaskId?: string | null
): ProjectTask[] {
  if (!isProjectTaskStatus(status)) {
    throw new Error(`Invalid project task status ${status}`)
  }

  const moving = tasks.find((task) => task.id === taskId)
  if (!moving) throw new Error(`Unknown project task ${taskId}`)
  if (beforeTaskId === taskId) throw new Error('Project task cannot move before itself')

  const remaining = tasks.filter((task) => task.id !== taskId)
  let insertionIndex: number

  if (beforeTaskId) {
    insertionIndex = remaining.findIndex((task) => task.id === beforeTaskId)
    if (insertionIndex < 0) throw new Error(`Unknown project task ${beforeTaskId}`)
    if (remaining[insertionIndex].status !== status) {
      throw new Error(`Project task ${beforeTaskId} is not in ${status}`)
    }
  } else {
    const lastDestinationIndex = remaining.reduce(
      (found, task, index) => (task.status === status ? index : found),
      -1
    )
    insertionIndex = lastDestinationIndex < 0 ? remaining.length : lastDestinationIndex + 1
  }

  const candidate = [
    ...remaining.slice(0, insertionIndex),
    { ...moving, status },
    ...remaining.slice(insertionIndex)
  ]
  const before = tasks.filter((task) => task.status === status).map((task) => task.id)
  const after = candidate.filter((task) => task.status === status).map((task) => task.id)

  return moving.status === status && before.join('\0') === after.join('\0')
    ? tasks
    : candidate
}

export function fitProjectCardDimensions(w?: number, h?: number) {
  const width =
    typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : PROJECT_CARD_DEFAULT_WIDTH
  const height =
    typeof h === 'number' && Number.isFinite(h) && h > 0 ? h : PROJECT_CARD_DEFAULT_HEIGHT

  return {
    w: Math.max(PROJECT_CARD_MIN_WIDTH, width),
    h: Math.max(PROJECT_CARD_MIN_HEIGHT, height)
  }
}

export function createProjectCardProps(input: {
  title: string
  tasks?: ProjectTaskInput[]
  w?: number
  h?: number
  color?: string
}): ProjectCardProps {
  return {
    ...fitProjectCardDimensions(input.w, input.h),
    title: nonBlank(input.title, 'Project title'),
    tasks: normalizeProjectTasks(input.tasks),
    color: input.color ?? DEFAULT_PROJECT_CARD_COLOR
  }
}
