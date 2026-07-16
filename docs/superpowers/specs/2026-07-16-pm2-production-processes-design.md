# PM2 Production Processes Design

## Goal

Add one PM2 ecosystem configuration that runs the built frontend and the TypeScript gateway server as separate production processes.

## Configuration

Create `ecosystem.config.cjs` at the repository root. CommonJS avoids ambiguity because the package declares `"type": "module"`, while PM2 ecosystem files are conventionally loaded as CommonJS.

The configuration defines two fork-mode, single-instance applications:

- `hermes-canvas-app` runs `npm run serve:app` from the repository root.
- `hermes-canvas-server` runs `npm run server` from the repository root.

Both processes use the current Node environment, restart automatically after failures, and expose production defaults through PM2's `env_production` configuration. Existing shell environment values may override the defaults for `APP_HOST`, `APP_PORT`, and `CANVAS_GATEWAY_PORT`.

## Runtime Flow

An operator first installs dependencies and runs `npm run build`. Starting PM2 with `pm2 start ecosystem.config.cjs --env production` launches both processes. The frontend static server reads the generated `dist` directory, and the gateway listens independently on its configured port.

PM2 is responsible only for process supervision. It does not build the frontend, install dependencies, or manage secrets.

## Failure Handling

PM2 restarts either process independently if it exits unexpectedly. The existing frontend server produces a clear error when `dist/index.html` is missing, so no additional preflight script is needed.

## Verification

Verification will include:

- Loading the ecosystem file with Node to confirm valid CommonJS syntax and the expected two application definitions.
- Running the existing type-check or build command to ensure the repository remains valid.
- Confirming the configured script names match `package.json`.
