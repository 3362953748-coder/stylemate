/**
 * 构建后处理:生成 GitHub Pages 的 SPA 回退页。
 *
 * GitHub Pages 是纯静态托管,没有 history fallback,
 * 直接访问子路径会 404。复制 index.html 为 404.html 即可兜底。
 */
import { copyFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const dist = join(process.cwd(), 'dist')

try {
  await access(join(dist, 'index.html'))
  await copyFile(join(dist, 'index.html'), join(dist, '404.html'))
  console.log('[post-build] 已生成 dist/404.html(SPA 回退)')
} catch {
  console.log('[post-build] 跳过:未找到 dist/index.html')
}
