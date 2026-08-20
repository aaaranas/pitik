/**
 * Pitik service worker.
 *
 * Hand-written rather than generated, because this app's caching needs are
 * unusual and small: the *photos* are already local (IndexedDB owns them), so
 * the worker only has to keep the application shell reachable. It must never
 * cache anything user-generated and never touch the Supabase origin.
 *
 * Strategies:
 *   navigations        network-first, falling back to cache, then /offline
 *   /_next/static/*    cache-first (content-hashed, safe to keep forever)
 *   same-origin assets stale-while-revalidate
 *   everything else    straight to the network
 */

const VERSION = "pitik-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline";

/**
 * Precached at install so the very first offline load has something to show.
 * Deliberately short — anything else is picked up as it is visited.
 */
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one 404 during a deploy can't fail the whole install.
      await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      // Take over open tabs immediately; the page only activates a new worker
      // after the user agrees to reload, so this can't swap code mid-session.
      await self.clients.claim();
    })(),
  );
});

/**
 * The page asks for the update once the user has accepted it. Never called
 * automatically: replacing the worker under a live camera session risks
 * dropping a photo that hasn't finished encoding.
 */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable, and anything cross-origin — Supabase above all —
  // goes straight to the network so no user photo or token is ever stored here.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.destination === "style" || request.destination === "script" || request.destination === "font") {
    event.respondWith(staleWhileRevalidate(request));
  }
});
