// Screenshots of every screen in the redesign: node ui_design.js BASE OUT QCF4_DIR [only]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [,, base, out, qcfDir, only] = process.argv;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function fakeSR() {
  window.__queue = []; window.__busy = false;
  class FakeSR {
    constructor() { this.stopped = false; }
    start() { setTimeout(() => { this.onstart && this.onstart(); this.wait(); }, 30); }
    stop() { this.stopped = true; setTimeout(() => this.onend && this.onend(), 10); }
    abort() { this.stop(); }
    wait() {
      if (this.stopped) return;
      if (!window.__queue.length) { setTimeout(() => this.wait(), 60); return; }
      const words = window.__queue.shift().split(' ');
      window.__busy = true;
      let k = 0;
      const emit = (t, f) => { const x = [{ transcript: t, confidence: 0.9 }]; x.isFinal = f; this.onresult && this.onresult({ results: [x], resultIndex: 0 }); };
      const step = () => { if (this.stopped) return; k++; if (k < words.length) { emit(words.slice(0, k).join(' '), false); setTimeout(step, 25); } else { emit(words.join(' '), true); setTimeout(() => { window.__busy = false; this.onend && this.onend(); }, 80); } };
      step();
    }
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
}
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  async function context(opts) {
    const ctx = await b.newContext(Object.assign({ deviceScaleFactor: 2, serviceWorkers: 'block' }, opts));
    await ctx.route('https://cdn.jsdelivr.net/**', route => {
      const name = route.request().url().split('/').pop();
      return route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(qcfDir + '/fonts-woff2/' + name) });
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404|fonts\.g|Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
    await p.addInitScript(fakeSR);
    await p.goto(base + '/index.html'); await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(900);
    return { ctx, p };
  }
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const want = n => !only || only.split(',').includes(n);
  const open = (p, s, a) => p.evaluate(([s, a]) => RahleDebug.Reader.open(RahleDebug.D.quran.surahs[s - 1].start + (a || 1) - 1), [s, a]).then(() => p.waitForTimeout(1300));
  const say = async (p, t) => { await p.evaluate(x => window.__queue.push(x), t); await p.waitForTimeout(120); await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 8000 }); await p.waitForTimeout(350); };

  let { ctx, p } = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (want('read')) { await open(p, 67); await shot(p, 'd01-read-mulk'); }
  if (want('opening')) { await open(p, 1); await shot(p, 'd02-read-fatiha'); await open(p, 2); await shot(p, 'd03-read-baqara'); }
  if (want('immersive')) {
    await open(p, 36, 13);
    await p.evaluate(() => RahleDebug.Mushaf.immersive(true)); await p.waitForTimeout(700); await shot(p, 'd04-immersive');
    await p.evaluate(() => RahleDebug.Mushaf.immersive(false)); await p.waitForTimeout(500);
  }
  if (want('hidden')) {
    await open(p, 67);
    await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[66].start, endV: D.quran.surahs[66].start + 4, mode: 'test' }); });
    await p.waitForTimeout(700);
    await say(p, 'تبارك الذي بيده الملك وهو على كل شيء قدير');
    await say(p, 'الذي خلق الموت والحياة ليبلوكم أحسن عملا وهو العزيز الغفور');
    await p.waitForTimeout(400); await shot(p, 'd05-hidden');
    await p.click('#rec-stop'); await p.waitForTimeout(700); await shot(p, 'd06-summary');
    if (await p.$('#sum-clear')) { await p.click('#sum-clear'); await p.waitForTimeout(300); }
  }
  if (want('picker')) { await p.click('#nav-btn'); await p.waitForTimeout(700); await shot(p, 'd07-picker'); await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
  if (want('display')) { await p.click('#display-btn'); await p.waitForTimeout(600); await shot(p, 'd08-display'); await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
  if (want('word')) { await open(p, 67); const w = await p.$('.mushaf .w[data-g]'); const g = await p.evaluate(() => RahleDebug.D.Q.verseStart[RahleDebug.D.quran.surahs[66].start] + 2); await p.evaluate(g => RahleDebug.Reader.words.get(g).click(), g); await p.waitForTimeout(1200); await shot(p, 'd09-word'); await p.keyboard.press('Escape'); await p.waitForTimeout(400); void w; }
  if (want('hifz')) { await p.click('.tab[data-tab="hifz"]'); await p.waitForTimeout(700); await shot(p, 'd10-hifz'); await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(300); await shot(p, 'd11-hifz-mosaic'); }
  if (want('words')) { await p.click('.tab[data-tab="words"]'); await p.waitForTimeout(900); await shot(p, 'd12-words'); }
  if (want('settings')) { await p.click('.tab[data-tab="read"]'); await p.waitForTimeout(500); await p.click('#settings-btn'); await p.waitForTimeout(600); await shot(p, 'd13-settings'); await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
  if (want('recite')) {
    await p.click('.tab[data-tab="read"]'); await p.waitForTimeout(400); await open(p, 67);
    await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[66].start, mode: 'follow' }); });
    await p.waitForTimeout(600);
    await say(p, 'تبارك الذي بيده الملك وهو على كل شيء قدير'); await say(p, 'الذي خلق الموت والحياة ليبلوكم أيكم أحسن');
    await shot(p, 'd14-recite'); await p.click('#rec-stop'); await p.waitForTimeout(600);
    if (await p.$('#sum-clear')) { await p.click('#sum-clear'); await p.waitForTimeout(300); }
  }
  if (want('blind')) {
    await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[66].start, mode: 'test', blind: true }); }); await p.waitForTimeout(800);
    await say(p, 'تبارك الذي بيده الملك وهو على كل شيء قدير'); await shot(p, 'd15-blind');
    await p.click('#bl-close'); await p.waitForTimeout(700); await shot(p, 'd16-blind-summary'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  }
  if (want('flow')) {
    await p.evaluate(() => { const st = RahleDebug.Store.data.settings; st.layout = 'flow'; RahleDebug.Store.save(); RahleDebug.Reader.render(67); }); await p.waitForTimeout(900); await shot(p, 'd17-flow');
    await p.evaluate(() => { const st = RahleDebug.Store.data.settings; st.layout = 'mushaf'; RahleDebug.Store.save(); RahleDebug.Reader.render(67); }); await p.waitForTimeout(700);
  }
  if (want('verse')) {
    await p.evaluate(() => { const st = RahleDebug.Store.data.settings; st.layout = 'verse'; RahleDebug.Store.save(); RahleDebug.Reader.render(112); }); await p.waitForTimeout(1200); await shot(p, 'd25-verse');
    await p.evaluate(() => { const st = RahleDebug.Store.data.settings; st.layout = 'mushaf'; RahleDebug.Store.save(); RahleDebug.Reader.render(67); }); await p.waitForTimeout(700);
  }
  if (want('cards')) {
    await p.click('.tab[data-tab="words"]'); await p.waitForTimeout(800);
    const learn = await p.$('[data-learn]'); if (learn) { await learn.click(); await p.waitForTimeout(900); await shot(p, 'd26-card'); await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
    await p.click('.tab[data-tab="read"]'); await p.waitForTimeout(400);
  }
  await ctx.close();

  if (want('splash')) {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const p2 = await c2.newPage();
    await p2.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
    await p2.goto(base + '/index.html', { waitUntil: 'commit' }); await p2.waitForTimeout(1500); await p2.screenshot({ path: `${out}/d27-splash.png` });
    await c2.close();
  }
  if (want('dark')) {
    ({ ctx, p } = await context({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true }));
    await open(p, 18); await shot(p, 'd18-dark-read');
    await p.click('.tab[data-tab="hifz"]'); await p.waitForTimeout(700); await shot(p, 'd19-dark-hifz');
    await ctx.close();
  }
  if (want('across')) {
    ({ ctx, p } = await context({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }));
    await open(p, 67); await shot(p, 'd20-phone-across'); await ctx.close();
  }
  if (want('tablet')) {
    ({ ctx, p } = await context({ viewport: { width: 1180, height: 820 } }));
    await open(p, 36); await shot(p, 'd21-tablet-across');
    await open(p, 1); await shot(p, 'd22-tablet-opening');
    await p.setViewportSize({ width: 820, height: 1180 }); await p.waitForTimeout(900); await shot(p, 'd23-tablet-upright');
    await ctx.close();
  }
  if (want('small')) {
    ({ ctx, p } = await context({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }));
    await open(p, 2, 6); await shot(p, 'd24-small-phone'); await ctx.close();
  }
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
