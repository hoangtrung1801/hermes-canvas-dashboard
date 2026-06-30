import { toRichText } from 'tldraw'
import { blockRegistry } from '../blocks/blockRegistry'
import type { CanvasBlock, CanvasObservationState, TodoTask, TodoTaskInput } from '../blocks/block.types'
import type { AdapterCreateResult, CanvasAdapter } from './canvasAdapter'

type EditorLike = {
  createShape(shape: Record<string, unknown>): unknown
  updateShape(shape: Record<string, unknown>): unknown
  deleteShape(shapeId: string): unknown
  getCurrentPageShapes(): Array<Record<string, unknown>>
  getSelectedShapeIds(): string[]
  getViewportPageBounds(): { x: number; y: number; w: number; h: number }
  zoomToFit(): void
}

export class TldrawAdapter implements CanvasAdapter {
  private readonly blocks = new Map<string, CanvasBlock>()
  private sequence = 0
  private todoTaskSequence = 0

  constructor(
    private readonly editor: EditorLike,
    public readonly canvasId: string
  ) {}

  createText(input: { text: string; x: number; y: number; name?: string }): AdapterCreateResult {
    return this.createBlock('text', input)
  }

  createBox(input: { x: number; y: number; w?: number; h?: number; name?: string; text?: string }): AdapterCreateResult {
    return this.createBlock('box', input)
  }

  createNote(input: { x: number; y: number; text: string; name?: string }): AdapterCreateResult {
    return this.createBlock('note', input)
  }

  createTodoBlock(input: { x: number; y: number; name: string; tasks?: TodoTaskInput[]; props?: Record<string, unknown> }): AdapterCreateResult {
    const tasks = this.normalizeTodoTasks(input.tasks ?? [])
    return this.createBlock('todo_block', {
      ...input,
      text: this.formatTodoBlockText(input.name, tasks),
      props: { ...input.props, tasks }
    })
  }

  createTaskCard(input: { x: number; y: number; name: string; text?: string; props?: Record<string, unknown> }): AdapterCreateResult {
    return this.createBlock('task_card', input)
  }

  createLinkCard(input: { x: number; y: number; name: string; url: string; props?: Record<string, unknown> }): AdapterCreateResult {
    return this.createBlock('link_card', {
      ...input,
      text: `${input.name}\n${input.url}`,
      props: { ...input.props, url: input.url }
    })
  }

  createArrow(input: { fromBlockId: string; toBlockId: string; label?: string }): AdapterCreateResult {
    const blockId = this.nextId('block')
    const shapeId = this.nextId('shape')
    const block: CanvasBlock = {
      id: blockId,
      type: 'box',
      name: input.label,
      x: 0,
      y: 0,
      text: input.label,
      props: { fromBlockId: input.fromBlockId, toBlockId: input.toBlockId },
      shapeIds: [shapeId]
    }

    this.editor.createShape({ id: shapeId, type: 'arrow', props: input })
    this.blocks.set(blockId, block)

    return { block, shapeIds: [shapeId] }
  }

  updateText(input: { blockId: string; text: string }): CanvasBlock | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return null

    const next = { ...existing, text: input.text }
    this.blocks.set(input.blockId, next)
    this.editor.updateShape({ id: existing.shapeIds[0], props: { richText: toRichText(input.text) } })

    return next
  }

  appendTodoTask(input: { blockId: string; text: string; taskId?: string }): { block: CanvasBlock; task: TodoTask } | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing || existing.type !== 'todo_block') return null

    const tasks = this.getTodoTasks(existing)
    const task: TodoTask = {
      id: input.taskId ?? this.nextTodoTaskId(),
      text: input.text,
      done: false
    }

    if (tasks.some((existingTask) => existingTask.id === task.id)) return null

    const next = this.updateTodoBlock(existing, [...tasks, task])
    return { block: next, task }
  }

  setTodoTaskDone(input: { blockId: string; taskId: string; done: boolean }): CanvasBlock | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing || existing.type !== 'todo_block') return null

    const tasks = this.getTodoTasks(existing)
    if (!tasks.some((task) => task.id === input.taskId)) return null

    return this.updateTodoBlock(
      existing,
      tasks.map((task) =>
        task.id === input.taskId ? { ...task, done: input.done } : task
      )
    )
  }

  removeTodoTask(input: { blockId: string; taskId: string }): CanvasBlock | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing || existing.type !== 'todo_block') return null

    const tasks = this.getTodoTasks(existing)
    if (!tasks.some((task) => task.id === input.taskId)) return null

    return this.updateTodoBlock(
      existing,
      tasks.filter((task) => task.id !== input.taskId)
    )
  }

  moveBlock(input: { blockId: string; x: number; y: number }): CanvasBlock | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return null

    const next = { ...existing, x: input.x, y: input.y }
    this.blocks.set(input.blockId, next)
    this.editor.updateShape({ id: existing.shapeIds[0], x: input.x, y: input.y })

    return next
  }

  deleteBlock(input: { blockId: string }): string[] {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return []

    existing.shapeIds.forEach((shapeId) => this.editor.deleteShape(shapeId))
    this.blocks.delete(input.blockId)

    return existing.shapeIds
  }

  getBlockById(blockId: string): CanvasBlock | null {
    return this.blocks.get(blockId) ?? null
  }

  getBlockByName(name: string): CanvasBlock | null {
    return [...this.blocks.values()].find((block) => block.name === name) ?? null
  }

  getCanvasState(): CanvasObservationState {
    return {
      canvasId: this.canvasId,
      selectedShapeIds: this.editor.getSelectedShapeIds(),
      viewport: this.editor.getViewportPageBounds(),
      blocks: [...this.blocks.values()]
    }
  }

  zoomToFit(): void {
    this.editor.zoomToFit()
  }

  zoomToBlock(blockId: string): void {
    const block = this.blocks.get(blockId)
    if (!block || !block.shapeIds[0]) return
    
    // Zoom/center on shapes if the editor supports it
    if (typeof (this.editor as any).zoomToShapes === 'function') {
      ;(this.editor as any).zoomToShapes([block.shapeIds[0]])
    } else if (typeof (this.editor as any).select === 'function') {
      ;(this.editor as any).select(block.shapeIds[0])
      if (typeof (this.editor as any).zoomToFit === 'function') {
        ;(this.editor as any).zoomToFit()
      }
    }
  }

  private createBlock(
    type: CanvasBlock['type'],
    input: {
      x: number
      y: number
      name?: string
      text?: string
      props?: Record<string, unknown>
      w?: number
      h?: number
    }
  ): AdapterCreateResult {
    const definition = blockRegistry[type]
    const blockId = this.nextId('block')
    const shapeId = this.nextId('shape')
    const block: CanvasBlock = {
      id: blockId,
      type,
      name: input.name,
      x: input.x,
      y: input.y,
      w: input.w ?? definition.defaultSize.w,
      h: input.h ?? definition.defaultSize.h,
      text: input.text ?? input.name,
      props: { ...definition.defaultProps, ...input.props },
      shapeIds: [shapeId]
    }

    const shapeType = type === 'text' ? 'text' : 'geo'

    this.editor.createShape({
      id: shapeId,
      type: shapeType,
      x: block.x,
      y: block.y,
      props:
        shapeType === 'text'
          ? {
              richText: toRichText(block.text ?? ''),
              w: block.w,
              autoSize: true
            }
          : {
              geo: 'rectangle',
              richText: toRichText(block.text ?? ''),
              w: block.w,
              h: block.h
            }
    })

    this.blocks.set(blockId, block)
    return { block, shapeIds: [shapeId] }
  }

  private normalizeTodoTasks(tasks: TodoTaskInput[]): TodoTask[] {
    return tasks.map((task) => {
      if (typeof task === 'string') {
        return {
          id: this.nextTodoTaskId(),
          text: task,
          done: false
        }
      }

      return {
        id: task.id ?? this.nextTodoTaskId(),
        text: task.text,
        done: task.done ?? false
      }
    })
  }

  private getTodoTasks(block: CanvasBlock): TodoTask[] {
    const tasks = block.props?.tasks
    if (!Array.isArray(tasks)) return []

    return tasks.filter((task): task is TodoTask => {
      if (!task || typeof task !== 'object') return false
      const record = task as Record<string, unknown>
      return (
        typeof record.id === 'string' &&
        typeof record.text === 'string' &&
        typeof record.done === 'boolean'
      )
    })
  }

  private updateTodoBlock(block: CanvasBlock, tasks: TodoTask[]): CanvasBlock {
    const text = this.formatTodoBlockText(block.name ?? 'Todo', tasks)
    const next: CanvasBlock = {
      ...block,
      text,
      props: { ...block.props, tasks }
    }

    this.blocks.set(block.id, next)
    this.editor.updateShape({ id: block.shapeIds[0], props: { richText: toRichText(text) } })

    return next
  }

  private formatTodoBlockText(name: string, tasks: TodoTask[]): string {
    const taskLines = tasks.map((task) => {
      const marker = task.done ? '[x]' : '[ ]'
      return `- ${marker} ${task.text}`
    })

    return [`${name}:`, ...taskLines].join('\n')
  }

  private nextId(prefix: 'block' | 'shape'): string {
    this.sequence += 1
    const suffix = this.sequence.toString().padStart(4, '0')
    return prefix === 'shape' ? `shape:${suffix}` : `block_${suffix}`
  }

  private nextTodoTaskId(): string {
    this.todoTaskSequence += 1
    return `todo_${this.todoTaskSequence.toString().padStart(4, '0')}`
  }
}
