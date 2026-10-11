// FloodLens Service Worker — handles offline caching and background sync
const CACHE_NAME = 'floodlens-v1';

// Assets to pre-cache on install (app shell)
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/maplibre-gl-worker.mjs',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  // Immediately take control without waiting for old SW to expire
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and third-party tile/map requests (always fresh from network)
  if (request.method !== 'GET') return;
  if (url.hostname.includes('google.com') || url.hostname.includes('openstreetmap.org')) return;
  if (url.hostname.includes('amazonaws.com')) return;

  // API routes: network-first, fall back to stale cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell / static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
