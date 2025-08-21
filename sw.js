// sw.js — service worker for PWA
const CACHE = "sca-v1";

// List the files you want available offline (add your real pages here)
const ASSETS = [
  "./",
  "./index.html",
  "./share.html",
  "./card.html",
  "./mission.html",
  "./unlock.html",
  "./learn.html",
  "./profile.html",
  "./feedback.html",
  "./redeem.html",
  "./share.css",
  "./share.js",
  "./assets/icons/pwa-192.png",
  "./assets/icons/pwa-512.png"
];

// Install: pre-cache assets
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clear old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin files; network for others (e.g., Firebase)
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
  }
});
