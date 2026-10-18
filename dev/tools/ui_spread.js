// UI check: the screen does not turn by itself (an app installed upright-only, or rotation locked). Held across, the
// app offers the two pages; a tap opens them full screen, turned across; held upright again, all is as before.
// Run: node ui_spread.js http://127.0.0.1:8765 OUT_DIR
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, base, out] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // a phone: full screen and turning are possible (recorded here, the test turns the window itself)
  await p.addInitScript(() => {
    window.__calls = [];
    Object.defineProperty(document, 'fullscreenEnabled', { get: () => true });
    let fs = null;
    Object.defineProperty(document, 'fullscreenElement', { get: () => fs });
    Element.prototype.requestFullscreen = function () { window.__calls.push('fullscreen'); fs = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    Document.prototype.exitFullscreen = function () { window.__calls.push('exit'); fs = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    ScreenOrientation.prototype.lock = function (t) { window.__calls.push('lock ' + t); return Promise.resolve(); };
    ScreenOrientation.prototype.unlock = function () { window.__calls.push('unlock'); };
  });
  await p.goto(base + '/index.html');
  await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(2600);   // (past the first-time tip)
  const hold = async (x, y, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await p.evaluate(([x, y]) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y, z: 1 } })), [x, y]); await p.waitForTimeout(100); } };
  const st = () => p.evaluate(() => ({ offer: !document.querySelector('#turn-offer').hidden, turn: document.querySelector('#turn-offer').style.getPropertyValue('--turn'), spread: RahleDebug.Mushaf.spread, calls: window.__calls.slice() }));
  await hold(0.3, 9.6, 1200);
  console.log('upright', JSON.stringify(await st()));
  await hold(-9.6, 0.4, 1500);                       // held across, top to the right; the window stays upright
  const s1 = await st();
  console.log('across', JSON.stringify(s1));
  await p.screenshot({ path: out + '/turn-offer.png' });
  await p.click('#turn-offer');
  await p.waitForTimeout(200);
  await p.setViewportSize({ width: 844, height: 390 });   // the phone turned the window
  await hold(-9.6, 0.4, 900);
  await p.waitForTimeout(500);
  const s2 = await st();
  console.log('opened', JSON.stringify(s2));
  await p.screenshot({ path: out + '/turn-open.png' });
  await hold(0.3, 9.6, 2200);                         // upright again
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(500);
  const s3 = await st();
  console.log('upright again', JSON.stringify(s3));
  // from the menu (Darstellung): opened while the phone is still upright, it stays open until it was held across
  await p.evaluate(() => { window.__calls = []; });
  await p.click('#display-btn'); await p.waitForTimeout(400);
  const hasBtn = await p.evaluate(() => !!document.querySelector('#d-turn'));
  await p.screenshot({ path: out + '/turn-menu.png' });
  if (hasBtn) await p.click('#d-turn');
  await hold(0.3, 9.6, 2200);
  const s4 = await st();
  await hold(9.6, 0.3, 900); await hold(0.3, 9.6, 2000);
  const s5 = await st();
  console.log('menu', hasBtn, JSON.stringify(s4.calls), JSON.stringify(s5.calls));
  const ok = !JSON.parse(JSON.stringify((await st()).offer)) && s1.offer && s1.turn === '-90deg' && s2.spread && s2.calls.includes('lock landscape') && s3.calls.includes('unlock') && s3.calls.includes('exit') && !s3.spread &&
    hasBtn && s4.calls.join() === 'fullscreen,lock landscape' && s5.calls.includes('unlock') && !errs.length;
  console.log(ok ? 'ok   held across: offered, opened two pages, back upright; from the menu too' : 'FAIL', errs.join(' | '));
  await b.close();
  process.exitCode = ok ? 0 : 1;
})();
