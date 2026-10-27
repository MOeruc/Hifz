// UI check of the dashboard (Heute) and the hifz plan: no plan yet (the fixed steps, as before), making a plan
// (Sabaq/Sabqi/Manzil), today's portion learnt and taken back, a passage rated by hand, a test of a passage graded,
// "Weiter" to the next passage, the research sheet, what is known from before, the other models, the hifz tab, dark.
// Screenshots go to OUT_DIR. Run: node ui_today.js http://127.0.0.1:8765 OUT_DIR
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const assert = require('assert');
const [,, base, out] = process.argv;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => { if (!localStorage.getItem('rahle.v1')) localStorage.setItem('rahle.v1', JSON.stringify({ v: 1, settings: { intro: false }, tab: 'read' })); });
  await p.goto(base + '/index.html');
  await p.waitForSelector('.tab[data-tab="today"]');
  const shot = async (name, sel) => { await p.waitForTimeout(400); await (sel ? p.locator(sel).last() : p).screenshot({ path: `${out}/${name}.png` }); };
  const sheet = '.sheet.open';
  const closeSheets = async () => { while (await p.locator(sheet).count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(350); } };
  const st = () => p.evaluate(() => {
    const R = RahleDebug, d = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    return { d, plan: R.Store.data.plan, md: R.Store.data.md, pages: R.Store.data.pages, today: R.Store.data.pst.today, rows: [...document.querySelectorAll('#v-today .td-row')].map(x => x.textContent.replace(/\s+/g, ' ').trim()) };
  });
  // juz 30 known from before; al-Mursalat 1-19 learnt three days ago, 20-28 yesterday
  await p.evaluate(() => {
    const R = RahleDebug, Q = R.D.quran, vi = (s, a) => Q.surahs[s - 1].start + a - 1;
    const d = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    const range = (a, z) => { const o = []; for (let v = a; v <= z; v++) o.push(v); return o; };
    R.Hifz.setVerses(range(vi(78, 1), 6235), true, { old: true });
    R.Hifz.setVerses(range(vi(77, 1), vi(77, 28)), true);
    for (let v = vi(77, 1); v <= vi(77, 28); v++) R.Store.data.md[v] = v <= vi(77, 19) ? d - 3 : d - 1;
    for (const p of [580, 581]) Object.assign(R.Store.data.pages[p], { r: d - 1, i: 1 });
    R.Store.data.pst = {};
  });

  // ---- no plan yet: the way to make one; the reviews as before (fixed steps)
  await p.click('.tab[data-tab="today"]');
  await p.waitForSelector('#v-today .td-setup');
  let s = await st();
  assert(!s.plan);
  await shot('t1-noplan');

  // ---- making the plan: 2 pages a week (the default), every day of the week, Sabaq/Sabqi/Manzil (recommended)
  await p.click('#v-today .td-setup [data-plan]');
  await p.waitForSelector(sheet + ' .ps');
  await shot('t2-setup');
  for (const k of [5, 6]) await p.click(`${sheet} [data-day="${k}"]`);
  assert.strictEqual(await p.locator(`${sheet} .ps-model.on [data-model="ssm"]`).count(), 1, 'Sabaq/Sabqi/Manzil chosen first');
  await p.locator(`${sheet} .ps-model`).first().scrollIntoViewIfNeeded();
  await shot('t3-setup-models');
  await p.click(`${sheet} [data-save]`);
  await p.waitForSelector('#v-today .td-card .td-goal');
  await p.waitForTimeout(400);
  s = await st();
  assert.strictEqual(s.plan.model, 'ssm'); assert.deepStrictEqual(s.plan.days, [1, 1, 1, 1, 1, 1, 1]);
  const secs = s.today.items.map(x => x[1]);
  assert.deepStrictEqual(s.today.items.filter(x => x[1] === 'recent').map(x => x[0]), [580, 581], 'al-Mursalat learnt in the last days: daily');
  assert.strictEqual(secs.filter(x => x === 'manzil').length, Math.ceil(23 / 14), 'juz 30 in a round of 14 days');
  assert(/^Al-Mursalat 29/.test(await p.textContent('#v-today .td-portion')), 'next: al-Mursalat 29, from the end');
  assert(s.rows[0].startsWith('Al-Mursalat 1–28') && /Neu · Seite 580–581/.test(s.rows[0]), s.rows[0]);
  assert(/Manzil · Seite 582–583/.test(s.rows[1]), s.rows[1]);
  await shot('t4-dashboard');
  await p.evaluate(() => window.scrollTo(0, 2000));
  await shot('t4b-dashboard-bottom');
  await p.evaluate(() => window.scrollTo(0, 0));

  // ---- today's portion: how to learn it, then marked as learnt; taken back; marked from the card
  const portion = await p.textContent('#v-today .td-portion');
  await p.click('#v-today [data-learn]');
  await p.waitForSelector(sheet + ' .ln-steps');
  await shot('t5-learn');
  await p.click(`${sheet} [data-a="done"]`);
  await p.waitForSelector('#v-today .td-undo');
  s = await st();
  const vi77 = await p.evaluate(() => RahleDebug.D.quran.surahs[76].start);
  assert.strictEqual(s.md[vi77 + 28], s.d, '77:29 learnt today');
  assert(/geschafft|Wochenziel/.test(await p.textContent('#v-today .td-new')), 'today done');
  await shot('t6-learnt');
  await p.click('#v-today [data-undo]');
  await p.waitForSelector('#v-today [data-learnt]');
  s = await st();
  assert(s.md[vi77 + 28] == null, 'taken back');
  assert.strictEqual(await p.textContent('#v-today .td-portion'), portion);
  await p.click('#v-today [data-learnt]');
  await p.waitForSelector('#v-today .td-undo');

  // ---- a passage rated by hand: "Sicher"
  await p.click('#v-today .td-row:nth-child(1) [data-ok]');
  await p.waitForSelector(sheet + ' .rate3');
  await shot('t7-rate');
  await p.click(`${sheet} [data-q="1"]`);
  await p.waitForTimeout(400);
  s = await st();
  assert.strictEqual(s.pages[580].t, s.d); assert.strictEqual(s.pages[581].t, s.d);
  assert.strictEqual(await p.locator('#v-today .td-row.done').count(), 1);

  // ---- the manzil passage recited in a test (all words there): graded, and "Weiter" has nothing left
  const g = await p.evaluate(() => {
    const R = RahleDebug, bl = R.Today.bl.find(x => x.sec === 'manzil');
    const from = R.D.Q.verseStart[bl.a], to = R.D.Q.verseStart[bl.z + 1] - 1;
    const status = []; for (let k = from; k <= to; k++) status[k] = window.QuranCore.ST.OK;
    R.Hifz.reviewFromSession({ status }, { from, to });
    return { pages: bl.pages, rec: bl.pages.map(p => R.Store.data.pages[p]), next: R.Today.nextBlock() };
  });
  for (const r of g.rec) assert(r.t > 0 && r.q === 100, JSON.stringify(r));
  assert.strictEqual(g.next, null, 'everything recited');
  await p.evaluate(() => RahleDebug.Today.render());
  assert.strictEqual(await p.locator('#v-today .td-row.done').count(), await p.locator('#v-today .td-row').count());
  await shot('t8-all-done');
  // the badge counts what is left: nothing
  assert(await p.locator('#due-badge').isHidden());

  // ---- what the research says
  await p.click('#v-today [data-why]');
  await p.waitForSelector(sheet + ' .how-list');
  await shot('t9-info');
  await p.evaluate(() => { const b = document.querySelector('.sheet.open .sheet-body'); b.scrollTop = b.scrollHeight; });
  await shot('t10-info-end');
  await closeSheets();

  // ---- known from before: whole surahs and juz
  await p.click('#v-today .td-foot [data-plan]');
  await p.waitForSelector(sheet + ' .ps');
  await p.click(`${sheet} [data-known]`);
  await p.waitForSelector(sheet + ' .ks-juz');
  await shot('t11-known');
  await p.click(`${sheet} .ks-row[data-s="76"]`);                       // al-Insan known from before: no day of learning
  s = await st();
  const vi76 = await p.evaluate(() => RahleDebug.D.quran.surahs[75].start);
  assert(s.md[vi76] == null, 'known from before: not counted for the week');
  await p.click(`${sheet} .ks-row[data-s="76"]`);                       // a tap on something memorised only asks
  assert(/Nochmal tippen/.test(await p.textContent(`${sheet} .ks-row[data-s="76"]`)));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  // ---- the other models
  await p.click(`${sheet} [data-model="fsrs"]`);
  await shot('t12-setup-fsrs');
  await p.click(`${sheet} [data-save]`);
  await p.waitForTimeout(500);
  s = await st();
  assert.strictEqual(s.plan.model, 'fsrs');
  assert(Object.keys(s.pages).length >= 26 && Object.values(s.pages).every(r => r.s > 0 && r.i >= 1), 'every page a record for FSRS');
  await shot('t13-fsrs');
  await p.click('#v-today .td-foot [data-plan]');
  await p.waitForSelector(sheet + ' .ps');
  await p.click(`${sheet} [data-model="leitner"]`);
  await p.click(`${sheet} [data-save]`);
  await p.waitForTimeout(500);
  s = await st();
  assert.strictEqual(s.plan.model, 'leitner');
  assert(Object.values(s.pages).every(r => r.i >= 1 && r.i <= 30));
  await shot('t14-leitner');

  // ---- a verse marked as learnt by mistake, marked again as known from before: it no longer counts for the week
  const conv = await p.evaluate(() => {
    const R = RahleDebug, v = R.D.quran.surahs[74].start;
    R.Hifz.setVerses([v], true); const a = R.Store.data.md[v];
    R.Hifz.setVerses([v], true, { old: true }); const b = R.Store.data.md[v];
    R.Hifz.setVerses([v], false);
    return [a, b];
  });
  assert(conv[0] > 0 && conv[1] == null, JSON.stringify(conv));

  // ---- the hifz tab points to the dashboard
  await p.click('.tab[data-tab="hifz"]');
  await p.waitForSelector('#v-hifz .h-today');
  await shot('t15-hifz');

  // ---- dark, and no overflow on a small phone
  await p.click('.tab[data-tab="today"]');
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.evaluate(() => { RahleDebug.Store.data.plan.model = 'ssm'; RahleDebug.Plan.today(true); RahleDebug.Today.render(); });
  await shot('t16-dark');
  await p.setViewportSize({ width: 340, height: 740 });
  await p.waitForTimeout(300);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(over <= 0, 'no sideways scrolling: ' + over);
  await shot('t17-small');

  assert.deepStrictEqual(errors, []);
  console.log('ui today ok');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
