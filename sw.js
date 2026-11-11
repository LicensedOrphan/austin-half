// Offline support: the app shell is cached on install; map library and tiles cache as used.
const VERSION = 'v4';
const SHELL = `shell-${VERSION}`;
const RUNTIME = 'runtime';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/fonts.css',
  'js/app.js', 'js/plan.js', 'js/paces.js', 'js/db.js', 'js/track.js', 'js/guide.js', 'js/cues.js',
  'js/content.js', 'js/state.js', 'js/ui.js', 'js/views.js', 'js/run.js', 'js/player.js', 'js/gpx.js', 'js/map.js', 'js/pull.js',
  'fonts/AtkinsonHyperlegible-400.woff2', 'fonts/AtkinsonHyperlegible-700.woff2',
  'fonts/BarlowCondensed-500.woff2', 'fonts/BarlowCondensed-600.woff2', 'fonts/BarlowCondensed-700.woff2',
  'img/icon.svg', 'img/icon-180.png',
  'img/ex/calf_raise_1.webp', 'img/ex/calf_raise_2.webp', 'img/ex/calf_stretch.webp', 'img/ex/glute_bridge_1.webp', 'img/ex/glute_bridge_2.webp', 'img/ex/goblet_squat_1.webp', 'img/ex/goblet_squat_2.webp', 'img/ex/hamstring_stretch.webp', 'img/ex/hip_flexor_stretch.webp', 'img/ex/leg_swings_1.webp', 'img/ex/leg_swings_2.webp', 'img/ex/pigeon.webp', 'img/ex/plank.webp', 'img/ex/reverse_lunge_1.webp', 'img/ex/reverse_lunge_2.webp', 'img/ex/side_plank.webp', 'img/ex/sl_rdl_1.webp', 'img/ex/sl_rdl_2.webp', 'img/ex/step_up_1.webp', 'img/ex/step_up_2.webp',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    // App files: network first so updates land, cache when offline.
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(SHELL).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
    return;
  }
  if (url.host === 'unpkg.com' || url.host.endsWith('openfreemap.org')) {
    // Map library and tiles: cache first, refresh in the background.
    e.respondWith(caches.open(RUNTIME).then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
