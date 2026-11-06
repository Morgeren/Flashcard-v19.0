const CACHE_PREFIX = 'nihongo-study-deck-pwa-';
const CACHE_VERSION = 'v19.1.0-cozy-1';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/favicon-16.png',
  './assets/css/typography.css',
  './assets/css/v19-cozy.css',
  './assets/config/seasonal_theme.json',
  './assets/config/typography.json',
  './assets/js/v19/cozy-ui.js',
  './assets/js/v19/bootstrap.js',
  './assets/js/v19/data-audit.js',
  './assets/js/v19/matching.js',
  './assets/js/v19/srs-engine.js',
  './assets/js/v19/seasonal/seasonal-engine.js',
  './assets/js/v19/seasonal/seasonal-date.js',
  './assets/js/v19/seasonal/seasonal-validator.js',
  './assets/js/v19/seasonal/seasonal-token-mapper.js',
  './assets/branding/android/app_icon_192.png',
  './assets/branding/android/app_icon_512.png',
  './assets/branding/android/app_icon_maskable_512.png',
  './assets/branding/favicon/favicon.svg',
  './assets/branding/favicon/favicon-16.png',
  './assets/branding/favicon/favicon-32.png',
  './assets/branding/favicon/favicon-48.png',
  './assets/branding/ios/apple-touch-icon.png',
  './assets/branding/app_icon_master.svg',
  './assets/empty-states/empty_library.png',
  './assets/empty-states/empty_progress.png',
  './assets/empty-states/empty_review.png',
  './assets/empty-states/empty_history.png',
  './assets/empty-states/empty_search.png',
  './assets/illustrations/home/spring/home_spring_mobile.webp',
  './assets/illustrations/study-room/spring/study_room_spring_mobile.webp',
  './assets/illustrations/home/summer/home_summer_mobile.webp',
  './assets/illustrations/study-room/summer/study_room_summer_mobile.webp',
  './assets/illustrations/home/autumn/home_autumn_mobile.webp',
  './assets/illustrations/study-room/autumn/study_room_autumn_mobile.webp',
  './assets/illustrations/home/winter/home_winter_mobile.webp',
  './assets/illustrations/study-room/winter/study_room_winter_mobile.webp',
  './assets/fonts/noto-sans-jp/japanese-core/sans-jp-japanese-core-w400.woff2',
  './assets/fonts/noto-sans-jp/japanese-core/sans-jp-japanese-core-w700.woff2',
  './assets/fonts/noto-sans-jp/japanese-extended/sans-jp-japanese-extended-w400.woff2',
  './assets/fonts/noto-sans-jp/japanese-extended/sans-jp-japanese-extended-w700.woff2',
  './assets/fonts/noto-sans-jp/latin/sans-jp-latin-w400.woff2',
  './assets/fonts/noto-sans-jp/latin/sans-jp-latin-w700.woff2',
  './assets/fonts/noto-sans-jp/symbols/sans-jp-symbols-w400.woff2',
  './assets/fonts/noto-sans-jp/symbols/sans-jp-symbols-w700.woff2',
  './assets/fonts/noto-serif-jp/japanese-core/serif-jp-japanese-core-w400.woff2',
  './assets/fonts/noto-serif-jp/japanese-extended/serif-jp-japanese-extended-w400.woff2',
  './assets/fonts/noto-serif-jp/latin/serif-jp-latin-w400.woff2',
  './assets/fonts/noto-serif-jp/symbols/serif-jp-symbols-w400.woff2',
  './assets/js/legacy/01-core-flashcards.js',
  './assets/js/legacy/02-v3-skills.js',
  './assets/js/legacy/03-toolbar.js',
  './assets/js/legacy/04-storage-migration.js',
  './assets/js/legacy/05-v10-learning-lab.js',
  './assets/js/legacy/06-v11-reading.js',
  './assets/js/legacy/07-v12-enhancements.js',
  './assets/js/legacy/08-v13-personal-tutor.js',
  './assets/js/legacy/09-v182-smart-reader.js',
  './assets/js/legacy/10-v186-advanced-flashcard.js',
  './assets/js/legacy/11-v187-simplified-ui.js',
  './assets/js/legacy/12-pwa-bootstrap.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) { return Response.error(); }
  })());
});
