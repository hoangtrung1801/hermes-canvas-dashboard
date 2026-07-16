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
