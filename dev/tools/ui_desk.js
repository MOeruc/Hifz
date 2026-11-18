// UI check on a desktop (a wide window, dark, two pages side by side), as in the user's picture of 18 Nov 2026:
// - today's portion: after an-Nas learnt today, the small rest of the day is no portion of its own ("al-Falaq 1"):
//   the day is done; "Trotzdem weiterlernen" gives al-Falaq whole, and Prüfen tests all of it
// - the basmala above a surah: the image of its glyph (a mask in the colour of the text), as wide as the glyph
// - the size of the pages (Darstellung): from the whole page to as wide as the screen, then scrolled; the line being
//   recited comes into view; on a phone held upright there is no room, and the sheet says so
// - after a test: the surah, section or verse before or after it at once, back and forth, and marked as learnt
// Run: node ui_desk.js http://127.0.0.1:8765 OUT_DIR [QCF4_DIR]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const [,, base, out, qcfDir] = process.argv;
const CHROME = require('./chrome.js');
const SIMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, '../testdata/simple-clean.json'), 'utf8'));
fs.mkdirSync(out, { recursive: true });

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
        else { emit(words.join(' '), true); setTimeout(() => { window.__busy = false; this.onend && this.onend(); }, 60); }
      };
      step();
    }
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
}
const verses = (s, a1, a2) => { const o = []; for (let a = a1; a <= a2; a++) o.push(SIMPLE[s][a - 1].text); return o; };

async function context(b, opts) {
  const ctx = await b.newContext(Object.assign({ serviceWorkers: 'block' }, opts));
  // a Wednesday, the clock running on (the share of a day depends on the weekday)
  await ctx.clock.install({ time: new Date('2026-11-18T16:30:00') });
  await ctx.route('https://cdn.jsdelivr.net/**', route => {
    if (!qcfDir) return route.abort();
    const name = route.request().url().split('/').pop();
    return route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(qcfDir + '/fonts-woff2/' + name) });
  });
  return ctx;
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const ctx = await context(b, { viewport: { width: 1500, height: 960 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404|fonts\.g|Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(fakeSR);
  await p.addInitScript(() => { if (!localStorage.getItem('rahle.v1')) localStorage.setItem('rahle.v1', JSON.stringify({ v: 1, settings: { intro: false }, tipBars: 1 })); });
  await p.goto(base + '/index.html');
  await p.waitForSelector('.tab[data-tab="today"]');
  const sheet = '.sheet.open';
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });
  const closeSheets = async () => { while (await p.locator(sheet).count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(350); } };
  const say = async list => {
    for (const t of list) {
      await p.evaluate(x => window.__queue.push(x), t);
      await p.waitForTimeout(80);
      await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 15000 });
      await p.waitForTimeout(140);
    }
    await p.waitForTimeout(500);
  };
  const range = () => p.evaluate(() => { const R = RahleDebug, Q = R.D.Q, ref = v => Q.verseSurah[v] + ':' + Q.verseAyah[v]; return { from: ref(R.Rec.range.v0), to: ref(R.Rec.range.v1), unit: R.Rec.unit, active: R.Rec.active }; });

  // ---- a plan of two pages a week, every day; an-Nas learnt today
  await p.evaluate(() => {
    const R = RahleDebug;
    R.Store.data.plan = R.PL.normalize({ model: 'ssm', weekly: 2, days: [1, 1, 1, 1, 1, 1, 1], order: 'back' });
    R.Store.data.pst = {}; R.Store.save();
  });
  await p.click('.tab[data-tab="today"]');
  await p.waitForSelector('#v-today .td-portion');
  assert.strictEqual(await p.textContent('#v-today .td-portion'), 'An-Nas');
  await p.click('#v-today [data-learnt]');
  await p.waitForTimeout(500);
  const after = (await p.textContent('#v-today .td-new')).replace(/\s+/g, ' ').trim();
  console.log('after an-Nas:', after);
  assert(/Für heute geschafft/.test(after) && /Heute gelernt: An-Nas/.test(after) && !/Al-Falaq 1\b/.test(after), after);
  await shot('k1-today-done');
  await p.click('#v-today [data-more]');
  await p.waitForSelector('#v-today .td-portion');
  assert.strictEqual(await p.textContent('#v-today .td-portion'), 'Al-Falaq', 'a usual day more: al-Falaq whole');
  await p.click('#v-today [data-learn]');
  await p.waitForSelector(sheet + ' [data-a="test"]');
  await p.click(sheet + ' [data-a="test"]');
  await p.waitForSelector('#recbar:not([hidden])');
  await p.waitForTimeout(900);
  let r = await range();
  console.log('Prüfen from today:', JSON.stringify(r));
  assert.strictEqual(r.from, '113:1'); assert.strictEqual(r.to, '113:5');
  await p.waitForTimeout(600);

  // ---- the basmala: the image of the glyph, as wide as the glyph, in the colour of the text
  const bs = await p.evaluate(() => {
    const x = [...document.querySelectorAll('.mushaf .basmala')].find(e => { const r = e.getBoundingClientRect(); return r.width && r.left >= 0 && r.right <= innerWidth; });
    const cs = getComputedStyle(x), r = x.getBoundingClientRect();
    return { cls: x.className, w: Math.round(r.width), h: Math.round(r.height), mask: (cs.webkitMaskImage || cs.maskImage || '').slice(0, 22), text: x.textContent.trim().length, glyphs: x.childNodes.length, bg: cs.backgroundColor };
  });
  console.log('basmala:', JSON.stringify(bs));
  assert(/\bqm\b/.test(bs.cls) && /^url\("data:image\/png/.test(bs.mask) && bs.w > 180 && bs.h > 20, JSON.stringify(bs));
  await shot('k2-test-falaq');

  // ---- reciting al-Falaq to its end: the surah before and after it, at once
  await say(verses(113, 1, 5));
  await p.waitForSelector(sheet + ' .ar-more');
  const ar = () => p.evaluate(() => ({ kind: document.querySelector('.ar-kind [aria-pressed="true"]').textContent,
    before: document.querySelector('.ar-go [data-d="-1"]').textContent, after: document.querySelector('.ar-go [data-d="1"]').textContent, title: document.querySelector('.sheet.open h2').textContent }));
  let a = await ar();
  console.log('after al-Falaq:', JSON.stringify(a));
  assert.deepStrictEqual(a, { kind: 'Sure', before: 'DavorAl-Ikhlas', after: 'DanachAn-Nas', title: 'Prüfung beendet' });
  await shot('k3-summary');
  await p.click(sheet + ' #sum-mem');
  assert.strictEqual(await p.textContent(sheet + ' #sum-mem'), '5 Verse markiert');
  assert(await p.evaluate(() => { const R = RahleDebug, a = R.D.quran.surahs[112].start; for (let v = a; v < a + 5; v++) if (!R.memHas(v)) return false; return true; }), 'al-Falaq marked as learnt');
  await p.click(sheet + ' .ar-go [data-d="-1"]');
  await p.waitForSelector('#recbar:not([hidden])');
  await p.waitForTimeout(700);
  r = await range();
  console.log('the surah before:', JSON.stringify(r));
  assert.strictEqual(r.from, '112:1'); assert.strictEqual(r.to, '112:4'); assert.deepStrictEqual(r.unit, { type: 'around', kind: 's' });
  await say(verses(112, 1, 4));
  await p.waitForSelector(sheet + ' .ar-more');
  a = await ar();
  assert.deepStrictEqual([a.kind, a.before, a.after], ['Sure', 'DavorAl-Masad', 'DanachAl-Falaq']);
  // verse by verse: the verse before al-Ikhlas 1 and after al-Ikhlas 4
  await p.click(sheet + ' .ar-kind [data-k="v"]');
  a = await ar();
  console.log('verses:', JSON.stringify(a));
  assert.deepStrictEqual([a.kind, a.before, a.after], ['Vers', 'DavorAl-Masad 5', 'DanachAl-Falaq 1']);
  assert.strictEqual(await p.evaluate(() => RahleDebug.Store.data.settings.nextKind), 'v');
  await p.click(sheet + ' .ar-go [data-d="1"]');
  await p.waitForSelector('#recbar:not([hidden])');
  await p.waitForTimeout(600);
  r = await range();
  assert.strictEqual(r.from, '113:1'); assert.strictEqual(r.to, '113:1');
  await p.click('#rec-stop'); await p.waitForTimeout(500);
  await closeSheets();
  // the section of al-Baqara before and after the second one
  await p.evaluate(() => { const R = RahleDebug, B = R.Plan.b(), k = B.secOf[R.D.quran.surahs[1].start + 7]; R.Rec.start({ v: B.secStart[k], endV: B.secStart[k + 1] - 1, mode: 'test' }); });
  await p.waitForSelector('#recbar:not([hidden])');
  await p.waitForTimeout(800);
  await say(verses(2, 8, 8));
  await p.click('#rec-stop');
  await p.waitForSelector(sheet + ' .ar-more');
  await p.click(sheet + ' .ar-kind [data-k="sec"]');
  a = await ar();
  console.log('sections:', JSON.stringify(a));
  assert.deepStrictEqual([a.kind, a.before, a.after], ['Sinnabschnitt', 'DavorAl-Baqara 1–7', 'DanachAl-Baqara 21–29']);
  await closeSheets();

  // ---- larger pages: the whole width, scrolled; the line in recitation comes into view
  await p.click('.tab[data-tab="read"]'); await p.waitForTimeout(400);
  const size0 = await p.evaluate(() => Object.assign({}, RahleDebug.Mushaf.size, { room: RahleDebug.Mushaf.room }));
  await p.click('#display-btn');
  await p.waitForSelector(sheet + ' #d-msize');
  const hint = await p.textContent(sheet + ' #d-msize-t');
  assert(/Links passt die ganze Seite/.test(hint), hint);
  await p.fill(sheet + ' #d-msize', '100'); await p.dispatchEvent(sheet + ' #d-msize', 'input'); await p.dispatchEvent(sheet + ' #d-msize', 'change');
  await p.waitForTimeout(600);
  await closeSheets();
  const size1 = await p.evaluate(() => { const M = RahleDebug.Mushaf, s = M.slides[M.cur]; return Object.assign({}, M.size, { tall: M.root.classList.contains('tall'), scroll: s.scrollHeight - s.clientHeight, saved: RahleDebug.Store.data.settings.mfill }); });
  console.log('page size:', JSON.stringify({ before: size0.pw, after: size1.pw, W: size1.W, tall: size1.tall, scroll: size1.scroll, saved: size1.saved }));
  assert(size1.pw >= Math.floor((size1.W - 24) / 2) - 1 && size1.pw > size0.pw + 40 && size1.tall && size1.scroll > 40 && size1.saved === 1, JSON.stringify(size1));
  await shot('k4-larger');
  // a test of an-Nas, the last lines of page 604: the slide goes down with it
  await p.evaluate(() => { const R = RahleDebug; R.Rec.start({ v: R.D.quran.surahs[113].start, mode: 'test' }); });
  await p.waitForSelector('#recbar:not([hidden])');
  await p.waitForTimeout(800);
  await say(verses(114, 1, 4));
  const down = await p.evaluate(() => { const M = RahleDebug.Mushaf, s = M.slides[M.cur], w = RahleDebug.Reader.words.get(RahleDebug.Rec.tracker.pointer); const r = w.getBoundingClientRect(), sr = s.getBoundingClientRect(); return { top: s.scrollTop, inView: r.top >= sr.top && r.bottom <= sr.bottom }; });
  console.log('reciting further down:', JSON.stringify(down));
  assert(down.top > 20 && down.inView, JSON.stringify(down));
  await shot('k5-larger-reciting');
  await p.click('#rec-stop'); await p.waitForTimeout(500);
  await closeSheets();

  // ---- a phone held upright: no room to grow, the sheet says so, the page stays as it is
  const ph = await (await context(b, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  ph.on('pageerror', e => errors.push('phone pageerror: ' + e.message));
  await ph.addInitScript(() => { if (!localStorage.getItem('rahle.v1')) localStorage.setItem('rahle.v1', JSON.stringify({ v: 1, settings: { intro: false, mfill: 1 }, tipBars: 1 })); });
  await ph.goto(base + '/index.html');
  await ph.waitForSelector('.mushaf .mp');
  await ph.waitForTimeout(600);
  const phone = await ph.evaluate(() => ({ pw: RahleDebug.Mushaf.size.pw, W: RahleDebug.Mushaf.size.W, room: RahleDebug.Mushaf.room, tall: RahleDebug.Mushaf.root.classList.contains('tall') }));
  await ph.evaluate(() => RahleDebug.Display.open());
  await ph.waitForSelector('.sheet.open #d-msize');
  const phint = await ph.textContent('.sheet.open #d-msize-t');
  console.log('phone:', JSON.stringify(phone), phint);
  assert(!phone.room && !phone.tall && phone.pw <= phone.W && /schon so breit wie der Bildschirm/.test(phint));
  await ph.screenshot({ path: `${out}/k6-phone-size.png` });

  console.log('errors', JSON.stringify(errors));
  assert.deepStrictEqual(errors, []);
  await b.close();
  console.log('ui desk ok');
})().catch(e => { console.error(e); process.exit(1); });
