// UI check: hidden text in the verse-by-verse layout, and the cost of one repaint in al-Baqara
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, url, out] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => { class F { start() { setTimeout(() => this.onstart && this.onstart(), 20); } stop() { setTimeout(() => this.onend && this.onend(), 5); } abort() { this.stop(); } } window.SpeechRecognition = F; window.webkitSpeechRecognition = F; });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForSelector('.w'); await p.waitForTimeout(400);
  // verse by verse, with translation
  await p.evaluate(async () => { const st = RahleDebug.Store.data.settings; st.layout = 'verse'; st.translation = true; });
  await p.evaluate(() => { const D = RahleDebug.D; const s = D.quran.surahs[66]; RahleDebug.Rec.start({ v: s.start, endV: s.start + 4, mode: 'test' }); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const t = RahleDebug.Rec.tracker; t.newSession(); const f = ['تبارك الذي بيده الملك وهو على كل شيء قدير']; t.feed(f, ''); });
  await p.waitForTimeout(400);
  const vb = await p.evaluate(() => [...document.querySelectorAll('.verse-block')].slice(0, 4).map(b => ({ v: b.dataset.v, shown: getComputedStyle(b).display !== 'none', tr: !!b.querySelector('.tr') && getComputedStyle(b.querySelector('.tr')).display !== 'none' })));
  await p.screenshot({ path: out + '/v1-verse-layout.png' });
  console.log('verse blocks', JSON.stringify(vb));
  await p.click('#rec-stop'); await p.waitForTimeout(500); await p.keyboard.press('Escape');
  await p.evaluate(() => { RahleDebug.Store.data.settings.layout = 'flow'; });
  // repaint cost in the longest surah, text hidden
  await p.evaluate(() => { const D = RahleDebug.D; const s = D.quran.surahs[1]; RahleDebug.Rec.start({ v: s.start + 100, endV: s.start + 140, mode: 'test' }); });
  await p.waitForTimeout(1500);
  const ms = await p.evaluate(() => { const R = RahleDebug.Rec; const t0 = performance.now(); for (let i = 0; i < 10; i++) R.paint(true); const t1 = performance.now(); for (let i = 0; i < 10; i++) R.paint(false); return [(t1 - t0) / 10, (performance.now() - t1) / 10]; });
  console.log('paint al-Baqara ms (forced, normal)', ms.map(x => x.toFixed(1)).join(', '));
  await p.screenshot({ path: out + '/v2-baqara-hidden.png' });
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
