const CACHE_NAME = "insight-ride-v2.3.0";
const OFFLINE_URL = "./index.html";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./vendor/capacitor.js",
  "./vendor/chart.umd.min.js",
  "./vendor/xlsx.full.min.js",
  "./vendor/jspdf.umd.min.js",
  "./vendor/jspdf.plugin.autotable.min.js",
  "./js/utils.js",
  "./js/storage.js",
  "./js/trips.js",
  "./js/expenses.js",
  "./js/customers.js",
  "./js/reports.js",
  "./js/settings.js",
  "./js/invoices.js",
  "./js/app.js",
  "./icons/icon-72x72.png",
  "./icons/icon-96x96.png",
  "./icons/icon-128x128.png",
  "./icons/icon-144x144.png",
  "./icons/icon-152x152.png",
  "./icons/icon-192x192.png",
  "./icons/icon-384x384.png",
  "./icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;
  const isNavigation = event.request.mode === "navigate";

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch (error) {
        return caches.match(event.request) || caches.match(OFFLINE_URL);
      }
    })());
    return;
  }

  if (!sameOrigin) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);

    const networkFetch = fetch(event.request).then((response) => {
      if (response && response.ok) {
        cache.put(event.request, response.clone());
      }
      return response;
    }).catch(() => cached);

    return cached || networkFetch;
  })());
});
