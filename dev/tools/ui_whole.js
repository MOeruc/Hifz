// UI check: a test of a page goes over whole sections (Sinnabschnitte). Page 599 (al-Bayyina 6 to al-ʿAdiyat 5) is
// tested from al-Bayyina 1 on page 598 to the end of al-ʿAdiyat on page 600; the pages turn on with the recitation;
// "Weiter" goes on from where it ended; page 600 begins with al-ʿAdiyat 1; the blind test of a page the same; a passage
// of today's list begins with its section too, and only its own page counts as recited.
// Run: node ui_whole.js http://127.0.0.1:8765 OUT_DIR [QCF4_DIR]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const [,, base, out, qcfDir] = process.argv;
const CHROME = require('./chrome.js');
const SIMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, '../testdata/simple-clean.json'), 'utf8'));
fs.mkdirSync(out, { recursive: true });

// a scripted recogniser: one phrase per session
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
const verse = (s, a) => SIMPLE[s][a - 1].text;
const verses = (s, a1, a2) => { const o = []; for (let a = a1; a <= a2; a++) o.push(verse(s, a)); return o; };

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('https://cdn.jsdelivr.net/**', route => {
    if (!qcfDir) return route.abort();
    const name = route.request().url().split('/').pop();
    return route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(qcfDir + '/fonts-woff2/' + name) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404|fonts\.g|Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(fakeSR);
  await p.addInitScript(() => { if (!localStorage.getItem('rahle.v1')) localStorage.setItem('rahle.v1', JSON.stringify({ v: 1, settings: { intro: false }, tipBars: 1 })); });
  await p.goto(base + '/index.html');
  await p.waitForSelector('.mushaf .mp');
  await p.waitForTimeout(600);
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });
  const sheet = '.sheet.open';
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
  // the test: its verses, the page in view, the word in the bar, and how the first words of the pages look
  const state = () => p.evaluate(() => {
    const R = RahleDebug, Q = R.D.Q, ref = v => Q.verseSurah[v] + ':' + Q.verseAyah[v];
    const cls = (s, a) => { const w = R.Reader.words.get(Q.verseStart[R.D.quran.surahs[s - 1].start + a - 1]); return w ? w.className : null; };
    return { active: R.Rec.active, from: R.Rec.range && ref(R.Rec.range.v0), to: R.Rec.range && R.Rec.range.v1 != null && ref(R.Rec.range.v1), unit: R.Rec.unit,
      page: R.Mushaf.page(), bar: document.querySelector('#rec-l1').textContent, qadr: cls(97, 1), bayyina: cls(98, 1), adiyat6: cls(100, 6) };
  });
  // the pages in view while reciting: every change of page, in order
  const watchPages = () => p.evaluate(() => { window.__pages = [RahleDebug.Mushaf.page()]; clearInterval(window.__pw); window.__pw = setInterval(() => { const x = RahleDebug.Mushaf.page(); if (x !== window.__pages[window.__pages.length - 1]) window.__pages.push(x); }, 40); });
  const pagesSeen = () => p.evaluate(() => { clearInterval(window.__pw); return window.__pages; });
  const today = await p.evaluate(() => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000));

  // as in the screenshots: al-Qariʿa to an-Nas known, al-Bayyina, az-Zalzala and al-ʿAdiyat being learnt
  await p.evaluate(() => {
    const R = RahleDebug, Q = R.D.quran, vi = (s, a) => Q.surahs[s - 1].start + a - 1;
    const range = (a, z) => { const o = []; for (let v = a; v <= z; v++) o.push(v); return o; };
    R.Hifz.setVerses(range(vi(101, 1), 6235), true, { old: true });
  });

  // ---- page 599 in the Hifz tab: the sheet says what a test goes over
  await p.click('.tab[data-tab="hifz"]');
  await p.click('#mosaic .tile[data-page="599"]');
  await p.waitForSelector(sheet + ' #cs-test');
  const span599 = (await p.textContent(sheet + ' .cs-span')).replace(/\s+/g, ' ').trim();
  console.log('page 599:', span599);
  assert.strictEqual(span599, 'Geprüft werden ganze Sinnabschnitte: Al-Bayyina – Al-ʿAdiyat, Seite 598–600.');
  await p.locator(sheet + ' .cs-go').scrollIntoViewIfNeeded();
  await shot('w1-sheet-599');

  // ---- Prüfen: from al-Bayyina 1 on page 598, the passage covered, the verses around it readable
  await p.click(sheet + ' #cs-test');
  await p.waitForSelector('#recbar:not([hidden])');
  await p.waitForTimeout(900);
  let s = await state();
  console.log('start:', JSON.stringify(s));
  assert.strictEqual(s.from, '98:1'); assert.strictEqual(s.to, '100:11');
  assert.strictEqual(s.page, 598, 'the test begins on the page where al-Bayyina begins');
  assert(/^Al-Bayyina 98:1$/.test(s.bar), s.bar);
  assert(/\bctx\b/.test(s.qadr), 'al-Qadr (before the passage) readable: ' + s.qadr);
  assert(!/\bctx\b|\bv\b/.test(s.bayyina), 'al-Bayyina 1 covered: ' + s.bayyina);
  await shot('w2-start-598');

  // ---- reciting: the page turns to 599 after al-Bayyina 5, to 600 after al-ʿAdiyat 5, never back
  await watchPages();
  await say(verses(98, 1, 5));
  s = await state();
  assert.strictEqual(s.page, 599, 'on to page 599 with al-Bayyina 6');
  await shot('w3-on-599');
  await say(verses(98, 6, 8).concat(verses(99, 1, 8), verses(100, 1, 7)));
  s = await state();
  assert.strictEqual(s.page, 600, 'on to page 600 with al-ʿAdiyat 6');
  await shot('w4-on-600');
  await say(verses(100, 8, 11));
  const seen = await pagesSeen();
  console.log('pages in view:', JSON.stringify(seen));
  assert.deepStrictEqual(seen, [598, 599, 600]);
  // the end of al-ʿAdiyat ends the test; going on is a button, from al-Qariʿa (the rest of page 600)
  await p.waitForSelector(sheet + ' #sum-next');
  const end = await p.evaluate(() => ({ active: RahleDebug.Rec.active, title: document.querySelector('.sheet.open h2').textContent, next: document.querySelector('#sum-next').textContent.trim() }));
  console.log('end:', JSON.stringify(end));
  assert(!end.active && end.title === 'Prüfung beendet', JSON.stringify(end));
  assert.strictEqual(end.next, 'Weiter: Al-Qariʿa – At-Takathur');
  await shot('w5-summary');
  await p.click(sheet + ' #sum-next');
  await p.waitForSelector('#recbar:not([hidden])');
  await p.waitForTimeout(500);
  s = await state();
  assert.strictEqual(s.from, '101:1'); assert.strictEqual(s.to, '102:8'); assert.strictEqual(s.unit.n, 600);
  await p.click('#rec-stop'); await p.waitForTimeout(500);
  await closeSheets();

  // ---- page 600: from al-ʿAdiyat 1 on page 599
  await p.click('.tab[data-tab="hifz"]');
  await p.click('#mosaic .tile[data-page="600"]');
  await p.waitForSelector(sheet + ' #cs-test');
  const span600 = (await p.textContent(sheet + ' .cs-span')).replace(/\s+/g, ' ').trim();
  console.log('page 600:', span600);
  assert.strictEqual(span600, 'Geprüft werden ganze Sinnabschnitte: Al-ʿAdiyat – At-Takathur, Seite 599–600.');
  await p.click(sheet + ' #cs-test');
  await p.waitForSelector('#recbar:not([hidden])');
  await p.waitForTimeout(900);
  s = await state();
  console.log('page 600 test:', JSON.stringify({ from: s.from, to: s.to, page: s.page }));
  assert.strictEqual(s.from, '100:1'); assert.strictEqual(s.to, '102:8'); assert.strictEqual(s.page, 599);
  await p.click('#rec-stop'); await p.waitForTimeout(500);
  await closeSheets();

  // ---- a page that begins and ends with its sections: no line, the page as it is
  await p.click('.tab[data-tab="hifz"]');
  await p.click('#mosaic .tile[data-page="601"]');
  await p.waitForSelector(sheet + ' #cs-test');
  assert.strictEqual(await p.locator(sheet + ' .cs-span').count(), 0, 'page 601: whole surahs, nothing to say');
  await closeSheets();

  // ---- the blind test of a page: the same passage
  await p.click('#h-blind'); await p.waitForTimeout(400);
  await p.click(sheet + ' .seg [data-m="p"]'); await p.waitForTimeout(300);
  await p.fill('#bp-range', '599'); await p.dispatchEvent('#bp-range', 'input'); await p.waitForTimeout(200);
  const info = await p.textContent('#bp-info');
  console.log('blind, page 599:', info);
  assert.strictEqual(info, 'Ganze Sinnabschnitte: Al-Bayyina – Al-ʿAdiyat, Seite 598–600');
  await shot('w6-blind-pick');
  await p.click('#bp-go'); await p.waitForTimeout(600);
  const bl = await p.evaluate(() => ({ sub: document.querySelector('#bl-sub').textContent, range: [RahleDebug.Rec.range.v0, RahleDebug.Rec.range.v1] }));
  console.log('blind:', JSON.stringify(bl));
  assert.strictEqual(bl.sub, 'Blindtest, Seite 598–600, 98:1 bis 100:11');
  await p.click('#bl-close'); await p.waitForTimeout(400);
  await closeSheets();

  // ---- today's list: al-ʿAdiyat known now, page 600 due (599 not): the passage begins with al-ʿAdiyat 1 on 599,
  // and only page 600 counts as recited
  await p.evaluate(d => {
    const R = RahleDebug, Q = R.D.quran, vi = (s, a) => Q.surahs[s - 1].start + a - 1;
    const range = (a, z) => { const o = []; for (let v = a; v <= z; v++) o.push(v); return o; };
    R.Hifz.setVerses(range(vi(100, 1), vi(100, 11)), true, { old: true });
    for (let pg = 599; pg <= 604; pg++) R.Store.data.pages[pg] = pg === 600 ? { r: d - 3, i: 1 } : { r: d, i: 30 };
    R.Store.data.pst = {};
    R.Store.save();
  }, today);
  await p.click('.tab[data-tab="today"]');
  await p.waitForSelector('#v-today .td-row');
  const rows = await p.$$eval('#v-today .td-row', xs => xs.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  console.log('today:', JSON.stringify(rows));
  assert.strictEqual(rows.length, 1);
  assert(/^Al-ʿAdiyat – At-Takathur ?Seite 600\b/.test(rows[0]), rows[0]);
  await shot('w7-today');
  await p.click('#v-today [data-test="0"]');
  await p.waitForSelector('#recbar:not([hidden])');
  await p.waitForTimeout(900);
  s = await state();
  console.log('review:', JSON.stringify({ from: s.from, to: s.to, page: s.page, unit: s.unit }));
  assert.strictEqual(s.from, '100:1'); assert.strictEqual(s.to, '102:8'); assert.strictEqual(s.page, 599);
  assert.deepStrictEqual(s.unit.pages, [600]);
  await say(verses(100, 1, 11).concat(verses(101, 1, 11), verses(102, 1, 8)));
  await p.waitForSelector(sheet + ' #sum-done');
  const rec = await p.evaluate(d => { const P = RahleDebug.Store.data.pages; return { p599: P[599].t === d, p600: P[600].t === d, q600: P[600].q, next: !!document.querySelector('#sum-next') }; }, today);
  console.log('recited:', JSON.stringify(rec));
  assert(rec.p600 && rec.q600 === 100, 'page 600 recited');
  assert(!rec.p599, 'page 599 (al-ʿAdiyat 1-5 only, not due) not counted');
  assert(!rec.next, 'nothing left today');
  await p.click(sheet + ' #sum-done'); await p.waitForTimeout(400);
  assert.strictEqual(await p.locator('#v-today .td-row.done').count(), 1);

  console.log('errors', JSON.stringify(errors));
  assert.deepStrictEqual(errors, []);
  await b.close();
  console.log('ui whole ok');
})().catch(e => { console.error(e); process.exit(1); });
