// Starting a recitation with the isti'adha and/or the basmala, on a phone: each said after a pause, so each may come in a
// recogniser session of its own, and the first word of a session is often lost (the recogniser restarts at a pause).
// Run: node tests/starts.test.js QURAN_JSON SIMPLE_CLEAN_JSON [-v]
// Checked: the isti'adha and basmala are recognised as such (no place is found or turned to because of them), the first
// place found is the one recited, and it is found within the first verses.
const A = require('./android.test.js');
const { Q, QC, gOf, refOfG, verseWords } = A;
const VERBOSE = process.argv.includes('-v');

let seed = 1;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const letters = 'بتثجحخدذرزسشصضطظعغفقكلمنهوي';
function garble(w) { const p = 1 + Math.floor(rnd() * (w.length - 1)); return w.slice(0, p) + letters[Math.floor(rnd() * letters.length)] + w.slice(p + 1); }
const ISTI = ['أعوذ بالله من الشيطان الرجيم', 'اعوذ بالله من الشيطان الرجيم', 'أعوذ بالله السميع العليم من الشيطان الرجيم', 'اعوذ بالله من الشيطان الرجيم'];
const BASM = ['بسم الله الرحمن الرحيم', 'بسم الله الرحمن الرحيم', 'بسم الله الرحمان الرحيم'];

/** parts: 'isti' | 'basm' | 'both' (in one breath) | [s, a1, a2]; view: [s, a] the place in view when the mic is tapped */
function play(view, parts, target, sd, opts) {
  seed = sd;
  const o = Object.assign({ clip: 0.8, end: 0.9, garble: 0.03 }, opts || {});
  const t = new QC.Tracker(Q, { strictness: 0 });
  if (A.T0) { t.index = A.T0.index; t.uindex = A.T0.uindex; }
  t.reset(gOf(view[0], view[1]), { search: !o.track });
  const ev = [];
  let said = 0;                                  // words of the surah said so far
  t.on('found', e => ev.push({ k: e.here ? 'here' : 'found', g: e.to, at: said }));
  t.on('jump', e => ev.push({ k: 'jump', g: e.to, at: said }));
  t.on('phrase', e => ev.push({ k: 'phrase ' + e.name, at: said }));
  const utter = [];
  for (const p of parts) {
    if (p === 'isti') utter.push({ w: ISTI[Math.floor(rnd() * ISTI.length)].split(' '), text: false });
    else if (p === 'basm') utter.push({ w: BASM[Math.floor(rnd() * BASM.length)].split(' '), text: false });
    else if (p === 'both') utter.push({ w: (ISTI[0] + ' ' + BASM[0]).split(' '), text: false });
    else for (let a = p[1]; a <= p[2]; a++) utter.push({ w: verseWords(p[0], a), text: true });
  }
  let finals = [], listening = true;
  const flashes = [];
  t.newSession();
  let prevText = false;
  for (const u of utter) {
    let w = u.w;
    if (!u.text && prevText) said = 0;           // a new start: words counted from here
    prevText = u.text;
    if (!listening && rnd() < o.clip) w = w.slice(1);
    listening = true;
    const fin = w.map(x => (x.length > 3 && rnd() < o.garble ? garble(x) : x));
    const base = said;
    for (let k = 1; k <= fin.length; k++) {
      if (u.text) said = base + k;
      t.feed(finals, fin.slice(0, k).join(' '));
      // while the isti'adha or basmala is said, no word of the text may light up (nor a page turn to it)
      if (!u.text && t.tentative.size) flashes.push(fin.slice(0, k).join(' ') + ' -> ' + [...t.tentative.keys()].map(refOfG).join(','));
    }
    finals = finals.concat([fin.join(' ')]);
    t.feed(finals, '');
    if (u.text) said = base + fin.length;
    if (rnd() < o.end) { t.newSession(); finals = []; listening = false; }
  }
  // the first place found or jumped to must be the target; nothing found before the surah's words
  const places = ev.filter(e => e.k === 'found' || e.k === 'here' || e.k === 'jump');
  const tEnd = Q.verseStart[Q.words[gOf(target[0], target[2])].v + 1] - 1;
  const inT = (tg, g) => g >= gOf(tg[0], tg[1]) && g <= Q.verseStart[Q.words[gOf(tg[0], tg[2])].v + 1] - 1 + 10;
  const inTarget = g => inT(target, g) || (o.then && inT(o.then, g));
  let ok = true, why = '';
  if (!places.length) {
    // starting in the place in view: nothing to find, the tracker follows from there
    if (!(t.mode === 'track' && inTarget(t.lastHeard))) { ok = false; why = 'not found'; }
  } else {
    const f = places[0];
    if (!inTarget(f.g)) { ok = false; why = 'first place ' + refOfG(f.g); }
    else if (f.at === 0) { ok = false; why = 'found before the surah was recited'; }
    else if (f.at > (o.maxWords || 14)) { ok = false; why = 'found only after ' + f.at + ' words'; }
    if (places.slice(1).some(e => !inTarget(e.g))) { ok = false; why += ' then ' + places.slice(1).map(e => e.k + ' ' + refOfG(e.g)).join(', '); }
  }
  if (t.mode !== 'track' || !inTarget(t.lastHeard)) { ok = false; why += ' ends ' + t.mode + ' ' + (t.lastHeard >= 0 ? refOfG(t.lastHeard) : '-'); }
  const phrases = ev.filter(e => e.k.startsWith('phrase')).map(e => e.k.slice(7));
  if (flashes.length) { ok = false; why += ' text lit up during isti\'adha/basmala: ' + flashes.slice(0, 3).join(' | '); }
  return { ok, why, ev: ev.map(e => e.k + (e.g != null ? ' ' + refOfG(e.g) : '') + '@' + e.at).join(', '), phrases };
}

const CASES = [
  // [name, view, parts, target]
  ['isti + basmala + al-Mulk, al-Mulk in view', [67, 1], ['isti', 'basm', [67, 1, 6]], [67, 1, 6]],
  ['isti + basmala + al-Mulk, al-Baqara in view', [2, 50], ['isti', 'basm', [67, 1, 6]], [67, 1, 6]],
  ['isti + basmala in one breath + Ya-Sin', [1, 1], ['both', [36, 1, 8]], [36, 1, 8]],
  ['basmala + ar-Rahman', [18, 1], ['basm', [55, 1, 8]], [55, 1, 8]],
  ['isti + basmala + al-Waqia', [56, 1], ['isti', 'basm', [56, 1, 8]], [56, 1, 8]],
  ['isti + basmala + al-Kahf', [36, 1], ['isti', 'basm', [18, 1, 5]], [18, 1, 5]],
  ['isti + basmala + al-Fatiha', [2, 1], ['isti', 'basm', [1, 2, 7]], [1, 1, 7]],
  ['isti + basmala + al-Baqara', [1, 1], ['isti', 'basm', [2, 1, 5]], [2, 1, 5]],
  ['isti + basmala + Al Imran (alif-lam-mim too)', [2, 1], ['isti', 'basm', [3, 1, 5]], [3, 1, 5]],
  ['isti only + at-Tawba', [8, 70], ['isti', [9, 1, 4]], [9, 1, 4]],
  ['isti + basmala + an-Naba', [78, 1], ['isti', 'basm', [78, 1, 10]], [78, 1, 10]],
  ['isti + basmala + al-Ikhlas', [112, 1], ['isti', 'basm', [112, 1, 4]], [112, 1, 4]],
  ['isti + basmala + al-Falaq, an-Nas in view', [114, 1], ['isti', 'basm', [113, 1, 5]], [113, 1, 5]],
  ['isti + basmala + ad-Duha', [93, 1], ['isti', 'basm', [93, 1, 11]], [93, 1, 11]],
  ['isti + basmala + al-Alaq', [96, 1], ['isti', 'basm', [96, 1, 8]], [96, 1, 8]],
  ['isti + basmala + al-Insan', [76, 1], ['isti', 'basm', [76, 1, 6]], [76, 1, 6]],
  ['isti + Ayat al-Kursi (no basmala)', [2, 250], ['isti', [2, 255, 256]], [2, 255, 256]],
  ['isti + basmala + Ayat al-Kursi', [2, 250], ['isti', 'basm', [2, 255, 256]], [2, 255, 256]],
  ['isti + the middle of al-Mulk in view', [67, 13], ['isti', [67, 13, 18]], [67, 13, 18]],
  ['isti + basmala + the end of al-Baqara', [2, 284], ['isti', 'basm', [2, 285, 286]], [2, 285, 286]],
  ['isti + basmala + Luqman 12 (in view)', [31, 12], ['isti', 'basm', [31, 12, 16]], [31, 12, 16]],
  ['isti + basmala + al-Hashr end (in view)', [59, 18], ['isti', 'basm', [59, 18, 24]], [59, 18, 24]],
  // started at a verse (verse sheet: "recite from here"), not searching
  ['at al-Mulk 13: isti + basmala, then on from there', [67, 13], ['isti', 'basm', [67, 13, 18]], [67, 13, 18], { track: true }],
  ['at the start of al-Mulk: isti + basmala + al-Mulk', [67, 1], ['isti', 'basm', [67, 1, 6]], [67, 1, 6], { track: true }],
  ['at the start of al-Mulk: isti + basmala + Ya-Sin instead', [67, 1], ['isti', 'basm', [36, 1, 8]], [36, 1, 8], { track: true }],
  ['at an-Naba 31: isti, then on from there', [78, 31], ['isti', [78, 31, 40]], [78, 31, 40], { track: true }],
  ['reading al-Mulk 25-30, then isti + basmala + al-Qalam', [67, 25], [[67, 25, 30], 'isti', 'basm', [68, 1, 6]], [67, 25, 30], { track: true, then: [68, 1, 6] }],
  ['reading al-Mulk 25-30, then isti + basmala + Ya-Sin', [67, 25], [[67, 25, 30], 'isti', 'basm', [36, 1, 6]], [67, 25, 30], { track: true, then: [36, 1, 6] }],
  // a poorer recogniser
  ['noisy: isti + basmala + al-Mulk, al-Baqara in view', [2, 50], ['isti', 'basm', [67, 1, 8]], [67, 1, 8], { garble: 0.1 }],
  ['noisy: isti + basmala + al-Waqia', [36, 1], ['isti', 'basm', [56, 1, 10]], [56, 1, 10], { garble: 0.1 }],
  ['noisy: isti + Ayat al-Kursi', [1, 1], ['isti', [2, 255, 256]], [2, 255, 256], { garble: 0.1 }],
  ['every session start lost: isti + basmala + al-Mulk', [2, 50], ['isti', 'basm', [67, 1, 8]], [67, 1, 8], { clip: 1, end: 1 }],
  ['every session start lost: isti + basmala + al-Ikhlas', [112, 1], ['isti', 'basm', [112, 1, 4]], [112, 1, 4], { clip: 1, end: 1 }],
];
if (require.main === module) {
  A.T0 = new QC.Tracker(Q); A.T0.buildIndex();
  const SEEDS = [1, 2, 3, 4, 5, 6];
  let F = 0, total = 0, noPhrase = 0;
  for (const [name, view, parts, target, opts] of CASES) {
    let bad = 0;
    for (const sd of SEEDS) {
      const r = play(view, parts, target, sd, opts);
      total++;
      const want = parts.filter(p => typeof p === 'string').length;
      if (r.phrases.length < Math.min(1, want)) noPhrase++;
      if (!r.ok) bad++;
      if (!r.ok || VERBOSE) console.log(`    ${r.ok ? 'ok  ' : 'FAIL'} seed ${sd}: ${r.why} [${r.ev}]`);
    }
    F += bad;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${name} (${SEEDS.length - bad}/${SEEDS.length})`);
  }
  console.log(`${F ? F + ' of ' + total + ' starts failed' : 'all starts ok'}; isti'adha/basmala not recognised in ${noPhrase} of ${total}`);
  // while the isti'adha or basmala is being said (interim text), nothing of the text in view lights up: before al-Falaq
  // (قل أعوذ), an-Nur 24:35 (الله نور), al-Hadid, the basmala of an-Naml ...
  const t = new QC.Tracker(Q); t.index = A.T0.index; t.uindex = A.T0.uindex;
  let lit = 0, states = 0;
  const PH = ['أعوذ بالله من الشيطان الرجيم', 'بسم الله الرحمن الرحيم', 'اعوذ بالله السميع العليم من الشيطان الرجيم'];
  for (const strict of [false, true]) {
    for (const [s, a] of [[67, 19], [67, 28], [2, 255], [59, 22], [1, 1], [55, 1], [27, 29], [16, 97], [36, 50], [3, 1], [112, 1], [113, 1], [114, 1], [96, 1], [24, 35], [57, 1]]) {
      for (const ph of PH) {
        const g = gOf(s, a);
        t.reset(g, strict ? { strict: true, bounds: [g, g + 60] } : {}); t.newSession();
        const w = ph.split(' ');
        for (let k = 1; k <= w.length; k++) {
          t.feed([], w.slice(0, k).join(' ')); states++;
          if (t.tentative.size) { lit++; if (VERBOSE) console.log(`    lit ${s}:${a} [${w.slice(0, k).join(' ')}] -> ${[...t.tentative.keys()].map(refOfG).join(' ')}`); }
        }
      }
    }
  }
  console.log(`${lit ? 'FAIL' : 'ok  '} text lit up while the isti'adha or basmala was said: ${lit} of ${states} interim states`);
  if (lit) F++;
  if (F) process.exitCode = 1;
}
module.exports = { play, CASES };
