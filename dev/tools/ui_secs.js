// UI check: the sections that belong together in meaning (rukūʿ). The setting in "Darstellung": in the Mushaf every
// other section of a surah on a light wash (bands behind its words, line by line) and a small ع over the verse that
// ends one (al-Mulk: 1-14 plain, 15-30 washed, the ع over 14); off: nothing of it. Running text: a paragraph for every
// section; verse by verse: a heading for every section. The sheet of a verse names its section (al-Mulk 20: section 2
// of 2, verses 15-30) and learns it with counting (the session holds 15-30) or tests it. The dashboard: today's
// portion and where it stands in its section. Dark, a small phone. Screenshots go to OUT_DIR.
// Run: node ui_secs.js http://127.0.0.1:8765 OUT_DIR
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const assert = require('assert');
const [,, base, out] = process.argv;

(async () => {
  const b = await chromium.launch({ executablePath: require('./chrome.js') });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.abort());              // the page fonts: the HAFS font instead
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => { if (!localStorage.getItem('rahle.v1')) localStorage.setItem('rahle.v1', JSON.stringify({ v: 1, settings: { intro: false, layout: 'mushaf' }, tab: 'read' })); });
  await p.goto(base + '/index.html');
  await p.waitForSelector('.mushaf .mp');
  const shot = async name => { await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${name}.png` }); };
  const sheet = '.sheet.open';
  const V = await p.evaluate(() => { const s = RahleDebug.D.quran.surahs; return { mulk: s[66].start, ikhlas: s[111].start }; });
  const go = async v => { await p.evaluate(v => RahleDebug.Reader.open(v, { flash: false }), v); await p.waitForTimeout(900); };
  const page = () => p.evaluate(() => {
    const mid = innerWidth / 2, sl = [...document.querySelectorAll('.slide')].filter(s => s.querySelector('.mp'))
      .sort((a, b) => Math.abs(a.getBoundingClientRect().left + a.getBoundingClientRect().width / 2 - mid) - Math.abs(b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2 - mid))[0];
    const vis = el => el && getComputedStyle(el).display !== 'none';
    const an = v => sl.querySelector(`.an[data-v="${v}"]`);
    return { secs: document.querySelector('#reader').classList.contains('secs'), bands: [...sl.querySelectorAll('.rkw')].filter(vis).length,
      anyBand: sl.querySelectorAll('.rkw').length, ends: [...sl.querySelectorAll('.an.rke')].map(x => +x.dataset.v),
      washed: [...sl.querySelectorAll('.w.rk1')].map(w => RahleDebug.D.Q.words[+w.dataset.g].v),
      mark: (() => { const e = sl.querySelector('.an.rke'); return e ? getComputedStyle(e, '::after').content : ''; })() };
  });

  // ---- the setting: off at first, nothing to see; on in "Darstellung"
  await go(V.mulk + 13);                                                  // al-Mulk 14: page 563
  let s = await page();
  assert(!s.secs && s.bands === 0, 'off: no bands ' + JSON.stringify(s));
  assert(s.anyBand > 0, 'the bands are there (only hidden)');
  assert.strictEqual(s.mark, 'none', 'off: no ع');
  await p.click('#display-btn');
  await p.waitForSelector(sheet + ' #d-secs');
  assert(/Rukūʿ/.test(await p.textContent(sheet + ' #d-secs-t')));
  await shot('s1-setting');
  await p.click(sheet + ' label:has(#d-secs)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  s = await page();
  assert(s.secs && s.bands > 0, 'on: bands ' + JSON.stringify(s));
  assert.strictEqual(await p.evaluate(() => RahleDebug.Store.data.settings.secs), true);
  // al-Mulk 1-14 plain, 15-30 washed, the ع over 14
  assert(s.ends.includes(V.mulk + 13), 'the ع over al-Mulk 14');
  assert(s.washed.length && s.washed.every(v => v >= V.mulk + 14 && v <= V.mulk + 29), 'only 15-30 washed');
  assert(/ع/.test(s.mark), s.mark);
  // a band follows the words: it lies within its line, behind the words of 15 on
  const geo = await p.evaluate(v15 => {
    const mid = innerWidth / 2, sl = [...document.querySelectorAll('.slide')].filter(s => s.querySelector('.mp'))
      .sort((a, b) => Math.abs(a.getBoundingClientRect().left + a.getBoundingClientRect().width / 2 - mid) - Math.abs(b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2 - mid))[0];
    const first = sl.querySelector(`.w[data-g="${RahleDebug.D.Q.verseStart[v15]}"]`), ln = first.closest('.ml'), band = ln.querySelector('.rkw');
    const lr = ln.getBoundingClientRect(), br = band.getBoundingClientRect(), wr = first.getBoundingClientRect();
    const prev = sl.querySelector(`.an[data-v="${v15 - 1}"]`).getBoundingClientRect();
    return { inLine: br.left >= lr.left - 1 && br.right <= lr.right + 1, coversFirst: br.right >= wr.right - 1, notOver14: br.right <= prev.left + 1 };
  }, V.mulk + 14);
  assert.deepStrictEqual(geo, { inLine: true, coversFirst: true, notOver14: true });
  await shot('s2-mushaf-mulk');

  // ---- the sheet of al-Mulk 20: its section, learnt with counting
  await p.click(`.slide .an[data-v="${V.mulk + 19}"]`);
  await p.waitForSelector(sheet + ' .vs-sec');
  const box = await p.textContent(sheet + ' .vs-sec');
  assert(/Sinnabschnitt 2 von 2/.test(box) && /Al-Mulk 15–30/.test(box) && /16 Verse/.test(box), box);
  await p.evaluate(() => { const b = document.querySelector('.sheet.open .sheet-body'); if (b) b.scrollTop = b.scrollHeight; });
  await shot('s3-verse-sheet');
  await p.click(sheet + ' #vs-sec-learn');
  await p.waitForSelector('body.drill-on #reader .w.dq');
  const dr = await p.evaluate(() => RahleDebug.Drill.st.vs);
  assert.strictEqual(dr.length, 16); assert.strictEqual(dr[0], V.mulk + 14); assert.strictEqual(dr[15], V.mulk + 29);
  await p.click('#dr-close');
  await p.waitForFunction(() => !document.body.classList.contains('drill-on'));
  // another section while that one is begun (a step done): replaced only after a second tap
  await p.evaluate(() => { RahleDebug.Store.data.drill.i = 2; RahleDebug.Store.save(); });
  await p.click(`.slide .an[data-v="${V.mulk + 3}"]`);
  await p.waitForSelector(sheet + ' .vs-sec');
  assert(/Sinnabschnitt 1 von 2/.test(await p.textContent(sheet + ' .vs-sec')));
  await p.click(sheet + ' #vs-sec-learn');
  assert(/Nochmal tippen/.test(await p.textContent(sheet + ' #vs-sec-learn')));
  await p.click(sheet + ' #vs-sec-test');                                  // testing it instead: a recitation of 1-14
  await p.waitForTimeout(600);
  const rec = await p.evaluate(() => ({ active: RahleDebug.Rec.active, drill: RahleDebug.Store.data.drill && RahleDebug.Store.data.drill.vs[0] }));
  assert.strictEqual(rec.drill, V.mulk + 14, 'the begun session kept');
  if (rec.active) await p.evaluate(() => RahleDebug.Rec.stop('user', true));
  await p.waitForTimeout(300);

  // ---- running text: a paragraph for every section; verse by verse: a heading for every section
  await p.evaluate(v => { const R = RahleDebug; R.Store.data.settings.layout = 'flow'; R.Store.save(); return R.Reader.render(67, { v }); }, V.mulk + 12);
  await p.waitForTimeout(800);
  const flow = await p.evaluate(v => { const m = document.querySelector(`.an[data-v="${v}"]`); return { last: m.parentElement.lastElementChild === m, cls: m.className }; }, V.mulk + 13);
  assert(flow.last && /rke/.test(flow.cls), 'al-Mulk 14 ends a paragraph ' + JSON.stringify(flow));
  await shot('s4-flow');
  await p.evaluate(v => { const R = RahleDebug; R.Store.data.settings.layout = 'verse'; R.Store.save(); return R.Reader.render(67, { v }); }, V.mulk + 14);
  await p.waitForTimeout(800);
  const heads = await p.$$eval('.rk-head', hs => hs.map(h => h.textContent.replace(/\s+/g, ' ').trim()));
  assert.strictEqual(heads.length, 2); assert(/Sinnabschnitt 2 von 2\s*Verse 15–30/.test(heads[1]), heads[1]);
  const before = await p.evaluate(v => { const b = document.querySelector(`.verse-block[data-v="${v}"]`); return b.previousElementSibling && b.previousElementSibling.className; }, V.mulk + 14);
  assert.strictEqual(before, 'rk-head');
  await shot('s5-verse-headings');
  // off again: no headings
  await p.evaluate(() => { const R = RahleDebug; R.Store.data.settings.secs = false; R.Store.save(); return R.Reader.render(67); });
  await p.waitForTimeout(500);
  assert.strictEqual(await p.locator('.rk-head').count(), 0);
  await p.evaluate(() => { const R = RahleDebug; R.Store.data.settings.secs = true; R.Store.data.settings.layout = 'mushaf'; R.Store.save(); });

  // ---- the dashboard: today's portion in its section (al-Mulk from the start, two pages a week)
  await p.evaluate(() => {
    const R = RahleDebug;
    R.Store.data.drill = null;
    R.Store.data.plan = R.PL.normalize({ model: 'ssm', weekly: 2, days: [1, 1, 1, 1, 1, 1, 1], order: 'front', from: 67 });
    R.Store.data.pst = {}; R.Store.save();
  });
  await p.click('.tab[data-tab="today"]');
  await p.waitForSelector('#v-today .td-portion');
  const td = await p.evaluate(() => ({ portion: document.querySelector('#v-today .td-portion').textContent, sec: (document.querySelector('#v-today .td-sec') || {}).textContent }));
  assert(/^Al-Mulk 1–/.test(td.portion), td.portion);
  assert(/^Sinnabschnitt Al-Mulk 1–14 · danach noch /.test(td.sec), td.sec);
  await shot('s6-dashboard');
  await p.click('#v-today [data-learn]');
  await p.waitForSelector(sheet + ' .ln-sec');
  assert.strictEqual(await p.textContent(sheet + ' .ln-sec'), td.sec);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // the portion learnt, the next one goes on in the section to its end
  const parts = await p.evaluate(() => {
    const R = RahleDebug, out = [];
    for (let k = 0; k < 6; k++) {
      const por = R.Plan.portion(0.3);
      out.push([R.D.Q.verseAyah[por.verses[0]], R.D.Q.verseAyah[por.verses[por.verses.length - 1]]]);
      R.Hifz.setVerses(por.verses, true);
      if (por.verses.includes(R.D.quran.surahs[66].start + 13)) break;
    }
    return out;
  });
  assert.strictEqual(parts[parts.length - 1][1], 14, 'the parts end with 14: ' + JSON.stringify(parts));
  for (let k = 1; k < parts.length; k++) assert.strictEqual(parts[k][0], parts[k - 1][1] + 1);

  // ---- dark, a small phone
  await p.click('.tab[data-tab="read"]');
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.setViewportSize({ width: 340, height: 740 });
  await p.waitForTimeout(500);
  await p.evaluate(v => RahleDebug.Reader.render(67, { v }), V.mulk + 13);   // the Mushaf again (the layout was changed above)
  await p.waitForSelector('.mushaf .mp');
  await p.waitForTimeout(900);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(over <= 0, 'no sideways scrolling: ' + over);
  assert((await page()).bands > 0);
  await shot('s7-dark-small');

  assert.deepStrictEqual(errors, []);
  console.log('ui secs ok');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
