import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the built site works from the GitHub Pages project
  // subpath (https://rexegan.github.io/nfldeepdive/).
  base: './',
  plugins: [react()],
  server: { host: true },
})
