// sw.js — Service Worker for Stroke Card Adventure
// Bump this version whenever you change cached files:
const CACHE = "sca-v4";

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

  // CSS (add/remove as your repo has)
  "./login.css",
  "./register.css",
  "./card.css",
  "./share.css",
  "./mission.css",
  "./learn.css",
  "./profile.css",
  "./feedback.css",

  // JS (add/remove as your repo has)
  "./login.js",
  "./register.js",
  "./card.js",
  "./share.js",
  "./mission.js",
  "./learn.js",
  "./profile.js",
  "./feedback.js",
  "./unlock.js",
  "./sponsor.js",

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

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== "GET") return;

  // Same-origin: cache-first for pages & assets
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
    return;
  }

  // Cross-origin (Firebase/Auth/etc.): network-first with cache fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
