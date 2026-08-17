// service-worker.js — caches every game asset on install so the game
// is fully playable offline after the first visit. Bump CACHE_VERSION
// whenever you ship changed assets; that's what triggers an update.

const CACHE_VERSION = 'gridmunch-v1';

// Paths are relative so this works whether the app is served from the
// domain root or a GitHub Pages project subpath (username.github.io/repo/).
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/storage.js',
  './js/maze-data.js',
  './js/maze.js',
  './js/entities.js',
  './js/input.js',
  './js/game.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first: serve instantly from cache when available (keeps the
// game snappy and fully functional offline), fall back to network for
// anything uncached, and opportunistically cache what we fetch.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
