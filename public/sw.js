/* Service worker de NOVA (PWA iOS / Android). */

const VERSION = 'nova-v1';
const CACHE_STATIQUE = `${VERSION}-statique`;
const CACHE_PAGES = `${VERSION}-pages`;

const RESSOURCES_PRECACHEES = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-96.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/assets/logo/logo.jpg',
];

const CHEMINS_EXCLUS = ['/api/', '/v1/', '/socket.io/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIQUE)
      .then((cache) => cache.addAll(RESSOURCES_PRECACHEES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(noms.filter((nom) => !nom.startsWith(VERSION)).map((nom) => caches.delete(nom)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/** Navigation : réseau d'abord, cache puis page hors ligne. */
async function navigationReseauDAbord(request) {
  try {
    const reponse = await fetch(request);
    if (reponse.ok) {
      const cache = await caches.open(CACHE_PAGES);
      cache.put(request, reponse.clone());
    }
    return reponse;
  } catch (erreur) {
    const cache = await caches.open(CACHE_PAGES);
    const enCache = await cache.match(request);
    if (enCache) return enCache;
    const secours = await caches.open(CACHE_STATIQUE);
    const horsLigne = await secours.match('/offline.html');
    if (horsLigne) return horsLigne;
    return new Response(
      '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Hors ligne</title><body style="font-family:system-ui;padding:2rem"><h1>Vous êtes hors ligne</h1><p>Reconnectez-vous puis réessayez.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/** Ressources statiques : cache d'abord. */
async function cacheDAbord(request) {
  const cache = await caches.open(CACHE_STATIQUE);
  const enCache = await cache.match(request);
  if (enCache) return enCache;
  const reponse = await fetch(request);
  if (reponse.ok) cache.put(request, reponse.clone());
  return reponse;
}

/** Contenu applicatif : réseau d'abord, cache en secours. */
async function reseauDAbord(request) {
  try {
    const reponse = await fetch(request);
    if (reponse.ok) {
      const cache = await caches.open(CACHE_PAGES);
      cache.put(request, reponse.clone());
    }
    return reponse;
  } catch (erreur) {
    const cache = await caches.open(CACHE_PAGES);
    const enCache = await cache.match(request);
    if (enCache) return enCache;
    throw erreur;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (CHEMINS_EXCLUS.some((chemin) => url.pathname.startsWith(chemin))) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationReseauDAbord(request));
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/assets/') ||
    ['style', 'script', 'font', 'image'].includes(request.destination)
  ) {
    event.respondWith(cacheDAbord(request));
    return;
  }

  event.respondWith(reseauDAbord(request));
});
