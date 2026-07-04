import { useState } from 'react'
import { useBridgeStore } from '../state/bridgeStore'

const PRESETS = [
  {
    name: 'Todo Block',
    value: {
      type: 'create_todo_block',
      id: 'shape:launch_checklist',
      title: 'Launch Checklist',
      x: 100,
      y: 150,
      tasks: [
        { id: 'task_copy', text: 'Write launch copy' },
        { id: 'task_assets', text: 'Prepare product screenshots', done: true }
      ]
    }
  },
  {
    name: 'Todo Actions Batch',
    value: [
      {
        type: 'create_todo_block',
        id: 'shape:release_tasks',
        title: 'Release Tasks',
        x: 100,
        y: 150,
        tasks: [{ id: 'task_review', text: 'Review release notes' }]
      },
      {
        type: 'append_todo_task',
        shapeId: 'shape:release_tasks',
        taskId: 'task_ship',
        text: 'Ship feature'
      },
      {
        type: 'set_todo_task_done',
        shapeId: 'shape:release_tasks',
        taskId: 'task_review',
        done: true
      }
    ]
  },
  {
    name: 'Sprint Task Card',
    value: {
      type: 'create_task_card',
      id: 'shape:sprint_task',
      title: 'Design New UI System',
      body: 'Create the tldraw-powered Hermes canvas workflow.',
      status: 'in_progress',
      priority: 'high',
      x: 100,
      y: 150
    }
  },
  {
    name: 'Documentation Link',
    value: {
      type: 'create_link_card',
      id: 'shape:tldraw_docs',
      title: 'tldraw Sync Documentation',
      url: 'https://tldraw.dev/docs/sync',
      description: 'Sync server and client setup',
      x: 100,
      y: 350
    }
  },
  {
    name: 'Geo Shape',
    value: {
      type: 'create_shape',
      shape: {
        id: 'shape:geo_box',
        type: 'geo',
        x: 450,
        y: 160,
        props: {
          geo: 'rectangle',
          w: 260,
          h: 140,
          color: 'blue',
          fill: 'solid',
          dash: 'draw',
          size: 'm'
        }
      }
    }
  }
]

export function Simulator() {
  const { bridge, adapter, setObservation, logs, addLog, clearLogs } = useBridgeStore()
  const [activeTab, setActiveTab] = useState<'simulator' | 'logs'>('simulator')
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0)
  const [actionJson, setActionJson] = useState(JSON.stringify(PRESETS[0].value, null, 2))
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index)
    setActionJson(JSON.stringify(PRESETS[index].value, null, 2))
  }

  const executeAction = () => {
    if (!bridge || !adapter) {
      alert('Canvas Bridge is not loaded yet.')
      return
    }

    try {
      const parsed = JSON.parse(actionJson)
      const actions = Array.isArray(parsed) ? parsed : [parsed]

      const envelope = {
        type: 'canvas.action' as const,
        requestId: 'sim_' + Math.random().toString(36).substring(2, 9),
        canvasId: adapter.canvasId,
        actions
      }

      addLog('in', 'canvas.action (Simulated)', envelope)

      const response = bridge.handleActionEnvelope(envelope)

      if ('error' in response) {
        addLog('error', 'canvas.error (Simulated)', response.error)
        alert(`Error executing action: ${response.error.message}`)
        return
      }

      setObservation(response.observation.state)
      addLog('out', 'canvas.result (Simulated)', response.result)
      addLog('out', 'canvas.observation (Simulated)', response.observation)
    } catch (e) {
      alert(`JSON Parse Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const clearCanvas = () => {
    if (!adapter || !bridge) return
    const shapeIds = [...adapter.shapes.keys()]
    if (shapeIds.length === 0) {
      alert('Canvas is already empty.')
      return
    }

    const envelope = {
      type: 'canvas.action' as const,
      requestId: 'clear_' + Math.random().toString(36).substring(2, 9),
      canvasId: adapter.canvasId,
      actions: [{ type: 'delete_shapes' as const, shapeIds }]
    }

    addLog('in', 'canvas.action (Clear Canvas)', envelope)
    const response = bridge.handleActionEnvelope(envelope)
    if ('error' in response) {
      addLog('error', 'canvas.error', response.error)
    } else {
      setObservation(response.observation.state)
      addLog('out', 'canvas.result', response.result)
    }
  }

  const zoomToFit = () => {
    if (!bridge || !adapter) return
    const envelope = {
      type: 'canvas.action' as const,
      requestId: 'fit_' + Math.random().toString(36).substring(2, 9),
      canvasId: adapter.canvasId,
      actions: [{ type: 'zoom_to_fit' as const }]
    }
    const response = bridge.handleActionEnvelope(envelope)
    if (!('error' in response)) {
      setObservation(response.observation.state)
    }
    addLog('info', 'action_trigger', 'Triggered zoom_to_fit')
  }

  return (
    <aside className="simulator-panel glassmorphic-panel">
      <div className="panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >
          Action Simulator
        </button>
        <button
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Logs ({logs.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'simulator' ? (
          <div className="simulator-view">
            <div className="form-group">
              <label htmlFor="preset-select">Select Preset Action</label>
              <select
                id="preset-select"
                value={selectedPresetIndex}
                onChange={(e) => handleSelectPreset(Number(e.target.value))}
              >
                {PRESETS.map((preset, index) => (
                  <option key={index} value={index}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="action-json-editor">Action Payload (JSON)</label>
              <textarea
                id="action-json-editor"
                className="code-editor"
                value={actionJson}
                onChange={(e) => setActionJson(e.target.value)}
                spellCheck="false"
              />
            </div>

            <div className="actions-bar">
              <button className="btn btn-primary" onClick={executeAction}>
                Execute Action
              </button>
              <button className="btn btn-secondary" onClick={zoomToFit}>
                Fit
              </button>
              <button className="btn btn-danger" onClick={clearCanvas}>
                Clear
              </button>
            </div>

            <div className="simulator-info">
              <h4>Quick Guide</h4>
              <p>
                Choose an action template, tweak shape ids, positions, or props, then execute it
                against the mounted tldraw editor.
              </p>
            </div>
          </div>
        ) : (
          <div className="logs-view">
            <div className="logs-header">
              <span>Event Stream Feed</span>
              {logs.length > 0 && (
                <button className="btn-text-danger" onClick={clearLogs}>
                  Clear Logs
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="empty-logs">
                <p>No logged events. Trigger simulator actions or send messages through the WebSocket bridge.</p>
              </div>
            ) : (
              <div className="logs-list">
                {logs.map((log) => (
                  <div key={log.id} className={`log-item dir-${log.direction}`}>
                    <div
                      className="log-summary"
                      onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    >
                      <span className="log-badge">{log.direction.toUpperCase()}</span>
                      <span className="log-type">{log.type}</span>
                      <span className="log-time">{log.timestamp}</span>
                    </div>

                    {expandedLogId === log.id && (
                      <div className="log-detail">
                        <pre>
                          <code>{JSON.stringify(log.payload, null, 2)}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
