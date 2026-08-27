/*
 * Service worker minimo: guarda en cache lo que la app va pidiendo para que
 * abra sin internet. No precarga nada, asi no hay que mantener listas.
 */
const CACHE = 'adminvurslef-v1'

self.addEventListener('install', (evento) => {
  self.skipWaiting()
  evento.waitUntil(caches.open(CACHE))
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
  if (peticion.method !== 'GET' || !peticion.url.startsWith(self.location.origin)) return

  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        const copia = respuesta.clone()
        caches.open(CACHE).then((cache) => cache.put(peticion, copia)).catch(() => {})
        return respuesta
      })
      .catch(async () => {
        const guardada = await caches.match(peticion)
        if (guardada) return guardada
        if (peticion.mode === 'navigate') {
          const inicio = await caches.match('./index.html')
          if (inicio) return inicio
        }
        return new Response('Sin conexion', { status: 503, statusText: 'Sin conexion' })
      }),
  )
})
