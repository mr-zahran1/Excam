const CACHE = 'exam-platform-v3';

const APP_SHELL = [
  '/',
  '/index.html',
  '/admin.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/admin-manifest.webmanifest',
  '/teacher.png',
  '/ae-logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (
    req.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Navigation: network first, cached fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();

          event.waitUntil(
            caches.open(CACHE)
              .then(cache => cache.put('/index.html', copy))
          );

          return res;
        })
        .catch(() => caches.match('/index.html'))
    );

    return;
  }

  // Other assets: cache first, network fallback
  event.respondWith(
    caches.match(req)
      .then(cached => {
        if (cached) {
          return cached;
        }

        return fetch(req)
          .then(res => {
            if (!res.ok) {
              return res;
            }

            const copy = res.clone();

            event.waitUntil(
              caches.open(CACHE)
                .then(cache => cache.put(req, copy))
            );

            return res;
          });
      })
      .catch(() => caches.match('/index.html'))
  );
});
