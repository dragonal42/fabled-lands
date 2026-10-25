'use strict';
// Cache application assets and photo images; never profile JSON or writes.
const CACHE_PREFIX = 'terres-fabuleuses-shell-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = CACHE_PREFIX + '20261025-journal-v11';
const BASE = new URL('./', self.location.href);
const SHELL = [
  './', 'index.php', 'manifest.webmanifest?v=20261024',
  'assets/style.css?v=20261024-lecture', 'assets/controls.css?v=20261025-accueil',
  'assets/app.js?v=20261025-journal', 'assets/adventure.js?v=20261025-accueil', 'assets/rules.js?v=20261025-regions', 'assets/map-viewer.js?v=20261025-accueil',
  'assets/game-data.js?v=20261025-codes', 'assets/install.js', 'assets/photos.js', 'assets/stamps.js', 'assets/creation-rules.json',
  'assets/map-catalog.json', 'assets/maps/monde-fr.jpg', 'assets/maps/sokara-fr.jpg?v=20261024-hd',
  'assets/maps/golnir-fr.jpg?v=20261024-hd', 'assets/maps/ocean-violet-fr.jpg', 'assets/maps/grandes-steppes-fr.jpg',
  'assets/maps/golnir-fr-couleur.jpg', 'assets/maps/ocean-violet-fr-couleur.jpg', 'assets/maps/grandes-steppes-fr-couleur.jpg',
  'assets/maps/uttaku-fr-couleur.jpg', 'assets/maps/ankon-konu-fr-couleur.jpg',
  'assets/maps/monde-fr-couleur.jpg', 'assets/maps/sokara-fr-couleur.jpg', 'assets/icon.svg', 'assets/voyage.svg',
  'assets/vendor/sweetalert2.min.js', 'assets/vendor/sweetalert2.min.css',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png?v=20261024', 'assets/favicon-32.png?v=20261024',
  'assets/favicon.ico?v=20261024'
].map(path => new URL(path, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin) return;
  const relative = url.pathname.slice(BASE.pathname.length);
  const navigation = url.pathname.startsWith(BASE.pathname) && request.mode === 'navigate' && (relative === '' || relative === 'index.php');
  const photo = url.pathname === new URL('getApi.php',BASE).pathname && /^[a-f0-9]{32}$/.test(url.searchParams.get('photo')||'') && /^[a-f0-9]{32}$/.test(url.searchParams.get('owner')||'');
  const asset = url.pathname.startsWith(BASE.pathname) &&
    (/^assets\/.+\.(css|js|json|svg|png|jpg|jpeg|webp|ico)$/.test(relative) || relative === 'manifest.webmanifest');
  if (!navigation && !asset && !photo) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && (!photo || response.headers.get('Content-Type')?.startsWith('image/'))) {
        // A full device cache must never prevent a successful online request.
        try { await cache.put(request, response.clone()); } catch {}
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (navigation) return await cache.match(new URL('./', BASE).href);
      throw error;
    }
  })());
});
