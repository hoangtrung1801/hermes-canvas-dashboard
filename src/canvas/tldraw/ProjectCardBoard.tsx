import { createPortal } from 'react-dom'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
  type WheelEvent
} from 'react'
import { resolveProjectTaskDrop, type ProjectDropZone } from './projectCardDrag'
import {
  PROJECT_TASK_STATUSES,
  appendProjectTask,
  moveProjectTask,
  nextProjectTaskId,
  removeProjectTask,
  updateProjectTaskText,
  type ProjectTask,
  type ProjectTaskStatus
} from './projectCard.types'

export type ProjectCardBoardProps = {
  title: string
  tasks: ProjectTask[]
  onTitleChange: (title: string) => void
  onTasksChange: (tasks: ProjectTask[]) => void
  onInteraction: (event: SyntheticEvent) => void
}

const STATUS_LABEL: Record<ProjectTaskStatus, string> = {
  todo: 'Todo',
  doing: 'Doing',
  done: 'Done',
  blocked: 'Blocked'
}

type ProjectDrop = ReturnType<typeof resolveProjectTaskDrop>

type PointerSession = {
  pointerId: number
  taskId: string
  startX: number
  startY: number
  active: boolean
  drop: ProjectDrop
}

type DragState = {
  taskId: string
  text: string
  x: number
  y: number
  drop: ProjectDrop
}

function ProjectIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 6.5h14v9H3z" />
      <path d="M7 6.5V4.5h6v2" />
    </svg>
  )
}

export function ProjectCardBoard({
  title,
  tasks,
  onTitleChange,
  onTasksChange,
  onInteraction
}: ProjectCardBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const pointerSession = useRef<PointerSession | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [drag, setDrag] = useState<DragState | null>(null)

  useEffect(() => {
    if (editingTitle) {
      const input = boardRef.current?.querySelector<HTMLInputElement>('[data-project-title-input]')
      input?.focus()
      input?.select()
      return
    }
    if (!editingTaskId) return

    const input = [...(boardRef.current?.querySelectorAll<HTMLInputElement>('[data-task-input]') ?? [])]
      .find((element) => element.dataset.taskInput === editingTaskId)
    const row = [...(boardRef.current?.querySelectorAll<HTMLElement>('[data-task-id]') ?? [])]
      .find((element) => element.dataset.taskId === editingTaskId)
    row?.scrollIntoView?.({ block: 'nearest' })
    input?.focus()
    input?.select()
  }, [editingTaskId, editingTitle])

  const startTitleEdit = (event: MouseEvent<HTMLElement>) => {
    onInteraction(event)
    setDraft(title)
    setEditingTitle(true)
  }

  const commitTitle = () => {
    onTitleChange(draft.trim() || 'Untitled Project')
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitTitle()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setEditingTitle(false)
    }
  }

  const startTaskEdit = (task: ProjectTask, event: MouseEvent<HTMLElement>) => {
    onInteraction(event)
    setDraft(task.text)
    setEditingTaskId(task.id)
  }

  const commitTask = (taskId: string) => {
    onTasksChange(updateProjectTaskText(tasks, taskId, draft.trim() || 'New task'))
    setEditingTaskId(null)
  }

  const handleTaskKeyDown = (taskId: string, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitTask(taskId)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setEditingTaskId(null)
    }
  }

  const addTask = (event: MouseEvent<HTMLButtonElement>) => {
    onInteraction(event)
    const id = nextProjectTaskId(tasks)
    onTasksChange(appendProjectTask(tasks, { id, text: 'New task', status: 'todo' }))
    setDraft('New task')
    setEditingTaskId(id)
  }

  const deleteTask = (task: ProjectTask, event: MouseEvent<HTMLButtonElement>) => {
    onInteraction(event)
    onTasksChange(removeProjectTask(tasks, task.id))
    if (editingTaskId === task.id) setEditingTaskId(null)
  }

  const collectDropZones = (movingTaskId: string): ProjectDropZone[] => {
    const bodies = boardRef.current?.querySelectorAll<HTMLElement>(
      '[data-project-column-body]'
    )
    if (!bodies) return []

    return [...bodies].map((body) => ({
      status: body.dataset.status as ProjectTaskStatus,
      rect: body.getBoundingClientRect(),
      tasks: [...body.querySelectorAll<HTMLElement>('[data-project-task]')]
        .filter((row) => row.dataset.taskId !== movingTaskId)
        .map((row) => ({
          id: row.dataset.taskId ?? '',
          rect: row.getBoundingClientRect()
        }))
    }))
  }

  const startPointerDrag = (task: ProjectTask, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('button,input')) return
    onInteraction(event)
    pointerSession.current = {
      pointerId: event.pointerId,
      taskId: task.id,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      drop: null
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const movePointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = pointerSession.current
    if (!session || session.pointerId !== event.pointerId) return

    if (!session.active) {
      const distance = Math.hypot(
        event.clientX - session.startX,
        event.clientY - session.startY
      )
      if (distance < 5) return
      session.active = true
    }

    onInteraction(event)
    session.drop = resolveProjectTaskDrop(
      event.clientX,
      event.clientY,
      collectDropZones(session.taskId)
    )
    setDrag({
      taskId: session.taskId,
      text: tasks.find((task) => task.id === session.taskId)?.text ?? 'Task',
      x: event.clientX,
      y: event.clientY,
      drop: session.drop
    })
  }

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = pointerSession.current
    if (!session || session.pointerId !== event.pointerId) return
    onInteraction(event)

    if (session.active && session.drop) {
      onTasksChange(
        moveProjectTask(
          tasks,
          session.taskId,
          session.drop.status,
          session.drop.beforeTaskId
        )
      )
    }

    pointerSession.current = null
    setDrag(null)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const cancelPointerDrag = () => {
    pointerSession.current = null
    setDrag(null)
  }

  const handleBoardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && pointerSession.current?.active) {
      event.preventDefault()
      cancelPointerDrag()
    }
  }

  const stopWheel = (event: WheelEvent<HTMLDivElement>) => event.stopPropagation()

  return (
    <div
      ref={boardRef}
      className="hermes-project-board-shell"
      data-testid="project-board"
      tabIndex={-1}
      onKeyDown={handleBoardKeyDown}
    >
      <header className="hermes-card-header hermes-project-header">
        <span className="hermes-card-icon">
          <ProjectIcon />
        </span>
        {editingTitle ? (
          <input
            data-project-title-input
            className="hermes-inline-title-input"
            aria-label="Project title"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={handleTitleKeyDown}
            onBlur={commitTitle}
            onPointerDown={onInteraction}
          />
        ) : (
          <strong
            onPointerDown={onInteraction}
            onPointerUp={onInteraction}
            onDoubleClick={startTitleEdit}
          >
            {title}
          </strong>
        )}
      </header>

      <div className="hermes-project-board">
        {PROJECT_TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status)
          const isDropColumn = drag?.drop?.status === status

          return (
            <section
              key={status}
              className="hermes-project-column"
              data-testid={`project-column-${status}`}
              data-drop-active={isDropColumn ? 'true' : 'false'}
            >
              <h3 aria-label={`${STATUS_LABEL[status]} ${columnTasks.length}`}>
                <span>{STATUS_LABEL[status]}</span>
                <span>{columnTasks.length}</span>
              </h3>
              <div
                className="hermes-project-column-body"
                data-project-column-body
                data-status={status}
                onWheel={stopWheel}
              >
                {columnTasks.map((task) => (
                  <div key={task.id}>
                    {isDropColumn && drag?.drop?.beforeTaskId === task.id && (
                      <div className="hermes-project-drop-marker" />
                    )}
                    <div
                      className="hermes-project-task"
                      data-project-task
                      data-task-id={task.id}
                      data-status={task.status}
                      onPointerDown={(event) => startPointerDrag(task, event)}
                      onPointerMove={movePointerDrag}
                      onPointerUp={finishPointerDrag}
                      onLostPointerCapture={() => {
                        if (pointerSession.current?.taskId === task.id) cancelPointerDrag()
                      }}
                    >
                      {editingTaskId === task.id ? (
                        <input
                          data-task-input={task.id}
                          aria-label="Task text"
                          value={draft}
                          onChange={(event) => setDraft(event.currentTarget.value)}
                          onKeyDown={(event) => handleTaskKeyDown(task.id, event)}
                          onBlur={() => commitTask(task.id)}
                          onPointerDown={onInteraction}
                        />
                      ) : (
                        <span onDoubleClick={(event) => startTaskEdit(task, event)}>
                          {task.text}
                        </span>
                      )}
                      <button
                        type="button"
                        className="hermes-project-task-delete"
                        aria-label={`Delete task: ${task.text}`}
                        onClick={(event) => deleteTask(task, event)}
                        onPointerDown={onInteraction}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                {isDropColumn && drag?.drop?.beforeTaskId === null && (
                  <div className="hermes-project-drop-marker" />
                )}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="hermes-project-footer">
        <button
          type="button"
          className="hermes-add-task-button"
          aria-label="Add task"
          onClick={addTask}
          onPointerDown={onInteraction}
        >
          +
        </button>
      </footer>

      {drag &&
        createPortal(
          <div
            className="hermes-project-drag-preview"
            role="status"
            aria-label={`${drag.text} task`}
            style={{ left: drag.x + 12, top: drag.y + 12 }}
          >
            {drag.text}
          </div>,
          document.body
        )}
    </div>
  )
}
