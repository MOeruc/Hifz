// Isti'adha and basmala before a memorisation test are never mistakes: in many spoken and recognised forms,
// cut apart by the recogniser in every way, at surah openings and in the middle of a surah.
// Run: node tests/neutral.test.js QURAN_JSON SIMPLE_CLEAN_JSON [-v]
const fs = require('fs');
const QC = require('../core.js');
const quran = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const simple = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const VERBOSE = process.argv.includes('-v');
const Q = QC.buildWords(quran);
const ST = QC.ST;
const vIndex = (s, a) => quran.surahs[s - 1].start + a - 1;
const gOf = (s, a) => Q.verseStart[vIndex(s, a)];
const refOf = g => { const v = Q.words[Math.min(g, Q.words.length - 1)].v; return Q.verseSurah[v] + ':' + Q.verseAyah[v]; };
function words(s, a) { let w = simple[String(s)][a - 1].text.split(' '); if (a === 1 && s !== 1 && s !== 9) w = w.slice(4); return w; }

const ISTI = {
  std: 'أعوذ بالله من الشيطان الرجيم',
  nohamza: 'اعوذ بالله من الشيطان الرجيم',
  long: 'أعوذ بالله السميع العليم من الشيطان الرجيم',
  long2: 'اعوذ بالله السميع العليم من الشيطان الرجيم من همزه ونفخه ونفثه',
  azim: 'أعوذ بالله العظيم من الشيطان الرجيم',
  lost1: 'بالله من الشيطان الرجيم',
  lostlast: 'اعوذ بالله من الشيطان',
  nomin: 'أعوذ بالله الشيطان الرجيم',
  garble: 'عوذ بالله من الشيطان الرحيم',
  nodef: 'اعوذ بالله من شيطان رجيم',
  astaidh: 'أستعيذ بالله من الشيطان الرجيم',
};
const BASM = {
  std: 'بسم الله الرحمن الرحيم',
  alif: 'باسم الله الرحمن الرحيم',
  rahman: 'بسم الله الرحمان الرحيم',
  lostlast: 'بسم الله الرحمن',
  lostfirst: 'الله الرحمن الرحيم',
  garble: 'بسم الله الرحمن الرحين',
};
// how the recogniser delivers the words
const DELIVERY = {
  phrases: parts => [parts.map(p => p.join(' '))],                 // each phrase and verse one final result
  sessions: parts => parts.map(p => [p.join(' ')]),               // each in its own session (pauses on Android)
  interim: parts => [{ interim: [].concat(...parts) }],           // one long interim result (Safari)
  cut3: parts => { const all = [].concat(...parts), out = []; for (let i = 0; i < all.length; i += 3) out.push(all.slice(i, i + 3).join(' ')); return [out]; },
  cut2: parts => { const all = [].concat(...parts), out = []; for (let i = 0; i < all.length; i += 2) out.push(all.slice(i, i + 2).join(' ')); return [out]; },
  sess3: parts => { const all = [].concat(...parts), out = []; for (let i = 0; i < all.length; i += 3) out.push([all.slice(i, i + 3).join(' ')]); return out; },
};
function play(t, sessions) {
  for (const s of sessions) {
    t.newSession();
    if (s.interim) {
      const ws = s.interim;
      for (let k = 1; k <= ws.length; k++) t.feed([], ws.slice(0, k).join(' '));
      t.feed([ws.join(' ')], '');
      continue;
    }
    const finals = [];
    for (const part of s) { t.feed(finals, part); finals.push(part); t.feed(finals, ''); }
  }
}
const BASE = new QC.Tracker(Q); BASE.buildIndex();
function fresh() { const t = new QC.Tracker(Q); t.index = BASE.index; t.uindex = BASE.uindex; t._exp = BASE._exp; return t; }
function run(s, a1, a2, prefix, delivery, strict) {
  const t = fresh();
  const ev = { attempt: [], hint: [], say: [] };
  t.on('attempt', e => ev.attempt.push(e));
  t.on('hint', e => ev.hint.push(e));
  t.on('say', e => { if (e.type !== 'where') ev.say.push(e); });     // (where the reciter was, after a pause: no mistake)
  const g0 = gOf(s, a1), g1 = Q.verseStart[vIndex(s, a2) + 1] - 1;
  t.reset(g0, { bounds: [g0, g1], strict });
  const parts = prefix.map(p => p.split(' '));
  for (let a = a1; a <= a2; a++) parts.push(words(s, a));
  play(t, DELIVERY[delivery](parts));
  const bad = [];
  for (let g = g0; g <= g1; g++) if (t.status[g] !== ST.OK) bad.push(refOf(g) + '#' + (g - Q.verseStart[Q.words[g].v]) + '=' + t.status[g]);
  return { ok: !ev.attempt.length && !ev.say.length && !bad.length && t.pointer > g1, ev, bad, ptr: t.pointer, g1 };
}

const PLACES = [[67, 1, 3], [36, 1, 4], [2, 1, 3], [113, 1, 3], [114, 1, 3], [112, 1, 4], [1, 1, 4], [9, 1, 2], [18, 1, 2], [55, 1, 5], [2, 142, 143], [18, 60, 61], [16, 98, 99], [27, 30, 31], [3, 36, 36], [81, 24, 26]];
const PREFIXES = [['none', []]];
for (const k in ISTI) PREFIXES.push(['isti:' + k, [ISTI[k]]]);
for (const k in BASM) PREFIXES.push(['basm:' + k, [BASM[k]]]);
for (const k of ['std', 'nohamza', 'long', 'lostlast', 'nomin']) for (const b of ['std', 'lostlast', 'alif']) PREFIXES.push([`isti:${k}+basm:${b}`, [ISTI[k], BASM[b]]]);
// al-Fatiha: the basmala is its first verse, so a basmala misheard or cut short there is (rightly) a mistake
const EXPECTED = (s, pname) => s === 1 && /^basm:(garble|lostfirst)$/.test(pname);

let fails = 0, total = 0;
for (const strict of [true, false]) {
  for (const [s, a1, a2] of PLACES) {
    for (const [pname, prefix] of PREFIXES) {
      for (const d of Object.keys(DELIVERY)) {
        if (EXPECTED(s, pname)) continue;
        total++;
        const r = run(s, a1, a2, prefix, d, strict);
        if (r.ok) continue;
        fails++;
        if (VERBOSE || fails <= 15) console.log(`FAIL ${strict ? 'hidden' : 'shown '} ${s}:${a1}-${a2} ${pname.padEnd(28)} ${d.padEnd(8)} attempts ${r.ev.attempt.map(x => x.kind).join(',') || '-'} said ${r.ev.say.map(x => x.type).join(',') || '-'} pointer ${refOf(r.ptr)}${r.ptr > r.g1 ? ' (end)' : ''} not ok ${r.bad.slice(0, 6).join(' ')}`);
      }
    }
  }
}
console.log(`${total - fails} of ${total} recitations without a false mistake`);
if (fails) process.exitCode = 1; else console.log('neutral phrases ok');
