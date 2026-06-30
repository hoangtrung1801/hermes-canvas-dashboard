import type { CanvasBlockType } from './block.types'

type BlockDefinition = {
  label: string
  defaultSize: { w: number; h: number }
  defaultProps?: Record<string, unknown>
}

export const blockRegistry: Record<CanvasBlockType, BlockDefinition> = {
  text: {
    label: 'Text',
    defaultSize: { w: 200, h: 32 }
  },
  box: {
    label: 'Box',
    defaultSize: { w: 240, h: 140 }
  },
  note: {
    label: 'Note',
    defaultSize: { w: 240, h: 180 }
  },
  todo_block: {
    label: 'Todo Block',
    defaultSize: { w: 320, h: 220 },
    defaultProps: { tasks: [] }
  },
  task_card: {
    label: 'Task Card',
    defaultSize: { w: 280, h: 160 },
    defaultProps: { status: 'todo', priority: 'medium' }
  },
  link_card: {
    label: 'Link Card',
    defaultSize: { w: 300, h: 120 },
    defaultProps: { url: '' }
  },
  file_card: {
    label: 'File Card',
    defaultSize: { w: 300, h: 120 }
  },
  job_panel: {
    label: 'Job Panel',
    defaultSize: { w: 360, h: 220 }
  }
}
