import { CanvasSurface } from './canvas/components/CanvasSurface'
import { Simulator } from './canvas/components/Simulator'
import { Inspector } from './canvas/components/Inspector'
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
        <div className="brand-group">
          <div className="logo-glow"></div>
          <div className="logo-symbol">H</div>
          <div>
            <p className="eyebrow">Hermes Canvas Bridge</p>
            <h1 id="app-title">Canvas for Hermes</h1>
          </div>
        </div>
        
        <div className="header-meta">
          <div className={`status-pill status-${status}`} id="bridge-status-pill">
            <span className="pulse-dot"></span>
            <span className="status-text">{statusCopy[status]}</span>
          </div>
          {status !== 'ready' && (
            <div className="sandbox-badge" id="sandbox-demo-badge">
              <span className="badge-dot"></span>
              Sandbox Active
            </div>
          )}
        </div>
      </header>

      <div className="workspace-layout">
        <Simulator />
        
        <section className="canvas-panel">
          <div className="canvas-header-bar">
            <span className="canvas-title">Interactive Canvas Surface</span>
            <span className="canvas-engine-badge">Excalidraw engine</span>
          </div>
          <div className="canvas-container">
            <CanvasSurface />
          </div>
        </section>

        <Inspector />
      </div>
    </main>
  )
}
