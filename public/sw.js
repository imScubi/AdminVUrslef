/*
 * Service worker: deja la app lista para abrir sin senal.
 *
 * La lista RECURSOS la escribe el build (ver vite.config.ts), porque los
 * nombres de los archivos llevan un hash que cambia en cada compilacion.
 * Sin precarga, la primera visita no alcanzaba a guardar nada y la app no
 * abria si el celular se quedaba sin internet antes de la segunda carga.
 */
const CACHE = 'adminvurslef-v4'
const RECURSOS = ['./']

self.addEventListener('install', (evento) => {
  self.skipWaiting()
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(RECURSOS).catch(() => undefined)),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return
  if (new URL(peticion.url).origin !== self.location.origin) return

  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone()
          caches.open(CACHE).then((cache) => cache.put(peticion, copia)).catch(() => {})
        }
        return respuesta
      })
      .catch(async () => {
        // ignoreVary es indispensable: el servidor manda Vary: Accept-Encoding
        // y, sin esto, lo precargado en la instalacion no coincide con lo que
        // pide la pagina, asi que la app no abria sin senal.
        const opciones = { ignoreSearch: true, ignoreVary: true }
        const guardada = await caches.match(peticion, opciones)
        if (guardada) return guardada
        if (peticion.mode === 'navigate') {
          // App de una sola pagina: cualquier ruta se sirve con el index.
          const inicio =
            (await caches.match(new URL('./', self.location.href).href, opciones)) ??
            (await caches.match('./index.html', opciones))
          if (inicio) return inicio
        }
        return new Response('Sin conexion', { status: 503, statusText: 'Sin conexion' })
      }),
  )
})
