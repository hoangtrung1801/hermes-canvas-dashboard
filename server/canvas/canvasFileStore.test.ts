import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasFileStore } from './canvasFileStore'

const snapshot = {
  version: 1,
  canvasId: 'canvas_001',
  elements: [{ id: 'element_0001', type: 'rectangle', x: 0, y: 0, width: 100, height: 80 }],
  adapter: {
    blocks: [],
    sequence: 1,
    todoTaskSequence: 0
  }
}

describe('CanvasFileStore', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hermes-canvas-store-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns null when no canvas file exists', async () => {
    const store = new CanvasFileStore(dir)

    await expect(store.load('canvas_001')).resolves.toBeNull()
  })

  it('saves and loads a canvas snapshot as json', async () => {
    const store = new CanvasFileStore(dir)

    await store.save('canvas_001', snapshot)

    await expect(store.load('canvas_001')).resolves.toEqual(snapshot)
    await expect(readFile(join(dir, 'canvas_001.json'), 'utf8')).resolves.toContain('"canvasId": "canvas_001"')
  })

  it('rejects canvas ids that are unsafe file names', async () => {
    const store = new CanvasFileStore(dir)

    await expect(store.save('../outside', snapshot)).rejects.toThrow('Invalid canvas id')
    await expect(store.load('../outside')).rejects.toThrow('Invalid canvas id')
  })
})
