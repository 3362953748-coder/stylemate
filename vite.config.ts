import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 部署环境注入 PORT 环境变量;本地开发走默认端口。
const port = Number(process.env.PORT) || 5173

export default defineConfig({
  plugins: [react()],
  // 部署环境通过反向代理域名访问,需放行 Host 检查并监听 0.0.0.0
  server: { host: '0.0.0.0', port, allowedHosts: true },
  preview: { host: '0.0.0.0', port, allowedHosts: true },
  build: { outDir: 'dist' },
})
