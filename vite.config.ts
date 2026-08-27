import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' para que la app funcione tal cual desde cualquier carpeta,
// sin necesidad de un dominio ni de configurar un servidor.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
})
