import { readTldrawObservation } from '../tldraw/tldrawActionExecutor'
import { createTidyCardLayout } from '../tldraw/tidyCardLayout'
import { useBridgeStore } from '../state/bridgeStore'

function TidyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3" width="5" height="5" rx="1" />
      <rect x="12" y="3" width="5" height="5" rx="1" />
      <rect x="3" y="12" width="5" height="5" rx="1" />
      <rect x="12" y="12" width="5" height="5" rx="1" />
    </svg>
  )
}

export function CanvasTidyButton() {
  const editor = useBridgeStore((state) => state.editor)
  const adapter = useBridgeStore((state) => state.adapter)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const addLog = useBridgeStore((state) => state.addLog)

  const tidyCanvas = () => {
    if (!editor || !adapter) return

    const placements = createTidyCardLayout(
      editor.getCurrentPageShapesSorted().map((shape) => ({
        id: String(shape.id),
        type: shape.type,
        x: shape.x,
        y: shape.y,
        props: shape.props as Record<string, unknown>
      }))
    )

    if (placements.length === 0) {
      addLog('info', 'canvas.tidy', 'No card components to arrange')
      return
    }

    editor.markHistoryStoppingPoint('tidy card layout')
    editor.updateShapes(
      placements.map((placement) => ({
        id: placement.id as any,
        type: placement.type as any,
        x: placement.x,
        y: placement.y
      }))
    )

    // Keep the action adapter in step with direct, collaborative tldraw changes.
    for (const placement of placements) {
      const record = adapter.shapes.get(placement.id)
      if (record) {
        adapter.shapes.set(placement.id, { ...record, x: placement.x, y: placement.y })
      }
    }

    editor.zoomToFit({ animation: { duration: 250 } })
    setObservation(readTldrawObservation(adapter))
    addLog('info', 'canvas.tidy', `Arranged ${placements.length} cards by type`)
  }

  const isReady = Boolean(editor && adapter)

  return (
    <button
      type="button"
      className="canvas-tidy-button"
      aria-label="Tidy cards by type"
      disabled={!isReady}
      title={isReady ? 'Arrange cards into groups by type' : 'Canvas is still loading'}
      onClick={tidyCanvas}
    >
      <TidyIcon />
      <span>Tidy</span>
    </button>
  )
}
