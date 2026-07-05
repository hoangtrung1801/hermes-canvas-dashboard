# Linux Service Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scripts and systemd units that launch the Hermes canvas gateway and frontend as Linux services in dev and production-style modes.

**Architecture:** Keep deployment artifacts versioned in `systemd/` and `scripts/linux/`. Add a dependency-free Node static server for the built Vite frontend so production app service does not run the Vite dev server. Validate artifacts with Vitest before adding implementation files.

**Tech Stack:** Node.js ESM, npm scripts, systemd unit files, Bash, Vitest.

---

## File Structure

- Create `scripts/serve-dist.mjs`: dependency-free static file server for `dist/`.
- Create `systemd/hermes-canvas.env.example`: environment template shared by all units.
- Create `systemd/hermes-canvas-server.service`: production gateway service.
- Create `systemd/hermes-canvas-app.service`: production frontend service.
- Create `systemd/hermes-canvas-server-dev.service`: development gateway service.
- Create `systemd/hermes-canvas-app-dev.service`: development frontend service.
- Create `scripts/linux/install-systemd-services.sh`: installer for unit files and env file.
- Create `scripts/linux/linuxServiceArtifacts.test.ts`: artifact and static server tests.
- Modify `package.json`: add `serve:app` script.
- Modify `README.md`: document Linux service usage.

### Task 1: Artifact Tests

**Files:**
- Create: `scripts/linux/linuxServiceArtifacts.test.ts`

- [ ] **Step 1: Write the failing artifact tests**

```ts
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

const repoRoot = path.resolve(__dirname, '../..')
const createdDirs: string[] = []
let staticServer: ReturnType<typeof spawn> | undefined

async function readRepoFile(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

afterEach(async () => {
  if (staticServer) {
    staticServer.kill('SIGTERM')
    staticServer = undefined
  }
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- scripts/linux/linuxServiceArtifacts.test.ts`

Expected: FAIL because service files and `scripts/serve-dist.mjs` do not exist.

### Task 2: Service Artifacts and Static Server

**Files:**
- Create: `scripts/serve-dist.mjs`
- Create: `systemd/hermes-canvas.env.example`
- Create: `systemd/hermes-canvas-server.service`
- Create: `systemd/hermes-canvas-app.service`
- Create: `systemd/hermes-canvas-server-dev.service`
- Create: `systemd/hermes-canvas-app-dev.service`
- Create: `scripts/linux/install-systemd-services.sh`
- Modify: `package.json`

- [ ] **Step 1: Add implementation files and npm script**

Add the static server, env template, four unit files, and installer. Add `"serve:app": "node scripts/serve-dist.mjs"` to `package.json`.

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- scripts/linux/linuxServiceArtifacts.test.ts`

Expected: PASS.

### Task 3: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document Linux service installation and operation**

Add a Linux Services section covering:

- `sudo scripts/linux/install-systemd-services.sh dev --enable --start`
- `npm run build`
- `sudo scripts/linux/install-systemd-services.sh prod --enable --start`
- `sudo scripts/linux/install-systemd-services.sh all --enable --start`
- Editing `/etc/hermes-canvas/hermes-canvas.env`
- Checking logs with `journalctl -u hermes-canvas-server.service -f`

- [ ] **Step 2: Run verification**

Run: `npm test -- scripts/linux/linuxServiceArtifacts.test.ts && npm run lint:types`

Expected: PASS.
