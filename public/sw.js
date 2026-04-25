/**
 * FrontGuard Service Worker
 * Handles offline caching with a cache-first strategy for static assets
 * and network-first for API routes.
 *
 * Place this in /public/sw.js — Next.js serves /public files at root.
 */

const CACHE_NAME = "frontguard-v2";
const OFFLINE_URL = "/offline";

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache critical routes — ignore failures (some may not exist yet)
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => console.warn(`SW: failed to cache ${url}`))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate — clean old caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch strategy ───────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes: network-first, no caching
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: "You are offline. This feature requires a connection." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  // Static assets (_next/static): cache-first, very long TTL
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached ?? fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Dynamic pages use per-request CSP nonces, so never serve cached HTML.
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL).then((cached) => cached ?? new Response("Offline", { status: 503 })))
  );
});

// ─── Background sync placeholder ─────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-logs") {
    // In a real app: flush queued offline actions to the server
    console.log("SW: background sync triggered");
  }
});
