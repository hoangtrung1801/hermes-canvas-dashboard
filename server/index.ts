import { createCanvasGateway } from './canvas/canvasGateway'

const port = Number(process.env.CANVAS_GATEWAY_PORT ?? 8787)
const gateway = createCanvasGateway(port)

console.log(`Canvas gateway listening on ws://localhost:${port}/canvas`)
console.log(`tldraw sync listening on ws://localhost:${port}/sync/canvas_001`)

process.on('SIGINT', () => {
  gateway.close(() => process.exit(0))
})
