const CACHE_PREFIX = 'soundwave-shell';
const CACHE_VERSION = 1;
const CACHE_NAME = `${CACHE_PREFIX}-v${CACHE_VERSION}`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-192.svg',
  '/pwa-512.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache music/API endpoints or user-specific data.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match('/index.html')) || (await caches.match('/')) ||
            new Response('SoundWave is offline. Connect to the internet and try again.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        })
    );
    return;
  }

  // Cache only successful same-origin static resources; network first keeps releases fresh.
  if (!['script', 'style', 'image', 'font', 'manifest'].includes(request.destination) &&
      !APP_SHELL.includes(url.pathname) &&
      !url.pathname.startsWith('/assets/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        return (await caches.match(request)) || new Response('', { status: 503 });
      })
  );
});
