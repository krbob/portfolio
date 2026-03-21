/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:18082'
const allowedHosts = resolveAllowedHosts(process.env.VITE_ALLOWED_HOSTS)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4174,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        ws: false,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Keep Vite proxy failures from crashing the dev server.
          })
        },
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 4174,
    allowedHosts,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})

function resolveAllowedHosts(raw: string | undefined): true | string[] | undefined {
  if (!raw) {
    return undefined
  }

  const normalized = raw
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  if (normalized.length === 0) {
    return undefined
  }

  if (normalized.includes('*')) {
    return true
  }

  return normalized
}
