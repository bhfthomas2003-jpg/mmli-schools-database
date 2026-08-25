/* =========================================================
   MMLI School Database — service-worker.js
   Caches the core app shell so it works offline after first load.
   No external requests are ever cached or made — everything here
   is local to this GitHub Pages site.
   ========================================================= */

const CACHE_NAME = "mmli-school-db-v4";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./database.js",
  "./backup.js",
  "./manifest.json",
  "./showcase.html",
  "./confirmed-schools.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache each file independently so one missing/renamed file never
      // breaks caching for the rest (unlike cache.addAll, which is all-or-nothing).
      Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch(() => {}))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// Cache-first for core assets, network-first fallback for everything else
// on this same origin (keeps things simple and fully local).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin requests

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          return response;
        })
        .catch(() => cached);
    })
  );
});
