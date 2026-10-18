/* MyHifz offline cache */
const CACHE = 'myhifz-2f58820f3d';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-maskable.png', 'quran.json', 'de.json', 'tajweed.json', 'lex.json', 'words.json', 'mushaf.json'];
self.addEventListener('install', e => {
  // cache: 'reload' skips the HTTP cache (GitHub Pages lets files be cached for 10 minutes), so a new version never stores old files
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('myhifz-') || k.startsWith('rahle-')) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match('index.html'))));
  } else if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.indexOf('/quran-qcf4@') > 0) {
    // the page fonts of the mushaf: fetched once, kept across versions of the app (the address names a fixed commit)
    e.respondWith(caches.open('qcf4-fonts-1').then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE + '-fonts').then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
