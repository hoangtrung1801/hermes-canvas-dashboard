import { CanvasSurface } from './canvas/components/CanvasSurface'
import { CanvasInsertMenu } from './canvas/components/CanvasInsertMenu'
import { CanvasTidyButton } from './canvas/components/CanvasTidyButton'
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
  const isActionDebugMode = new URLSearchParams(window.location.search).get('debug') === 'true'

  if (!isActionDebugMode) {
    return (
      <main className="fullscreen-canvas-page">
        <section className="fullscreen-canvas-container" aria-label="Fullscreen canvas surface">
          <CanvasTidyButton />
          <CanvasInsertMenu />
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
            <p className="eyebrow">Infinite canvas workspace</p>
            <h1 id="app-title">Hermes Canvas Productivity</h1>
            <p className="brand-description">Visual workspace for agent-driven execution</p>
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
            <CanvasTidyButton />
            <CanvasInsertMenu />
            <CanvasSurface />
          </div>
        </section>

        <Inspector />
      </div>
    </main>
  )
}
