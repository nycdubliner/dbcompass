const CACHE_NAME = 'dbcompass-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './src/app.js',
  './src/api.js',
  './src/math.js',
  './src/ui.js',
  './src/city-detector.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Tell the active service worker to take control of the page immediately.
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests for our assets, exclude API calls
  if (event.request.method !== 'GET' || event.request.url.includes('api.jcdecaux.com')) {
    return;
  }
  
  // Network-first strategy with cache fallback
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      return caches.open(CACHE_NAME).then((cache) => {
        // Update cache with the fresh network response
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      });
    }).catch(() => {
      // If network fails, return from cache
      return caches.match(event.request);
    })
  );
});
