/**
 * INSTITUTIONAL PWA SERVICE WORKER v1.0
 * Handles offline experience and caching of critical assets.
 */

const CACHE_NAME = 'stockmint-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/signup',
  '/logo.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
