import { useEffect } from 'react'
import { useBridgeStore } from '../state/bridgeStore'
import {
  reconcileAutoFrames,
  subscribeToAutoFrameChanges
} from '../tldraw/autoFrameReconciler'

export function useCanvasAutoFrames() {
  const editor = useBridgeStore((state) => state.editor)
  const adapter = useBridgeStore((state) => state.adapter)
  const setObservation = useBridgeStore((state) => state.setObservation)
  const addLog = useBridgeStore((state) => state.addLog)

  useEffect(() => {
    if (!editor || !adapter) return

    const reconcile = () => {
      reconcileAutoFrames({ editor, adapter, setObservation, addLog })
    }

    reconcile()
    return subscribeToAutoFrameChanges({ editor, reconcile })
  }, [editor, adapter, setObservation, addLog])
}
