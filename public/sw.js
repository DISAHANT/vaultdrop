// VaultDrop Service Worker for PWA Support
const CACHE_NAME = 'vaultdrop-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed, continuing anyway:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy for dynamic pages & assets, fallback to cache
self.addEventListener('fetch', (event) => {
  // Do not intercept non-GET requests or chrome-extension schemes
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Let API requests and Pusher/auth requests pass through directly
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/pusher/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Cache static files (images, css, js, icons)
        if (
          url.pathname.match(/\.(png|jpg|jpeg|svg|css|js|woff2|woff|ico)$/) ||
          url.pathname === '/' ||
          url.pathname === '/manifest.json'
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // If offline, try serving from cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // If navigating to a page while offline, return cached root page
        if (event.request.mode === 'navigate') {
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
        }
        return new Response('Offline: Network unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});
