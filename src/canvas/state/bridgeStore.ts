import { create } from 'zustand'
import type { CanvasBridge } from '../bridge/CanvasBridge'
import type { CanvasAdapter } from '../adapters/canvasAdapter'
import type { CanvasObservationState } from '../blocks/block.types'

export type BridgeStatus = 'disconnected' | 'ready' | 'error'

export type LogEntry = {
  id: string
  timestamp: string
  direction: 'in' | 'out' | 'info' | 'error'
  type: string
  payload: unknown
}

type BridgeStore = {
  bridge: CanvasBridge | null
  adapter: CanvasAdapter | null
  editor: any | null
  status: BridgeStatus
  lastObservation: CanvasObservationState | null
  logs: LogEntry[]
  setBridge(bridge: CanvasBridge, adapter: CanvasAdapter, editor: any): void
  setStatus(status: BridgeStatus): void
  setObservation(state: CanvasObservationState): void
  addLog(direction: LogEntry['direction'], type: string, payload: unknown): void
  clearLogs(): void
}

export const useBridgeStore = create<BridgeStore>((set) => ({
  bridge: null,
  adapter: null,
  editor: null,
  status: 'disconnected',
  lastObservation: null,
  logs: [],
  setBridge: (bridge, adapter, editor) => set({ bridge, adapter, editor, status: 'ready' }),
  setStatus: (status) => set({ status }),
  setObservation: (lastObservation) => set({ lastObservation }),
  addLog: (direction, type, payload) =>
    set((state) => ({
      logs: [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          direction,
          type,
          payload
        },
        ...state.logs.slice(0, 99)
      ]
    })),
  clearLogs: () => set({ logs: [] })
}))
