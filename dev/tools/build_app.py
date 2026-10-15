"""Assemble MyHifz: the Claude preview (artifact) and the installable web app (PWA zip).

Usage: python3 -I build_app.py APP_DIR DATA_DIR FONT_WOFF2 OUT_DIR
"""
import base64, json, os, re, shutil, sys, zipfile, hashlib

APP, DATA, FONT, OUT = sys.argv[1:5]
src = open(os.path.join(APP, 'src/index.html'), encoding='utf-8').read()
core = open(os.path.join(APP, 'core.js'), encoding='utf-8').read()
app = open(os.path.join(APP, 'src/app.js'), encoding='utf-8').read()
font_b64 = base64.b64encode(open(FONT, 'rb').read()).decode('ascii')
import datetime
_h = hashlib.sha256((src + core + app).encode('utf-8')).hexdigest()[:7]
APP_VERSION = datetime.date.today().strftime('%d.%m.%Y') + ' (' + _h + ')'
app = app.replace('/*APP_VERSION*/', APP_VERSION)
DATA_FILES = ['quran.json', 'de.json', 'tajweed.json', 'lex.json', 'words.json']

def assemble(head_extra):
    html = src.replace('/*FONT_HAFS*/', 'data:font/woff2;base64,' + font_b64)
    # never let a script body close the tag early
    assert '</script' not in core and '</script' not in app
    html = html.replace('/*CORE_JS*/', core).replace('/*APP_JS*/', app)
    html = html.replace('<!--HEAD-->', head_extra)
    return html

# ------------------------------------------------------------ artifact (preview inside Claude)
art = os.path.join(OUT, 'artifact')
shutil.rmtree(art, ignore_errors=True)
os.makedirs(art)
open(os.path.join(art, 'index.html'), 'w', encoding='utf-8').write(assemble(''))
for f in DATA_FILES:
    shutil.copy(os.path.join(DATA, f), os.path.join(art, f))

# ------------------------------------------------------------ installable web app
pwa = os.path.join(OUT, 'pwa')
shutil.rmtree(pwa, ignore_errors=True)
os.makedirs(pwa)
body = assemble('')
m = re.match(r'\s*<title>(.*?)</title>\s*', body, re.S)
title = m.group(1)
body = body[m.end():]
style_start = body.index('<style>')
style_end = body.index('</style>') + len('</style>')
style = body[style_start:style_end]
body = body[:style_start] + body[style_end:]
head = f'''<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="Persönliche Koran-App: Rezitation mit Mitverfolgung, Hifz-Plan und Koran-Wortschatz.">
<meta name="theme-color" content="#FBFCFD" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0D1424" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="MyHifz">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icon-180.png">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{style.replace(chr(10) + '<link', '<link')}
</head>
<body>
'''
open(os.path.join(pwa, 'index.html'), 'w', encoding='utf-8').write(head + body + '\n</body>\n</html>\n')
for f in DATA_FILES:
    shutil.copy(os.path.join(DATA, f), os.path.join(pwa, f))

for icon in ['icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-maskable.png']:
    shutil.copy(os.path.join(APP, icon), os.path.join(pwa, icon))

manifest = {
    'name': 'MyHifz', 'short_name': 'MyHifz', 'lang': 'de', 'dir': 'ltr',
    'description': 'Koran lesen und rezitieren, Hifz planen, Wortschatz lernen.',
    'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'portrait',
    'background_color': '#FBFCFD', 'theme_color': '#2347A8',
    'icons': [
        {'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'icon-maskable.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}
json.dump(manifest, open(os.path.join(pwa, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# cache version derived from content so a new upload refreshes installed copies
h = hashlib.sha256()
for f in ['index.html'] + DATA_FILES:
    h.update(open(os.path.join(pwa, f), 'rb').read())
ver = h.hexdigest()[:10]
sw = '''/* MyHifz offline cache */
const CACHE = 'myhifz-%s';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', %s];
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
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE + '-fonts').then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
''' % (ver, ', '.join("'%s'" % f for f in DATA_FILES))
open(os.path.join(pwa, 'sw.js'), 'w', encoding='utf-8').write(sw)
open(os.path.join(pwa, 'LIESMICH.txt'), 'w', encoding='utf-8').write('''MyHifz – deine Koran-App

MyHifz läuft unter https://moeruc.github.io/Hifz/ (GitHub-Repository MOeruc/Hifz).
Neue Versionen kommen über das Repository; die installierte App lädt sie beim Öffnen selbst.

Diesen Ordner brauchst du nur, wenn du MyHifz woanders selbst hosten willst:
1. Alle Dateien bei einem Webhoster mit HTTPS hochladen (z. B. GitHub Pages oder Netlify).
2. Adresse auf dem Handy öffnen. Android: Chrome, Menü, "App installieren".
   iPhone: Safari, Teilen, "Zum Home-Bildschirm".
3. Fortschritt übertragen: in der alten App Einstellungen > "Sicherung kopieren",
   in der neuen App "Sicherung einfügen".
''')
# zip with a top-level folder, ready to upload
zpath = os.path.join(OUT, 'MyHifz.zip')
if os.path.exists(zpath):
    os.remove(zpath)
with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in sorted(os.listdir(pwa)):
        z.write(os.path.join(pwa, f), 'MyHifz/' + f)
print('built', ver, 'zip', os.path.getsize(zpath))
