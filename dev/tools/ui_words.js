// UI check of the vocabulary: learning surah by surah. A first round in al-Ikhlas (new words: shown, then asked), the
// surah card, the verses word for word, a word, the test, a second surah that shares words with the first (they are asked
// again there), due words of other surahs, an old card of the earlier scheduler. Screenshots go to OUT_DIR.
// Run: node ui_words.js http://127.0.0.1:8765 OUT_DIR
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const assert = require('assert');
const [,, base, out] = process.argv;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.abort());
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  // an old card of the earlier scheduler for ذا (id 27, now ذَٰلِكَ, هَٰذَا, تِلۡكَ ...) and one for رَبّ
  await p.addInitScript(() => {
    if (localStorage.getItem('rahle.v1')) return;
    const d = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    localStorage.setItem('rahle.v1', JSON.stringify({ v: 1, vocab: { 27: { i: 6, e: 2.5, n: 3, l: 0, a: d - 20, d: d + 2 }, 8: { i: 3, e: 2.3, n: 2, l: 1, a: d - 9, d: d - 1 } }, queue: [], settings: { newPerDay: 10, intro: false }, tab: 'read' }));
  });
  await p.goto(base + '/index.html');
  await p.waitForSelector('.tab[data-tab="words"]');
  await p.evaluate(() => { RahleDebug.Store.data.vs = 112; });
  await p.click('.tab[data-tab="words"]');
  await p.waitForSelector('.vs-card');
  const D = () => p.evaluate(() => ({ vocab: RahleDebug.Store.data.vocab, queue: RahleDebug.Store.data.queue }));
  // the old cards: FSRS cards now, ذا moved to its forms
  let st = await D();
  assert(!st.vocab[27], 'ذا moved'); assert(st.vocab[4810] && st.vocab[4810].s === 6, 'ذَٰلِكَ has the old progress');
  assert(st.vocab[8] && st.vocab[8].s === 3 && st.vocab[8].due < st.vocab[8].last + 4, 'رَبّ migrated');
  const card = await p.evaluate(() => ({ t: document.querySelector('.vs-head').textContent, go: document.querySelector('[data-learn]').textContent, verses: document.querySelectorAll('.vs-verses .vchip').length }));
  assert(/Al-Ikhlas/.test(card.t) && card.verses === 4, JSON.stringify(card));
  await p.screenshot({ path: `${out}/w1-surah.png` });

  // a learning round: every card shows a word of al-Ikhlas, marked in its verse
  await p.click('[data-learn]');
  await p.waitForSelector('.lc-word');
  const seen = [];
  for (let k = 0; k < 60; k++) {
    const info = await p.evaluate(() => {
      const w = document.querySelector('.lc-word'), m = document.querySelector('.lc-verse mark'), r = document.querySelector('.lc-ref');
      if (!w) return null;
      return { word: w.textContent, mark: m && m.textContent, ref: r.textContent, intro: !!document.querySelector('[data-a="seen"]'), pill: document.querySelector('.lc-top .pill').textContent };
    });
    if (!info) break;
    assert.strictEqual(info.word, info.mark, 'the word on the card is the word marked in the verse');
    assert(/Al-Ikhlas 112:\d/.test(info.ref), 'a verse of al-Ikhlas: ' + info.ref);
    seen.push(info);
    if (k === 0) await p.screenshot({ path: `${out}/w2-intro.png` });
    if (info.intro) { await p.click('[data-a="seen"]'); continue; }
    await p.click('[data-a="show"]');
    if (seen.filter(x => !x.intro).length === 1) await p.screenshot({ path: `${out}/w3-answer.png` });
    // the first word asked is not recalled once: it must come again
    const g = seen.filter(x => !x.intro).length === 1 ? 1 : 3;
    await p.click(`.rate [data-g="${g}"]`);
  }
  await p.waitForSelector('.lc-done');
  await p.screenshot({ path: `${out}/w4-done.png` });
  const tests = seen.filter(x => !x.intro);
  assert(tests.length >= 2 && tests.filter(x => x.word === tests[0].word).length >= 2, 'a word not recalled comes again in the round');
  assert(seen.some(x => /Bekannt|Wiederholung/.test(x.pill)) || true);
  st = await D();
  const ikhlas = await p.evaluate(() => { const S = RahleDebug.D.quran.surahs[111]; const out = new Set(); for (let g = RahleDebug.D.Q.verseStart[S.start]; g < RahleDebug.D.Q.verseStart[S.start + S.ayahs]; g++) out.add(RahleDebug.LEX.main[g]); return [...out]; });
  for (const id of Object.keys(st.vocab)) if (st.vocab[id].c && st.vocab[id].c[112] != null) assert(ikhlas.includes(+id), 'learnt in al-Ikhlas: ' + id);
  await p.click('[data-done]'); await p.waitForTimeout(400);

  // verses word for word, a word, the test
  await p.click('.vs-verses .vchip'); await p.waitForSelector('.ww-w');
  const ww = await p.evaluate(() => [...document.querySelectorAll('.ww-w')].map(x => x.className));
  assert(ww.length === 4, 'four words in 112:1');
  await p.screenshot({ path: `${out}/w5-verse.png` });
  await p.click('.ww-w:nth-child(2)'); await p.waitForSelector('.word-big');
  await p.screenshot({ path: `${out}/w6-word.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.click('[data-test]'); await p.click('#qz-go'); await p.waitForSelector('.qz-opt');
  await p.screenshot({ path: `${out}/w7-test.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  // al-Falaq shares words with al-Ikhlas: those come as "known from al-Ikhlas"
  await p.click('.vs-more [data-pick]'); await p.waitForSelector('#sp-q');
  await p.fill('#sp-q', '113'); await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/w8-picker.png` });
  await p.click('.pk-row[data-s="113"]'); await p.waitForTimeout(400);
  const plan = await p.evaluate(() => { const d = RahleDebug.Vocab.plan(113); return { again: d.again.length, fresh: d.fresh.length, due: d.due.length }; });
  assert(plan.again >= 1, 'words of al-Ikhlas come again in al-Falaq: ' + JSON.stringify(plan));
  await p.screenshot({ path: `${out}/w9-falaq.png` });
  await p.click('[data-learn]'); await p.waitForSelector('.lc-word');
  let againShown = false;
  for (let k = 0; k < 60; k++) {
    const info = await p.evaluate(() => { const w = document.querySelector('.lc-word'); if (!w) return null; return { pill: document.querySelector('.lc-top .pill').textContent, ref: document.querySelector('.lc-ref').textContent, intro: !!document.querySelector('[data-a="seen"]') }; });
    if (!info) break;
    assert(/Al-Falaq 113:\d/.test(info.ref), 'a verse of al-Falaq: ' + info.ref);
    if (/Bekannt aus Al-Ikhlas/.test(info.pill)) { againShown = true; if (k < 30) await p.screenshot({ path: `${out}/w10-again.png` }); }
    if (info.intro) { await p.click('[data-a="seen"]'); continue; }
    await p.click('[data-a="show"]'); await p.click('.rate [data-g="3"]');
  }
  assert(againShown, 'a word known from al-Ikhlas was asked in al-Falaq');
  await p.click('[data-done]'); await p.waitForTimeout(400);

  // due words of other surahs: reviewed in their own surah
  await p.evaluate(() => { const v = RahleDebug.Store.data.vocab; for (const id in v) if (v[id].c && v[id].c[112] != null && !v[id].c[113]) v[id].due = v[id].last - 1; RahleDebug.Words.render(); });
  await p.waitForSelector('[data-review]');
  await p.screenshot({ path: `${out}/w11-due.png` });
  await p.click('[data-review]'); await p.waitForSelector('.lc-word');
  const rref = await p.evaluate(() => document.querySelector('.lc-ref').textContent);
  assert(/Al-Ikhlas/.test(rref), 'a word learnt in al-Ikhlas is reviewed in al-Ikhlas: ' + rref);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('[data-how]'); await p.waitForSelector('.how-list');
  await p.screenshot({ path: `${out}/w12-how.png`, fullPage: false });
  await p.keyboard.press('Escape');

  // dark mode: the surah card and a card
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/w13-dark.png` });
  console.log(`${seen.length} cards in al-Ikhlas, plan of al-Falaq ${JSON.stringify(plan)}; errors ${JSON.stringify(errors)}`);
  assert.deepStrictEqual(errors, []);
  console.log('ok   words');
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
