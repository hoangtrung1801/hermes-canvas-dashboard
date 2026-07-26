import { DefaultToolbar, TldrawUiMenuToolItem } from 'tldraw'
import { ComponentIcon, INSERT_OPTIONS, useCanvasInsert } from './CanvasInsertMenu'

const TOOLBAR_TOOL_IDS = ['select', 'hand', 'arrow', 'text', 'draw', 'eraser'] as const

export function CanvasToolbar() {
  const { insertCard, isReady } = useCanvasInsert()

  return (
    <DefaultToolbar>
      <div className="canvas-toolbar-group" role="group" aria-label="Insert card">
        {INSERT_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            className="canvas-toolbar-insert"
            aria-label={option.label}
            disabled={!isReady}
            title={isReady ? option.label : 'Canvas is still loading'}
            onClick={() => insertCard(option.kind)}
          >
            <ComponentIcon icon={option.icon} />
          </button>
        ))}
      </div>
      <div className="canvas-toolbar-divider" aria-hidden="true" />
      {TOOLBAR_TOOL_IDS.map((toolId) => (
        <TldrawUiMenuToolItem key={toolId} toolId={toolId} />
      ))}
    </DefaultToolbar>
  )
}
