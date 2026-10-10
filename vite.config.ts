import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `npm run dev:worker` serves the API on :8787; the Vite dev server proxies to it.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Never inline fonts as data: URIs — the CSP only allows fonts from 'self'.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
})
