// Gist service worker — offline-first static site caching
const CACHE_VERSION = 'gist-v2';
const PRECACHE_URLS = [
  '/',
  '/create',
  '/spec',
  '/favicon.svg',
  '/og-image.svg',
  '/fonts/dm-mono-400-latin.woff2',
  '/fonts/dm-sans-normal-latin.woff2',
  '/fonts/dm-sans-italic-latin.woff2',
  '/fonts/instrument-serif-normal-latin.woff2',
  '/fonts/instrument-serif-italic-latin.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // HTML pages: network-first (get latest deploy), fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Static assets (fonts, CSS, JS, images): cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        return response;
      });
    }),
  );
});
