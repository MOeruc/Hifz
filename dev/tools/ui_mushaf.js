// UI check: the pages of the Madina Mushaf. One page upright, two lying across; turning pages; the page fonts loaded
// from jsDelivr (served here from a local copy of quran-qcf4) and the HAFS font when they are missing; reciting on the
// pages; memorising with hidden text: the empty page with its verse markers, words appearing in place.
// Run: node ui_mushaf.js http://127.0.0.1:8765 OUT_DIR QCF4_DIR
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [,, base, out, qcfDir] = process.argv;
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
      const step = () => {
        if (this.stopped) return;
        k++;
        if (k < words.length) { emit(words.slice(0, k).join(' '), false); setTimeout(step, 25); }
        else { emit(words.join(' '), true); setTimeout(() => { window.__busy = false; this.onend && this.onend(); }, 80); }
      };
      step();
    }
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
}
const V67 = [
  'تبارك الذي بيده الملك وهو على كل شيء قدير',
  'الذي خلق الموت والحياة ليبلوكم أيكم أحسن عملا وهو العزيز الغفور',
  'الذي خلق سبع سماوات طباقا ما ترى في خلق الرحمن من تفاوت فارجع البصر هل ترى من فطور',
];

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  let fontHits = 0;
  async function context(opts, block) {
    const ctx = await b.newContext(Object.assign({ deviceScaleFactor: 2, serviceWorkers: 'block' }, opts));
    await ctx.route('https://cdn.jsdelivr.net/**', route => {
      if (block) return route.abort();
      const name = route.request().url().split('/').pop();
      fontHits++;
      return route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(qcfDir + '/fonts-woff2/' + name) });
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404|fonts\.g|Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
    await p.addInitScript(fakeSR);
    return { ctx, p };
  }
  const state = p => p.evaluate(() => {
    const M = document.querySelector('#reader');
    const cur = [...document.querySelectorAll('.mushaf .slide')].findIndex(s => { const r = s.getBoundingClientRect(); return r.left > -5 && r.right < innerWidth + 5; });
    const pages = [...document.querySelectorAll('.mushaf .slide')][cur];
    return { paged: M.classList.contains('mushaf'), spread: M.classList.contains('spread'), slide: cur, pages: pages ? [...pages.querySelectorAll('.mp')].map(x => +x.dataset.page) : [],
      glyphs: !!document.querySelector('.mushaf .slide .mp-lines[style*="QCF4"]'), title: document.querySelector('#nav-t1').textContent + ' | ' + document.querySelector('#nav-t2').textContent,
      lines: pages ? [...pages.querySelectorAll('.mp .ml')].length : 0, overflow: pages ? [...pages.querySelectorAll('.ml.t')].filter(l => l.scrollWidth > l.clientWidth + 1).length : -1,
      pw: getComputedStyle(M).getPropertyValue('--pw'), words: RahleDebug.Reader.words.size };
  });
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });

  // 1. upright phone: the first page, then turning
  let { ctx, p } = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await p.goto(base + '/index.html');
  await p.waitForSelector('.mushaf .mp');
  await p.waitForTimeout(1200);
  console.log('start', JSON.stringify(await state(p)));
  await shot(p, 'p1-start');
  // turn: the next page lies to the left
  await p.evaluate(() => { const r = document.querySelector('#reader'); r.scrollBy({ left: -r.clientWidth, behavior: 'auto' }); });
  await p.waitForTimeout(700);
  console.log('turned', JSON.stringify(await state(p)));
  await shot(p, 'p2-page2');
  // al-Mulk, as from the surah list
  await p.evaluate(() => RahleDebug.Reader.open(RahleDebug.D.quran.surahs[66].start));
  await p.waitForTimeout(1200);
  console.log('al-Mulk', JSON.stringify(await state(p)));
  await shot(p, 'p3-mulk');
  // 2. reciting on the page
  await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[66].start, mode: 'follow' }); });
  await p.waitForTimeout(600);
  const say = async t => { await p.evaluate(x => window.__queue.push(x), t); await p.waitForTimeout(120); await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 8000 }); await p.waitForTimeout(350); };
  await say('بسم الله الرحمن الرحيم'); await say(V67[0]); await say(V67[1]);
  console.log('recited', JSON.stringify(await p.evaluate(() => ({ s1: document.querySelectorAll('.mushaf .w.s1').length, heard: document.querySelectorAll('.mushaf .basmala.heard').length }))));
  await shot(p, 'p4-recite');
  await p.click('#rec-stop'); await p.waitForTimeout(500);
  if (await p.$('#sum-clear')) { await p.click('#sum-clear'); await p.waitForTimeout(300); }
  // 3. memorising with hidden text: the empty page with its verse markers
  await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[66].start, endV: D.quran.surahs[66].start + 4, mode: 'test' }); });
  await p.waitForTimeout(700);
  const hid = () => p.evaluate(() => { const ws = [...document.querySelectorAll('.mushaf .slide .w')]; const vis = ws.filter(w => getComputedStyle(w).color !== 'rgba(0, 0, 0, 0)'); const an = [...document.querySelectorAll('.mushaf .an')].filter(a => getComputedStyle(a).color !== 'rgba(0, 0, 0, 0)' && a.getBoundingClientRect().width > 2); return { words: ws.length, visible: vis.length, markersVisible: an.length, hdr: !!document.querySelector('.mushaf .sbox') }; });
  console.log('hidden, start', JSON.stringify(await hid()));
  await shot(p, 'p5-hidden-empty');
  await say(V67[0]); await say(V67[1]);
  console.log('hidden, after 2 verses', JSON.stringify(await hid()));
  await shot(p, 'p6-hidden-two');
  await p.click('#rec-stop'); await p.waitForTimeout(500);
  if (await p.$('#sum-clear')) { await p.click('#sum-clear'); await p.waitForTimeout(300); }
  // 3b. memorising from the middle of a page: the verses before it stay as they are
  await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[66].start + 5, endV: D.quran.surahs[66].start + 8, mode: 'test' }); });
  await p.waitForTimeout(700);
  console.log('hidden from 67:6', JSON.stringify(await hid()));
  await shot(p, 'p6b-hidden-mid');
  await p.click('#rec-stop'); await p.waitForTimeout(500);
  if (await p.$('#sum-clear')) { await p.click('#sum-clear'); await p.waitForTimeout(300); }
  // 3c. the display sheet
  await p.click('#display-btn'); await p.waitForTimeout(600);
  await shot(p, 'p6c-display');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await ctx.close();

  // 4. lying across: two pages, an open book
  ({ ctx, p } = await context({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }));
  await p.goto(base + '/index.html'); await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(800);
  await p.evaluate(() => RahleDebug.Reader.open(RahleDebug.D.quran.surahs[66].start)); await p.waitForTimeout(1200);
  console.log('phone across', JSON.stringify(await state(p)));
  await shot(p, 'p7-across-phone');
  // reciting lying across: the slide scrolls down with the reciter
  {
    const MORE = V67.concat(['ثم ارجع البصر كرتين ينقلب إليك البصر خاسئا وهو حسير', 'ولقد زينا السماء الدنيا بمصابيح وجعلناها رجوما للشياطين وأعتدنا لهم عذاب السعير', 'وللذين كفروا بربهم عذاب جهنم وبئس المصير', 'إذا ألقوا فيها سمعوا لها شهيقا وهي تفور', 'تكاد تميز من الغيظ كلما ألقي فيها فوج سألهم خزنتها ألم يأتكم نذير']);
    await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[66].start, mode: 'follow' }); });
    await p.waitForTimeout(600);
    for (const x of MORE) { await p.evaluate(t => window.__queue.push(t), x); await p.waitForTimeout(120); await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 8000 }); await p.waitForTimeout(400); }
    await p.waitForTimeout(600);
    console.log('across, reciting', JSON.stringify(await p.evaluate(() => { const sl = [...document.querySelectorAll('.mushaf .slide')].find(s => s.querySelector('.w.cur')); const cur = document.querySelector('.mushaf .w.cur'); const r = cur && cur.getBoundingClientRect(); return { scrollTop: sl ? Math.round(sl.scrollTop) : -1, curTop: r ? Math.round(r.top) : null, inView: r ? r.top > 40 && r.bottom < innerHeight - 40 : null, title: document.querySelector('#nav-t1').textContent }; })));
    await shot(p, 'p7b-across-reciting');
    await p.click('#rec-stop'); await p.waitForTimeout(400);
  }
  await ctx.close();
  ({ ctx, p } = await context({ viewport: { width: 1180, height: 820 } }));
  await p.goto(base + '/index.html'); await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(800);
  await p.evaluate(() => RahleDebug.Reader.open(RahleDebug.D.quran.surahs[1].start)); await p.waitForTimeout(1200);
  console.log('tablet across', JSON.stringify(await state(p)));
  await shot(p, 'p8-across-tablet');
  // rotate: the same page stays in view
  await p.setViewportSize({ width: 820, height: 1180 }); await p.waitForTimeout(900);
  console.log('tablet upright', JSON.stringify(await state(p)));
  await shot(p, 'p9-tablet-upright');
  await ctx.close();

  // 5. dark
  ({ ctx, p } = await context({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true }));
  await p.goto(base + '/index.html'); await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(500);
  await p.evaluate(() => RahleDebug.Reader.open(RahleDebug.D.quran.surahs[35].start + 30)); await p.waitForTimeout(1200);
  console.log('dark', JSON.stringify(await state(p)));
  await shot(p, 'p10-dark');
  await ctx.close();

  // 6. without the page fonts (offline the first time): the same lines in the HAFS font
  ({ ctx, p } = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, true));
  await p.goto(base + '/index.html'); await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(500);
  await p.evaluate(() => RahleDebug.Reader.open(RahleDebug.D.quran.surahs[66].start)); await p.waitForTimeout(1200);
  console.log('no page fonts', JSON.stringify(await state(p)));
  await shot(p, 'p11-hafs');
  await ctx.close();

  console.log('font requests served', fontHits);
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
