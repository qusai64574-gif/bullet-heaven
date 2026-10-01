/* Service worker — offline app shell.
   The app never needs the network: everything is local. This caches the shell
   so it opens instantly and works with no connection at all. */
const CACHE = 'studyplanner-v1.3.0';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/base.css',
  'css/components.css',
  'css/chat.css',
  'js/core/utils.js',
  'js/core/idb.js',
  'js/core/models.js',
  'js/core/store.js',
  'js/core/cloud.js',
  'js/core/notify.js',
  'js/core/auth.js',
  'js/ui/ui.js',
  'js/ui/router.js',
  'js/domain/planner.js',
  'js/domain/search.js',
  'js/domain/assistant.js',
  'js/data/sample.js',
  'js/screens/auth.js',
  'js/screens/home.js',
  'js/screens/calendar.js',
  'js/screens/lists.js',
  'js/screens/projects.js',
  'js/screens/detail.js',
  'js/screens/more.js',
  'js/screens/assistant.js',
  'js/screens/onboarding.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Navigations: serve the shell, fall back to cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('index.html', copy));
          return res;
        })
        .catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Static assets: cache first, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* Reminder taps open the app at the right item. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.route ? 'index.html#' + data.route : 'index.html#/home';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'NAVIGATE', route: data.route || '/home' });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
