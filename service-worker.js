const CACHE_VERSION = 'liv-intel-v9';
const SHELL_ASSETS = [
  './',
  './index.html',
  './assets/style.css',
  './assets/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const DATA_FILES = [
  './data/latest.json',
  './data/latest-trends.json',
  './data/latest-analytics.json'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for data files, cache-first for shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isData = DATA_FILES.some((f) => url.pathname.endsWith(f.replace('./', '/')));

  if (isData) {
    // Network first, fall back to cache for data
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache first for app shell
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
  }
});
