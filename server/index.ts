import { createCanvasGateway } from './canvas/canvasGateway'

const port = Number(process.env.CANVAS_GATEWAY_PORT ?? 8787)
const gateway = createCanvasGateway(port)

console.log(`Canvas gateway listening on ws://localhost:${port}/canvas`)
console.log(`Canvas state file API listening on http://localhost:${port}/canvas-state/canvas_001`)

process.on('SIGINT', () => {
  gateway.close(() => process.exit(0))
})
