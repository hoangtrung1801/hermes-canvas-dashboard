import { blockRegistry } from '../blocks/blockRegistry'
import type { CanvasBlock, CanvasObservationState, TodoTask, TodoTaskInput } from '../blocks/block.types'
import type { AdapterCreateResult, CanvasAdapter } from './canvasAdapter'

export type ExcalidrawElementLike = {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  [key: string]: unknown
}

type ExcalidrawAppState = {
  scrollX?: number
  scrollY?: number
  selectedElementIds?: Record<string, boolean>
  width?: number
  height?: number
}

export type ExcalidrawApiLike = {
  updateScene(scene: { elements?: readonly ExcalidrawElementLike[]; appState?: Record<string, unknown> | null }): void
  getSceneElements(): readonly ExcalidrawElementLike[]
  getAppState(): ExcalidrawAppState
  scrollToContent(target?: string | ExcalidrawElementLike | readonly ExcalidrawElementLike[]): void
}

export class ExcalidrawAdapter implements CanvasAdapter {
  private readonly blocks = new Map<string, CanvasBlock>()
  private sequence = 0
  private todoTaskSequence = 0

  constructor(
    private readonly api: ExcalidrawApiLike,
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
    const fromBlock = this.blocks.get(input.fromBlockId)
    const toBlock = this.blocks.get(input.toBlockId)
    const blockId = this.nextId('block')
    const shapeId = this.nextId('element')
    const fromCenter = this.getBlockCenter(fromBlock)
    const toCenter = this.getBlockCenter(toBlock)
    const x = Math.min(fromCenter.x, toCenter.x)
    const y = Math.min(fromCenter.y, toCenter.y)
    const width = Math.max(Math.abs(toCenter.x - fromCenter.x), 1)
    const height = Math.max(Math.abs(toCenter.y - fromCenter.y), 1)
    const block: CanvasBlock = {
      id: blockId,
      type: 'box',
      name: input.label,
      x,
      y,
      w: width,
      h: height,
      text: input.label,
      props: { fromBlockId: input.fromBlockId, toBlockId: input.toBlockId },
      shapeIds: [shapeId]
    }

    this.appendElements([this.createArrowElement(shapeId, x, y, width, height)])
    this.blocks.set(blockId, block)

    return { block, shapeIds: [shapeId] }
  }

  updateText(input: { blockId: string; text: string }): CanvasBlock | null {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return null

    const next = { ...existing, text: input.text }
    this.blocks.set(input.blockId, next)
    this.updateBlockTextElements(existing, input.text)

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

    const dx = input.x - existing.x
    const dy = input.y - existing.y
    const next = { ...existing, x: input.x, y: input.y }
    this.blocks.set(input.blockId, next)
    this.updateElements((element) =>
      existing.shapeIds.includes(element.id)
        ? ({ ...element, x: element.x + dx, y: element.y + dy } as ExcalidrawElementLike)
        : element
    )

    return next
  }

  deleteBlock(input: { blockId: string }): string[] {
    const existing = this.blocks.get(input.blockId)
    if (!existing) return []

    const deletedShapeIds = existing.shapeIds
    this.replaceElements(this.api.getSceneElements().filter((element) => !deletedShapeIds.includes(element.id)))
    this.blocks.delete(input.blockId)

    return deletedShapeIds
  }

  getBlockById(blockId: string): CanvasBlock | null {
    return this.blocks.get(blockId) ?? null
  }

  getBlockByName(name: string): CanvasBlock | null {
    return [...this.blocks.values()].find((block) => block.name === name) ?? null
  }

  getCanvasState(): CanvasObservationState {
    const appState = this.api.getAppState()
    return {
      canvasId: this.canvasId,
      selectedShapeIds: Object.entries(appState.selectedElementIds ?? {})
        .filter(([, selected]) => selected)
        .map(([elementId]) => elementId),
      viewport: {
        x: -(appState.scrollX ?? 0),
        y: -(appState.scrollY ?? 0),
        w: appState.width ?? 0,
        h: appState.height ?? 0
      },
      blocks: [...this.blocks.values()]
    }
  }

  zoomToFit(): void {
    this.api.scrollToContent()
  }

  zoomToBlock(blockId: string): void {
    const block = this.blocks.get(blockId)
    if (!block) return

    const elements = this.api.getSceneElements().filter((element) => block.shapeIds.includes(element.id))
    if (elements.length > 0) {
      this.api.scrollToContent(elements)
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
      shapeIds: []
    }

    const elements = this.appendElements(this.createElements(block))
    block.shapeIds = elements.map((element) => element.id)
    this.blocks.set(blockId, block)

    return { block, shapeIds: block.shapeIds }
  }

  private createElements(block: CanvasBlock): ExcalidrawElementLike[] {
    if (block.type === 'text') {
      return [
        this.createTextElement(this.nextId('element'), block.x, block.y, block.text ?? '', block.w)
      ]
    }

    const rectangleId = this.nextId('element')
    const text = block.text ?? ''
    const textId = text ? this.nextId('element') : undefined
    const elements: ExcalidrawElementLike[] = [
      this.createRectangleElement(
        rectangleId,
        block.x,
        block.y,
        block.w ?? 200,
        block.h ?? 120,
        this.getBlockBackground(block.type),
        textId
      )
    ]

    if (text && textId) {
      elements.push(
        this.createTextElement(
          textId,
          block.x + 16,
          block.y + 16,
          text,
          Math.max((block.w ?? 200) - 32, 20),
          {
            containerId: rectangleId,
            height: Math.max((block.h ?? 120) - 32, 28)
          }
        )
      )
    }

    return elements
  }

  private appendElements(elements: ExcalidrawElementLike[]): ExcalidrawElementLike[] {
    this.replaceElements([...this.api.getSceneElements(), ...elements])
    return elements
  }

  private createRectangleElement(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    backgroundColor: string,
    boundTextId?: string
  ): ExcalidrawElementLike {
    return {
      ...this.createBaseElement(id, 'rectangle', x, y, width, height),
      backgroundColor,
      boundElements: boundTextId ? [{ id: boundTextId, type: 'text' }] : null
    } as ExcalidrawElementLike
  }

  private createTextElement(
    id: string,
    x: number,
    y: number,
    text: string,
    width = 200,
    options: { containerId?: string; height?: number } = {}
  ): ExcalidrawElementLike {
    return {
      ...this.createBaseElement(id, 'text', x, y, width, options.height ?? this.estimateTextHeight(text)),
      text,
      originalText: text,
      fontSize: 20,
      fontFamily: 5,
      textAlign: 'left',
      verticalAlign: 'top',
      containerId: options.containerId ?? null,
      autoResize: false,
      lineHeight: 1.25
    } as ExcalidrawElementLike
  }

  private createArrowElement(id: string, x: number, y: number, width: number, height: number): ExcalidrawElementLike {
    return {
      ...this.createBaseElement(id, 'arrow', x, y, width, height),
      points: [[0, 0], [width, height]],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: 'arrow'
    } as ExcalidrawElementLike
  }

  private createBaseElement(
    id: string,
    type: 'rectangle' | 'text' | 'arrow',
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    return {
      id,
      type,
      x,
      y,
      width,
      height,
      angle: 0,
      strokeColor: '#1f2937',
      backgroundColor: '#ffffff',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: type === 'rectangle' ? { type: 3 } : null,
      seed: this.sequence + 1,
      version: 1,
      versionNonce: this.sequence + 1000,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      index: null
    }
  }

  private replaceElements(elements: readonly ExcalidrawElementLike[]): void {
    this.api.updateScene({ elements })
  }

  private updateElements(mapper: (element: ExcalidrawElementLike) => ExcalidrawElementLike): void {
    this.replaceElements(this.api.getSceneElements().map(mapper))
  }

  private updateBlockTextElements(block: CanvasBlock, text: string): void {
    this.updateElements((element) => {
      if (!block.shapeIds.includes(element.id) || element.type !== 'text') return element
      return {
        ...element,
        text,
        originalText: text
      } as ExcalidrawElementLike
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
    this.updateBlockTextElements(block, text)

    return next
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

  private formatTodoBlockText(name: string, tasks: TodoTask[]): string {
    const taskLines = tasks.map((task) => {
      const marker = task.done ? '[x]' : '[ ]'
      return `- ${marker} ${task.text}`
    })

    return [`${name}:`, ...taskLines].join('\n')
  }

  private getBlockCenter(block: CanvasBlock | undefined): { x: number; y: number } {
    if (!block) return { x: 0, y: 0 }
    return {
      x: block.x + (block.w ?? 0) / 2,
      y: block.y + (block.h ?? 0) / 2
    }
  }

  private getBlockBackground(type: CanvasBlock['type']): string {
    switch (type) {
      case 'note':
      case 'todo_block':
        return '#fff3bf'
      case 'task_card':
        return '#dbeafe'
      case 'link_card':
        return '#dcfce7'
      default:
        return '#ffffff'
    }
  }

  private estimateTextHeight(text: string): number {
    return Math.max(text.split('\n').length * 28, 28)
  }

  private nextId(prefix: 'block' | 'element'): string {
    this.sequence += 1
    const suffix = this.sequence.toString().padStart(4, '0')
    return prefix === 'element' ? `element_${suffix}` : `block_${suffix}`
  }

  private nextTodoTaskId(): string {
    this.todoTaskSequence += 1
    return `todo_${this.todoTaskSequence.toString().padStart(4, '0')}`
  }
}
