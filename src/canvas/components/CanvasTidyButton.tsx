import { reconcileAutoFrames } from '../tldraw/autoFrameReconciler'
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

    const result = reconcileAutoFrames({
      editor,
      adapter,
      mode: 'tidy',
      setObservation,
      addLog
    })
    if (result.error) return

    if (result.cardCount === 0) {
      addLog('info', 'canvas.tidy', 'No card components to frame')
      return
    }

    editor.markHistoryStoppingPoint('tidy auto frames')
    editor.zoomToFit({ animation: { duration: 250 } })
    addLog(
      'info',
      'canvas.tidy',
      `Arranged ${result.cardCount} cards in ${result.frameCount} frames`
    )
  }

  const isReady = Boolean(editor && adapter)

  return (
    <button
      type="button"
      className="canvas-toolbar-button"
      aria-label="Tidy cards by type"
      disabled={!isReady}
      title={isReady ? 'Arrange cards into groups by type' : 'Canvas is still loading'}
      onClick={tidyCanvas}
    >
      <TidyIcon />
    </button>
  )
}
