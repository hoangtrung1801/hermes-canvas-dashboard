import { useState } from 'react'
import { useBridgeStore } from '../state/bridgeStore'
import type { CanvasShapeSummary } from '../blocks/block.types'

export function Inspector() {
  const { lastObservation, adapter, bridge, setObservation, addLog, editor } = useBridgeStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all')
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const shapes = lastObservation?.shapes ?? []

  const handleDelete = (shapeId: string) => {
    if (!bridge || !adapter) return

    const envelope = {
      type: 'canvas.action' as const,
      requestId: 'insp_del_' + Math.random().toString(36).substring(2, 9),
      canvasId: adapter.canvasId,
      actions: [{ type: 'delete_shapes' as const, shapeIds: [shapeId] }]
    }

    addLog('in', 'canvas.action (Inspector Delete)', envelope)
    const response = bridge.handleActionEnvelope(envelope)
    if ('error' in response) {
      addLog('error', 'canvas.error', response.error)
    } else {
      setObservation(response.observation.state)
      addLog('out', 'canvas.result', response.result)
    }
  }

  const handleStartEdit = (shape: CanvasShapeSummary) => {
    setEditingShapeId(shape.id)
    setEditText(getShapeTitle(shape))
  }

  const handleSaveEdit = (shapeId: string) => {
    if (!bridge || !adapter) return

    const envelope = {
      type: 'canvas.action' as const,
      requestId: 'insp_edit_' + Math.random().toString(36).substring(2, 9),
      canvasId: adapter.canvasId,
      actions: [{ type: 'update_shape' as const, shapeId, patch: { props: { title: editText } } }]
    }

    addLog('in', 'canvas.action (Inspector Edit)', envelope)
    const response = bridge.handleActionEnvelope(envelope)
    if ('error' in response) {
      addLog('error', 'canvas.error', response.error)
    } else {
      setObservation(response.observation.state)
      addLog('out', 'canvas.result', response.result)
    }
    setEditingShapeId(null)
  }

  const handleFocus = (shapeId: string) => {
    editor?.select(shapeId as never)
    editor?.zoomToFit()
    addLog('info', 'action_trigger', `Focused view on shape: ${shapeId}`)
  }

  const filteredShapes = shapes.filter((shape) => {
    const searchable = [
      shape.id,
      shape.type,
      getShapeTitle(shape),
      stringProp(shape, 'body'),
      stringProp(shape, 'description'),
      stringProp(shape, 'url')
    ].join(' ').toLowerCase()
    const termMatches = searchable.includes(searchTerm.toLowerCase())

    if (selectedTypeFilter === 'all') {
      return termMatches
    }
    return termMatches && shape.type === selectedTypeFilter
  })

  return (
    <aside className="inspector-panel glassmorphic-panel">
      <div className="inspector-header">
        <h3>Canvas Inspector</h3>
        <p className="subtitle">{shapes.length} active shapes on canvas</p>
      </div>

      <div className="filter-controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search by ID, title or URL..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          value={selectedTypeFilter}
          onChange={(e) => setSelectedTypeFilter(e.target.value)}
          className="type-filter-select"
        >
          <option value="all">All Types</option>
          <option value="todo_block">Todo Block</option>
          <option value="link_card">Link Card</option>
          <option value="geo">Geo</option>
          <option value="text">Text</option>
          <option value="note">Note</option>
        </select>
      </div>

      <div className="block-list-container">
        {filteredShapes.length === 0 ? (
          <div className="empty-state">
            <p>
              {shapes.length === 0
                ? 'Canvas is empty. Create shapes using the Action Simulator or tldraw tools.'
                : 'No shapes matching search filters.'}
            </p>
          </div>
        ) : (
          <div className="block-list">
            {filteredShapes.map((shape) => (
              <div key={shape.id} className="block-card">
                <div className="block-card-header">
                  <span className={`block-badge-type type-${shape.type}`}>{shape.type}</span>
                  <span className="block-card-id">{shape.id}</span>
                </div>

                <div className="block-card-body">
                  {editingShapeId === shape.id ? (
                    <div className="inline-edit">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="edit-input"
                      />
                      <div className="inline-edit-buttons">
                        <button className="btn-icon btn-save" onClick={() => handleSaveEdit(shape.id)}>
                          Save
                        </button>
                        <button className="btn-icon btn-cancel" onClick={() => setEditingShapeId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="block-title">{getShapeTitle(shape) || <em>Untitled</em>}</p>
                      {getShapeDescription(shape) && (
                        <p className="block-text">{getShapeDescription(shape)}</p>
                      )}
                    </>
                  )}

                  <div className="block-coords">
                    x: {Math.round(shape.x)}, y: {Math.round(shape.y)}
                    {shape.w && shape.h && ` (${Math.round(shape.w)}x${Math.round(shape.h)})`}
                  </div>
                </div>

                <div className="block-card-actions">
                  <button
                    className="btn btn-sm btn-icon-only"
                    onClick={() => handleFocus(shape.id)}
                    title="Focus on canvas"
                  >
                    Focus
                  </button>
                  <button
                    className="btn btn-sm btn-icon-only"
                    onClick={() => handleStartEdit(shape)}
                    title="Edit shape title"
                    disabled={editingShapeId === shape.id}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-icon-only btn-danger-hover"
                    onClick={() => handleDelete(shape.id)}
                    title="Delete shape"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="inspector-footer">
        <h4>Telemetry Overview</h4>
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">Camera</span>
            <span className="stat-value">
              {lastObservation
                ? `${Math.round(lastObservation.camera.x)},${Math.round(lastObservation.camera.y)}`
                : 'N/A'}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Selection</span>
            <span className="stat-value">
              {lastObservation?.selectedShapeIds.length ?? 0} items
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}

function getShapeTitle(shape: CanvasShapeSummary): string {
  return stringProp(shape, 'title') || stringProp(shape, 'name')
}

function getShapeDescription(shape: CanvasShapeSummary): string {
  return stringProp(shape, 'body') || stringProp(shape, 'description') || stringProp(shape, 'url')
}

function stringProp(shape: CanvasShapeSummary, key: string): string {
  const value = shape.props[key]
  return typeof value === 'string' ? value : ''
}
