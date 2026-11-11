import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 部署环境注入 PORT 环境变量;本地开发走默认端口。
const port = Number(process.env.PORT) || 5173

// GitHub Pages 部署在仓库子路径(如 /stylemate/)下,需要 base 前缀。
// 通过环境变量注入,本地开发与自有域名部署时留空即可。
// 注意:Git Bash 会把形如 /foo 的环境变量值改写成 Windows 路径,
// 因此这里用 STYLEMATE_BASE 承载,并在下方做归一化处理。
const rawBase = process.env.VITE_BASE ?? process.env.STYLEMATE_BASE ?? '/'
const base = rawBase.startsWith('/') && !/[A-Za-z]:/.test(rawBase) ? rawBase : '/'

if (rawBase !== '/' && base === '/') {
  console.warn(
    `[vite] 检测到非法 base 值 "${rawBase}",已回退为 "/"。` +
      'Git Bash 可能把 /foo 改写成了 Windows 路径,请改用 STYLEMATE_BASE。',
  )
}

export default defineConfig({
  base,
  plugins: [react()],
  // 部署环境通过反向代理域名访问,需放行 Host 检查并监听 0.0.0.0
  server: { host: '0.0.0.0', port, allowedHosts: true },
  preview: { host: '0.0.0.0', port, allowedHosts: true },
  build: { outDir: 'dist' },
})
