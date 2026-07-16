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
