import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/admin-api': {
        target: 'https://wsxzuyndslpaklsksmao.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/admin-api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Remove cabeçalhos que identificam a chamada como sendo do navegador
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
            
            // Remove todos os cabeçalhos 'sec-*' (Sec-Fetch-Dest, Sec-Fetch-Mode, etc)
            Object.keys(req.headers || {}).forEach(key => {
              if (key.toLowerCase().startsWith('sec-')) {
                proxyReq.removeHeader(key)
              }
            })
            
            proxyReq.setHeader('User-Agent', 'NodeJS') // Finge ser um servidor Node
          })
        }
      }
    }
  }
})
