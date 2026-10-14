// Migration worker: remove the old app-shell cache and reload open pages.
// New pages unregister this worker; HTML and hashed assets load from the network.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('zapitv-'))
        .map((name) => caches.delete(name))
    );

    await self.clients.claim();
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(
      pages
        .filter((page) => new URL(page.url).origin === self.location.origin)
        .map((page) => page.navigate(page.url).catch(() => undefined))
    );
  })());
});
