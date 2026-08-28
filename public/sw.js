/**
 * Ledgr Service Worker
 * Strategy: Network-first for API/Supabase, Cache-first for app shell
 */

const CACHE_NAME = 'ledgr-v1';
const SUPABASE_DOMAIN = 'supabase.co';

// App shell files to pre-cache
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

/* ── Install: cache app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch strategy ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always network for Supabase API calls (auth + data)
  if (url.hostname.includes(SUPABASE_DOMAIN) || url.hostname.includes('googleapis.com')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Network-first for navigation (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok && !url.hostname.includes('localhost') || url.pathname.startsWith('/assets/')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});
