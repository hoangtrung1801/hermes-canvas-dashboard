import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectCardBoard } from './ProjectCardBoard'
import type { ProjectTask } from './projectCard.types'

afterEach(() => vi.restoreAllMocks())

function Harness() {
  const [title, setTitle] = useState('Website launch')
  const [tasks, setTasks] = useState<ProjectTask[]>([
    { id: 'task_todo', text: 'Draft', status: 'todo' },
    { id: 'task_doing', text: 'Review', status: 'doing' },
    { id: 'task_done', text: 'Ship', status: 'done' },
    { id: 'task_blocked', text: 'Legal', status: 'blocked' }
  ])

  return (
    <ProjectCardBoard
      title={title}
      tasks={tasks}
      onTitleChange={setTitle}
      onTasksChange={setTasks}
      onInteraction={() => undefined}
    />
  )
}

describe('ProjectCardBoard', () => {
  it('receives pointer coordinates from the test environment', () => {
    let received: Record<string, unknown> = {}
    render(
      <div
        data-testid="pointer-probe"
        onPointerDown={(event) => {
          received = {
            pointerId: event.pointerId,
            button: event.button,
            clientX: event.clientX,
            clientY: event.clientY
          }
        }}
      />
    )
    fireEvent.pointerDown(screen.getByTestId('pointer-probe'), {
      pointerId: 7,
      button: 0,
      clientX: 50,
      clientY: 80
    })
    expect(received).toEqual({ pointerId: 7, button: 0, clientX: 50, clientY: 80 })
  })

  it('renders fixed columns, counts, and task status treatments', () => {
    render(<Harness />)

    expect(screen.getByRole('heading', { name: 'Todo 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Doing 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Done 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Blocked 1' })).toBeInTheDocument()
    expect(screen.getByText('Ship').closest('[data-project-task]')).toHaveAttribute(
      'data-status',
      'done'
    )
    expect(screen.getByText('Legal').closest('[data-project-task]')).toHaveAttribute(
      'data-status',
      'blocked'
    )
  })

  it('adds a Todo task and immediately edits selected text', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    const input = await screen.findByRole('textbox', { name: 'Task text' })
    expect(input).toHaveValue('New task')
    expect(document.activeElement).toBe(input)
    expect(input).toHaveProperty('selectionStart', 0)
    expect(input).toHaveProperty('selectionEnd', 8)

    fireEvent.change(input, { target: { value: 'Write copy' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('Write copy')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Todo 2' })).toBeInTheDocument()
  })

  it('edits task text, cancels with Escape, saves on blur, and deletes', () => {
    render(<Harness />)

    fireEvent.doubleClick(screen.getByText('Draft'))
    const input = screen.getByRole('textbox', { name: 'Task text' })
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByText('Draft')).toBeInTheDocument()

    fireEvent.doubleClick(screen.getByText('Draft'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Task text' }), {
      target: { value: 'Final' }
    })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Task text' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete task: Final' }))

    expect(screen.queryByText('Final')).not.toBeInTheDocument()
  })

  it('edits the project title with save, fallback, and cancel semantics', () => {
    render(<Harness />)

    fireEvent.doubleClick(screen.getByText('Website launch'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Project title' }), {
      target: { value: 'Release' }
    })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Project title' }), {
      key: 'Enter'
    })
    expect(screen.getByText('Release')).toBeInTheDocument()

    fireEvent.doubleClick(screen.getByText('Release'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Project title' }), {
      target: { value: '   ' }
    })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Project title' }))
    expect(screen.getByText('Untitled Project')).toBeInTheDocument()

    fireEvent.doubleClick(screen.getByText('Untitled Project'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Project title' }), {
      target: { value: 'Cancelled' }
    })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Project title' }), {
      key: 'Escape'
    })
    expect(screen.getByText('Untitled Project')).toBeInTheDocument()
  })

  it('moves a task by pointer and cancels outside or on Escape', () => {
    const rect = (left: number, right: number, top: number, bottom: number) =>
      ({
        left,
        right,
        top,
        bottom,
        width: right - left,
        height: bottom - top,
        x: left,
        y: top,
        toJSON: () => ({})
      }) as DOMRect

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const taskId = this.getAttribute('data-task-id')
      if (taskId === 'task_todo') return rect(10, 190, 60, 100)
      if (taskId === 'task_doing') return rect(220, 400, 60, 100)

      const status = this.getAttribute('data-status')
      if (this.hasAttribute('data-project-column-body') && status === 'todo') {
        return rect(0, 200, 40, 300)
      }
      if (this.hasAttribute('data-project-column-body') && status === 'doing') {
        return rect(210, 410, 40, 300)
      }
      if (this.hasAttribute('data-project-column-body') && status === 'done') {
        return rect(420, 620, 40, 300)
      }
      if (this.hasAttribute('data-project-column-body') && status === 'blocked') {
        return rect(630, 830, 40, 300)
      }
      return rect(0, 0, 0, 0)
    })

    render(<Harness />)

    const task = screen.getByText('Draft').closest('[data-project-task]') as HTMLElement
    fireEvent.pointerDown(task, { pointerId: 1, button: 0, clientX: 50, clientY: 80 })
    fireEvent.pointerMove(task, { pointerId: 1, clientX: 300, clientY: 250 })
    expect(screen.getByRole('status', { name: 'Draft task' })).toBeInTheDocument()
    fireEvent.pointerUp(task, { pointerId: 1, clientX: 300, clientY: 250 })

    expect(within(screen.getByTestId('project-column-doing')).getByText('Draft')).toBeInTheDocument()

    const moved = screen.getByText('Draft').closest('[data-project-task]') as HTMLElement
    fireEvent.pointerDown(moved, { pointerId: 2, button: 0, clientX: 300, clientY: 250 })
    fireEvent.pointerMove(moved, { pointerId: 2, clientX: 900, clientY: 100 })
    fireEvent.pointerUp(moved, { pointerId: 2, clientX: 900, clientY: 100 })
    expect(within(screen.getByTestId('project-column-doing')).getByText('Draft')).toBeInTheDocument()

    fireEvent.pointerDown(moved, { pointerId: 3, button: 0, clientX: 300, clientY: 250 })
    fireEvent.pointerMove(moved, { pointerId: 3, clientX: 100, clientY: 100 })
    fireEvent.keyDown(screen.getByTestId('project-board'), { key: 'Escape' })
    fireEvent.pointerUp(moved, { pointerId: 3, clientX: 100, clientY: 100 })
    expect(within(screen.getByTestId('project-column-doing')).getByText('Draft')).toBeInTheDocument()
  })

  it('keeps four fixed columns with independent vertical scrolling', () => {
    const styles = readFileSync('src/styles.css', 'utf8')

    expect(styles).toMatch(
      /\.hermes-project-board\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s
    )
    expect(styles).toMatch(
      /\.hermes-project-column-body\s*\{[^}]*overflow-y:\s*auto;/s
    )
    expect(styles).not.toMatch(
      /\.hermes-project-board\s*\{[^}]*overflow-x:\s*auto;/s
    )
  })
})
