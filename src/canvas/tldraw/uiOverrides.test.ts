import { describe, expect, it } from 'vitest'
import { canvasUiOverrides, DROPPED_TOOL_IDS, KEPT_TOOL_IDS } from './uiOverrides'

function makeTools(ids: readonly string[]) {
  return Object.fromEntries(
    ids.map((id) => [id, { id, label: id, icon: id, onSelect: () => {} }])
  )
}

function applyOverride(ids: readonly string[]) {
  const tools = makeTools(ids)
  return canvasUiOverrides.tools!({} as never, tools as never, {} as never)
}

describe('canvasUiOverrides', () => {
  it('keeps exactly the card-workspace tools', () => {
    const result = applyOverride([...KEPT_TOOL_IDS, ...DROPPED_TOOL_IDS])
    expect(Object.keys(result).sort()).toEqual([...KEPT_TOOL_IDS].sort())
  })

  it('drops the note tool so N cannot spawn a competing sticky', () => {
    const result = applyOverride([...KEPT_TOOL_IDS, 'note'])
    expect(result.note).toBeUndefined()
  })

  it('drops the frame tool so manual frames cannot fight the auto-frame reconciler', () => {
    const result = applyOverride([...KEPT_TOOL_IDS, 'frame'])
    expect(result.frame).toBeUndefined()
  })

  it('drops tools that are not on the keep list even if tldraw adds new ones', () => {
    const result = applyOverride([...KEPT_TOOL_IDS, 'some-future-tool'])
    expect(result['some-future-tool']).toBeUndefined()
  })

  it('tolerates a keep-list tool being absent from the registry', () => {
    const result = applyOverride(['select', 'hand'])
    expect(Object.keys(result).sort()).toEqual(['hand', 'select'])
  })
})
