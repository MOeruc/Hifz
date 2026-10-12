// Realistic recitation sessions: isti'adha and basmala, recogniser noise, verse-wise results, surah changes.
// Run: node tests/sessions.test.js QURAN_JSON SIMPLE_CLEAN_JSON [-v]
// For every session we watch which surah the tracker follows after each recogniser result and check
// that it reaches the recited surah quickly and never shows a third surah in between.
const fs = require('fs');
const QC = require('../core.js');
const quran = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const simple = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const VERBOSE = process.argv.includes('-v');
const Q = QC.buildWords(quran);
const BASM = 'بسم الله الرحمن الرحيم'.split(' ');
const ISTI = 'أعوذ بالله من الشيطان الرجيم'.split(' ');
const SPOKEN = { 'الم': 'ألف لام ميم', 'الر': 'ألف لام را', 'المر': 'ألف لام ميم را', 'المص': 'ألف لام ميم صاد', 'يس': 'ياسين', 'طه': 'طه', 'طسم': 'طا سين ميم', 'طس': 'طا سين', 'حم': 'حا ميم', 'عسق': 'عين سين قاف', 'ص': 'صاد', 'ق': 'قاف', 'ن': 'نون', 'كهيعص': 'كاف ها يا عين صاد' };

const surahStart = s => quran.surahs[s - 1].start;
const vIndex = (s, a) => surahStart(s) + a - 1;
const gOf = (s, a) => Q.verseStart[vIndex(s, a)];
const surahOfG = g => Q.verseSurah[Q.words[Math.min(g, Q.words.length - 1)].v];
const refOfG = g => { const v = Q.words[Math.min(g, Q.words.length - 1)].v; return Q.verseSurah[v] + ':' + Q.verseAyah[v]; };
function verseWords(s, a) {
  let w = simple[String(s)][a - 1].text.split(' ');
  if (a === 1 && s !== 1 && s !== 9) w = w.slice(4);
  return w.map(x => (a === 1 && SPOKEN[x]) ? SPOKEN[x] : x).join(' ').split(' ');
}

let seed = 1;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const letters = 'بتثجحخدذرزسشصضطظعغفقكلمنهوي';
function noisy(words, nz) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const r = rnd(), w = words[i];
    if (r < nz.drop) continue;
    if (r < nz.drop + nz.garble && w.length > 2) { const p = 1 + Math.floor(rnd() * (w.length - 1)); out.push(w.slice(0, p) + letters[Math.floor(rnd() * letters.length)] + w.slice(p + 1)); continue; }
    if (r < nz.drop + nz.garble + nz.merge && i + 1 < words.length) { out.push(w + words[i + 1]); i++; continue; }
    out.push(w);
  }
  return out;
}

/** session parts: 'isti' | 'basm' | 'pause' | [s, a1, a2]. Returns recogniser chunks grouped in sessions. */
function script(parts, nz) {
  const sessions = [[]];
  const chunk = words => { if (words.length) sessions[sessions.length - 1].push(words.join(' ')); };
  for (const p of parts) {
    if (p === 'pause') { sessions.push([]); continue; }
    if (p === 'isti') { chunk(noisy(ISTI, nz)); continue; }
    if (p === 'basm') { chunk(noisy(BASM, nz)); continue; }
    if (p === 'end') { chunk(noisy('صدق الله العظيم'.split(' '), nz)); continue; }
    const [s, a1, a2] = p;
    for (let a = a1; a <= a2; a++) {
      const w = noisy(verseWords(s, a), nz);
      // long verses come in several results
      for (let i = 0; i < w.length;) { const n = w.length - i <= 9 ? w.length - i : 4 + Math.floor(rnd() * 5); chunk(w.slice(i, i + n)); i += n; }
      // the recogniser restarts every now and then
      if (sessions[sessions.length - 1].length > 4 + Math.floor(rnd() * 4)) sessions.push([]);
    }
  }
  return sessions.filter(x => x.length);
}

/** which surah the app would show: the surah of the last word heard (as the reader follows it) */
function shownSurah(t, fallback) {
  let last = t.lastHeard;
  if (last == null) { last = -1; for (const [, b] of t.ranges) if (b > last) last = b; }
  return last >= 0 ? surahOfG(last) : fallback;
}

function play(name, view, parts, expect, nz, seeds) {
  let fails = 0;
  for (const sd of seeds) {
    seed = sd;
    const sessions = script(parts, nz);
    const t = new QC.Tracker(Q);
    const ev = [];
    t.on('jump', e => ev.push('jump ' + refOfG(e.to)));
    t.on('found', e => ev.push((e.here ? 'here ' : 'found ') + (e.to >= 0 ? refOfG(e.to) : '?')));
    t.reset(gOf(view[0], view[1]), { search: true });
    const shown = [view[0]];
    let words = 0, firstRight = -1;
    for (const ses of sessions) {
      t.newSession();
      const finals = [];
      for (const c of ses) {
        t.feed(finals, c); finals.push(c); t.feed(finals, '');
        words += c.split(' ').length;
        const s = shownSurah(t, view[0]);
        if (s !== shown[shown.length - 1]) shown.push(s);
        if (firstRight < 0 && s === expect.surahs[0] && t.mode === 'track') firstRight = words;
      }
    }
    // the shown surahs must be exactly the expected sequence (the view first, unless it already is the first)
    const want = expect.surahs[0] === view[0] ? expect.surahs : [view[0]].concat(expect.surahs);
    const okSeq = JSON.stringify(shown) === JSON.stringify(want);
    let ok = okSeq;
    let okWords = 0, total = 0;
    for (const [s, a1, a2] of expect.check || []) {
      for (let g = gOf(s, a1); g < Q.verseStart[vIndex(s, a2) + 1]; g++) { total++; if (t.status[g] === QC.ST.OK || t.status[g] === QC.ST.CORRECTED) okWords++; }
    }
    if (total && okWords / total < (expect.minOk || 0.75)) ok = false;
    if (expect.final && refOfG(t.lastHeard) !== expect.final) ok = false;
    if (expect.maxEvents != null && ev.length > expect.maxEvents) ok = false;
    if (!ok) fails++;
    if (!ok || VERBOSE) console.log(`  ${ok ? 'ok  ' : 'FAIL'} seed ${sd}: shown ${shown.join(' > ')} (want ${want.join(' > ')}), right after ${firstRight} words, ok ${okWords}/${total}, last ${t.lastHeard >= 0 ? refOfG(t.lastHeard) : '-'}, events ${ev.join(', ')}`);
  }
  console.log(`${fails ? 'FAIL' : 'ok  '} ${name}  (${seeds.length - fails}/${seeds.length})`);
  return fails;
}

module.exports = { script, play, Q, QC, gOf, refOfG, surahOfG, shownSurah, setSeed: x => { seed = x; } };
if (require.main === module) {
const NZ = { drop: 0.03, garble: 0.04, merge: 0.03 };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
let F = 0;
F += play('Fatiha in view, isti + basmala + Ya-Sin', [1, 1], ['isti', 'basm', [36, 1, 12]], { surahs: [36], check: [[36, 2, 12]] }, NZ, SEEDS);
F += play('Fatiha in view, basmala + al-Kahf (starts like al-Fatiha)', [1, 1], ['basm', [18, 1, 10]], { surahs: [18], check: [[18, 2, 10]] }, NZ, SEEDS);
F += play('Fatiha in view, basmala + al-Fatiha', [1, 1], ['isti', 'basm', [1, 2, 7]], { surahs: [1], check: [[1, 1, 7]] }, NZ, SEEDS);
F += play('Baqara 2:50 in view, basmala + al-Mulk', [2, 50], ['basm', [67, 1, 10]], { surahs: [67], check: [[67, 2, 10]] }, NZ, SEEDS);
F += play('al-Mulk to the end, basmala, al-Qalam', [67, 1], ['basm', [67, 1, 30], 'basm', [68, 1, 8]], { surahs: [67, 68], check: [[67, 2, 30], [68, 2, 8]] }, NZ, SEEDS);
F += play('Juz Amma backwards: an-Nas, al-Falaq, al-Ikhlas', [112, 1], ['basm', [114, 1, 6], 'basm', [113, 1, 5], 'basm', [112, 1, 4]], { surahs: [114, 113, 112], check: [[114, 2, 6], [113, 2, 5], [112, 2, 4]] }, NZ, SEEDS);
F += play('al-Kahf, then basmala and Ayat al-Kursi', [18, 1], ['basm', [18, 1, 8], 'pause', 'basm', [2, 255, 257]], { surahs: [18, 2], check: [[18, 2, 8], [2, 256, 257]] }, NZ, SEEDS);
F += play('al-Mulk, pause, basmala, same place', [67, 10], [[67, 10, 15], 'pause', 'basm', [67, 16, 22]], { surahs: [67], check: [[67, 11, 22]] }, NZ, SEEDS);
F += play('at-Tawba without basmala', [1, 1], ['isti', [9, 1, 6]], { surahs: [9], check: [[9, 2, 6]] }, NZ, SEEDS);
F += play('at-Tawba with basmala', [1, 1], ['basm', [9, 1, 6]], { surahs: [9], check: [[9, 2, 6]] }, NZ, SEEDS);
F += play('start in the middle without basmala (2:255)', [1, 1], ['isti', [2, 255, 257]], { surahs: [2], check: [[2, 256, 257]] }, NZ, SEEDS);
F += play('Baqara 2:1 in view, basmala + Al Imran (both open with alif-lam-mim)', [2, 1], ['basm', [3, 1, 6]], { surahs: [3], check: [[3, 2, 6]] }, NZ, SEEDS);
F += play('ar-Rahman with basmala', [55, 1], ['basm', [55, 1, 40]], { surahs: [55], check: [[55, 1, 40]] }, NZ, SEEDS);
F += play('al-Hadid (opens like al-Hashr and as-Saff)', [1, 1], ['basm', [57, 1, 6]], { surahs: [57], check: [[57, 2, 6]] }, NZ, SEEDS);
F += play('reading Baqara, then basmala + Al Imran', [2, 20], [[2, 20, 25], 'basm', [3, 1, 6]], { surahs: [2, 3], check: [[2, 21, 25], [3, 2, 6]] }, NZ, SEEDS);
F += play('reading Ya-Sin, then basmala + as-Saffat (next surah)', [36, 75], [[36, 75, 83], 'basm', [37, 1, 10]], { surahs: [36, 37], check: [[36, 76, 83], [37, 1, 10]] }, NZ, SEEDS);
F += play('Juz Amma in order with basmalas: ad-Duha, ash-Sharh, at-Tin', [93, 1], ['basm', [93, 1, 11], 'basm', [94, 1, 8], 'basm', [95, 1, 8]], { surahs: [93, 94, 95], check: [[93, 2, 11], [94, 2, 8], [95, 2, 8]], maxEvents: 1 }, NZ, SEEDS);
F += play('al-Ikhlas twice (starts the same surah again)', [112, 1], ['basm', [112, 1, 4], 'basm', [112, 1, 4]], { surahs: [112], check: [[112, 1, 4]], final: '112:4' }, NZ, SEEDS);
F += play('closing words, then another surah', [67, 25], [[67, 25, 30], 'end', 'basm', [36, 1, 6]], { surahs: [67, 36], check: [[67, 26, 30], [36, 2, 6]] }, NZ, SEEDS);
F += play('ar-Rahman refrain first, from another surah', [18, 1], ['basm', [55, 13, 20]], { surahs: [55], check: [[55, 16, 20]] }, NZ, SEEDS);
F += play('pause and go on a few verses later (no basmala)', [18, 1], ['basm', [18, 1, 6], 'pause', [18, 9, 14]], { surahs: [18], check: [[18, 10, 14]], final: '18:14' }, NZ, SEEDS);
console.log(F ? F + ' session(s) failed' : 'all sessions ok');
if (F) process.exitCode = 1;
}
