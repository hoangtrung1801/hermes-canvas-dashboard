import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export class CanvasFileStore {
  constructor(private readonly dataDir = join(process.cwd(), 'data')) {}

  async load(canvasId: string): Promise<unknown | null> {
    const filePath = this.filePath(canvasId)
    try {
      return JSON.parse(await readFile(filePath, 'utf8'))
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async save(canvasId: string, snapshot: unknown): Promise<void> {
    const filePath = this.filePath(canvasId)
    await mkdir(this.dataDir, { recursive: true })
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
    await rename(tempPath, filePath)
  }

  private filePath(canvasId: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(canvasId)) {
      throw new Error(`Invalid canvas id ${canvasId}`)
    }

    return join(this.dataDir, `${canvasId}.json`)
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
