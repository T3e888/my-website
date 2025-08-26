// sw.js — Service Worker for Stroke Card Adventure
// Bump this version whenever you change cached files:
const CACHE = "sca-v6";

const CORE_ASSETS = [
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
  "./stats.html",              // include if the page exists

  // CSS (include versioned URL actually used by pages)
  "./global.css",
  "./global.css?v=1",          // ← important: your pages request this exact URL
  "./login.css",
  "./register.css",
  "./card.css",
  "./share.css",
  "./mission.css",
  "./learn.css",
  "./profile.css",
  "./feedback.css",
  "./leaderboard.css",         // include if present

  // JS (include versioned URL actually used by pages)
  "./login.js",
  "./register.js",
  "./card.js",
  "./share.js",
  "./mission.js",
  "./learn.js",
  "./profile.js",
  "./profile.js?v=th-2",       // ← important: profile.html uses this
  "./feedback.js",
  "./unlock.js",
  "./sponsor.js",
  "./leaderboard.js",          // include if present

  // Icons
  "./assets/icons/pwa-192.png",
  "./assets/icons/pwa-512.png"
];

// Install: pre-cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
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

// Fetch: cache-first for same-origin; runtime cache for images (cards)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // Same-origin
  if (url.origin === location.origin) {
    // Runtime cache card images (no need to list all files)
    const isCardImage =
      req.destination === "image" || url.pathname.includes("/assets/cards/");

    if (isCardImage) {
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

    // Default cache-first for pages & static assets
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
    return;
  }

  // Cross-origin (Firebase/Auth/etc.): network-first with cache fallback
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
