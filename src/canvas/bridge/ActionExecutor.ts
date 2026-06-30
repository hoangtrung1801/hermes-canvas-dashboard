import type { CanvasAction } from '../actions/canvasAction.types'
import type { CanvasAdapter } from '../adapters/canvasAdapter'

export type ActionExecutionResult = {
  actionType: CanvasAction['type']
  createdBlockIds?: string[]
  updatedBlockIds?: string[]
  deletedBlockIds?: string[]
  createdShapeIds?: string[]
  createdTaskIds?: string[]
  updatedTaskIds?: string[]
  deletedTaskIds?: string[]
  matchedBlockIds?: string[]
  error?: string
}

export class ActionExecutor {
  constructor(private readonly adapter: CanvasAdapter) {}

  execute(action: CanvasAction): ActionExecutionResult {
    switch (action.type) {
      case 'create_text': {
        const created = this.adapter.createText(action)
        return {
          actionType: action.type,
          createdBlockIds: [created.block.id],
          createdShapeIds: created.shapeIds
        }
      }
      case 'create_box': {
        const created = this.adapter.createBox(action)
        return {
          actionType: action.type,
          createdBlockIds: [created.block.id],
          createdShapeIds: created.shapeIds
        }
      }
      case 'create_note': {
        const created = this.adapter.createNote(action)
        return {
          actionType: action.type,
          createdBlockIds: [created.block.id],
          createdShapeIds: created.shapeIds
        }
      }
      case 'create_todo_block': {
        const created = this.adapter.createTodoBlock(action)
        const tasks = created.block.props?.tasks
        return {
          actionType: action.type,
          createdBlockIds: [created.block.id],
          createdShapeIds: created.shapeIds,
          createdTaskIds: Array.isArray(tasks)
            ? tasks
                .map((task) =>
                  task && typeof task === 'object'
                    ? (task as Record<string, unknown>).id
                    : undefined
                )
                .filter((taskId): taskId is string => typeof taskId === 'string')
            : undefined
        }
      }
      case 'create_task_card': {
        const created = this.adapter.createTaskCard(action)
        return {
          actionType: action.type,
          createdBlockIds: [created.block.id],
          createdShapeIds: created.shapeIds
        }
      }
      case 'create_link_card': {
        const created = this.adapter.createLinkCard(action)
        return {
          actionType: action.type,
          createdBlockIds: [created.block.id],
          createdShapeIds: created.shapeIds
        }
      }
      case 'create_arrow': {
        const created = this.adapter.createArrow(action)
        return {
          actionType: action.type,
          createdBlockIds: [created.block.id],
          createdShapeIds: created.shapeIds
        }
      }
      case 'update_text': {
        const updated = this.adapter.updateText(action)
        return updated
          ? { actionType: action.type, updatedBlockIds: [updated.id] }
          : { actionType: action.type, error: `Unknown block ${action.blockId}` }
      }
      case 'append_todo_task': {
        const appended = this.adapter.appendTodoTask(action)
        return appended
          ? {
              actionType: action.type,
              updatedBlockIds: [appended.block.id],
              createdTaskIds: [appended.task.id]
            }
          : {
              actionType: action.type,
              error: `Unknown todo block ${action.blockId} or duplicate task id ${action.taskId ?? '(generated)'}`
            }
      }
      case 'set_todo_task_done': {
        const updated = this.adapter.setTodoTaskDone(action)
        return updated
          ? {
              actionType: action.type,
              updatedBlockIds: [updated.id],
              updatedTaskIds: [action.taskId]
            }
          : { actionType: action.type, error: `Unknown todo block or task ${action.taskId}` }
      }
      case 'remove_todo_task': {
        const updated = this.adapter.removeTodoTask(action)
        return updated
          ? {
              actionType: action.type,
              updatedBlockIds: [updated.id],
              deletedTaskIds: [action.taskId]
            }
          : { actionType: action.type, error: `Unknown todo block or task ${action.taskId}` }
      }
      case 'move_block': {
        const updated = this.adapter.moveBlock(action)
        return updated
          ? { actionType: action.type, updatedBlockIds: [updated.id] }
          : { actionType: action.type, error: `Unknown block ${action.blockId}` }
      }
      case 'delete_block': {
        const deletedShapeIds = this.adapter.deleteBlock(action)
        return deletedShapeIds.length > 0
          ? { actionType: action.type, deletedBlockIds: [action.blockId] }
          : { actionType: action.type, error: `Unknown block ${action.blockId}` }
      }
      case 'get_block_by_name': {
        const matched = this.adapter.getBlockByName(action.name)
        return matched
          ? { actionType: action.type, matchedBlockIds: [matched.id] }
          : { actionType: action.type, error: `Unknown block named ${action.name}` }
      }
      case 'read_canvas':
      case 'zoom_to_fit':
        if (action.type === 'zoom_to_fit') {
          this.adapter.zoomToFit()
        }
        return { actionType: action.type }
    }
  }
}
