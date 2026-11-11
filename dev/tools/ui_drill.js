// UI check: learning with counting. From the dashboard: the sheet (how often, the last portion first, the steps and
// minutes), then the counting: the last portion, every verse counted as it is said (a session each, one long session,
// a phone that sends everything again, two times in one result), the first times with the text and then by heart,
// -1 and +1, a step counted by hand, closed and opened again where it was, the end: marked as learnt. Recalling (FSRS):
// read twice, then only times by heart without a mistake count (a gap, a look at the text: not); a long verse in parts;
// a time with too few words is not counted. Dark, a small phone. Screenshots go to OUT_DIR.
// Run: node ui_drill.js http://127.0.0.1:8765 OUT_DIR
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const assert = require('assert');
const [,, base, out] = process.argv;

// a scripted recogniser: every item of the queue is a session of utterances, each a final result after the interim
// text grew word by word; cum: every result again with all said before it in the session (some phones)
function fakeSR() {
  window.__queue = []; window.__busy = false;
  class FakeSR {
    constructor() { this.stopped = false; }
    start() { setTimeout(() => { this.onstart && this.onstart(); this.wait(); }, 30); }
    stop() { this.stopped = true; setTimeout(() => this.onend && this.onend(), 10); }
    abort() { this.stop(); }
    wait() {
      if (this.stopped) return;
      if (!window.__queue.length) { setTimeout(() => this.wait(), 50); return; }
      const item = window.__queue.shift();
      const say = typeof item === 'string' ? [item] : item.say, cum = !!item.cum;
      window.__busy = true;
      const done = [];
      let before = [], i = 0, k = 0;
      const emit = interim => {
        const res = done.map(t => { const x = [{ transcript: t, confidence: 0.9 }]; x.isFinal = true; return x; });
        if (interim) { const x = [{ transcript: interim, confidence: 0.6 }]; x.isFinal = false; res.push(x); }
        if (!this.stopped && this.onresult) this.onresult({ results: res, resultIndex: Math.max(0, res.length - 1) });
      };
      const next = () => {
        if (this.stopped) { window.__busy = false; return; }
        const w = say[i].split(' ');
        k++;
        if (k < w.length) { emit((cum ? before.concat(w.slice(0, k)) : w.slice(0, k)).join(' ')); setTimeout(next, 20); return; }
        before = before.concat(w);
        done.push((cum ? before : w).join(' '));
        emit('');
        i++; k = 0;
        if (i < say.length) { setTimeout(next, 40); return; }
        setTimeout(() => { window.__busy = false; if (!this.stopped && this.onend) this.onend(); }, 60);
      };
      next();
    }
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
}

const V113 = ['قل أعوذ برب الفلق', 'من شر ما خلق', 'ومن شر غاسق إذا وقب', 'ومن شر النفاثات في العقد', 'ومن شر حاسد إذا حسد'];
const V112 = ['قل هو الله أحد', 'الله الصمد', 'لم يلد ولم يولد', 'ولم يكن له كفوا أحد'];
const D282 = 'يا أيها الذين آمنوا إذا تداينتم بدين إلى أجل مسمى فاكتبوه وليكتب بينكم كاتب بالعدل ولا يأب كاتب أن يكتب كما علمه الله فليكتب وليملل الذي عليه الحق وليتق الله ربه ولا يبخس منه شيئا'.split(' ');
const P1 = D282.slice(0, 15).join(' '), P2 = D282.slice(15, 35).join(' ');
const times = (n, x) => Array.from({ length: n }, () => x);

(async () => {
  const b = await chromium.launch({ executablePath: require('./chrome.js') });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(fakeSR);
  await p.addInitScript(() => { if (!localStorage.getItem('rahle.v1')) localStorage.setItem('rahle.v1', JSON.stringify({ v: 1, settings: { intro: false }, tab: 'read' })); });
  await p.goto(base + '/index.html');
  await p.waitForSelector('.tab[data-tab="today"]');
  const shot = async name => { await p.waitForTimeout(350); await p.screenshot({ path: `${out}/${name}.png` }); };
  const sheet = '.sheet.open';
  /** a session of the recogniser, and wait until it is through */
  const say = async (item, wait) => {
    await p.evaluate(x => window.__queue.push(x), item);
    await p.waitForTimeout(80);
    await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 15000 });
    await p.waitForTimeout(wait == null ? 250 : wait);
  };
  const st = () => p.evaluate(() => {
    const R = RahleDebug, q = s => document.querySelector(s), dr = R.Drill;
    return { i: dr.st && dr.st.i, laps: dr.st && dr.st.laps, saved: R.Store.data.drill && { i: R.Store.data.drill.i, laps: R.Store.data.drill.laps },
      what: q('#dr-what') && q('#dr-what').textContent, how: q('#dr-how') && q('#dr-how').textContent, n: q('#dr-n') && q('#dr-n').textContent,
      of: q('#dr-of') && q('#dr-of').textContent, hide: q('#dr-text') && q('#dr-text').classList.contains('hide'), tip: q('#dr-tip') && q('#dr-tip').textContent,
      sub: q('#dr-sub') && q('#dr-sub').textContent, dots: q('#dr-dots') ? [...q('#dr-dots').children].map(i => i.className || '-').join('') : '',
      open: !!q('#drill') && !q('#drill').hidden, end: !!q('#dr-end') && !q('#dr-end').hidden };
  });
  /** the step is done and the next one has begun */
  const nextStep = async i => { await p.waitForFunction(k => RahleDebug.Drill.st.i === k && !!RahleDebug.Drill.t, i, { timeout: 5000 }); await p.waitForTimeout(150); };

  // al-Falaq learnt a few days ago, the rest of juz 30 known from before; al-Ikhlas is next (from the end, surah by surah)
  await p.evaluate(() => {
    const R = RahleDebug, Q = R.D.quran, vi = (s, a) => Q.surahs[s - 1].start + a - 1;
    const d = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    const range = (a, z) => { const o = []; for (let v = a; v <= z; v++) o.push(v); return o; };
    R.Hifz.setVerses(range(vi(78, 1), vi(111, 5)).concat(range(vi(114, 1), vi(114, 6))), true, { old: true });
    R.Hifz.setVerses(range(vi(113, 1), vi(113, 5)), true);
    for (let v = vi(113, 1); v <= vi(113, 5); v++) R.Store.data.md[v] = d - 3;   // in the week before: not this week's
    R.Store.data.plan = R.PL.normalize({ model: 'ssm', weekly: 1, days: [1, 1, 1, 1, 1, 1, 1], order: 'back' });
    R.Store.data.pst = {};
    R.Store.save();
  });
  await p.click('.tab[data-tab="today"]');
  await p.waitForSelector('#v-today .td-portion');
  assert.strictEqual(await p.textContent('#v-today .td-portion'), 'Al-Ikhlas');

  // ---- the sheet: learning with counting first; how often; the last portion first; steps and minutes
  await p.click('#v-today [data-learn]');
  await p.waitForSelector(sheet + ' .ln-drill [data-a="drill"]');
  await p.waitForTimeout(300);
  let plan = await p.textContent(sheet + ' .ln-plan');
  assert(/^6 Schritte · etwa \d+ Min\.$/.test(plan), plan);
  const m20 = +plan.match(/etwa (\d+)/)[1];
  assert.strictEqual(await p.getAttribute(sheet + ' [data-n="20"]', 'aria-pressed'), 'true');
  assert(/Al-Falaq, 20-mal/.test(await p.textContent(sheet + ' .ln-link')));
  assert(await p.isChecked(sheet + ' [data-link]'));
  await shot('d1-sheet');
  await p.click(sheet + ' [data-n="5"]');
  plan = await p.textContent(sheet + ' .ln-plan');
  assert(+plan.match(/etwa (\d+)/)[1] < m20, 'fewer minutes with 5 times: ' + plan);
  assert.strictEqual(await p.evaluate(() => RahleDebug.Store.data.settings.drillN), 5);
  await p.click(sheet + ' [data-link]');                                 // without the last portion: one step less
  assert(/^5 Schritte/.test(await p.textContent(sheet + ' .ln-plan')));
  await p.click(sheet + ' [data-link]');
  assert(/^6 Schritte/.test(await p.textContent(sheet + ' .ln-plan')));
  await p.click(sheet + ' [data-a="drill"]');
  await p.waitForSelector('#drill:not([hidden]) .dw');
  await p.waitForTimeout(300);

  // ---- step 1: the last portion, 5 times by heart, said verse by verse in one long session (a computer)
  let s = await st();
  assert.strictEqual(s.what, 'Zuerst der letzte Abschnitt: Al-Falaq'); assert.strictEqual(s.how, '5-mal auswendig');
  assert.strictEqual(s.n, '0'); assert.strictEqual(s.of, 'von 5'); assert(s.hide, 'by heart: the text hidden');
  assert(/^Schritt 1 von 6/.test(s.sub), s.sub);
  await shot('d2-link');
  await say({ say: [].concat(...times(2, V113)) });
  s = await st();
  assert.strictEqual(s.n, '2', JSON.stringify(s));
  await shot('d3-link-2');
  await say({ say: [].concat(...times(3, V113)) }, 100);
  s = await st();
  assert.strictEqual(s.of, 'geschafft', JSON.stringify(s));
  await nextStep(1);

  // ---- step 2: al-Ikhlas 1, the first three times with the text; a session for every time (a phone)
  s = await st();
  assert.strictEqual(s.what, 'Vers 1'); assert.strictEqual(s.how, '5-mal, die ersten 3 mit Text');
  assert(!s.hide, 'the text shown');
  await say(V112[0]); await say(V112[0]);
  s = await st();
  assert.strictEqual(s.n, '2'); assert(!s.hide); assert.strictEqual(s.dots, 'rr---');
  await shot('d4-piece-reading');
  await say(V112[0]);
  s = await st();
  assert.strictEqual(s.n, '3'); assert(s.hide, 'by heart from the fourth time');
  // one too many (counted by mistake): -1, the text is back; +1 by hand
  await p.click('#dr-minus');
  s = await st();
  assert.strictEqual(s.n, '2'); assert(!s.hide);
  await p.click('#dr-plus');
  s = await st();
  assert.strictEqual(s.n, '3'); assert.strictEqual(s.dots, 'rrm--'); assert(s.hide);
  await shot('d5-piece-byheart');
  // two times in one result, without a pause
  await say(V112[0] + ' ' + V112[0], 100);
  s = await st();
  assert.strictEqual(s.of, 'geschafft', JSON.stringify(s));
  await shot('d6-step-done');
  await nextStep(2);

  // ---- step 3: al-Ikhlas 2 on a phone that sends every result again with all before it
  s = await st();
  assert.strictEqual(s.what, 'Vers 2');
  await say({ say: times(4, V112[1]), cum: true });
  s = await st();
  assert.strictEqual(s.n, '4', 'all again, and only the new words counted: ' + JSON.stringify(s));
  await say(V112[1], 100);
  await nextStep(3);
  await p.evaluate(() => { window.QuranCore.Repeats.cum = null; });

  // ---- step 4: al-Ikhlas 3, a session each; step 5: al-Ikhlas 4 counted by hand (+1, no microphone)
  for (let k = 0; k < 4; k++) await say(V112[2]);
  s = await st();
  assert.strictEqual(s.n, '4');
  await say(V112[2], 100);
  await nextStep(4);
  s = await st();
  assert.strictEqual(s.what, 'Vers 4');
  await p.click('#dr-mic');                                               // the microphone off
  s = await st();
  assert(/Mikrofon ist aus/.test(s.tip), s.tip);
  for (let k = 0; k < 5; k++) await p.click('#dr-plus');
  await p.waitForTimeout(100);
  await p.click('#dr-plus');                                              // during the pause: on at once
  await nextStep(5);

  // ---- step 6: the four together; closed after two times; opened again from the dashboard where it was
  s = await st();
  assert.strictEqual(s.what, 'Verse 1–4 zusammen'); assert.strictEqual(s.how, '5-mal auswendig');
  await p.click('#dr-mic');                                               // listening again
  await say({ say: [].concat(...times(2, V112)) });
  s = await st();
  assert.strictEqual(s.n, '2', JSON.stringify(s));
  await shot('d7-group');
  await p.click('#dr-close');
  await p.waitForSelector('#drill', { state: 'hidden' });
  s = await st();
  assert.deepStrictEqual(s.saved, { i: 5, laps: 'cc' });
  await p.waitForSelector('#v-today [data-drill]');
  assert(/Schritt 6 von 6/.test(await p.textContent('#v-today .td-drill')));
  assert.strictEqual(await p.textContent('#v-today .td-portion'), 'Al-Ikhlas');
  await shot('d8-dashboard-saved');
  // the sheet says where it is, and can begin anew
  await p.click('#v-today .td-drill [data-learn]');
  await p.waitForSelector(sheet + ' [data-a="drill-new"]');
  assert(/Begonnen: Schritt 6 von 6/.test(await p.textContent(sheet + ' .ln-plan')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.click('#v-today [data-drill]');
  await p.waitForSelector('#drill:not([hidden]) .dw');
  await p.waitForTimeout(300);
  s = await st();
  assert.strictEqual(s.n, '2'); assert.strictEqual(s.what, 'Verse 1–4 zusammen');
  for (let k = 0; k < 3; k++) await say(V112.join(' '), k === 2 ? 100 : 250);
  await p.waitForSelector('#dr-end:not([hidden]) #dr-mark', { timeout: 5000 });
  await shot('d9-finished');
  await p.click('#dr-mark');
  await p.waitForSelector('#drill', { state: 'hidden' });
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => {
    const R = RahleDebug, v = R.D.quran.surahs[111].start, d = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    return { md: [0, 1, 2, 3].map(k => R.Store.data.md[v + k] === d), drill: R.Store.data.drill, undo: !!document.querySelector('#v-today .td-undo') };
  });
  assert.deepStrictEqual(after.md, [true, true, true, true]); assert.strictEqual(after.drill, null); assert(after.undo);
  await shot('d10-learnt');

  // ---- recalling (FSRS): a long verse in parts; read twice, then only by heart without a mistake counts
  await p.evaluate(() => { const R = RahleDebug; R.Store.data.plan.model = 'fsrs'; R.Store.data.settings.drillLink = false; R.Store.save(); R.Drill.open([R.D.quran.surahs[1].start + 281], true); });
  await p.waitForSelector('#drill:not([hidden]) .dw');
  await p.waitForTimeout(400);
  s = await st();
  assert.strictEqual(s.what, 'Vers 282, Teil 1 von 8'); assert.strictEqual(s.how, '2-mal lesen, dann 3-mal fehlerfrei auswendig');
  assert.strictEqual(s.of, 'von 3 fehlerfrei'); assert(!s.hide);
  await shot('d11-recall-reading');
  await say(P1); await say(P1);
  s = await st();
  assert.strictEqual(s.n, '0'); assert(s.hide); assert.strictEqual(s.dots, 'rr');
  // a word left out: does not count
  await say(P1.split(' ').filter((_, k) => k !== 6).join(' '));
  s = await st();
  assert.strictEqual(s.n, '0'); assert.strictEqual(s.dots, 'rrg'); assert(/Mit Lücken/.test(s.tip), s.tip);
  await shot('d12-recall-gap');
  // a look at the text: does not count either
  await p.click('#dr-text');
  s = await st();
  assert(!s.hide, 'shown for a moment');
  await say(P1);
  s = await st();
  assert.strictEqual(s.n, '0'); assert.strictEqual(s.dots, 'rrgp'); assert(/Nachsehen/.test(s.tip), s.tip);
  await p.waitForTimeout(3000);
  assert((await st()).hide, 'hidden again');
  for (let k = 0; k < 3; k++) await say(P1, k === 2 ? 100 : 250);
  await nextStep(1);
  s = await st();
  assert.strictEqual(s.what, 'Vers 282, Teil 2 von 8');
  // only the last few words of a time: not counted
  await say(P2);
  await say(P2.split(' ').slice(-4).join(' '));
  s = await st();
  assert.strictEqual(s.dots, 'r', JSON.stringify(s));
  await shot('d13-recall-part2');
  await p.click('#dr-close');
  await p.waitForSelector('#drill', { state: 'hidden' });

  // ---- dark, and a small phone: nothing sideways
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.setViewportSize({ width: 340, height: 700 });
  await p.evaluate(() => { const R = RahleDebug; R.Drill.open([R.D.quran.surahs[1].start + 281]); });
  await p.waitForSelector('#drill:not([hidden]) .dw');
  await p.waitForTimeout(400);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(over <= 0, 'no sideways scrolling: ' + over);
  await shot('d14-dark-small');
  await p.click('#dr-close');

  assert.deepStrictEqual(errors, []);
  console.log('ui drill ok');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
