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
import { T } from '@tldraw/validate'
import type { CSSProperties, ChangeEvent, MouseEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  LINK_CARD_TYPE,
  TODO_BLOCK_TYPE,
  DEFAULT_LINK_CARD_COLOR,
  DEFAULT_TODO_BLOCK_COLOR,
  HERMES_CARD_MIN_HEIGHT,
  HERMES_CARD_MIN_WIDTH,
  type LinkCardProps,
  type TodoBlockProps,
  linkCardMigrations,
  todoBlockMigrations
} from './customShape.types'
import { ProjectCardShapeUtil } from './projectCardUtils'
import { DocsCardShapeUtil } from './docsCardUtils'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [TODO_BLOCK_TYPE]: TodoBlockProps
    [LINK_CARD_TYPE]: LinkCardProps
  }
}

export type TodoBlockShape = TLShape<typeof TODO_BLOCK_TYPE>
export type LinkCardShape = TLShape<typeof LINK_CARD_TYPE>
type HermesCardShape = TodoBlockShape | LinkCardShape

function TodoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.5" y="3.5" width="13" height="13" rx="3" />
      <path d="m7 10 2 2 4-5" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8.1 11.9 11.9 8.1" />
      <path d="M7.2 13.8 6 15a3.2 3.2 0 0 1-4.5-4.5l2.7-2.7a3.2 3.2 0 0 1 4.5 0" />
      <path d="M12.8 6.2 14 5a3.2 3.2 0 1 1 4.5 4.5l-2.7 2.7a3.2 3.2 0 0 1-4.5 0" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M11 4h5v5" />
      <path d="m16 4-7 7" />
      <path d="M14 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  )
}

abstract class BaseHermesCardUtil<Shape extends HermesCardShape> extends ShapeUtil<Shape> {
  override canEdit = () => true
  override canResize = () => true
  override isAspectRatioLocked = () => false

  getGeometry(shape: Shape) {
    const props = shape.props as Record<string, unknown>
    return new Rectangle2d({
      width: typeof props.w === 'number' ? props.w : 240,
      height: typeof props.h === 'number' ? props.h : 140,
      isFilled: true
    })
  }

  getIndicatorPath() {
    return undefined
  }

  override onResize(shape: Shape, info: TLResizeInfo<Shape>) {
    const { id: _id, type: _type, ...patch } = resizeBox(shape as any, info as any, {
      minWidth: HERMES_CARD_MIN_WIDTH,
      minHeight: HERMES_CARD_MIN_HEIGHT
    })

    return patch
  }
}

function markCanvasEventHandled(editor: ReturnType<typeof useEditor>, event: PointerEvent<HTMLElement>) {
  editor.markEventAsHandled(event)
}

function enterShapeEditMode<Shape extends HermesCardShape>(
  editor: ReturnType<typeof useEditor>,
  shape: Shape,
  event: MouseEvent<HTMLElement>
) {
  editor.setEditingShape(shape.id)
  editor.markEventAsHandled(event)
}

function controlHandlers(editor: ReturnType<typeof useEditor>) {
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => markCanvasEventHandled(editor, event),
    onPointerUp: (event: PointerEvent<HTMLElement>) => markCanvasEventHandled(editor, event)
  }
}

function updateShapeProps<Shape extends HermesCardShape>(
  editor: ReturnType<typeof useEditor>,
  shape: Shape,
  props: Partial<Shape['props']>
) {
  editor.updateShape({
    id: shape.id,
    type: shape.type,
    props
  } as any)
}

function cardStyle(
  editor: ReturnType<typeof useEditor>,
  props: { w: number; h: number; color?: string; backgroundColor?: string }
): CSSProperties {
  const colors = editor.getCurrentTheme().colors[editor.getColorMode()]
  const backgroundColor = props.color
    ? getColorValue(colors, props.color, 'noteFill')
    : props.backgroundColor

  return {
    width: props.w,
    height: props.h,
    ...(backgroundColor ? { backgroundColor, '--hermes-card-accent': backgroundColor } : {})
  } as CSSProperties
}

function createNextTodoTaskId(tasks: TodoBlockProps['tasks']) {
  const usedIds = new Set(tasks.map((task) => task.id))

  for (let index = tasks.length + 1; ; index += 1) {
    const id = `task_${String(index).padStart(4, '0')}`
    if (!usedIds.has(id)) return id
  }
}

export class TodoBlockShapeUtil extends BaseHermesCardUtil<TodoBlockShape> {
  static override type = TODO_BLOCK_TYPE
  static override migrations = todoBlockMigrations
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    tasks: T.arrayOf(
      T.object({
        id: T.string,
        text: T.string,
        done: T.boolean
      })
    ),
    color: DefaultColorStyle,
    backgroundColor: T.string.optional()
  }

  getDefaultProps(): TodoBlockProps {
    return { w: 320, h: 180, title: 'Todo', tasks: [], color: DEFAULT_TODO_BLOCK_COLOR }
  }

  component(shape: TodoBlockShape) {
    const editor = useEditor()
    const isEditing = useIsEditing(shape.id)
    const handlers = controlHandlers(editor)

    const updateTaskDone = (taskId: string, event: ChangeEvent<HTMLInputElement>) => {
      const tasks = shape.props.tasks.map((task) =>
        task.id === taskId ? { ...task, done: event.currentTarget.checked } : task
      )

      updateShapeProps(editor, shape, { tasks })
    }

    const updateTaskText = (taskId: string, event: ChangeEvent<HTMLInputElement>) => {
      const tasks = shape.props.tasks.map((task) =>
        task.id === taskId ? { ...task, text: event.currentTarget.value } : task
      )

      updateShapeProps(editor, shape, { tasks })
    }

    const addTask = (event: MouseEvent<HTMLButtonElement>) => {
      editor.markEventAsHandled(event)
      updateShapeProps(editor, shape, {
        tasks: [
          ...shape.props.tasks,
          { id: createNextTodoTaskId(shape.props.tasks), text: 'New task', done: false }
        ]
      })
    }

    const deleteTask = (taskId: string, event: MouseEvent<HTMLButtonElement>) => {
      editor.markEventAsHandled(event)
      updateShapeProps(editor, shape, {
        tasks: shape.props.tasks.filter((task) => task.id !== taskId)
      })
    }

    if (!isEditing) {
      const completedTasks = shape.props.tasks.filter((task) => task.done).length

      return (
        <HTMLContainer
          className="hermes-shape hermes-todo-block"
          style={cardStyle(editor, shape.props)}
          onDoubleClick={(event) => enterShapeEditMode(editor, shape, event)}
        >
          <div className="hermes-card-header">
            <span className="hermes-card-icon">
              <TodoIcon />
            </span>
            <strong>{shape.props.title}</strong>
            <span
              className="hermes-progress-badge"
              aria-label={`${completedTasks} of ${shape.props.tasks.length} tasks complete`}
            >
              {completedTasks}/{shape.props.tasks.length}
            </span>
          </div>
          <div className="hermes-task-list">
            {shape.props.tasks.map((task) => (
              <label key={task.id} className={`hermes-task-row${task.done ? ' is-done' : ''}`}>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={(event) => updateTaskDone(task.id, event)}
                  {...handlers}
                />
                <span className="hermes-task-label">{task.text}</span>
              </label>
            ))}
          </div>
        </HTMLContainer>
      )
    }

    return (
      <HTMLContainer className="hermes-shape hermes-todo-block" style={cardStyle(editor, shape.props)}>
        <div className="hermes-card-header hermes-card-header-editing">
          <span className="hermes-card-icon">
            <TodoIcon />
          </span>
          <label className="hermes-inline-title-field">
            <span className="hermes-sr-only">Todo title</span>
            <input
              aria-label="Todo title"
              className="hermes-inline-title-input"
              value={shape.props.title}
              onChange={(event) => updateShapeProps(editor, shape, { title: event.currentTarget.value })}
              {...handlers}
            />
          </label>
          <span
            className="hermes-progress-badge"
            aria-label={`${shape.props.tasks.filter((task) => task.done).length} of ${shape.props.tasks.length} tasks complete`}
          >
            {shape.props.tasks.filter((task) => task.done).length}/{shape.props.tasks.length}
          </span>
        </div>
        <div className="hermes-task-list">
          {shape.props.tasks.map((task) => (
            <div key={task.id} className={`hermes-task-row${task.done ? ' is-done' : ''}`}>
              <input
                type="checkbox"
                checked={task.done}
                aria-label={task.text}
                onChange={(event) => updateTaskDone(task.id, event)}
                {...handlers}
              />
              <input
                aria-label={`Task text: ${task.text}`}
                className="hermes-task-text-input hermes-inline-task-input"
                value={task.text}
                onChange={(event) => updateTaskText(task.id, event)}
                {...handlers}
              />
              <button
                type="button"
                aria-label={`Delete task: ${task.text}`}
                title={`Delete task: ${task.text}`}
                className="hermes-task-delete"
                onClick={(event) => deleteTask(task.id, event)}
                {...handlers}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Add task"
          title="Add task"
          className="hermes-add-task-button"
          onClick={addTask}
          {...handlers}
        >
          +
        </button>
      </HTMLContainer>
    )
  }
}

export class LinkCardShapeUtil extends BaseHermesCardUtil<LinkCardShape> {
  static override type = LINK_CARD_TYPE
  static override migrations = linkCardMigrations
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    url: T.string,
    description: T.string,
    imageUrl: T.string,
    color: DefaultColorStyle,
    backgroundColor: T.string.optional()
  }

  getDefaultProps(): LinkCardProps {
    return { w: 320, h: 180, title: 'Link', url: '', description: '', imageUrl: '', color: DEFAULT_LINK_CARD_COLOR }
  }

  component(shape: LinkCardShape) {
    const editor = useEditor()
    const isEditing = useIsEditing(shape.id)

    const closeEditor = () => editor.setEditingShape(null)

    return (
      <>
        <HTMLContainer
          className="hermes-shape hermes-link-card"
          style={cardStyle(editor, shape.props)}
          onDoubleClick={(event) => enterShapeEditMode(editor, shape, event)}
        >
          <div className="hermes-card-header">
            <span className="hermes-card-icon">
              <LinkIcon />
            </span>
            <strong>{shape.props.title}</strong>
          </div>
          {shape.props.imageUrl && (
            <img
              className="hermes-link-preview"
              src={shape.props.imageUrl}
              alt={`${shape.props.title} preview`}
              draggable={false}
            />
          )}
          <p
            className={`hermes-link-description${shape.props.description ? '' : ' is-empty'}`}
          >
            {shape.props.description || 'Double-click to add link text'}
          </p>
          <a
            className="hermes-link-footer"
            href={shape.props.url}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onPointerDown={(event) => markCanvasEventHandled(editor, event)}
            onPointerUp={(event) => markCanvasEventHandled(editor, event)}
            aria-label={`Open ${shape.props.url}`}
            title={shape.props.url}
          >
            <span>{shape.props.url || 'Add a URL'}</span>
            <ExternalLinkIcon />
          </a>
        </HTMLContainer>
        {isEditing &&
          createPortal(
            <div
              className="hermes-modal-backdrop"
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeEditor()
              }}
              onMouseDown={(event) => {
                event.stopPropagation()
                if (event.target === event.currentTarget) closeEditor()
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <section
                className="hermes-link-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hermes-link-modal-title"
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <header className="hermes-link-modal-header">
                  <span className="hermes-link-modal-icon">
                    <LinkIcon />
                  </span>
                  <div>
                    <h2 id="hermes-link-modal-title">Edit link</h2>
                    <p>Update the card details and destination.</p>
                  </div>
                  <button type="button" aria-label="Close link editor" onClick={closeEditor}>
                    <CloseIcon />
                  </button>
                </header>

                <div className="hermes-link-modal-fields">
                  <label className="hermes-modal-field">
                    <span>Title</span>
                    <input
                      autoFocus
                      aria-label="Link title"
                      value={shape.props.title}
                      onChange={(event) => updateShapeProps(editor, shape, { title: event.currentTarget.value })}
                    />
                  </label>
                  <label className="hermes-modal-field">
                    <span>URL</span>
                    <input
                      aria-label="Link URL"
                      inputMode="url"
                      value={shape.props.url}
                      onChange={(event) => updateShapeProps(editor, shape, { url: event.currentTarget.value })}
                    />
                  </label>
                  <label className="hermes-modal-field">
                    <span>Description</span>
                    <textarea
                      aria-label="Link description"
                      value={shape.props.description}
                      onChange={(event) => updateShapeProps(editor, shape, { description: event.currentTarget.value })}
                    />
                  </label>
                  <label className="hermes-modal-field">
                    <span>Preview image URL</span>
                    <input
                      aria-label="Link preview image URL"
                      inputMode="url"
                      value={shape.props.imageUrl}
                      onChange={(event) => updateShapeProps(editor, shape, { imageUrl: event.currentTarget.value })}
                    />
                  </label>
                </div>

                <footer className="hermes-link-modal-footer">
                  <a href={shape.props.url} target="_blank" rel="noopener noreferrer">
                    Test link
                    <ExternalLinkIcon />
                  </a>
                  <button type="button" onClick={closeEditor}>Done</button>
                </footer>
              </section>
            </div>,
            document.body
          )}
      </>
    )
  }
}

export const hermesShapeUtils = [
  TodoBlockShapeUtil,
  LinkCardShapeUtil,
  ProjectCardShapeUtil,
  DocsCardShapeUtil
]
