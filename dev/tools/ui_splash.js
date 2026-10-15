// Start screen: the page in the heart writes itself, then the app shows; setting, dark mode, reduced motion, load error.
// Run: node ui_splash.js http://127.0.0.1:8765 OUT_DIR
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, base, out] = process.argv;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const human = () => Object.defineProperty(navigator, 'webdriver', { get: () => false });   // automation would skip the animation

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g|404|Failed to load resource/.test(m.text())) errors.push(m.text()); }); };

  // 1. the animation, frame by frame, and when the app takes over
  let ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.addInitScript(human);
  let p = await ctx.newPage(); watch(p);
  const t0 = Date.now();
  await p.goto(base + '/index.html', { waitUntil: 'commit' });
  const log = [];
  for (const t of [250, 800, 1300, 1700, 2100, 2600, 3300]) {
    const w = t - (Date.now() - t0); if (w > 0) await p.waitForTimeout(w);
    const s = await p.evaluate(() => { const sp = document.getElementById('splash'); return { splash: !!sp, out: !!(sp && sp.classList.contains('out')), still: !!(sp && sp.classList.contains('still')), lit: sp ? sp.querySelectorAll('.sp-lit i').length : 0, pens: sp ? sp.querySelectorAll('.sp-pen i').length : 0, words: document.querySelectorAll('#reader .w').length }; });
    log.push([t, s]);
    await p.screenshot({ path: `${out}/s${t}.png` });
  }
  for (const [t, s] of log) console.log(String(t).padStart(5), JSON.stringify(s));

  // 2. dark appearance chosen in the settings: the start screen is dark from the first frame
  // (the app writes its state when it is left, so settings are changed from another page of the same origin)
  const setSettings = async patch => { await p.goto(base + '/manifest.webmanifest'); await p.evaluate(pt => { const d = JSON.parse(localStorage.getItem('rahle.v1')); Object.assign(d.settings, pt); localStorage.setItem('rahle.v1', JSON.stringify(d)); }, patch); };
  await setSettings({ theme: 'dark' });
  await p.goto(base + '/index.html', { waitUntil: 'commit' });
  await p.waitForSelector('#splash');
  const darkBg = await p.evaluate(() => getComputedStyle(document.getElementById('splash')).backgroundColor);
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/dark.png` });
  console.log('dark start screen background', darkBg);

  // 3. animation switched off in the settings: no particles, the app shows as soon as it is ready
  await setSettings({ theme: 'system', intro: false });
  const t1 = Date.now();
  await p.goto(base + '/index.html', { waitUntil: 'commit' });
  await p.waitForSelector('#splash');
  const still = await p.evaluate(() => document.getElementById('splash').classList.contains('still'));
  await p.waitForFunction(() => !document.getElementById('splash') && document.querySelector('#reader .w'), null, { timeout: 8000 });
  console.log('intro off: still =', still, '| app shown after', Date.now() - t1, 'ms');
  // the switch in the settings
  await setSettings({ intro: true });
  await p.goto(base + '/index.html'); await p.waitForSelector('.w'); await p.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 });
  await p.click('#settings-btn'); await p.waitForTimeout(400);
  const sw = await p.$('#s-intro');
  console.log('settings switch', !!sw, sw ? await sw.isChecked() : null);
  await sw.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/setting.png` });
  await sw.click(); await p.waitForTimeout(500);
  console.log('after switching off, stored intro =', await p.evaluate(() => JSON.parse(localStorage.getItem('rahle.v1')).settings.intro));
  await ctx.close();

  // 4. reduced motion: the finished logo, no particles
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addInitScript(human);
  p = await ctx.newPage(); watch(p);
  await p.goto(base + '/index.html', { waitUntil: 'commit' });
  await p.waitForSelector('#splash');
  console.log('reduced motion: still =', await p.evaluate(() => document.getElementById('splash').classList.contains('still')));
  await ctx.close();

  // 5. the Quran text cannot be loaded: the start screen says so
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(human);
  p = await ctx.newPage();
  await p.route('**/quran.json', r => r.fulfill({ status: 404, body: 'nope' }));
  await p.goto(base + '/index.html');
  await p.waitForFunction(() => /nicht geladen/.test(document.getElementById('sp-msg').textContent), null, { timeout: 8000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/fail.png` });
  console.log('load error:', await p.evaluate(() => document.getElementById('sp-msg').textContent), '| visible', await p.evaluate(() => getComputedStyle(document.getElementById('sp-msg')).opacity));
  await ctx.close();

  // 6. under automation (tests): no animation, nothing in the way
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  p = await ctx.newPage(); watch(p);
  const t2 = Date.now();
  await p.goto(base + '/index.html'); await p.waitForSelector('.w');
  await p.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 });
  console.log('automation: start screen gone after', Date.now() - t2, 'ms');
  await ctx.close();

  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
