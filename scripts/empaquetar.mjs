/*
 * Empaqueta la app en un solo archivo HTML que se abre con doble clic,
 * sin servidor, sin internet y sin instalar nada.
 *
 *   npm run empaquetar   ->   AdminVUrslef.html
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const SALIDA = 'AdminVUrslef.html'

const assets = readdirSync(join(DIST, 'assets'))
const js = assets.filter((f) => f.endsWith('.js'))
const css = assets.filter((f) => f.endsWith('.css'))

if (js.length !== 1) {
  console.error(
    `Se esperaba un solo archivo .js en dist/assets y hay ${js.length}. ` +
      'Si la app se dividio en varios chunks hay que ajustar este script.',
  )
  process.exit(1)
}

const codigo = readFileSync(join(DIST, 'assets', js[0]), 'utf8')
const estilos = css.map((f) => readFileSync(join(DIST, 'assets', f), 'utf8')).join('\n')

// El bundle no usa import/export, asi que puede ir como <script> clasico.
// Eso es lo que permite que funcione desde file:// (un modulo ES no cargaria).
for (const patron of [/^\s*import[\s{*'"]/m, /^\s*export[\s{*]/m, /\bimport\s*\(/]) {
  if (patron.test(codigo)) {
    console.error(
      'El bundle contiene sintaxis de modulos ES y no se puede insertar como script clasico.',
    )
    process.exit(1)
  }
}

const icono = readFileSync(join(DIST, 'icono.svg'), 'utf8')
const iconoDataUri = `data:image/svg+xml;base64,${Buffer.from(icono).toString('base64')}`
const seguro = (texto) => texto.replace(/<\/script/gi, '<\\/script')

const html = `<!doctype html>
<html lang="es-MX">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#4f46e5" />
    <title>AdminVUrslef</title>
    <link rel="icon" href="${iconoDataUri}" />
    <style>${estilos}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${seguro(codigo)}</script>
  </body>
</html>
`

writeFileSync(SALIDA, html)
const kb = (Buffer.byteLength(html) / 1024).toFixed(0)
console.log(`Listo: ${SALIDA} (${kb} KB). Abrelo con doble clic.`)
