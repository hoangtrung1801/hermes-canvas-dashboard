# PM2 Production Processes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PM2 ecosystem file that supervises the production frontend and gateway server as separate processes.

**Architecture:** A root-level CommonJS ecosystem file exports two fork-mode application definitions that delegate to the repository's existing npm scripts. A Vitest test loads the file directly and locks down process names, commands, working directories, restart behavior, and configurable production environment defaults.

**Tech Stack:** PM2 ecosystem configuration, CommonJS, npm scripts, Vitest, TypeScript

## Global Constraints

- Use `ecosystem.config.cjs` because the package declares `"type": "module"`.
- Run the frontend with `npm run serve:app` and the gateway with `npm run server`.
- Use single-instance fork mode and restart failed processes independently.
- Default `APP_HOST` to `0.0.0.0`, `APP_PORT` to `5173`, and `CANVAS_GATEWAY_PORT` to `8787`, while preserving values supplied in the shell environment.
- Do not build the frontend, install dependencies, or manage secrets from PM2.

---

### Task 1: PM2 production ecosystem

**Files:**
- Create: `ecosystem.config.cjs`
- Create: `scripts/pm2Config.test.ts`

**Interfaces:**
- Consumes: package scripts `serve:app` and `server` from `package.json`; shell variables `APP_HOST`, `APP_PORT`, and `CANVAS_GATEWAY_PORT`.
- Produces: a CommonJS `{ apps: Pm2App[] }` configuration consumable by `pm2 start ecosystem.config.cjs --env production`.

- [x] **Step 1: Write the failing configuration test**

```ts
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('PM2 ecosystem configuration', () => {
  it('defines the production frontend and gateway processes', () => {
    const config = require('../ecosystem.config.cjs')

    expect(config.apps).toHaveLength(2)
    expect(config.apps).toEqual([
      expect.objectContaining({
        name: 'hermes-canvas-app',
        cwd: projectRoot,
        script: 'npm',
        args: 'run serve:app',
        exec_mode: 'fork',
        instances: 1,
        autorestart: true,
        env_production: expect.objectContaining({
          NODE_ENV: 'production',
          APP_HOST: process.env.APP_HOST ?? '0.0.0.0',
          APP_PORT: process.env.APP_PORT ?? '5173',
        }),
      }),
      expect.objectContaining({
        name: 'hermes-canvas-server',
        cwd: projectRoot,
        script: 'npm',
        args: 'run server',
        exec_mode: 'fork',
        instances: 1,
        autorestart: true,
        env_production: expect.objectContaining({
          NODE_ENV: 'production',
          CANVAS_GATEWAY_PORT: process.env.CANVAS_GATEWAY_PORT ?? '8787',
        }),
      }),
    ])
  })
})
```

- [x] **Step 2: Run the focused test and verify that it fails**

Run: `npm test -- scripts/pm2Config.test.ts`

Expected: FAIL because `ecosystem.config.cjs` does not exist.

- [x] **Step 3: Add the minimal ecosystem configuration**

```js
const path = require('node:path')

const cwd = path.resolve(__dirname)

module.exports = {
  apps: [
    {
      name: 'hermes-canvas-app',
      cwd,
      script: 'npm',
      args: 'run serve:app',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      env_production: {
        NODE_ENV: 'production',
        APP_HOST: process.env.APP_HOST ?? '0.0.0.0',
        APP_PORT: process.env.APP_PORT ?? '5173',
      },
    },
    {
      name: 'hermes-canvas-server',
      cwd,
      script: 'npm',
      args: 'run server',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      env_production: {
        NODE_ENV: 'production',
        CANVAS_GATEWAY_PORT: process.env.CANVAS_GATEWAY_PORT ?? '8787',
      },
    },
  ],
}
```

- [x] **Step 4: Run focused and repository verification**

Run: `npm test -- scripts/pm2Config.test.ts`

Expected: the PM2 configuration test passes.

Run: `npm run lint:types`

Expected: TypeScript exits successfully.

Run: `npm run build`

Expected: TypeScript and Vite complete successfully and produce `dist/index.html` for `serve:app`.

- [x] **Step 5: Commit the implementation**

```bash
git add ecosystem.config.cjs scripts/pm2Config.test.ts docs/superpowers/plans/2026-07-16-pm2-production-processes.md
git commit -m "feat: add PM2 production processes"
```
