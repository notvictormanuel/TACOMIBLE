// Service worker de Lista de Turno: guarda la app para abrir rápido y sin señal.
// Los datos (Supabase) siempre van a la red.
const CACHE = 'lista-turno-v1'
const BASICOS = ['/', '/manifest.webmanifest', '/icons/icono.svg', '/icons/icono-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET') return

  // Páginas: primero la red, si no hay señal la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copia))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Archivos de la app y fuentes: primero la copia guardada.
  const esPropio = url.origin === self.location.origin
  const esFuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!esPropio && !esFuente) return
  e.respondWith(
    caches.match(req).then(
      (guardado) =>
        guardado ||
        fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
          }
          return res
        }),
    ),
  )
})
