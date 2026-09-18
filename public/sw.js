const CACHE = 'exam-platform-v4';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network-only service worker. No Response cloning or caching.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).catch(() => {
      if (req.mode === 'navigate') return caches.match('/index.html');
      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});
