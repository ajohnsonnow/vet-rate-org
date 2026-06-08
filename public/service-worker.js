/**
 * Service Worker — Vet-Rate.org offline shell.
 *
 * Strategy:
 *   - **Navigation requests** (HTML): network-first → cache fallback → /offline.html.
 *     Keeps users on a fresh build when the network is up; falls back gracefully when not.
 *   - **Hashed static assets** (/assets/, /images/, /favicon.*): cache-first.
 *     Vite emits content-hashed filenames so cache entries are effectively immutable.
 *   - **Cross-origin requests**: pass through untouched. Critical for the
 *     zero-knowledge stance — AI API calls (Anthropic, Gemini, Google), VA
 *     endpoints, HuggingFace model downloads, and analytics are NEVER cached
 *     here. The browser's HTTP cache and the app's own IndexedDB/localStorage
 *     layers handle their own persistence.
 *   - **Same-origin POST/PUT/DELETE**: pass through (never cache mutations).
 *
 * Versioning:
 *   - CACHE_VERSION bumps invalidate the previous cache on activate.
 *   - Bump when you change app-shell URLs or cache-shape. Hashed assets do
 *     NOT need a bump — their filenames change automatically.
 *
 * Update flow:
 *   - On install, precache the app shell + offline page.
 *   - On activate, delete any cache whose name does not match CACHE_VERSION.
 *   - The page can postMessage({type:"SKIP_WAITING"}) to activate immediately
 *     after a user opts into "Refresh to update" — without that, the new SW
 *     waits until all tabs close, which is the safer default.
 *
 * Closes finding #27 in docs/AUDIT_FINDINGS.md.
 */

const CACHE_VERSION = "vetrate-v2";
const OFFLINE_URL = "/offline.html";

// App shell — the minimum needed to render the offline page and the SPA root.
// Hashed JS/CSS bundles are NOT listed here; they're cached lazily on first
// fetch because their names are build-output dependent.
const PRECACHE_URLS = [
  "/",
  "/index.html",
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Use { cache: "reload" } to bypass the browser HTTP cache during
      // precache — guarantees we get the latest build, not a stale 304.
      cache.addAll(
        PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" })),
      ),
    ),
  );
  // Don't auto-skipWaiting — let the page opt in via postMessage so an
  // in-flight session isn't yanked out from under the user.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Validate origin — only accept messages from same origin. In service
  // workers, event.origin may be empty string for same-origin messages.
  const eventOrigin = event.origin || "";
  const selfOrigin = self.location.origin || "";
  if (eventOrigin !== "" && eventOrigin !== selfOrigin) {
    return;
  }
  // Source must be a controlled client (WindowClient).
  if (!event.source || !("id" in event.source)) {
    return;
  }
  // Page-driven update activation — pages send this after the user accepts
  // an "Update available" prompt.
  if (
    event.data &&
    typeof event.data === "object" &&
    event.data.type === "SKIP_WAITING"
  ) {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1. Only handle GET. Mutations always go straight to the network.
  if (request.method !== "GET") return;

  // 2. Only handle http(s). Skip chrome-extension://, file://, etc.
  if (!request.url.startsWith("http")) return;

  const url = new URL(request.url);

  // 3. Skip cross-origin entirely. AI/VA/analytics/CDN traffic is opaque
  //    to us and the page handles its own retry/error logic.
  if (url.origin !== self.location.origin) return;

  // 4. Skip range requests (video/audio streaming). The browser handles them.
  if (request.headers.has("range")) return;

  // 5. Navigation requests → network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          // Cache the latest index.html so a future offline navigation
          // gets the real shell, not just the static fallback.
          const cache = await caches.open(CACHE_VERSION);
          cache.put("/index.html", fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_VERSION);
          return (
            (await cache.match(request)) ||
            (await cache.match("/index.html")) ||
            (await cache.match(OFFLINE_URL)) ||
            new Response("Offline", { status: 503, statusText: "Offline" })
          );
        }
      })(),
    );
    return;
  }

  // 6. Static asset → cache-first, falling back to network and populating cache.
  //    Hashed Vite output under /assets/ is the common case.
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|gif|ico)$/i.test(
      url.pathname,
    );

  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          // Only cache successful basic responses. 4xx/5xx/redirects/opaque
          // pass through without polluting the cache.
          if (fresh && fresh.ok && fresh.type === "basic") {
            cache.put(request, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          return (
            cached ||
            new Response("Offline asset unavailable", {
              status: 503,
              statusText: "Offline",
            })
          );
        }
      })(),
    );
    return;
  }

  // 7. Everything else (same-origin JSON/API endpoints, dev endpoints):
  //    pass through to the network. Don't cache JSON responses by default
  //    — they may contain user data and we have no way of knowing without
  //    inspecting payloads, which we deliberately don't do.
});
