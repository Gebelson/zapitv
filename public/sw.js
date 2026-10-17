// ZapiTV Service Worker - Suporte Offline & PWA App Shell
const CACHE_NAME = 'zapitv-shell-v5';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      let assets = [];
      try {
        const response = await fetch('/offline-assets.json', { cache: 'no-store' });
        if (response.ok) assets = await response.json();
      } catch {}
      // Cada recurso é independente: um erro não descarta o app shell inteiro.
      await Promise.allSettled([...PRECACHE_URLS, '/offline-assets.json', ...assets]
        .map(url => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('zapitv-shell-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Apenas requisições GET da mesma origem do app (App Shell e assets locais)
  if (req.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return;

  // NUNCA interceptar módulos de desenvolvimento do Vite/HMR, chamadas de API, vídeo em streaming, chunks parciais ou proxies de vídeo
  // Os downloads offline são gerenciados privadamente via OPFS/IndexedDB
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/components/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.search.includes('t=') ||
    req.headers.has('range') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.webm') ||
    url.pathname.includes('/stream/') ||
    url.search.includes('.mp4') ||
    url.search.includes('.m3u8') ||
    url.search.includes('video') ||
    url.hostname.includes('torrentio') ||
    url.hostname.includes('cinemeta') ||
    url.hostname.includes('tmdb')
  ) {
    return;
  }

  // Requisições de navegação (SPA): Network first, fallback para app shell em cache se offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/index.html')) || (await cache.match('/'));
      })
    );
    return;
  }

  // Recursos estáticos do app: Network-first com fallback para cache e atualização em segundo plano
  event.respondWith(
    fetch(req).then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseClone);
        });
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      // Se for navegação ou html, tenta fallback do index
      if (req.destination === 'document') {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/index.html')) || (await cache.match('/'));
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
