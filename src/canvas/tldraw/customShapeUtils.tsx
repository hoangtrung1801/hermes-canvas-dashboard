import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  resizeBox,
  useEditor,
  type TLResizeInfo,
  type TLShape
} from 'tldraw'
import { T } from '@tldraw/validate'
import type { ChangeEvent, PointerEvent } from 'react'
import {
  LINK_CARD_TYPE,
  TASK_CARD_TYPE,
  TODO_BLOCK_TYPE,
  type LinkCardProps,
  type TaskCardProps,
  type TodoBlockProps
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

abstract class BaseHermesCardUtil<Shape extends TLShape> extends ShapeUtil<Shape> {
  override canEdit = () => false
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

export class TodoBlockShapeUtil extends BaseHermesCardUtil<TodoBlockShape> {
  static override type = TODO_BLOCK_TYPE
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
    )
  }

  getDefaultProps(): TodoBlockProps {
    return { w: 320, h: 220, title: 'Todo', tasks: [] }
  }

  component(shape: TodoBlockShape) {
    const editor = useEditor()

    const updateTaskDone = (taskId: string, event: ChangeEvent<HTMLInputElement>) => {
      const tasks = shape.props.tasks.map((task) =>
        task.id === taskId ? { ...task, done: event.currentTarget.checked } : task
      )

      editor.updateShape({
        id: shape.id,
        type: TODO_BLOCK_TYPE,
        props: { tasks }
      })
    }

    return (
      <HTMLContainer className="hermes-shape hermes-todo-block" style={{ width: shape.props.w, height: shape.props.h }}>
        <strong>{shape.props.title}</strong>
        <div className="hermes-task-list">
          {shape.props.tasks.map((task) => (
            <label key={task.id} className="hermes-task-row">
              <input
                type="checkbox"
                checked={task.done}
                onChange={(event) => updateTaskDone(task.id, event)}
                onPointerDown={(event) => markCanvasEventHandled(editor, event)}
                onPointerUp={(event) => markCanvasEventHandled(editor, event)}
              />
              <span>{task.text}</span>
            </label>
          ))}
        </div>
      </HTMLContainer>
    )
  }
}

export class TaskCardShapeUtil extends BaseHermesCardUtil<TaskCardShape> {
  static override type = TASK_CARD_TYPE
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    body: T.string,
    status: T.string,
    priority: T.string
  }

  getDefaultProps(): TaskCardProps {
    return { w: 280, h: 160, title: 'Task', body: '', status: 'todo', priority: 'medium' }
  }

  component(shape: TaskCardShape) {
    return (
      <HTMLContainer className="hermes-shape hermes-task-card" style={{ width: shape.props.w, height: shape.props.h }}>
        <div className="hermes-card-kicker">
          {shape.props.status} - {shape.props.priority}
        </div>
        <strong>{shape.props.title}</strong>
        {shape.props.body && <p>{shape.props.body}</p>}
      </HTMLContainer>
    )
  }
}

export class LinkCardShapeUtil extends BaseHermesCardUtil<LinkCardShape> {
  static override type = LINK_CARD_TYPE
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    url: T.string,
    description: T.string
  }

  getDefaultProps(): LinkCardProps {
    return { w: 300, h: 120, title: 'Link', url: '', description: '' }
  }

  component(shape: LinkCardShape) {
    const editor = useEditor()

    return (
      <HTMLContainer className="hermes-shape hermes-link-card" style={{ width: shape.props.w, height: shape.props.h }}>
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
}

export const hermesShapeUtils = [
  TodoBlockShapeUtil,
  TaskCardShapeUtil,
  LinkCardShapeUtil
]
