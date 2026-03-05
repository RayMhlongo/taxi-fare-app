const CACHE_NAME = 'taxi-fare-v2';
const OFFLINE_FALLBACK = new URL('./index.html', self.location.href).toString();

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      './index.html',
      './manifest.json',
      './icons/icon-192x192.png',
      './icons/icon-512x512.png'
    ]).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const isNav = event.request.mode === 'navigate';
  event.respondWith(
    (isNav ? fetch(event.request) : Promise.reject()).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
      return res;
    }).catch(() => {
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (!res || res.status !== 200) return res;
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        }).catch(() => caches.match(OFFLINE_FALLBACK));
      });
    })
  );
});
