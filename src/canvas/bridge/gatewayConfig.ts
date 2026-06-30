type GatewayEnv = {
  VITE_CANVAS_GATEWAY_URL?: string
}

export function getCanvasGatewayUrl(env: GatewayEnv = import.meta.env) {
  const url = env.VITE_CANVAS_GATEWAY_URL?.trim()
  return url ? url : null
}
