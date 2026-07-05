import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

const repoRoot = path.resolve(__dirname, '../..')
const createdDirs: string[] = []

async function readRepoFile(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

afterEach(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  createdDirs.length = 0
})

describe('linux service artifacts', () => {
  test('production and development units load the shared environment file and run expected commands', async () => {
    const prodServer = await readRepoFile('systemd/hermes-canvas-server.service')
    const prodApp = await readRepoFile('systemd/hermes-canvas-app.service')
    const devServer = await readRepoFile('systemd/hermes-canvas-server-dev.service')
    const devApp = await readRepoFile('systemd/hermes-canvas-app-dev.service')

    for (const unit of [prodServer, prodApp, devServer, devApp]) {
      expect(unit).toContain('EnvironmentFile=/etc/hermes-canvas/hermes-canvas.env')
      expect(unit).toContain('WorkingDirectory=__HERMES_CANVAS_ROOT__')
      expect(unit).toContain('Restart=on-failure')
    }

    expect(prodServer).toContain('ExecStart=/usr/bin/npm run server')
    expect(prodApp).toContain('ExecStart=/usr/bin/npm run serve:app')
    expect(devServer).toContain('ExecStart=/usr/bin/npm run server')
    expect(devApp).toContain('ExecStart=/usr/bin/npm run dev -- --host ${APP_HOST} --port ${APP_PORT}')
  })

  test('installer exposes dev, prod, and all modes without overwriting an existing env file', async () => {
    const installer = await readRepoFile('scripts/linux/install-systemd-services.sh')

    expect(installer).toContain('MODE="${1:-all}"')
    expect(installer).toContain('dev)')
    expect(installer).toContain('prod)')
    expect(installer).toContain('all)')
    expect(installer).toContain('if [[ ! -f "${ENV_FILE}" ]]')
    expect(installer).toContain('s|__HERMES_CANVAS_ROOT__|${INSTALL_ROOT}|g')
  })
})

describe('static dist server', () => {
  test('resolves built assets and falls back routes to index.html', async () => {
    const { resolveDistFile } = await import('../serve-dist.mjs')
    const distDir = path.join(repoRoot, 'tmp-test-dist')
    createdDirs.push(distDir)
    await mkdir(path.join(distDir, 'assets'), { recursive: true })
    await writeFile(path.join(distDir, 'index.html'), '<main>Hermes Canvas</main>')
    await writeFile(path.join(distDir, 'assets', 'app.js'), 'console.log("ok")')

    await expect(resolveDistFile('/assets/app.js', distDir)).resolves.toBe(
      path.join(distDir, 'assets', 'app.js')
    )
    await expect(resolveDistFile('/canvas/anything', distDir)).resolves.toBe(
      path.join(distDir, 'index.html')
    )
    await expect(resolveDistFile('/assets/missing.js', distDir)).resolves.toBeUndefined()
  })
})
