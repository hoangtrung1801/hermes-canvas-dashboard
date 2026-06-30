import { useState } from 'react'
import { useBridgeStore } from '../state/bridgeStore'
import type { CanvasBlock } from '../blocks/block.types'

export function Inspector() {
  const { lastObservation, adapter, bridge, setObservation, addLog } = useBridgeStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all')
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const blocks = lastObservation?.blocks ?? []

  const handleDelete = (blockId: string) => {
    if (!bridge || !adapter) return

    const envelope = {
      type: 'canvas.action' as const,
      requestId: 'insp_del_' + Math.random().toString(36).substring(2, 9),
      canvasId: adapter.canvasId,
      actions: [{ type: 'delete_block' as const, blockId }]
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

  const handleStartEdit = (block: CanvasBlock) => {
    setEditingBlockId(block.id)
    setEditText(block.text ?? block.name ?? '')
  }

  const handleSaveEdit = (blockId: string) => {
    if (!bridge || !adapter) return

    const envelope = {
      type: 'canvas.action' as const,
      requestId: 'insp_edit_' + Math.random().toString(36).substring(2, 9),
      canvasId: adapter.canvasId,
      actions: [{ type: 'update_text' as const, blockId, text: editText }]
    }

    addLog('in', 'canvas.action (Inspector Edit)', envelope)
    const response = bridge.handleActionEnvelope(envelope)
    if ('error' in response) {
      addLog('error', 'canvas.error', response.error)
    } else {
      setObservation(response.observation.state)
      addLog('out', 'canvas.result', response.result)
    }
    setEditingBlockId(null)
  }

  const handleFocus = (blockId: string) => {
    if (!adapter) return
    // Check if our zoomToBlock method is available
    if (typeof (adapter as any).zoomToBlock === 'function') {
      ;(adapter as any).zoomToBlock(blockId)
      addLog('info', 'action_trigger', `Focused view on block: ${blockId}`)
    } else {
      // Fallback: select shape
      const block = adapter.getBlockById(blockId)
      if (block && block.shapeIds[0] && useBridgeStore.getState().editor) {
        const editor = useBridgeStore.getState().editor
        editor.select(block.shapeIds[0])
        editor.zoomToFit()
      }
    }
  }

  const filteredBlocks = blocks.filter((block) => {
    const nameMatch = (block.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const textMatch = (block.text ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const idMatch = block.id.toLowerCase().includes(searchTerm.toLowerCase())
    const termMatches = nameMatch || textMatch || idMatch

    if (selectedTypeFilter === 'all') {
      return termMatches
    }
    return termMatches && block.type === selectedTypeFilter
  })

  // Group blocks by type for quick statistics
  const typeCounts = blocks.reduce<Record<string, number>>((acc, block) => {
    acc[block.type] = (acc[block.type] || 0) + 1
    return acc
  }, {})

  return (
    <aside className="inspector-panel glassmorphic-panel">
      <div className="inspector-header">
        <h3>Canvas Inspector</h3>
        <p className="subtitle">{blocks.length} active blocks on canvas</p>
      </div>

      <div className="filter-controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search by ID, Name or Text..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          value={selectedTypeFilter}
          onChange={(e) => setSelectedTypeFilter(e.target.value)}
          className="type-filter-select"
        >
          <option value="all">All Types</option>
          <option value="text">Text</option>
          <option value="box">Box</option>
          <option value="note">Note</option>
          <option value="todo_block">Todo Block</option>
          <option value="task_card">Task Card</option>
          <option value="link_card">Link Card</option>
          <option value="file_card">File Card</option>
          <option value="job_panel">Job Panel</option>
        </select>
      </div>

      <div className="block-list-container">
        {filteredBlocks.length === 0 ? (
          <div className="empty-state">
            <p>
              {blocks.length === 0
                ? 'Canvas is empty. Create blocks using the Action Simulator or drawn shapes.'
                : 'No blocks matching search filters.'}
            </p>
          </div>
        ) : (
          <div className="block-list">
            {filteredBlocks.map((block) => (
              <div key={block.id} className="block-card">
                <div className="block-card-header">
                  <span className={`block-badge-type type-${block.type}`}>{block.type}</span>
                  <span className="block-card-id">{block.id}</span>
                </div>

                <div className="block-card-body">
                  {editingBlockId === block.id ? (
                    <div className="inline-edit">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="edit-input"
                      />
                      <div className="inline-edit-buttons">
                        <button className="btn-icon btn-save" onClick={() => handleSaveEdit(block.id)}>
                          ✓
                        </button>
                        <button className="btn-icon btn-cancel" onClick={() => setEditingBlockId(null)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="block-title">{block.name || <em>Unnamed</em>}</p>
                      {block.text && <p className="block-text">{block.text}</p>}
                    </>
                  )}

                  <div className="block-coords">
                    x: {Math.round(block.x)}, y: {Math.round(block.y)}
                    {block.w && block.h && ` (${Math.round(block.w)}×${Math.round(block.h)})`}
                  </div>
                </div>

                <div className="block-card-actions">
                  <button
                    className="btn btn-sm btn-icon-only"
                    onClick={() => handleFocus(block.id)}
                    title="Focus on canvas"
                  >
                    🎯
                  </button>
                  <button
                    className="btn btn-sm btn-icon-only"
                    onClick={() => handleStartEdit(block)}
                    title="Edit block text"
                    disabled={editingBlockId === block.id}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-sm btn-icon-only btn-danger-hover"
                    onClick={() => handleDelete(block.id)}
                    title="Delete block"
                  >
                    🗑️
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
            <span className="stat-label">Viewport</span>
            <span className="stat-value">
              {lastObservation
                ? `${Math.round(lastObservation.viewport.x)},${Math.round(lastObservation.viewport.y)}`
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
