import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // API_PROXY=https://mothertongue-books.vercel.app tries the local site against the live API.
      '/api': { target: process.env.API_PROXY ?? 'http://localhost:8000', changeOrigin: true },
    },
  },
})
