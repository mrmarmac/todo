// Hand-rolled service worker v2 (no plugin, honouring D1/D17; strategy per D22).
// Goals fixed vs v1:
//   1. Stale-forever: navigations are network-first, so an online client always
//      gets the current index.html (which references the current hashed bundles).
//   2. First-visit offline: install fetches index.html, extracts the hashed
//      /assets/ URLs and precaches them — so the shell + bundles are cached even
//      though the first page load happened before the SW controlled the page.
//   3. Dev cache trap: main.tsx now registers the SW in production only, so this
//      file never runs against Vite's transformed /src modules during `vite dev`.
const CACHE = 'todo-pwa-v3';
// Core shell that must be cached for the app to boot offline.
const SHELL = ['/todo/', '/todo/index.html', '/todo/manifest.webmanifest'];

// Pull the hashed asset URLs out of index.html's markup. Vite emits e.g.
//   <script type="module" crossorigin src="/assets/index-XXXX.js"></script>
//   <link rel="stylesheet" crossorigin href="/assets/index-XXXX.css">
// so we match either src="..." or href="..." pointing at /assets/, tolerant of
// attribute order (crossorigin sits before src/href in the current output).
function extractAssetUrls(html) {
  const urls = new Set();
  const re = /(?:src|href)="([^"]*\/assets\/[^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    urls.add(m[1]);
  }
  return [...urls];
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Cache the critical shell first. If this fails install rightly rejects.
      await cache.addAll(SHELL);
      // Best-effort: fetch index.html fresh, precache the hashed bundles it
      // references so the very first (uncontrolled) visit works offline. Any
      // fetch/parse failure here must NOT abort the shell install above, so it
      // is wrapped and individual puts are used rather than a single addAll.
      try {
        const res = await fetch('/todo/index.html', { cache: 'no-cache' });
        if (res.ok) {
          const html = await res.text();
          const assets = extractAssetUrls(html);
          await Promise.all(
            assets.map((url) =>
              cache.add(url).catch(() => {
                /* one bad asset shouldn't fail the rest */
              }),
            ),
          );
        }
      } catch {
        /* offline or parse failure — shell is still cached, assets fill at runtime */
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any cache that isn't the current version (evicts v1 on upgrade).
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));

      // Best-effort prune: navigations are network-first, so old builds' hashed
      // assets accumulate. Fetch the current index.html, and delete cached
      // /assets/ entries no longer referenced by it. Wrapped so offline
      // activation (fetch throws) still succeeds.
      try {
        const res = await fetch('/todo/index.html', { cache: 'no-cache' });
        if (res.ok) {
          const current = new Set(extractAssetUrls(await res.text()));
          const cache = await caches.open(CACHE);
          const requests = await cache.keys();
          await Promise.all(
            requests.map((req) => {
              const path = new URL(req.url).pathname;
              if (path.includes('/assets/') && !current.has(path)) {
                return cache.delete(req);
              }
              return undefined;
            }),
          );
        }
      } catch {
        /* offline — keep whatever assets we have, prune next time */
      }

      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Don't intercept non-GET or cross-origin requests (unchanged from v1).
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const url = new URL(request.url);

  // Navigations: network-first. Try the network so an online client always gets
  // the current index.html (and thus the current bundles); cache a fresh copy;
  // fall back to the cached index.html when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache good responses — a 5xx must not overwrite the cached shell.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/todo/index.html'))),
    );
    return;
  }

  // Hashed /assets/ bundles: filenames are immutable, so cache-first is correct
  // and fast; populate the cache at runtime on a miss.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Other same-origin GETs (manifest, icons): cache-first + runtime-cache,
  // as in v1.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      });
    }),
  );
});
