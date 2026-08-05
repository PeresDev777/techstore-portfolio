import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Espelha o "paths" do tsconfig.app.json — TS resolve os tipos, Vite resolve o bundle.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Falha explicitamente se a porta estiver ocupada: a automacao depende de uma baseURL fixa.
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
})
