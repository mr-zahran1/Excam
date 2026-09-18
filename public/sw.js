const CACHE = 'exam-platform-v2';
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
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Keep navigation online-first so a deployed update appears immediately; fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put('/index.html', copy));
      return res;
    }).catch(() => caches.match('/index.html')));
    return;
  }

  event.respondWith(caches.match(req).then(cached => {
    const network = fetch(req).then(res => {
      if (res.ok) caches.open(CACHE).then(cache => cache.put(req, res.clone()));
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
