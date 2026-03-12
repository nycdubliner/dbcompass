const CACHE_NAME = 'dbcompass-v1';
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
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests for our assets, exclude API calls
  if (event.request.method !== 'GET' || event.request.url.includes('api.jcdecaux.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
