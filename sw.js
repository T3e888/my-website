// sw.js — Service Worker for Stroke Card Adventure
// Bump this version whenever you change cached files:
const CACHE = "sca-v14";   // ← bumped from v10 to v11

const CORE_ASSETS = [
  // Root / PWA
  "./",
  "./index.html",
  "./manifest.webmanifest",

  // Pages
  "./login.html",
  "./register.html",
  "./card.html",
  "./share.html",
  "./mission.html",
  "./learn.html",
  "./profile.html",
  "./feedback.html",
  "./unlock.html",
  "./redeem.html",
  "./leaderboard.html",
  "./stats.html",

  // New pages (play + cards hub)
  "./play-menu.html",
  "./mycards.html",
  "./mycharacter.html",
  "./upgrade.html",
  "./merge.html",
  "./mutation.html",
  "./collection.html",
  "./play.html",

  // CSS  (exact URLs your pages load)
  "./global.css",
  "./global.css?v=1",
  "./login.css",
  "./register.css",
  "./card.css",
  "./share.css",       // ← updated file
  "./mission.css",
  "./learn.css",
  "./profile.css",
  "./feedback.css",
  "./leaderboard.css",

  // JS
  "./app.js",
  "./login.js",
  "./register.js",
  "./card.js",
  "./share.js",
  "./mission.js",
  "./learn.js",
  "./profile.js",
  "./profile.js?v=th-2",
  "./feedback.js",
  "./unlock.js",
  "./sponsor.js",
  "./leaderboard.js",

  // Icons / images
  "./assets/icons/pwa-192.png",
  "./assets/icons/pwa-512.png",
  "./assets/icons/favicon-16.png",
  "./assets/icons/favicon-32.png",
  "./assets/logo.png"
];

// Install: pre-cache (tolerant to 404s/missing files)
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(
      CORE_ASSETS.map(async (url) => {
        try {
          const resp = await fetch(url, { cache: "no-cache" });
          if (resp && resp.ok) await cache.put(url, resp.clone());
        } catch (_e) { /* ignore missing */ }
      })
    );
    await self.skipWaiting();
  })());
});

// Activate: clear old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin; runtime cache for images (cards, icons)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin
  if (url.origin === location.origin) {
    const isImage =
      req.destination === "image" ||
      /\/assets\/(cards|icons|partners)\//.test(url.pathname);

    if (isImage) {
      event.respondWith(
        caches.match(req).then((cached) =>
          cached ||
            fetch(req).then((resp) => {
              const copy = resp.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
              return resp;
            })
        )
      );
      return;
    }

    // Default: cache-first for pages & static assets
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
    return;
  }

  // Cross-origin: network-first with cache fallback
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
