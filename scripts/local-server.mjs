import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultLeaderboardPath, newEntryStore } from './leaderboard.mjs'

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
}
const bundle = fileURLToPath(new URL('../dist/', import.meta.url))

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(value))
}

function readBody(request) {
  const chunks = []
  let bytes = 0
  return new Promise((resolveBody, reject) => {
    request.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes <= 16384) chunks.push(chunk)
    })
    request.on('error', reject)
    request.on('end', () => {
      try {
        if (bytes > 16384) throw new Error('Nội dung quá dài.')
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('Dữ liệu gửi lên không hợp lệ.'), { status: 400 }))
      }
    })
  })
}

export async function startLocalServer({ port = 0, dist = bundle, dataPath = defaultLeaderboardPath() } = {}) {
  await stat(resolve(dist, 'index.html')).catch(() => { throw new Error('Chưa có bản build. Chạy npm run build trước.') })
  const entries = newEntryStore(dataPath)
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
      if (pathname === '/api/leaderboard') {
        if (request.method === 'GET') return sendJson(response, 200, { entries: await entries.list() })
        if (request.method === 'POST' && request.headers['content-type']?.startsWith('application/json')) {
          return sendJson(response, 201, { entries: await entries.add(await readBody(request)) })
        }
        return sendJson(response, 405, { error: 'Phương thức không được hỗ trợ.' })
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Phương thức không được hỗ trợ.' })
      const file = resolve(dist, pathname === '/' ? 'index.html' : '.' + pathname)
      const child = relative(dist, file)
      if (child.startsWith('..') || isAbsolute(child)) return sendJson(response, 404, { error: 'Không tìm thấy.' })
      const content = await readFile(file)
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=3600' : 'no-store' })
      response.end(request.method === 'HEAD' ? undefined : content)
    } catch (error) {
      const status = error.status ?? (error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500)
      sendJson(response, status, { error: status === 500 ? 'Không thể đọc hoặc lưu dữ liệu cục bộ.' : error.message })
    }
  })
  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolveListen)
  })
  return { url: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise((done) => server.close(done)) }
}
