import {
  DefaultColorStyle,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence
} from '@tldraw/tlschema'
import { T } from '@tldraw/validate'

export const PROJECT_CARD_TYPE = 'project_card'
export const PROJECT_CARD_DEFAULT_WIDTH = 360
export const PROJECT_CARD_DEFAULT_HEIGHT = 320
export const PROJECT_CARD_MIN_WIDTH = 320
export const PROJECT_CARD_MIN_HEIGHT = 240
export const DEFAULT_PROJECT_CARD_COLOR = 'light-violet'

export const PROJECT_STATUSES = ['planned', 'active', 'blocked', 'done'] as const
export const PROJECT_PRIORITIES = ['low', 'medium', 'high'] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number]

export type ProjectAction = {
  id: string
  text: string
  done: boolean
}

export type ProjectActionInput = {
  id?: string
  text: string
  done?: boolean
}

export type ProjectCardProps = {
  w: number
  h: number
  title: string
  status: ProjectStatus
  priority: ProjectPriority
  dueDate?: string
  actions: ProjectAction[]
  color: string
}

const projectCardVersions = createShapePropsMigrationIds(PROJECT_CARD_TYPE, {
  AddProjectFields: 1
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
    }
  ]
})

const projectActionValidator = T.object({
  id: T.string,
  text: T.string,
  done: T.boolean
})

export const projectCardProps = {
  w: T.number,
  h: T.number,
  title: T.string,
  status: T.literalEnum(...PROJECT_STATUSES),
  priority: T.literalEnum(...PROJECT_PRIORITIES),
  dueDate: T.string.optional(),
  actions: T.arrayOf(projectActionValidator),
  color: DefaultColorStyle
}

function nonBlank(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} must not be empty`)
  return trimmed
}

export function nextProjectActionId<Action extends { id: string }>(actions: Action[]) {
  const used = new Set(actions.map((action) => action.id))

  for (let index = 1; ; index += 1) {
    const id = `action_${String(index).padStart(4, '0')}`
    if (!used.has(id)) return id
  }
}

export function normalizeProjectActions(inputs: ProjectActionInput[] = []): ProjectAction[] {
  const supplied = inputs.flatMap((action) => (action.id ? [action.id] : []))
  if (new Set(supplied).size !== supplied.length) {
    const duplicate = supplied.find((id, index) => supplied.indexOf(id) !== index)
    throw new Error(`Duplicate project action ${duplicate}`)
  }

  const used = new Set(supplied)
  return inputs.map((input) => {
    let id = input.id
    if (!id) {
      id = nextProjectActionId([...used].map((usedId) => ({ id: usedId })))
      used.add(id)
    }

    return {
      id,
      text: nonBlank(input.text, 'Project action text'),
      done: input.done ?? false
    }
  })
}

export function fitProjectCardDimensions(w?: number, h?: number) {
  const validWidth =
    typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : PROJECT_CARD_DEFAULT_WIDTH
  const validHeight =
    typeof h === 'number' && Number.isFinite(h) && h > 0 ? h : PROJECT_CARD_DEFAULT_HEIGHT

  return {
    w: Math.max(PROJECT_CARD_MIN_WIDTH, validWidth),
    h: Math.max(PROJECT_CARD_MIN_HEIGHT, validHeight)
  }
}

export function isValidProjectDueDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function localProjectDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isProjectOverdue(
  dueDate: string | undefined,
  status: ProjectStatus,
  today = localProjectDate()
) {
  return Boolean(
    dueDate && isValidProjectDueDate(dueDate) && status !== 'done' && dueDate < today
  )
}

export function getProjectProgress(actions: ProjectAction[]) {
  const completed = actions.filter((action) => action.done).length
  const total = actions.length

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100)
  }
}

export function createProjectCardProps(input: {
  title: string
  status?: ProjectStatus
  priority?: ProjectPriority
  dueDate?: string
  actions?: ProjectActionInput[]
  w?: number
  h?: number
  color?: string
}): ProjectCardProps {
  if (input.dueDate !== undefined && !isValidProjectDueDate(input.dueDate)) {
    throw new Error('Project due date must be a real YYYY-MM-DD date')
  }

  return {
    ...fitProjectCardDimensions(input.w, input.h),
    title: nonBlank(input.title, 'Project title'),
    status: input.status ?? 'planned',
    priority: input.priority ?? 'medium',
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    actions: normalizeProjectActions(input.actions),
    color: input.color ?? DEFAULT_PROJECT_CARD_COLOR
  }
}
