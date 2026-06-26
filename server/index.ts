import { createCanvasGateway } from './canvas/canvasGateway'

const { wss } = createCanvasGateway(8787)

console.log('Canvas gateway listening on ws://localhost:8787/canvas')

process.on('SIGINT', () => {
  wss.close(() => process.exit(0))
})
