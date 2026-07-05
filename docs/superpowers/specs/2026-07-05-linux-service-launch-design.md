# Linux Service Launch Design

## Goal

Add Linux service support for running the Hermes canvas gateway and frontend in both development and production-style modes.

## Architecture

The deployment files will live in the repository so they can be reviewed and versioned with the app. `systemd/` will contain service unit templates for development and production. `scripts/linux/install-systemd-services.sh` will install those unit files with the absolute checkout path substituted into `WorkingDirectory`, create an environment file when missing, reload systemd, and optionally enable/start the selected services.

Production frontend serving will use a small dependency-free Node static server that serves `dist/` with SPA fallback. Development mode will keep using Vite directly. The backend will continue using the existing `npm run server` command because the project currently runs the TypeScript gateway through `tsx`.

## Components

- `scripts/serve-dist.mjs`: serves the built frontend from `dist/` on configurable `APP_HOST` and `APP_PORT`.
- `systemd/hermes-canvas-server.service`: production gateway service.
- `systemd/hermes-canvas-app.service`: production frontend service for `dist/`.
- `systemd/hermes-canvas-server-dev.service`: development gateway service.
- `systemd/hermes-canvas-app-dev.service`: development Vite service.
- `systemd/hermes-canvas.env.example`: configurable deployment environment.
- `scripts/linux/install-systemd-services.sh`: installs and manages unit files.
- `README.md`: documents install, build, start, stop, and logs commands.

## Configuration

The units will read `/etc/hermes-canvas/hermes-canvas.env`. The default variables are:

- `HERMES_CANVAS_ROOT`: absolute checkout path.
- `CANVAS_GATEWAY_PORT`: gateway port, default `8787`.
- `APP_HOST`: frontend bind host, default `0.0.0.0`.
- `APP_PORT`: frontend port, default `5173`.
- `VITE_CANVAS_GATEWAY_URL`: browser bridge WebSocket URL.
- `VITE_TLDRAW_SYNC_URL`: tldraw sync WebSocket base URL.

The install script will default `HERMES_CANVAS_ROOT` to the current repository path and will not overwrite an existing environment file.

## Error Handling

The installer will fail fast for missing `systemctl`, missing repository files, or invalid mode. systemd will restart app and gateway services on failure. The static server will exit with a clear error if `dist/index.html` is missing.

## Testing

Automated tests will validate the static server behavior and the Linux service artifacts. The artifact tests will check that units reference the environment file, use the expected npm commands, and that the installer exposes dev, prod, and all modes.
