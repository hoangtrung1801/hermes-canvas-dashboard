import {
  DEFAULT_THEME,
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
import {
  LINK_CARD_TYPE,
  TASK_CARD_TYPE,
  TODO_BLOCK_TYPE,
  DEFAULT_CUSTOM_CARD_COLOR,
  type LinkCardProps,
  type TaskCardProps,
  type TodoBlockProps,
  linkCardMigrations,
  taskCardMigrations,
  todoBlockMigrations
} from './customShape.types'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [TODO_BLOCK_TYPE]: TodoBlockProps
    [TASK_CARD_TYPE]: TaskCardProps
    [LINK_CARD_TYPE]: LinkCardProps
  }
}

export type TodoBlockShape = TLShape<typeof TODO_BLOCK_TYPE>
export type TaskCardShape = TLShape<typeof TASK_CARD_TYPE>
export type LinkCardShape = TLShape<typeof LINK_CARD_TYPE>
type HermesCardShape = TodoBlockShape | TaskCardShape | LinkCardShape

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
      minWidth: 180,
      minHeight: 96
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

function cardStyle(props: { w: number; h: number; color?: string; backgroundColor?: string }): CSSProperties {
  const backgroundColor = props.color
    ? getColorValue(DEFAULT_THEME.colors.light, props.color, 'noteFill')
    : props.backgroundColor

  return {
    width: props.w,
    height: props.h,
    ...(backgroundColor ? { backgroundColor } : {})
  }
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
    return { w: 320, h: 220, title: 'Todo', tasks: [], color: DEFAULT_CUSTOM_CARD_COLOR }
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

    if (!isEditing) {
      return (
        <HTMLContainer
          className="hermes-shape hermes-todo-block"
          style={cardStyle(shape.props)}
          onDoubleClick={(event) => enterShapeEditMode(editor, shape, event)}
        >
          <strong>{shape.props.title}</strong>
          <div className="hermes-task-list">
            {shape.props.tasks.map((task) => (
              <label key={task.id} className="hermes-task-row">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={(event) => updateTaskDone(task.id, event)}
                  {...handlers}
                />
                <span>{task.text}</span>
              </label>
            ))}
          </div>
        </HTMLContainer>
      )
    }

    return (
      <HTMLContainer className="hermes-shape hermes-todo-block" style={cardStyle(shape.props)}>
        <label className="hermes-field hermes-field-title">
          <span>Todo title</span>
          <input
            aria-label="Todo title"
            value={shape.props.title}
            onChange={(event) => updateShapeProps(editor, shape, { title: event.currentTarget.value })}
            {...handlers}
          />
        </label>
        <div className="hermes-task-list">
          {shape.props.tasks.map((task) => (
            <label key={task.id} className="hermes-task-row">
              <input
                type="checkbox"
                checked={task.done}
                onChange={(event) => updateTaskDone(task.id, event)}
                {...handlers}
              />
              <input
                aria-label={`Task text: ${task.text}`}
                className="hermes-task-text-input"
                value={task.text}
                onChange={(event) => updateTaskText(task.id, event)}
                {...handlers}
              />
            </label>
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

export class TaskCardShapeUtil extends BaseHermesCardUtil<TaskCardShape> {
  static override type = TASK_CARD_TYPE
  static override migrations = taskCardMigrations
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    body: T.string,
    status: T.string,
    priority: T.string,
    color: DefaultColorStyle,
    backgroundColor: T.string.optional()
  }

  getDefaultProps(): TaskCardProps {
    return { w: 280, h: 160, title: 'Task', body: '', status: 'todo', priority: 'medium', color: DEFAULT_CUSTOM_CARD_COLOR }
  }

  component(shape: TaskCardShape) {
    const editor = useEditor()
    const isEditing = useIsEditing(shape.id)
    const handlers = controlHandlers(editor)

    if (!isEditing) {
      return (
        <HTMLContainer
          className="hermes-shape hermes-task-card"
          style={cardStyle(shape.props)}
          onDoubleClick={(event) => enterShapeEditMode(editor, shape, event)}
        >
          <div className="hermes-card-kicker">
            {shape.props.status} - {shape.props.priority}
          </div>
          <strong>{shape.props.title}</strong>
          {shape.props.body && <p>{shape.props.body}</p>}
        </HTMLContainer>
      )
    }

    return (
      <HTMLContainer className="hermes-shape hermes-task-card" style={cardStyle(shape.props)}>
        <div className="hermes-inline-fields">
          <label className="hermes-field">
            <span>Task status</span>
            <input
              aria-label="Task status"
              value={shape.props.status}
              onChange={(event) => updateShapeProps(editor, shape, { status: event.currentTarget.value })}
              {...handlers}
            />
          </label>
          <label className="hermes-field">
            <span>Task priority</span>
            <input
              aria-label="Task priority"
              value={shape.props.priority}
              onChange={(event) => updateShapeProps(editor, shape, { priority: event.currentTarget.value })}
              {...handlers}
            />
          </label>
        </div>
        <label className="hermes-field hermes-field-title">
          <span>Task title</span>
          <input
            aria-label="Task title"
            value={shape.props.title}
            onChange={(event) => updateShapeProps(editor, shape, { title: event.currentTarget.value })}
            {...handlers}
          />
        </label>
        <label className="hermes-field">
          <span>Task body</span>
          <textarea
            aria-label="Task body"
            value={shape.props.body}
            onChange={(event) => updateShapeProps(editor, shape, { body: event.currentTarget.value })}
            {...handlers}
          />
        </label>
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
    color: DefaultColorStyle,
    backgroundColor: T.string.optional()
  }

  getDefaultProps(): LinkCardProps {
    return { w: 300, h: 120, title: 'Link', url: '', description: '', color: DEFAULT_CUSTOM_CARD_COLOR }
  }

  component(shape: LinkCardShape) {
    const editor = useEditor()
    const isEditing = useIsEditing(shape.id)
    const handlers = controlHandlers(editor)

    if (!isEditing) {
      return (
        <HTMLContainer
          className="hermes-shape hermes-link-card"
          style={cardStyle(shape.props)}
          onDoubleClick={(event) => enterShapeEditMode(editor, shape, event)}
        >
          <strong>{shape.props.title}</strong>
          <a
            href={shape.props.url}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onPointerDown={(event) => markCanvasEventHandled(editor, event)}
            onPointerUp={(event) => markCanvasEventHandled(editor, event)}
          >
            {shape.props.url}
          </a>
          {shape.props.description && <p>{shape.props.description}</p>}
        </HTMLContainer>
      )
    }

    return (
      <HTMLContainer className="hermes-shape hermes-link-card" style={cardStyle(shape.props)}>
        <label className="hermes-field hermes-field-title">
          <span>Link title</span>
          <input
            aria-label="Link title"
            value={shape.props.title}
            onChange={(event) => updateShapeProps(editor, shape, { title: event.currentTarget.value })}
            {...handlers}
          />
        </label>
        <label className="hermes-field">
          <span>Link URL</span>
          <input
            aria-label="Link URL"
            value={shape.props.url}
            onChange={(event) => updateShapeProps(editor, shape, { url: event.currentTarget.value })}
            {...handlers}
          />
        </label>
        <a
          aria-label="Open link"
          href={shape.props.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          {...handlers}
        >
          Open link
        </a>
        <label className="hermes-field">
          <span>Link description</span>
          <textarea
            aria-label="Link description"
            value={shape.props.description}
            onChange={(event) => updateShapeProps(editor, shape, { description: event.currentTarget.value })}
            {...handlers}
          />
        </label>
      </HTMLContainer>
    )
  }
}

export const hermesShapeUtils = [
  TodoBlockShapeUtil,
  TaskCardShapeUtil,
  LinkCardShapeUtil
]
