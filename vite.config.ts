import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: { outDir: 'dist', sourcemap: false },
  server: {
    // `npm run dev` gives you the UI with hot reload; `npm run dev:api` runs the
    // Worker and its local D1 alongside it. Without the second one the app still
    // runs — it just reports itself as offline and keeps the plan in this
    // browser, which is fine for working on the interface.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
})
