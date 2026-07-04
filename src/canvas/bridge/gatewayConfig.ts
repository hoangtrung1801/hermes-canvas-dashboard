type GatewayEnv = {
  VITE_CANVAS_GATEWAY_URL?: string
  VITE_TLDRAW_SYNC_URL?: string
}

export function getCanvasGatewayUrl(env: GatewayEnv = import.meta.env) {
  const url = env.VITE_CANVAS_GATEWAY_URL?.trim()
  return url ? url : null
}

export function getTldrawSyncUrl(canvasId: string, env: GatewayEnv = import.meta.env): string {
  const explicit = env.VITE_TLDRAW_SYNC_URL?.trim()
  if (explicit) {
    return `${explicit.replace(/\/$/, '')}/${encodeURIComponent(canvasId)}`
  }

  const gatewayUrl = getCanvasGatewayUrl(env)
  if (gatewayUrl) {
    try {
      const url = new URL(gatewayUrl)
      return `${url.origin}/sync/${encodeURIComponent(canvasId)}`
    } catch {
      // Fall through to the local gateway default.
    }
  }

  return `ws://localhost:8787/sync/${encodeURIComponent(canvasId)}`
}
