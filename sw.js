/* portMrker service worker — lets the installed app open offline.
 * - The app page: network first (always the newest version), cached copy when offline
 * - Libraries, fonts and icons: cache first (their URLs are versioned)
 * - Price APIs (Binance, Finnhub, exchange rates) and Gemini are never cached
 */
const CACHE = 'portmrker-v1';
const STATIC_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App page and its own files: network first, fall back to cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Versioned libraries & fonts: cache first
  if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
  // Everything else (live prices, AI) goes straight to the network
});
