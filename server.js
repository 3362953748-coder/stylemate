/**
 * 静态资源服务器。
 *
 * 部署环境注入 PORT 环境变量,必须监听 0.0.0.0。
 * 这里不依赖 vite preview:npm 会拦截 --host 等参数,
 * 直接用 node 的 http 模块最可控。
 *
 * 用法:node server.js   (需先执行 npm run build)
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const PORT = Number(process.env.PORT) || 3000
const HOST = '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

async function resolveFile(urlPath) {
  // 去掉查询串与哈希
  const clean = urlPath.split('?')[0].split('#')[0]
  // 归一化并阻断路径穿越
  const safe = normalize(decodeURIComponent(clean)).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(ROOT, safe)

  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    // 单页应用回退到 index.html
    filePath = join(ROOT, 'index.html')
  }
  return filePath
}

const server = createServer(async (req, res) => {
  try {
    const filePath = await resolveFile(req.url || '/')
    const body = await readFile(filePath)
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=31536000',
    })
    res.end(body)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`Internal Error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`StyleMate 已启动: http://${HOST}:${PORT} (root: ${ROOT})`)
})
