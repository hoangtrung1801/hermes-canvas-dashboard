import { CanvasSurface } from './canvas/components/CanvasSurface'
import { Simulator } from './canvas/components/Simulator'
import { Inspector } from './canvas/components/Inspector'
import { useBridgeStore } from './canvas/state/bridgeStore'

const statusCopy = {
  disconnected: 'Bridge disconnected',
  ready: 'Bridge ready',
  error: 'Bridge error'
} as const

function BridgeStatusMeta({ status }: { status: keyof typeof statusCopy }) {
  return (
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
  )
}

export default function App() {
  const status = useBridgeStore((state) => state.status)
  const isFullscreenCanvas = new URLSearchParams(window.location.search).get('view') === 'canvas'

  if (isFullscreenCanvas) {
    return (
      <main className="fullscreen-canvas-page">
        <header className="fullscreen-canvas-topbar">
          <div className="brand-group fullscreen-brand-group">
            <div className="logo-symbol">H</div>
            <div>
              <p className="eyebrow">Hermes Canvas Bridge</p>
              <h1 id="app-title">Fullscreen Canvas</h1>
            </div>
          </div>

          <div className="fullscreen-topbar-actions">
            <BridgeStatusMeta status={status} />
            <a className="canvas-action-link" href="/">
              Back
            </a>
          </div>
        </header>

        <section className="fullscreen-canvas-container" aria-label="Fullscreen canvas surface">
          <CanvasSurface />
        </section>
      </main>
    )
  }

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
        
        <BridgeStatusMeta status={status} />
      </header>

      <div className="workspace-layout">
        <Simulator />
        
        <section className="canvas-panel">
          <div className="canvas-header-bar">
            <span className="canvas-title">Interactive Canvas Surface</span>
            <div className="canvas-header-actions">
              <span className="canvas-engine-badge">tldraw sync</span>
              <a className="canvas-action-link" href="?view=canvas">
                Fullscreen
              </a>
            </div>
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
