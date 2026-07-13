import {
  DefaultColorStyle,
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  getColorValue,
  resizeBox,
  useEditor,
  useIsEditing,
  type TLResizeInfo,
  type TLShape
} from 'tldraw'
import type {
  CSSProperties,
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent
} from 'react'
import {
  PROJECT_CARD_MIN_HEIGHT,
  PROJECT_CARD_MIN_WIDTH,
  PROJECT_CARD_TYPE,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  createProjectCardProps,
  getProjectProgress,
  isProjectOverdue,
  nextProjectActionId,
  projectCardMigrations,
  projectCardProps,
  type ProjectCardProps
} from './projectCard.types'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [PROJECT_CARD_TYPE]: ProjectCardProps
  }
}

export type ProjectCardShape = TLShape<typeof PROJECT_CARD_TYPE>

const STATUS_LABEL = {
  planned: 'Planned',
  active: 'Active',
  blocked: 'Blocked',
  done: 'Done'
} as const

const PRIORITY_LABEL = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
} as const

function ProjectIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 6.5h14v9H3z" />
      <path d="M7 6.5V4.5h6v2" />
    </svg>
  )
}

function ProjectCardView({ shape }: { shape: ProjectCardShape }) {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const { completed, total, percent } = getProjectProgress(shape.props.actions)
  const overdue = isProjectOverdue(shape.props.dueDate, shape.props.status)
  const background = getColorValue(
    editor.getCurrentTheme().colors[editor.getColorMode()],
    shape.props.color,
    'noteFill'
  )

  const updateProps = (props: Partial<ProjectCardProps>) => {
    editor.updateShape({ id: shape.id, type: PROJECT_CARD_TYPE, props })
  }

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => editor.markEventAsHandled(event),
    onPointerUp: (event: PointerEvent<HTMLElement>) => editor.markEventAsHandled(event)
  }

  const setDone = (id: string, done: boolean) => {
    updateProps({
      actions: shape.props.actions.map((action) =>
        action.id === id ? { ...action, done } : action
      )
    })
  }

  const setActionText = (id: string, text: string) => {
    updateProps({
      actions: shape.props.actions.map((action) =>
        action.id === id ? { ...action, text } : action
      )
    })
  }

  const addAction = (event: MouseEvent<HTMLButtonElement>) => {
    editor.markEventAsHandled(event)
    updateProps({
      actions: [
        ...shape.props.actions,
        {
          id: nextProjectActionId(shape.props.actions),
          text: 'New action',
          done: false
        }
      ]
    })
  }

  const removeAction = (id: string, event: MouseEvent<HTMLButtonElement>) => {
    editor.markEventAsHandled(event)
    updateProps({ actions: shape.props.actions.filter((action) => action.id !== id) })
  }

  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') editor.setEditingShape(null)
  }

  const style = {
    width: shape.props.w,
    height: shape.props.h,
    backgroundColor: background,
    '--hermes-card-accent': background
  } as CSSProperties

  const progress = (
    <>
      <div className="hermes-project-progress-row">
        <span>Progress</span>
        <span aria-label={`${completed} of ${total} project actions complete`}>
          {completed}/{total}
        </span>
      </div>
      <div
        className="hermes-project-progress"
        role="progressbar"
        aria-label="Project action progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </>
  )

  if (!isEditing) {
    return (
      <HTMLContainer
        className="hermes-shape hermes-project-card"
        style={style}
        onDoubleClick={(event: MouseEvent<HTMLElement>) => {
          editor.setEditingShape(shape.id)
          editor.markEventAsHandled(event)
        }}
      >
        <div className="hermes-card-header">
          <span className="hermes-card-icon">
            <ProjectIcon />
          </span>
          <strong>{shape.props.title}</strong>
          <span className="hermes-project-badge" data-status={shape.props.status}>
            {STATUS_LABEL[shape.props.status]}
          </span>
        </div>
        <div className="hermes-project-meta">
          <span className="hermes-project-priority" data-priority={shape.props.priority}>
            {PRIORITY_LABEL[shape.props.priority]}
          </span>
          {shape.props.dueDate && (
            <time
              className={`hermes-project-due${overdue ? ' is-overdue' : ''}`}
              dateTime={shape.props.dueDate}
            >
              Due {shape.props.dueDate}
            </time>
          )}
        </div>
        {progress}
        <div
          className="hermes-project-actions"
          onWheel={(event) => event.stopPropagation()}
        >
          {shape.props.actions.map((action) => (
            <label
              key={action.id}
              className={`hermes-project-action${action.done ? ' is-done' : ''}`}
            >
              <input
                type="checkbox"
                aria-label={action.text}
                checked={action.done}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setDone(action.id, event.currentTarget.checked)
                }
                {...handlers}
              />
              <span className="hermes-project-action-label">{action.text}</span>
            </label>
          ))}
        </div>
      </HTMLContainer>
    )
  }

  return (
    <HTMLContainer
      className="hermes-shape hermes-project-card is-editing"
      style={style}
      onKeyDown={closeOnEscape}
    >
      <div className="hermes-card-header hermes-card-header-editing">
        <span className="hermes-card-icon">
          <ProjectIcon />
        </span>
        <input
          aria-label="Project title"
          className="hermes-inline-title-input"
          value={shape.props.title}
          onChange={(event) => updateProps({ title: event.currentTarget.value })}
          onBlur={(event) =>
            updateProps({ title: event.currentTarget.value.trim() || 'Untitled Project' })
          }
          {...handlers}
        />
      </div>
      <div className="hermes-project-edit-fields">
        <select
          aria-label="Project status"
          value={shape.props.status}
          onChange={(event) =>
            updateProps({ status: event.currentTarget.value as ProjectCardProps['status'] })
          }
          {...handlers}
        >
          {PROJECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Project priority"
          value={shape.props.priority}
          onChange={(event) =>
            updateProps({ priority: event.currentTarget.value as ProjectCardProps['priority'] })
          }
          {...handlers}
        >
          {PROJECT_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABEL[value]}
            </option>
          ))}
        </select>
        <input
          aria-label="Project due date"
          type="date"
          value={shape.props.dueDate ?? ''}
          onChange={(event) => updateProps({ dueDate: event.currentTarget.value || undefined })}
          {...handlers}
        />
      </div>
      {progress}
      <div
        className="hermes-project-actions"
        onWheel={(event) => event.stopPropagation()}
      >
        {shape.props.actions.map((action) => (
          <div
            key={action.id}
            className={`hermes-project-action${action.done ? ' is-done' : ''}`}
          >
            <input
              type="checkbox"
              aria-label={`Complete ${action.text}`}
              checked={action.done}
              onChange={(event) => setDone(action.id, event.currentTarget.checked)}
              {...handlers}
            />
            <input
              type="text"
              aria-label={`Project action: ${action.text}`}
              value={action.text}
              onChange={(event) => setActionText(action.id, event.currentTarget.value)}
              onBlur={(event) =>
                setActionText(action.id, event.currentTarget.value.trim() || 'New action')
              }
              {...handlers}
            />
            <button
              type="button"
              aria-label={`Remove action: ${action.text}`}
              onClick={(event) => removeAction(action.id, event)}
              {...handlers}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="hermes-add-task-button"
        aria-label="Add project action"
        onClick={addAction}
        {...handlers}
      >
        +
      </button>
    </HTMLContainer>
  )
}

export class ProjectCardShapeUtil extends ShapeUtil<ProjectCardShape> {
  static override type = PROJECT_CARD_TYPE
  static override migrations = projectCardMigrations
  static override props = { ...projectCardProps, color: DefaultColorStyle }

  override canEdit = () => true
  override canResize = () => true
  override isAspectRatioLocked = () => false

  getDefaultProps() {
    return createProjectCardProps({ title: 'New Project' })
  }

  getGeometry(shape: ProjectCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  getIndicatorPath() {
    return undefined
  }

  override onResize(shape: ProjectCardShape, info: TLResizeInfo<ProjectCardShape>) {
    const { id: _id, type: _type, ...patch } = resizeBox(shape, info, {
      minWidth: PROJECT_CARD_MIN_WIDTH,
      minHeight: PROJECT_CARD_MIN_HEIGHT
    })
    return patch
  }

  component(shape: ProjectCardShape) {
    return <ProjectCardView shape={shape} />
  }
}
