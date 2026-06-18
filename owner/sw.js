// Thirsty Beaches Owner Control — Service Worker
// Cache app shell for offline open, NEVER serve stale write responses.
// Security note: this SW caches only GET requests to same-origin assets.
// It does NOT intercept GitHub API requests — those always hit the network
// (write operations must never go through a cache).

const CACHE_NAME = 'tb-control-v1';

// App shell assets to pre-cache (all relative to /owner/)
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-512.svg',
  './icon-maskable.svg',
];

// Install: pre-cache the shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - GitHub API (api.github.com) → network only, never cache
// - Google Fonts → stale-while-revalidate (CSS/fonts only, never write)
// - Same-origin assets → cache-first (app shell)
// - Everything else → network-first with cache fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // GitHub API: always network, never cache — writes must be live
  if (url.hostname === 'api.github.com') {
    event.respondWith(fetch(request));
    return;
  }

  // raw.githubusercontent.com (drinks.json, kiosk-control.json reads): network-first
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Google Fonts: stale-while-revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open('tb-fonts-v1').then(cache =>
        cache.match(request).then(cached => {
          const fresh = fetch(request).then(resp => {
            cache.put(request, resp.clone());
            return resp;
          });
          return cached || fresh;
        })
      )
    );
    return;
  }

  // Same-origin: cache-first (app shell)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return resp;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Message channel: allow the app to send SKIP_WAITING
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
