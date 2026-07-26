import type { TLUiOverrides, TLUiToolsContextType } from 'tldraw'

/**
 * The only tools a card workspace needs. Everything else is removed from the
 * registry, which also removes its keyboard shortcut.
 */
export const KEPT_TOOL_IDS = ['select', 'hand', 'arrow', 'text', 'draw', 'eraser'] as const

/**
 * Documented for the test fixture and for readers. The override works by
 * allow-list, so this array is not consulted at runtime — a tool tldraw adds in
 * a future version is dropped without needing to be listed here.
 */
export const DROPPED_TOOL_IDS = [
  'note',
  'asset',
  'rectangle',
  'ellipse',
  'triangle',
  'diamond',
  'hexagon',
  'oval',
  'rhombus',
  'star',
  'cloud',
  'heart',
  'x-box',
  'check-box',
  'arrow-left',
  'arrow-up',
  'arrow-down',
  'arrow-right',
  'line',
  'highlight',
  'laser',
  'frame'
] as const

export const canvasUiOverrides: TLUiOverrides = {
  tools(_editor, tools) {
    const kept: TLUiToolsContextType = {}

    for (const id of KEPT_TOOL_IDS) {
      const tool = tools[id]
      if (tool) kept[id] = tool
    }

    return kept
  }
}
