// sw.js — Network-first for HTML, cache-first for images, SWR for css/js
const CACHE = "sca-v19"; // bump this

const CORE_ASSETS = [
  "./","./index.html","./manifest.webmanifest",

  // pages (add versioned too)
  "./login.html","./register.html","./card.html","./share.html","./mission.html",
  "./learn.html","./profile.html","./feedback.html","./unlock.html","./redeem.html",
  "./leaderboard.html","./stats.html","./play-menu.html","./mycards.html",
  "./mycharacter.html","./upgrade.html","./merge.html","./mutation.html","./collection.html","./play.html",

  // css
  "./global.css","./global.css?v=8",
  "./share.css","./share.css?v=prelogo",
  "./profile.css","./profile.css?v=3",

  // js
  "./app.js","./login.js","./register.js","./card.js","./share.js","./mission.js",
  "./learn.js","./profile.js","./profile.js?v=th-6","./feedback.js","./unlock.js",
  "./sponsor.js","./leaderboard.js",

  // icons/images
  "./assets/icons/pwa-192.png","./assets/icons/pwa-512.png",
  "./assets/icons/favicon-16.png","./assets/icons/favicon-32.png",
  "./assets/logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE_ASSETS.map(async (url) => {
      try {
        const resp = await fetch(url, { cache: "no-cache" });
        if (resp && resp.ok) await cache.put(url, resp.clone());
      } catch {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Network-first for navigations/HTML => prevents "title only" stale page
  if (req.mode === "navigate" ||
      (url.origin === location.origin && url.pathname.endsWith(".html"))) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match("./index.html"));
      }
    })());
    return;
  }

  // Same-origin images: cache-first
  if (url.origin === location.origin) {
    const isImage = req.destination === "image" ||
                    /\/assets\/(cards|icons|partners)\//.test(url.pathname);
    if (isImage) {
      event.respondWith(
        caches.match(req).then(cached =>
          cached || fetch(req).then(resp => {
            caches.open(CACHE).then(c => c.put(req, resp.clone()));
            return resp;
          })
        )
      );
      return;
    }

    // css/js: stale-while-revalidate
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const fetchPromise = fetch(req).then(resp => {
        caches.open(CACHE).then(c => c.put(req, resp.clone()));
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
    return;
  }

  // cross-origin: network, fallback to cache
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
