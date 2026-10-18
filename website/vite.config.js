import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so InfinityFree / subdirectory hosting resolves assets correctly.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
