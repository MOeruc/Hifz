// The hifz plan (hifzplan.js): the order of learning, the portion of a day (by verses, and by the sections that belong
// together in meaning), the week, the three models of reviewing
// (Sabaq/Sabqi/Manzil, FSRS, fixed steps), the passages of a day; half a year of a simulated learner in each model; and
// learning with counting: long verses cut, the steps, a step as a text to recite.
// Run: node tests/hifzplan.test.js QURAN_JSON MUSHAF_JSON
const fs = require('fs');
const assert = require('assert');
const QC = require('../core.js');
const P = require('../hifzplan.js');
const V = require('../vocab.js');
const quran = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const Q = QC.buildWords(quran);
const B = P.book({ verseStart: Q.verseStart, pages: quran.pages, juz: quran.juz, surahs: quran.surahs }), BB = B;
// the same with the sections that belong together in meaning (rukūʿ): the portions end where a section ends
const BS = P.book({ verseStart: Q.verseStart, pages: quran.pages, juz: quran.juz, surahs: quran.surahs, rukus: quran.rukus });
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok  ', name); };
const vi = (s, a) => quran.surahs[s - 1].start + a - 1;
const ref = v => Q.verseSurah[v] + ':' + Q.verseAyah[v];
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);
/** a deterministic random number generator (mulberry32) */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const plan = o => P.normalize(o);

ok('the book: 604 pages, every page sums to one page, every verse on the page it starts on', () => {
  assert.strictEqual(B.n, 6236);
  const per = new Float64Array(605);
  for (let v = 0; v < B.n; v++) per[B.pageOf[v]] += B.size[v];
  for (let p = 1; p <= 604; p++) assert(near(per[p], 1, 1e-9), `page ${p}: ${per[p]}`);
  assert.strictEqual(B.pageOf[vi(1, 1)], 1); assert.strictEqual(B.pageOf[vi(2, 1)], 2); assert.strictEqual(B.pageOf[vi(114, 6)], 604);
  assert.strictEqual(B.pageOf[vi(67, 1)], 562); assert.strictEqual(B.juzOf[vi(67, 1)], 29); assert.strictEqual(B.juzOf[vi(78, 1)], 30);
  assert.strictEqual(P.pageFirst(B, 604), vi(112, 1)); assert.strictEqual(P.pageLast(B, 604), vi(114, 6));
  assert(near(P.open(B, () => false, 0, B.n - 1), 604, 1e-6));
});

ok('the orders of learning: every verse once; from the end, juz by juz, from the front, from a chosen surah', () => {
  for (const o of P.ORDERS) for (const from of [0, 1, 2, 67, 114]) {
    const s = P.sequence(B, o, from), seen = new Uint8Array(B.n);
    assert.strictEqual(s.length, B.n);
    for (const v of s) { assert(!seen[v], `${o} ${from}: ${ref(v)} twice`); seen[v] = 1; }
  }
  const back = P.sequence(B, 'back', 0);
  assert.deepStrictEqual([...back.slice(0, 8)].map(ref), ['114:1', '114:2', '114:3', '114:4', '114:5', '114:6', '113:1', '113:2']);
  assert.strictEqual(ref(back[B.n - 1]), '1:7');
  assert.deepStrictEqual([...P.sequence(B, 'juz', 0).slice(0, 2)].map(ref), ['78:1', '78:2']);
  const juz = P.sequence(B, 'juz', 0);
  assert.strictEqual(ref(juz[juz.indexOf(vi(114, 6)) + 1]), '67:1', 'after juz 30 comes juz 29 from al-Mulk');
  assert.deepStrictEqual([...P.sequence(B, 'front', 0).slice(0, 2)].map(ref), ['1:1', '1:2']);
  const mulk = P.sequence(B, 'front', 67);
  assert.strictEqual(ref(mulk[0]), '67:1');
  assert.strictEqual(ref(mulk[mulk.indexOf(vi(67, 30)) + 1]), '68:1', 'from al-Mulk on in the order of the mushaf');
  assert.strictEqual(ref(mulk[mulk.indexOf(vi(114, 6)) + 1]), '1:1', 'and around to the start');
  const mulkBack = P.sequence(B, 'back', 67);
  assert.strictEqual(ref(mulkBack[mulkBack.indexOf(vi(67, 30)) + 1]), '66:1', 'from the end: al-Mulk, then at-Tahrim');
});

ok('the portion of a day: the next verses not memorised, ending at the verse nearest to the target', () => {
  const none = () => false;
  // from the end: an-Nas first, al-Falaq after it
  const a = P.nextPortion(B, none, 'back', 0, 0.3);
  assert.strictEqual(ref(a.verses[0]), '114:1');
  assert.deepStrictEqual(a.runs.map(r => r.map(ref)), [['114:1', '114:6']], 'an-Nas: ' + a.verses.map(ref));
  // a page from al-Mulk: the whole first page (562 ends with 67:12)
  const m = P.nextPortion(B, none, 'front', 67, 1);
  assert.strictEqual(ref(m.verses[0]), '67:1'); assert.strictEqual(ref(m.verses[m.verses.length - 1]), '67:12'); assert(near(m.size, 1, 1e-9));
  // half a page from al-Baqara 1: ends at the verse boundary nearest to half the page
  const h = P.nextPortion(B, none, 'front', 2, 0.5);
  let best = Infinity, sum = 0;
  for (let v = vi(2, 1); v < vi(2, 30); v++) { sum += B.size[v]; best = Math.min(best, Math.abs(sum - 0.5)); }
  assert(near(Math.abs(h.size - 0.5), best, 1e-9), `${h.size} vs best ${best}`);
  // memorised verses are left out; the portion goes on after them
  const mem = new Set([vi(114, 1), vi(114, 2), vi(114, 3)]);
  const g = P.nextPortion(B, v => mem.has(v), 'back', 0, 0.1);
  assert.strictEqual(ref(g.verses[0]), '114:4');
  // the short rest of a surah comes along (al-Ikhlas is not left with one verse)
  const ik = P.nextPortion(B, v => Q.verseSurah[v] > 112, 'back', 0, B.size[vi(112, 1)] + B.size[vi(112, 2)] + B.size[vi(112, 3)]);
  assert.deepStrictEqual(ik.runs.map(r => r.map(ref)), [['112:1', '112:4']]);
  // all memorised: nothing
  assert.strictEqual(P.nextPortion(B, () => true, 'back', 0, 1).verses.length, 0);
  // random states: never a memorised verse, always in the order of the plan, never more than one verse off the target
  const r = rng(7);
  for (let k = 0; k < 300; k++) {
    const o = P.ORDERS[k % 3], from = r() < 0.3 ? 1 + Math.floor(r() * 114) : 0, target = 0.05 + r() * 2;
    const m2 = new Uint8Array(B.n);
    const seq = P.sequence(B, o, from), cut = Math.floor(r() * B.n);
    for (let i = 0; i < cut; i++) if (r() < 0.9) m2[seq[i]] = 1;
    for (let i = 0; i < 40; i++) m2[Math.floor(r() * B.n)] = 1;
    const has = v => m2[v] === 1;
    const p = P.nextPortion(B, has, o, from, target);
    if (!p.verses.length) continue;
    const want = []; for (const v of seq) if (!has(v)) { want.push(v); if (want.length >= p.verses.length) break; }
    assert.deepStrictEqual(p.verses, want, `order ${o} from ${from}`);
    const maxV = Math.max(...p.verses.map(v => B.size[v]));
    assert(p.size <= target * 3 / 2 + maxV + 1e-9 && (p.size >= target - maxV - 1e-9 || p.verses.length === want.length), `size ${p.size} target ${target}`);
  }
});

ok('the sections that belong together in meaning (rukūʿ): 556, every surah begins one, a long verse can be one', () => {
  assert.strictEqual(BS.secs, 556);
  for (let s = 1; s <= 114; s++) assert.strictEqual(BS.secStart[BS.secOf[vi(s, 1)]], vi(s, 1), `surah ${s} begins a section`);
  for (let k = 0; k < BS.secs; k++) assert.strictEqual(BS.surahOf[BS.secStart[k]], BS.surahOf[BS.secStart[k + 1] - 1], `section ${k} in one surah`);
  const at = (s, a) => P.section(BS, BS.secOf[vi(s, a)]);
  const d = at(2, 282);                                     // the verses of debt: 282 and 283 together, the 39th of 40
  assert.deepStrictEqual([ref(d.a), ref(d.z), d.nr, d.of], ['2:282', '2:283', 39, 40]);
  const mz = at(73, 20);                                    // al-Muzzammil 20: one long verse, a section of its own
  assert.deepStrictEqual([ref(mz.a), ref(mz.z), mz.nr, mz.of], ['73:20', '73:20', 2, 2]);
  assert.deepStrictEqual([at(67, 1), at(67, 15)].map(x => [ref(x.a), ref(x.z)]), [['67:1', '67:14'], ['67:15', '67:30']]);
  assert.deepStrictEqual([ref(at(112, 3).a), ref(at(112, 3).z), at(112, 3).of], ['112:1', '112:4', 1]);
  let total = 0;
  for (let k = 0; k < BS.secs; k++) total += P.section(BS, k).size;
  assert(near(total, 604, 1e-6), 'the sections cover the book');
});

ok('the portion with sections: it ends where a section ends; a long section in parts of about the same size', () => {
  const none = () => false;
  // an-Nas whole; a day of a page from the end: an-Nas, al-Falaq, al-Ikhlas (three whole sections)
  assert.deepStrictEqual(P.nextPortion(BS, none, 'back', 0, 0.3).runs.map(r => r.map(ref)), [['114:1', '114:6']]);
  const pg = P.nextPortion(BS, none, 'back', 0, 1);
  assert.deepStrictEqual([...new Set(pg.verses.map(v => BS.surahOf[v]))], [114, 113, 112]);
  // al-Mulk 1-14 (a section of 1.1 pages) with a page a day: whole; with a third of a page: in parts, the last ends at 14
  assert.deepStrictEqual(P.nextPortion(BS, none, 'front', 67, 1).runs.map(r => r.map(ref)), [['67:1', '67:14']]);
  const mem = new Set(), has = v => mem.has(v), parts = [];
  for (let day = 0; day < 10; day++) {
    const p = P.nextPortion(BS, has, 'front', 67, 0.3);
    parts.push(p);
    for (const v of p.verses) mem.add(v);
    if (mem.has(vi(67, 14))) break;
  }
  const sec = P.section(BS, BS.secOf[vi(67, 1)]);
  assert.strictEqual(parts.length, Math.round(sec.size / 0.3), 'as many days as the size asks');
  for (const p of parts.slice(0, -1)) assert(BS.secOf[p.verses[p.verses.length - 1]] === sec.k && p.verses[p.verses.length - 1] < sec.z, 'inside the section');
  assert.strictEqual(ref(parts[parts.length - 1].verses.slice(-1)[0]), '67:14', 'the last part ends with the section');
  const sizes = parts.map(p => p.size), maxV = Math.max(...Array.from({ length: 14 }, (_, k) => BS.size[vi(67, k + 1)]));
  assert(Math.max(...sizes) - Math.min(...sizes) <= maxV + 1e-9, 'parts of about the same size: ' + sizes.map(x => x.toFixed(2)));
  // a section with verses memorised in it: they are left out, the rest is the section
  const holes = new Set([vi(67, 3), vi(67, 4)]);
  const hp = P.nextPortion(BS, v => holes.has(v), 'front', 67, 1);
  assert.deepStrictEqual(hp.runs.map(r => r.map(ref)), [['67:1', '67:2'], ['67:5', '67:14']]);
  // the last learning day of the week goes on to its target, into the next section: al-Mulk 1-14 (1.1 pages) and a
  // day of 1.6 pages: without fill al-Mulk 1-14 alone, with fill on into 15-30
  const nf = P.nextPortion(BS, none, 'front', 67, 1.6), wf = P.nextPortion(BS, none, 'front', 67, 1.6, { fill: true });
  assert.strictEqual(ref(nf.verses.slice(-1)[0]), '67:14');
  const s2 = P.section(BS, BS.secOf[vi(67, 15)]), part = wf.size - nf.size, wantPart = Math.max(s2.size / 2, 1.6 - nf.size);
  assert(wf.size >= 1.6 - 1e-9 - 0.1 && BS.secOf[wf.verses.slice(-1)[0]] === s2.k, `filled: ${wf.size.toFixed(2)}`);
  assert(Math.abs(part - wantPart) <= Math.max(...wf.verses.map(v => BS.size[v])) + 1e-9, `the first part of 15-30: ${part.toFixed(2)} for ${wantPart.toFixed(2)}`);
  // where a portion stands: al-Mulk 1-5 of 1-14, then the rest
  const ps = P.portionSection(BS, none, parts[0].verses);
  assert.strictEqual(ps.sec.k, sec.k); assert.strictEqual(ps.whole, 0); assert(near(ps.after, sec.size - parts[0].size, 1e-9));
  assert.strictEqual(P.portionSection(BS, none, pg.verses).whole, 3);
  // learners of every order and pace: in the order of the plan, never a memorised verse; a portion ends inside a
  // section only when that section was too long for the day (then its first part), and every section is finished
  const r = rng(11);
  for (let k = 0; k < 120; k++) {
    const o = P.ORDERS[k % 3], from = r() < 0.3 ? 1 + Math.floor(r() * 114) : 0, target = 0.15 + r() * 1.5;
    const m2 = new Uint8Array(BS.n), seq = P.sequence(BS, o, from), cut = Math.floor(r() * BS.n);
    for (let i = 0; i < cut; i++) if (r() < 0.9) m2[seq[i]] = 1;
    for (let i = 0; i < 30; i++) m2[Math.floor(r() * BS.n)] = 1;
    const has = v => m2[v] === 1;
    for (let day = 0; day < 12; day++) {
      const p = P.nextPortion(BS, has, o, from, target);
      if (!p.verses.length) break;
      const want = []; for (const v of seq) if (!has(v)) { want.push(v); if (want.length >= p.verses.length) break; }
      assert.deepStrictEqual(p.verses, want, `order ${o} from ${from}`);
      // what was left of the section of the last verse, as one run in the order of learning (learning juz by juz,
      // a section across the start of a juz is two runs)
      const last = p.verses[p.verses.length - 1], kk = BS.secOf[last];
      let mine = 0; for (const v of p.verses) if (BS.secOf[v] === kk) mine += BS.size[v];
      let restBefore = 0;
      for (let j = seq.indexOf(p.verses.find(v => BS.secOf[v] === kk)); j < seq.length && BS.secOf[seq[j]] === kk; j++) if (!has(seq[j])) restBefore += BS.size[seq[j]];
      const restAfter = restBefore - mine;
      if (restAfter > 1e-9) {
        // ends inside: this section did not fit the day (or the day had less than half its target before it)
        assert(restBefore > P.WHOLE * target - 1e-9, `${o}: a section of ${restBefore.toFixed(2)} cut for a day of ${target.toFixed(2)}`);
        const parts = Math.max(2, Math.round(restBefore / target)), maxV = Math.max(...p.verses.map(v => BS.size[v]));
        assert(Math.abs(mine - restBefore / parts) <= maxV + 1e-9, `${o}: a part of ${mine.toFixed(2)} for ${(restBefore / parts).toFixed(2)}`);
      }
      for (const v of p.verses) m2[v] = 1;
    }
  }
});

ok('the week: Monday to Sunday, the goal shared over the learning days that are left', () => {
  assert.strictEqual(P.weekday(0), 3);                     // 1 Jan 1970: Thursday
  const mon = 20752;                                       // Monday, 26 Oct 2026 (days since 1970)
  assert.strictEqual(P.weekday(mon), 0); assert.strictEqual(P.weekStart(mon + 6), mon); assert.strictEqual(P.weekStart(mon + 7), mon + 7);
  const pl = plan({ weekly: 2, days: [1, 1, 1, 1, 1, 0, 0] });
  let w = P.week(B, {}, pl, mon);
  assert(near(w.target, 0.4) && w.learnDay && w.daysLeft === 5 && !w.reached);
  // half a page learnt on Monday: Tuesday's share is what is left over the four days left
  const md = {};
  let s = 0; for (let v = vi(67, 1); s < 0.5; v++) { md[v] = mon; s += B.size[v]; }
  w = P.week(B, md, pl, mon + 1);
  assert(near(w.done, s) && near(w.target, (2 - s) / 4) && near(w.per[0], s));
  // on Monday itself the share stays as it was in the morning, and what was learnt counts for today
  w = P.week(B, md, pl, mon);
  assert(near(w.target, 0.4) && near(w.today, s) && w.left === 0);
  // Saturday is not a learning day; the next week starts empty
  w = P.week(B, md, pl, mon + 5);
  assert(!w.learnDay && w.target === 0);
  w = P.week(B, md, pl, mon + 7);
  assert(near(w.done, 0) && near(w.target, 0.4));
  // the goal reached
  const md2 = {}; let s2 = 0; for (let v = vi(67, 1); s2 < 2; v++) { md2[v] = mon + 1; s2 += B.size[v]; }
  assert(P.week(B, md2, pl, mon + 2).reached);
  assert(near(P.perDay(pl), 0.4));
});

ok('fixed steps: 1, 3, 7, 14, 30 days; with mistakes the same step, forgotten back to the first', () => {
  const pl = plan({ model: 'leitner' });
  let r = P.learnt(null, 100, pl);
  assert.strictEqual(r.i, 1);
  const seen = [];
  for (let k = 0; k < 6; k++) { r = P.review(r, 1, r.r + r.i, pl); seen.push(r.i); }
  assert.deepStrictEqual(seen, [3, 7, 14, 30, 30, 30]);
  assert.strictEqual(P.review(r, 0.9, r.r + 30, pl).i, 30);
  assert.strictEqual(P.review(r, 0.6, r.r + 30, pl).i, 1);
  assert.strictEqual(P.review({ r: 0, i: 7 }, 0.9, 7, pl).i, 7);
  assert.strictEqual(P.review({ r: 0, i: 60 }, 1, 60, pl).i, 30, 'the old 60-day step becomes the last step');
  const old = { 600: { r: 0, i: 60 } };
  P.ensure(B, v => B.pageOf[v] === 600, old, pl, 10);
  assert.strictEqual(old[600].i, 30, 'records of earlier versions: at most 30 days');
  // learning new verses on a page is not a recitation of it: the day's list does not count it as done
  const l = P.learnt({ r: 3, i: 7, t: 3 }, 9, pl);
  assert.strictEqual(l.t, 3); assert.strictEqual(l.r, 9); assert.strictEqual(l.i, 1);
});

ok('FSRS for pages: new verses come again tomorrow, then growing gaps, at most 30 days; a higher target, more often', () => {
  const run = ret => {
    const pl = plan({ model: 'fsrs', retention: ret });
    let r = P.learnt(null, 0, pl);
    const gaps = [r.i];
    for (let k = 0; k < 8; k++) { r = P.review(r, 1, r.r + r.i, pl, 'p'); gaps.push(r.i); }
    return { gaps, r, pl };
  };
  const a = run(0.9), b = run(0.95), c = run(0.97);
  for (const x of [a, b, c]) {
    assert.strictEqual(x.gaps[0], 1);
    for (let k = 1; k < x.gaps.length; k++) assert(x.gaps[k] >= x.gaps[k - 1] && x.gaps[k] <= P.CAP, x.gaps.join(','));
    assert.strictEqual(x.gaps[x.gaps.length - 1], P.CAP);
  }
  const sum = g => g.slice(0, 5).reduce((s, x) => s + x, 0);
  assert(sum(a.gaps) > sum(b.gaps) && sum(b.gaps) > sum(c.gaps), [a.gaps, b.gaps, c.gaps].join(' | '));
  // forgotten: tomorrow again, lower stability; with mistakes: shorter than without
  const f = P.review(b.r, 0.5, b.r.r + 30, b.pl, 'p');
  assert.strictEqual(f.i, 1); assert(f.s < b.r.s); assert.strictEqual(f.l, 1);
  const h = P.review(b.r, 0.9, b.r.r + 10, b.pl, 'p'), g = P.review(b.r, 1, b.r.r + 10, b.pl, 'p');
  assert(h.i <= g.i && h.s < g.s);
  // new verses on a page that sat well: as fragile as a new page again
  const nw = P.learnt(b.r, 300, b.pl);
  assert.strictEqual(nw.i, 1); assert(nw.s <= V.review(null, V.GOOD, 0).s);
  assert.deepStrictEqual(P.preview(P.learnt(null, 0, b.pl), 1, b.pl, 'p').map(x => x >= 1), [true, true, true]);
});

ok('Sabaq, Sabqi, Manzil: the recent pages daily, the weak ones daily, all others in a round', () => {
  const pl = plan({ model: 'ssm', recent: 7, cycle: 4 });
  const has = v => Q.verseSurah[v] >= 78;                  // juz 30, known from before
  const pages = {}, md = {}, state = {};
  // al-Mursalat 1-15 (page 580) learnt three days ago
  for (let v = vi(77, 1); v <= vi(77, 15); v++) md[v] = 97;
  const has2 = v => has(v) || md[v] != null;
  const t = P.today({ b: B, has: has2, pages, md, plan: pl, day: 100, state });
  const rec = t.items.filter(x => x[1] === 'recent').map(x => x[0]), man = t.items.filter(x => x[1] === 'manzil').map(x => x[0]);
  assert.deepStrictEqual(rec, [580]);
  const old = P.memPages(B, has2).filter(p => p !== 580);
  assert.strictEqual(man.length, Math.ceil(old.length / 4));
  assert.deepStrictEqual(man, old.slice(0, man.length), 'the round starts at the first page');
  // a weak page comes every day until it is recited well
  pages[600] = P.review(null, 0.6, 99, pl);
  assert(pages[600].w);
  const t2 = P.today({ b: B, has: has2, pages, md, plan: pl, day: 101, state });
  assert(t2.items.some(x => x[0] === 600 && x[1] === 'weak'));
  pages[600] = P.review(pages[600], 0.9, 101, pl); assert(pages[600].w, 'with mistakes still weak');
  pages[600] = P.review(pages[600], 1, 102, pl); assert(!pages[600].w);
  // after the window the page joins the round
  const t3 = P.today({ b: B, has: has2, pages, md, plan: pl, day: 110, state });
  assert(!t3.items.some(x => x[1] === 'recent'));
});

ok('the round: every page once per round, nothing skipped when a day is missed, nothing doubled', () => {
  const pl = plan({ model: 'ssm', cycle: 7 });
  const has = v => Q.verseSurah[v] >= 67;                  // juz 29 and 30
  const pages = {}, state = {};
  const old = P.memPages(B, has);
  const quota = Math.ceil(old.length / 7);
  const days = new Map();
  let day = 1000;
  // three weeks, every day all of it: 43 pages, 7 a day, a round takes 6 or 7 days
  for (let k = 0; k < 21; k++, day++) {
    const t = P.today({ b: B, has, pages, md: {}, plan: pl, day, state });
    assert.strictEqual(t.items.length, quota);
    assert.strictEqual(new Set(t.items.map(x => x[0])).size, quota, 'no page twice in a day');
    for (const [p] of t.items) { pages[p] = P.review(pages[p], 1, day, pl); (days.get(p) || days.set(p, []).get(p)).push(day); }
  }
  for (const p of old) {
    const d = days.get(p);
    assert(d && d.length >= 3, `page ${p}: ${d}`);
    for (let k = 1; k < d.length; k++) assert(d[k] - d[k - 1] >= Math.floor(old.length / quota) && d[k] - d[k - 1] <= 7, `page ${p}: ${d}`);
  }
  assert.strictEqual(state.manzil.round, 1 + Math.floor(21 * quota / old.length));
  // a day with nothing done: the same pages come again the next day, the round waits
  const t1 = P.today({ b: B, has, pages, md: {}, plan: pl, day, state });
  day += 3;                                                // three days not opened at all
  const t2 = P.today({ b: B, has, pages, md: {}, plan: pl, day, state });
  assert.deepStrictEqual(t2.items, t1.items);
  // half of it done: the other half first the next day, then new pages up to the quota
  for (const [p] of t2.items.slice(0, 2)) pages[p] = P.review(pages[p], 1, day, pl);
  day++;
  const t3 = P.today({ b: B, has, pages, md: {}, plan: pl, day, state });
  const left = t2.items.slice(2).map(x => x[0]);
  for (const p of left) assert(t3.items.some(x => x[0] === p), `page ${p} carried over`);
  assert.strictEqual(t3.items.length, quota);
  // the same day asked again: the same list, done pages included (as done); after a change of the plan, anew without
  // jumping ahead in the round
  for (const [p] of t3.items) pages[p] = P.review(pages[p], 1, day, pl);
  const t4 = P.today({ b: B, has, pages, md: {}, plan: pl, day, state });
  assert.deepStrictEqual(t4.items, t3.items);
  const t5 = P.today({ b: B, has, pages, md: {}, plan: pl, day, state, again: true });
  assert.deepStrictEqual(t5.items, t3.items);
  const pl3 = plan({ model: 'ssm', cycle: 3 });
  const t6 = P.today({ b: B, has, pages, md: {}, plan: pl3, day, state, again: true });
  assert.strictEqual(t6.items.length, Math.ceil(old.length / 3));
  for (const [p] of t3.items) assert(t6.items.some(x => x[0] === p), `page ${p}: the round goes on from the same place`);
});

ok('FSRS and steps: the pages due today, the most at risk first, at most 20 a day', () => {
  for (const model of ['fsrs', 'leitner']) {
    const pl = plan({ model });
    const has = v => Q.verseSurah[v] >= 58;                // juz 28 to 30
    const pages = {}, state = {};
    P.ensure(B, has, pages, pl, 500);
    const mem = P.memPages(B, has);
    assert.strictEqual(Object.keys(pages).length, mem.length);
    const spread = P.spreadDays(mem.length);
    const dueDays = mem.map(p => pages[p].r + pages[p].i);
    assert(Math.min(...dueDays) === 501 && Math.max(...dueDays) === 500 + spread, 'pages known from before come within ' + spread + ' days');
    // a long break: everything due, worked off over days
    const t = P.today({ b: B, has, pages, md: {}, plan: pl, day: 600, state });
    assert.strictEqual(t.items.length, P.MAX_DAY); assert.strictEqual(t.more, mem.length - P.MAX_DAY);
    for (let k = 1; k < t.items.length; k++) assert(t.items[k][0] > t.items[k - 1][0]);
    // pages no longer memorised lose their record
    P.ensure(B, v => Q.verseSurah[v] >= 78, pages, pl, 600);
    assert(Object.keys(pages).every(p => +p >= 582));
  }
});

ok('passages: consecutive pages of a section in one go, at most five pages, a gap ends one', () => {
  const span = x => x.pages.join(',') + ' ' + ref(x.a) + '-' + ref(x.z);
  const juz30 = v => Q.verseSurah[v] >= 78;
  const seven = [582, 583, 584, 585, 586, 587, 588, 600].map(p => [p, 'manzil']);
  assert.deepStrictEqual(P.blocks(B, juz30, seven).map(span), ['582,583,584,585,586 78:1-81:29', '587,588 82:1-83:33', '600 100:6-102:8']);
  // 80:1 (page 585) not memorised: the passage before ends at 79:46, the next starts at 80:2
  const gap = v => juz30(v) && v !== vi(80, 1);
  assert.deepStrictEqual(P.blocks(B, gap, seven).map(span), ['582,583,584 78:1-79:46', '585,586,587,588 80:2-83:33', '600 100:6-102:8']);
  // two sections never in one passage
  assert.strictEqual(P.blocks(B, juz30, [[590, 'recent'], [591, 'manzil']]).length, 2);
});

// ------------------------------------------------------------------ half a year of a learner, in each model
/**
 * A learner with juz 30 known from before, learning 2 pages a week on five days in the order from the end (al-Mursalat,
 * al-Insan, ...), reciting everything the plan asks on most days (one day in eight nothing at all), sometimes with
 * mistakes, sometimes forgetting (the quality of a recitation is random here; the models react to it).
 */
function simulate(model, opts, book) {
  const B = book || BB;
  const pl = plan(Object.assign({ model, weekly: 2, order: 'back' }, opts));
  const r = rng(42);
  const mem = new Uint8Array(B.n), md = {}, pages = {}, state = {};
  for (let v = vi(78, 1); v < B.n; v++) mem[v] = 1;
  const has = v => mem[v] === 1;
  const last = new Map(), gaps = [], firstMonth = new Map(), load = [];
  const start = 20752;                                     // a Monday
  P.ensure(B, has, pages, pl, start);
  for (const p of P.memPages(B, has)) last.set(p, start);
  for (let day = start; day < start + 182; day++) {
    if ((day - start) % 8 === 7) { load.push(null); continue; }           // a day without the app
    P.ensure(B, has, pages, pl, day);
    const t = P.today({ b: B, has, pages, md, plan: pl, day, state });
    let recited = 0;
    for (const bl of P.blocks(B, has, t.items)) {
      for (const p of bl.pages) {
        const x = r(), q = x < 0.04 ? 0.6 : x < 0.15 ? 0.9 : 1;
        pages[p] = P.review(pages[p], q, day, pl, 'p' + p);
        if (last.has(p)) gaps.push(day - last.get(p));
        last.set(p, day); recited++;
        if (firstMonth.has(p) && day - firstMonth.get(p).at <= 30) firstMonth.get(p).n++;
      }
    }
    load.push(recited);
    const w = P.week(B, md, pl, day);
    if (w.learnDay && w.left > 0.02) {
      const por = P.nextPortion(B, has, pl.order, pl.from, w.left, { fill: w.daysLeft === 1 });   // (as the app does)
      for (const v of por.verses) { mem[v] = 1; md[v] = day; }
      for (const p of new Set(por.verses.map(v => B.pageOf[v]))) {
        pages[p] = P.learnt(pages[p], day, pl);
        if (!firstMonth.has(p)) firstMonth.set(p, { at: day, n: 0 });
        if (!last.has(p)) last.set(p, day);
      }
    }
  }
  const lastWeeks = load.slice(-56).filter(x => x != null);
  const avg = lastWeeks.reduce((s, x) => s + x, 0) / lastWeeks.length;
  const early = [...firstMonth.values()].filter(x => x.at < start + 182 - 30).map(x => x.n);
  return { learnt: Object.keys(md).reduce((x, v) => x + B.size[+v], 0), pages: P.memPages(B, has).length, avg, max: Math.max(...lastWeeks),
    maxGap: Math.max(...gaps), early: early.reduce((s, x) => s + x, 0) / Math.max(1, early.length), load };
}

ok('half a year, three models: the goal met every week, no page left out, the work of a day', () => {
  const rows = [];
  for (const [model, o, name] of [['ssm', {}, 'Sabaq·Sabqi·Manzil (7 / 14 Tage)'], ['ssm', { cycle: 30 }, 'Sabaq·Sabqi·Manzil (7 / 30 Tage)'],
    ['fsrs', { retention: 0.95 }, 'FSRS 95 %'], ['fsrs', { retention: 0.9 }, 'FSRS 90 %'], ['leitner', {}, 'Feste Stufen']]) {
    const s = simulate(model, o);
    rows.push([name, s]);
    // 26 weeks of 2 pages: 52 pages learnt, the missed days made up on the other days of the week
    assert(Math.abs(s.learnt - 52) < 1, `${name}: ${s.learnt.toFixed(2)} pages learnt`);
    // no page waits longer than the round or the cap, plus the days without the app (and, in FSRS and the steps, a
    // backlog of a day or two)
    const limit = model === 'ssm' ? (o.cycle || 14) + 6 : P.CAP + 6;
    assert(s.maxGap <= limit, `${name}: a page waited ${s.maxGap} days (limit ${limit})`);
    // new pages come often in their first month
    assert(s.early >= 4, `${name}: new pages recited ${s.early.toFixed(1)} times in their first month`);
  }
  // the same plan with the portions ending at the ends of sections: the goal still met every week
  const ss = simulate('ssm', {}, BS);
  assert(Math.abs(ss.learnt - 52) < 1, `sections: ${ss.learnt.toFixed(2)} pages learnt`);
  assert(ss.maxGap <= 14 + 6, `sections: a page waited ${ss.maxGap} days`);
  rows.push(['Sabaq·Sabqi·Manzil, Sinnabschnitte', ss]);
  console.log('      model                              pages  per day (last 8 weeks)  most  longest gap  first month');
  for (const [name, s] of rows) console.log(`      ${name.padEnd(34)} ${String(s.pages).padStart(5)}  ${s.avg.toFixed(1).padStart(22)}  ${String(s.max).padStart(4)}  ${String(s.maxGap).padStart(11)}  ${s.early.toFixed(1).padStart(11)}`);
});

// ------------------------------------------------------------------ learning with counting (the drill)
const mushaf = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
const LE = mushaf ? P.lineEnds(Q, mushaf) : null;
const PAUSES = 'ۘۗۚۖۛ';
const wordsOf = (a, z) => z - a + 1;

ok('long verses cut into pieces of at most 20 words, at a pause sign or the end of a line; short verses whole', () => {
  assert(LE, 'run with mushaf.json');
  let cuts = 0, signs = 0, lines = 0, long = 0, maxPiece = 0;
  for (let v = 0; v < B.n; v++) {
    const ps = P.pieces(Q, v, LE), L = Q.verseStart[v + 1] - Q.verseStart[v];
    // the pieces cover the verse, in order, without a gap
    assert.strictEqual(ps[0][0], Q.verseStart[v]); assert.strictEqual(ps[ps.length - 1][1], Q.verseStart[v + 1] - 1);
    for (let k = 1; k < ps.length; k++) assert.strictEqual(ps[k][0], ps[k - 1][1] + 1);
    if (L <= P.PIECE_MAX) { assert.strictEqual(ps.length, 1, `${ref(v)}: ${L} words, cut`); continue; }
    long++;
    for (const [a, z] of ps) { maxPiece = Math.max(maxPiece, wordsOf(a, z)); assert(wordsOf(a, z) >= 4, `${ref(v)}: a piece of ${wordsOf(a, z)} words`); }
    for (let k = 0; k < ps.length - 1; k++) {
      const g = ps[k][1];
      cuts++;
      if ([...PAUSES].some(c => Q.words[g].t.indexOf(c) >= 0)) signs++;
      else if (LE[g]) lines++;
      else assert.fail(`${ref(v)}: cut after word ${g - Q.verseStart[v] + 1} without a pause sign or the end of a line`);
    }
  }
  assert(maxPiece <= P.PIECE_MAX, `a piece of ${maxPiece} words`);
  // the longest verse: 2:282, 128 words
  const d = P.pieces(Q, vi(2, 282), LE);
  assert(d.length >= 7 && d.length <= 9, `2:282 in ${d.length} pieces`);
  console.log(`      ${long} verses of more than ${P.PIECE_MAX} words, ${cuts} cuts: ${signs} at a pause sign, ${lines} at the end of a line`);
});

ok('the steps: every piece, groups of at most four pieces and 40 words, the whole; the last portion first', () => {
  // al-Mulk 1-11 (11 verses): groups of verses, the whole at the end
  const vs = []; for (let a = 1; a <= 11; a++) vs.push(vi(67, a));
  const tw = P.drill(Q, vs, { method: 'twenty', n: 20, lineEnd: LE });
  const kinds = tw.steps.map(s => s.kind[0]).join('');
  assert(/^(p+g)+w$/.test(kinds), kinds);
  assert.strictEqual(tw.steps.filter(s => s.kind === 'piece').length, 11);
  assert.strictEqual(tw.steps[tw.steps.length - 1].kind, 'whole');
  for (const s of tw.steps) {
    assert.strictEqual(s.need, 20); assert.strictEqual(s.rule, 'any');
    assert.strictEqual(s.show, s.kind === 'piece' ? 3 : 0);
    if (s.kind === 'group') assert(s.words <= P.GROUP_WORDS, `a group of ${s.words} words`);
  }
  // every piece of a group comes right before it, and the group is the pieces together
  for (let i = 0; i < tw.steps.length; i++) {
    const s = tw.steps[i];
    if (s.kind !== 'group') continue;
    let j = i - 1; const parts = [];
    while (j >= 0 && tw.steps[j].kind === 'piece') parts.unshift(tw.steps[j--]);
    assert(parts.length >= 2 && parts.length <= P.GROUP_PIECES);
    assert.strictEqual(parts[0].ranges[0][0], s.ranges[0][0]); assert.strictEqual(parts[parts.length - 1].ranges[0][1], s.ranges[0][1]);
  }
  // recalling: read twice, three times right; together and the whole twice right; the last portion once
  const link = [vi(67, 1), vi(67, 2)];
  const rc = P.drill(Q, vs.slice(2), { method: 'recall', link, lineEnd: LE });
  assert.strictEqual(rc.steps[0].kind, 'link'); assert.strictEqual(rc.steps[0].need, 1); assert.strictEqual(rc.steps[0].rule, 'clean');
  assert.deepStrictEqual(rc.steps[0].ranges, [[Q.verseStart[vi(67, 1)], Q.verseStart[vi(67, 3)] - 1]]);
  for (const s of rc.steps.slice(1)) assert.strictEqual(s.need, s.kind === 'piece' ? 3 : 2, s.kind);
  assert(rc.steps.filter(s => s.kind === 'piece').every(s => s.show === 2));
  // a long verse: its pieces, then up to four of them together, then the verse whole (more than one group)
  const ay = P.drill(Q, [vi(2, 282)], { method: 'twenty', n: 10, lineEnd: LE });
  const parts = ay.pieces.length;
  assert.strictEqual(ay.steps.filter(s => s.kind === 'piece').length, parts);
  assert(ay.steps.filter(s => s.kind === 'group').every(s => s.words <= P.GROUP_WORDS));
  assert.strictEqual(ay.steps[ay.steps.length - 1].kind, 'whole');
  assert.deepStrictEqual(ay.steps[ay.steps.length - 1].ranges, [[Q.verseStart[vi(2, 282)], Q.verseStart[vi(2, 283)] - 1]]);
  assert(ay.pieces.every(x => x.v === vi(2, 282) && x.parts === parts));
  // four long verses are never one group (2:282 alone is longer than 40 words, 2:283 too)
  const two = P.drill(Q, [vi(2, 282), vi(2, 283)], { method: 'twenty', lineEnd: LE });
  assert(two.steps.filter(s => s.kind === 'group').every(s => s.words <= P.GROUP_WORDS));
  // two runs (verses not one after the other): learnt one after the other, each with its whole
  const runs2 = P.drill(Q, [vi(112, 1), vi(112, 2), vi(112, 3), vi(112, 4), vi(114, 1), vi(114, 2), vi(114, 3), vi(114, 4), vi(114, 5), vi(114, 6)], { method: 'twenty' });
  assert(runs2.steps.every(s => s.ranges.length === 1));
  const firstOf114 = runs2.steps.findIndex(s => s.ranges[0][0] >= Q.verseStart[vi(114, 1)]);
  assert(runs2.steps.slice(0, firstOf114).every(s => s.ranges[0][1] < Q.verseStart[vi(113, 1)]), 'al-Ikhlas first, then an-Nas');
  // the minutes: about the words said
  const m = P.drillMinutes(tw.steps, 1.2);
  const w = tw.steps.reduce((s, x) => s + x.words * x.need, 0);
  assert.strictEqual(m, Math.round(w * 1.2 / 60));
});

ok('a step as a text: a copy for every time, each a verse of its own; the times passed; the sounds for the phone', () => {
  const a = Q.verseStart[vi(112, 1)], z = Q.verseStart[vi(112, 3)] - 1;
  const q = P.drillText(Q, [[a, z], [Q.verseStart[vi(112, 4)], Q.verseStart[vi(112, 5)] - 1]], 3);
  assert.strictEqual(q.len, (z - a + 1) + 5); assert.strictEqual(q.words.length, q.len * 3);
  for (let r = 0; r < 3; r++) {
    assert.strictEqual(q.verseStart[r], r * q.len); assert(q.verseAyah[r] !== 1);
    for (let k = 0; k < q.len; k++) { const w = q.words[q.verseStart[r] + k]; assert.strictEqual(w.t, Q.words[q.gs[k]].t); assert.strictEqual(w.v, r); assert.strictEqual(w.k, k); }
  }
  const heard = g => g % q.len !== 0;                                   // the first word of every time not heard
  assert.deepStrictEqual(P.drillPassed(q, q.len * 2, 0, heard).map(x => [x.r, x.heard]), [[0, q.len - 1], [1, q.len - 1]]);
  assert.deepStrictEqual(P.drillPassed(q, q.len * 2 - 1, 1, heard), []);
  assert(P.drillCounts({ heard: 5, len: 10 }) && !P.drillCounts({ heard: 4, len: 9 }));
  const us = g => Uint8Array.from([g % 7 + 1, g % 5 + 1]);
  const du = P.drillUnits(q, us);
  assert.strictEqual(du.count.length, q.words.length);
  let o = 0;
  for (let i = 0; i < q.words.length; i++) { const u = us(q.gs[i % q.len]); assert.deepStrictEqual(Array.from(du.units.subarray(o, o + du.count[i])), Array.from(u)); o += du.count[i]; }
});

console.log(`${n} hifz plan tests passed`);
