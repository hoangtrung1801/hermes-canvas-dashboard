import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2']
])

export function resolveRequestPath(url, distDir) {
  const requestUrl = new URL(url ?? '/', 'http://localhost')
  const decodedPath = decodeURIComponent(requestUrl.pathname)
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.slice(1)
  const absolutePath = path.resolve(distDir, relativePath)

  if (absolutePath !== distDir && !absolutePath.startsWith(`${distDir}${path.sep}`)) {
    return undefined
  }

  return absolutePath
}

export async function resolveDistFile(url, distDir) {
  const indexPath = path.join(distDir, 'index.html')
  const requestedPath = resolveRequestPath(url, distDir)
  if (!requestedPath) {
    return undefined
  }

  try {
    const fileStat = await stat(requestedPath)
    if (fileStat.isFile()) {
      return requestedPath
    }
  } catch {
    // Fall through to SPA fallback or 404.
  }

  return path.extname(requestedPath) ? undefined : indexPath
}

export function createDistServer(distDir) {
  const indexPath = path.join(distDir, 'index.html')

  if (!existsSync(indexPath)) {
    throw new Error(`Cannot serve frontend: missing ${indexPath}. Run "npm run build" first.`)
  }

  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      response.end('Method Not Allowed')
      return
    }

    const filePath = await resolveDistFile(request.url, distDir)
    if (!filePath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not Found')
      return
    }

    response.writeHead(200, {
      'Cache-Control': filePath === indexPath ? 'no-cache' : 'public, max-age=31536000, immutable',
      'Content-Type': mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream'
    })

    if (request.method === 'HEAD') {
      response.end()
      return
    }

    createReadStream(filePath).pipe(response)
  })
}

export function startDistServer({
  distDir = path.resolve(process.env.DIST_DIR ?? path.join(repoRoot, 'dist')),
  host = process.env.APP_HOST ?? '0.0.0.0',
  port = Number(process.env.APP_PORT ?? 5173)
} = {}) {
  const server = createDistServer(distDir)

  server.listen(port, host, () => {
    const address = server.address()
    const resolvedPort = typeof address === 'object' && address ? address.port : port
    console.log(`Hermes canvas frontend listening on http://${host}:${resolvedPort}`)
  })

  return server
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let server
  try {
    server = startDistServer()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0))
  })
}
