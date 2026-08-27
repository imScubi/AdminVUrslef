import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Escribe en el service worker la lista real de archivos a precargar.
 * Se hace aqui porque los nombres llevan un hash distinto en cada build, y sin
 * precarga la app no abre sin senal hasta la segunda visita.
 */
function precargaServiceWorker(): Plugin {
  return {
    name: 'precarga-service-worker',
    apply: 'build',
    closeBundle() {
      const salida = (this.environment?.config?.build?.outDir as string) ?? 'dist'
      const rutaSw = join(salida, 'sw.js')
      let sw: string
      try {
        sw = readFileSync(rutaSw, 'utf8')
      } catch {
        return
      }
      const assets = readdirSync(join(salida, 'assets'))
        .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
        .map((f) => `./assets/${f}`)
      const recursos = ['./', './index.html', './manifest.webmanifest', './icono.svg', ...assets]
      writeFileSync(
        rutaSw,
        sw.replace("const RECURSOS = ['./']", `const RECURSOS = ${JSON.stringify(recursos)}`),
      )
    },
  }
}

export default defineConfig({
  // base './' para que funcione en cualquier ruta, con o sin dominio propio.
  base: './',
  plugins: [react(), precargaServiceWorker()],
  build: { outDir: 'dist', sourcemap: false },
})
