// Benchmark: how reliably and how fast the tracker lands on the surah being recited.
// node tests/bench_find.js QURAN_JSON SIMPLE_CLEAN_JSON [CORE_JS]
// Three situations, each for every surah (or many random places):
//   open   - app opened on another surah, the reciter says isti'adha + basmala and begins surah S
//   switch - reading surah A, then basmala and surah S from its beginning
//   middle - app on another surah, the reciter begins in the middle of S without basmala
const path = require('path');
if (process.argv[4] && process.argv[4].endsWith('.js')) require.cache[require.resolve('../core.js')] = { exports: require(path.resolve(process.argv[4])) };
const H = require('./sessions.test.js');
const { script, Q, QC, gOf, surahOfG, shownSurah, setSeed } = H;
const quran = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const ayahs = s => quran.surahs[s - 1].ayahs;
let rs = 99;
const rnd = () => (rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648;

function versesFor(s, a1, minWords) {
  let a2 = a1, n = 0;
  while (a2 <= ayahs(s)) { n += Q.verseStart[quran.surahs[s - 1].start + a2] - Q.verseStart[quran.surahs[s - 1].start + a2 - 1]; if (n >= minWords) break; a2++; }
  return Math.min(a2, ayahs(s));
}
function runOne(view, parts, target, nz, seedNo) {
  setSeed(seedNo);
  const sessions = script(parts, nz);
  const t = new QC.Tracker(Q);
  t.reset(gOf(view[0], view[1]), { search: true });
  const shown = [view[0]];
  let words = 0, reached = -1, countFrom = -1;
  for (const ses of sessions) {
    t.newSession();
    const finals = [];
    for (const c of ses) {
      t.feed(finals, c); finals.push(c); t.feed(finals, '');
      words += c.split(' ').length;
      const s = shownSurah(t, view[0]);
      if (s !== shown[shown.length - 1]) shown.push(s);
      if (reached < 0 && s === target && t.mode === 'track') reached = words;
    }
  }
  return { shown, reached, words };
}
function bench(name, cases, nz) {
  let right = 0, wrongShown = 0, never = 0;
  const lat = [];
  for (const c of cases) {
    const r = runOne(c.view, c.parts, c.target, nz, c.seed);
    const allowed = new Set([c.view[0], c.from || c.view[0], c.target]);
    const extra = r.shown.filter(s => !allowed.has(s));
    if (extra.length) wrongShown++;
    if (r.shown[r.shown.length - 1] === c.target) right++; else never++;
    if (r.reached >= 0) lat.push(r.reached - (c.lead || 0));
    if ((extra.length || r.shown[r.shown.length - 1] !== c.target) && process.argv.includes('-v')) console.log('   ', name, JSON.stringify(c.parts), 'shown', r.shown.join('>'));
  }
  lat.sort((a, b) => a - b);
  const q = p => lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : '-';
  console.log(`${name.padEnd(8)} ${cases.length} runs: correct ${right}, ended wrong ${never}, showed a wrong surah on the way ${wrongShown}; words until there: median ${q(0.5)}, 90% ${q(0.9)}`);
}

const NZ = { drop: 0.03, garble: 0.04, merge: 0.03 };
const HARD = { drop: 0.06, garble: 0.08, merge: 0.04 };
for (const [label, nz] of [['normal', NZ], ['noisy', HARD]]) {
  console.log('-- recogniser noise:', label);
  const open = [], sw = [], mid = [];
  for (let s = 1; s <= 114; s++) {
    const view = s === 1 ? [2, 1] : [1, 1];
    const a2 = versesFor(s, s === 1 ? 2 : 1, 25);
    open.push({ view, parts: ['isti', 'basm', [s, s === 1 ? 2 : 1, a2]], target: s, seed: s * 7 + 1, lead: 9 });
    const A = 1 + Math.floor(rnd() * 114) === s ? (s % 114) + 1 : 1 + Math.floor(rnd() * 114);
    const aA = Math.max(1, Math.min(ayahs(A), 1 + Math.floor(rnd() * ayahs(A))));
    const bA = versesFor(A, aA, 12);
    const leadA = Q.verseStart[quran.surahs[A - 1].start + bA] - Q.verseStart[quran.surahs[A - 1].start + aA - 1] + 4;
    if (A !== s) sw.push({ view: [A, aA], from: A, parts: [[A, aA, bA], 'basm', [s, s === 1 ? 2 : 1, a2]], target: s, seed: s * 13 + 5, lead: leadA });
    if (ayahs(s) >= 6) {
      const am = 2 + Math.floor(rnd() * (ayahs(s) - 2));
      mid.push({ view: [s === 2 ? 3 : 2, 1], parts: [[s, am, versesFor(s, am, 30)]], target: s, seed: s * 17 + 3 });
    }
  }
  bench('open', open, nz);
  bench('switch', sw, nz);
  bench('middle', mid, nz);
}
