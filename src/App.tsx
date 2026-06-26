import { CanvasSurface } from './canvas/components/CanvasSurface'
import { useBridgeStore } from './canvas/state/bridgeStore'

const statusCopy = {
  disconnected: 'Bridge disconnected',
  ready: 'Bridge ready',
  error: 'Bridge error'
} as const

export default function App() {
  const status = useBridgeStore((state) => state.status)

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Hermes Canvas Bridge</p>
          <h1>Canvas for Hermes</h1>
        </div>
        <p className="status-pill">{statusCopy[status]}</p>
      </header>

      <section className="canvas-panel">
        <CanvasSurface />
      </section>
    </main>
  )
}
