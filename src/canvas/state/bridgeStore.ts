import { create } from 'zustand'
import type { CanvasBridge } from '../bridge/CanvasBridge'
import type { CanvasObservationState } from '../blocks/block.types'

type BridgeStatus = 'disconnected' | 'ready' | 'error'

type BridgeStore = {
  bridge: CanvasBridge | null
  status: BridgeStatus
  lastObservation: CanvasObservationState | null
  setBridge(bridge: CanvasBridge): void
  setStatus(status: BridgeStatus): void
  setObservation(state: CanvasObservationState): void
}

export const useBridgeStore = create<BridgeStore>((set) => ({
  bridge: null,
  status: 'disconnected',
  lastObservation: null,
  setBridge: (bridge) => set({ bridge, status: 'ready' }),
  setStatus: (status) => set({ status }),
  setObservation: (lastObservation) => set({ lastObservation })
}))
