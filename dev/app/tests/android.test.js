// How the recogniser behaves on a phone (Chrome on Android), and what the tracker makes of it.
// Run: node tests/android.test.js QURAN_JSON SIMPLE_CLEAN_JSON [-v]
//
// The model:
//  - the reciter reads verse by verse and pauses after each verse (long verses: also once in the middle). Android ends
//    the recogniser session at a pause; the app starts a new one, and the reciter often begins before it listens:
//    the first word (or two short ones) of the new session is lost.
//  - within an utterance the interim text grows word by word; it may show a word split in two, or an extra word, that
//    the final result no longer has.
//  - some phones send each result again with everything said before it in the session (cumulative), and the earlier
//    words may be spelled a little differently in the repeat.
//  - with hidden text the reciter does what the app asks: when it stops at a word, he reads again from where it says.
// Checked: no word at the start of a session reported as not heard, no page turned back, no jump, the end reached.
const fs = require('fs');
const path = require('path');
const QC = require('../core.js');
const quran = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const simple = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const VERBOSE = process.argv.includes('-v');
const Q = QC.buildWords(quran);
const mushaf = (() => { try { return JSON.parse(fs.readFileSync(path.join(path.dirname(path.resolve(process.argv[2])), 'mushaf.json'), 'utf8')); } catch (e) { return null; } })();
const SPOKEN = { 'الم': 'ألف لام ميم', 'الر': 'ألف لام را', 'المر': 'ألف لام ميم را', 'المص': 'ألف لام ميم صاد', 'يس': 'ياسين', 'طه': 'طه', 'طسم': 'طا سين ميم', 'طس': 'طا سين', 'حم': 'حا ميم', 'عسق': 'عين سين قاف', 'ص': 'صاد', 'ق': 'قاف', 'ن': 'نون', 'كهيعص': 'كاف ها يا عين صاد' };
const surahStart = s => quran.surahs[s - 1].start;
const vIndex = (s, a) => surahStart(s) + a - 1;
const gOf = (s, a) => Q.verseStart[vIndex(s, a)];
const refOfG = g => { const v = Q.words[Math.max(0, Math.min(g, Q.words.length - 1))].v; return Q.verseSurah[v] + ':' + Q.verseAyah[v]; };
function verseWords(s, a) {
  let w = simple[String(s)][a - 1].text.split(' ');
  if (a === 1 && s !== 1 && s !== 9) w = w.slice(4);
  return w.map(x => (a === 1 && SPOKEN[x]) ? SPOKEN[x] : x).join(' ').split(' ');
}
const pageStarts = mushaf ? mushaf.pages.map(p => p.g) : null;
function pageOf(g) {
  if (!pageStarts) return Math.floor(g / 150);
  let lo = 0, hi = pageStarts.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pageStarts[m] <= g) lo = m; else hi = m - 1; }
  return lo + 1;
}

let seed = 1;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const letters = 'بتثجحخدذرزسشصضطظعغفقكلمنهوي';
function garble(w) { const p = 1 + Math.floor(rnd() * (w.length - 1)); return w.slice(0, p) + letters[Math.floor(rnd() * letters.length)] + w.slice(p + 1); }
function noisy(words, nz) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const r = rnd(), w = words[i];
    if (r < nz.drop) continue;
    if (r < nz.drop + nz.garble && w.length > 2) { out.push(garble(w)); continue; }
    if (r < nz.drop + nz.garble + nz.merge && i + 1 < words.length) { out.push(w + words[i + 1]); i++; continue; }
    out.push(w);
  }
  return out;
}
/** how the interim text shows the words of an utterance before the final result: now and then a word split in two or
    an extra word, which the final result no longer has (decided once per word: the interim text is stable) */
function interimForms(fin, drift) {
  return fin.map(w => {
    if (drift && w.length > 3 && /^[وفب]/.test(w) && rnd() < 0.25) return [w[0], w.slice(1)];
    if (drift && rnd() < 0.04) return [w, 'و'];
    return [w];
  });
}
/** the interim text after k words; chaos: the recogniser keeps changing its mind about earlier words too */
function interimOf(forms, k, chaos) {
  const out = [];
  for (let i = 0; i < k; i++) {
    const f = forms[i];
    if (chaos && f.length > 1 && rnd() < 0.5) out.push(f.join('')); else out.push(...f);
  }
  return out;
}
/** an earlier word spelled a little differently when the phone sends it again */
function respell(w) {
  if (rnd() < 0.5) return w.replace(/^ا/, 'أ').replace(/ى$/, 'ي').replace(/ة$/, 'ه');
  return w.length > 3 ? garble(w) : w;
}

/**
 * opts: { clip: chance that the first word of a session is lost, endAtPause: chance the session ends at a pause,
 *         drift: interim drift, cumulative: results repeated with everything before, strict: hidden text (gate),
 *         nz: noise, searchFrom: [s, a] start by finding the place }
 */
function run(s, a1, a2, opts, sd, T) {
  seed = sd;
  const nz = opts.nz || { drop: 0, garble: 0, merge: 0 };
  const t = T || new QC.Tracker(Q, { strictness: 0 });
  t.listeners = {};
  const g0 = gOf(s, a1), gEnd = Q.verseStart[vIndex(s, a2) + 1] - 1;
  if (opts.strict) t.reset(g0, { strict: true, bounds: [g0, gEnd] });
  else if (opts.searchFrom) t.reset(gOf(opts.searchFrom[0], opts.searchFrom[1]), { search: true });
  else t.reset(g0);
  const ev = { jump: 0, found: [], says: [], back: 0, backAt: [], rereads: 0 };
  let ask = null;                                   // the app asked to read again from this word
  t.on('jump', e => { ev.jump++; ev.found.push('jump ' + refOfG(e.to)); });
  t.on('found', e => ev.found.push((e.here ? 'here ' : 'found ') + refOfG(e.to)));
  // a failed attempt (memorising): the reciter starts the verse again
  t.on('attempt', () => { ev.attempts = (ev.attempts || 0) + 1; if (ask == null) ask = Q.verseStart[Q.words[Math.min(t.pointer, Q.words.length - 1)].v]; });
  t.on('say', e => {
    ev.says.push(e.type + '@' + refOfG(e.g) + (e.g === Q.verseStart[Q.words[e.g].v] ? '(start)' : ''));
    if (e.type !== 'where' && e.type !== 'accept' && ask == null) ask = e.from != null ? e.from : e.g;
  });
  let page = -1, ptrWas = t.pointer;
  const look = () => {
    // the page the app shows: where the pointer is, or further on where the interim text already is
    if (t.mode !== 'track') return;
    let g = t.pointer;
    for (const k of t.tentative.keys()) if (k > g) g = k;
    const p = pageOf(Math.min(g, Q.words.length - 1));
    // (memorising: the app stopped at a word on an earlier page and shows it, that is meant)
    if (page >= 0 && p < page && !(t.spot && pageOf(t.spot.g) === p)) { ev.back++; ev.backAt.push(page + '>' + p + '@' + refOfG(g)); }
    page = p; ptrWas = t.pointer;
  };
  // the words to say, as utterances (a pause after each): verse by verse, long verses in two halves
  const queue = [];
  for (let a = a1; a <= a2; a++) {
    const w = verseWords(s, a);
    if (w.length > 12 && rnd() < 0.4) { const h = Math.floor(w.length / 2); queue.push({ a, w: w.slice(0, h) }, { a, w: w.slice(h) }); }
    else queue.push({ a, w });
  }
  let finals = [], said = [], first = true, clipped = 0, guard = 0, listening = false;
  t.newSession();
  while (queue.length && guard++ < 2000) {
    const u = queue.shift();
    let w = u.w;
    // a new session: what is said before the recogniser listens is lost
    if (!first && !listening && rnd() < opts.clip) {
      const len = x => QC.core(QC.skeleton(x)).length;
      const two = w.length > 2 && len(w[0]) + len(w[1]) <= 6 && rnd() < 0.4;
      w = w.slice(two ? 2 : 1); clipped++;
    }
    first = false; listening = true;              // from here on the session listens
    const fin = noisy(w, nz);
    if (!fin.length) continue;
    // sent again: the last words revised now and then, earlier ones rarely
    const prev = opts.cumulative ? said.map((x, i) => (rnd() < (i >= said.length - 6 ? 0.15 : 0.03) ? respell(x) : x)) : [];
    const forms = interimForms(fin, opts.drift);
    for (let k = 1; k <= fin.length; k++) {
      const im = interimOf(forms, k, opts.chaos);
      t.feed(finals, (opts.cumulative ? prev.concat(im) : im).join(' ')); look();
    }
    said = said.concat(fin);
    finals = finals.concat([(opts.cumulative ? prev.concat(fin) : fin).join(' ')]);
    t.feed(finals, ''); look();
    if (ask != null) {
      // the app stopped at a word: a pause, then read again from where it says, to the end of that verse
      const g = ask; ask = null; ev.rereads++;
      const v = Q.words[g].v, sa = Q.verseAyah[v], sw = verseWords(s, sa), qn = Q.verseStart[v + 1] - Q.verseStart[v];
      const k = Math.max(0, Math.min(sw.length - 1, Math.round((g - Q.verseStart[v]) * sw.length / qn)));
      // from there on again: this verse from that word, then the verses after it
      queue.length = 0;
      if (ev.rereads <= 60) {
        queue.push({ a: sa, w: sw.slice(k) });
        for (let a = sa + 1; a <= a2; a++) queue.push({ a, w: verseWords(s, a) });
      }
      t.newSession(); finals = []; said = []; listening = false;
      continue;
    }
    if (rnd() < opts.endAtPause) { t.newSession(); finals = []; said = []; listening = false; look(); }
  }
  let missStart = 0, missOther = 0, okWords = 0, total = 0;
  for (let a = a1; a <= a2; a++) {
    const v = vIndex(s, a);
    for (let g = Q.verseStart[v]; g < Q.verseStart[v + 1]; g++) {
      total++;
      const st = t.status[g];
      if (st === QC.ST.OK || st === QC.ST.CORRECTED) okWords++;
      else if (st === QC.ST.MISSED || st === QC.ST.NONE) { if (g === Q.verseStart[v] && a > a1) missStart++; else missOther++; }
    }
  }
  const startSays = ev.says.filter(x => /^(unheard|misheard|missing|wrong).*\(start\)/.test(x)).length;
  return { attempts: ev.attempts || 0, missStart, missOther, okWords, total, jump: ev.jump, back: ev.back, backAt: ev.backAt, found: ev.found, says: ev.says, startSays, rereads: ev.rereads,
    end: t.pointer >= gEnd, clipped, last: refOfG(t.pointer - 1) };       // (the very last word may be lost in the noise)
}

const PASSAGES = [
  ['al-Mulk', 67, 1, 30], ['Ya-Sin', 36, 1, 40], ['al-Kahf', 18, 1, 30], ['al-Baqara 2:1-40', 2, 1, 40],
  ['ar-Rahman', 55, 1, 78], ['al-Waqia', 56, 1, 60], ['an-Naba', 78, 1, 40], ['al-Hashr end', 59, 18, 24],
  ['Al Imran 3:190-200', 3, 190, 200], ['al-Muzzammil', 73, 1, 20], ['al-Insan', 76, 1, 31], ['Luqman', 31, 12, 19],
];
const NOISE = { drop: 0.02, garble: 0.05, merge: 0.03 };
const MODES = [
  // [name, options, how many words at the start of a session may still be reported (noise), checks]
  ['session per verse, first word lost', { clip: 0.85, endAtPause: 1 }],
  ['session per verse, noisy', { clip: 0.85, endAtPause: 1, nz: NOISE }, { noisy: true }],
  ['long sessions, interim drift', { clip: 0.85, endAtPause: 0.25, drift: true }],
  ['long sessions, cumulative results', { clip: 0.85, endAtPause: 0.3, cumulative: true, drift: true }],
  ['long sessions, cumulative, noisy', { clip: 0.85, endAtPause: 0.3, cumulative: true, drift: true, nz: NOISE }, { noisy: true }],
  ['long sessions, unstable interim text', { clip: 0.85, endAtPause: 0.3, drift: true, chaos: true }, { noisy: true }],
];
if (require.main === module) {
  const SEEDS = [1, 2, 3];
  const T = new QC.Tracker(Q, { strictness: 0 });
  T.buildIndex();
  let F = 0;
  for (const strict of [false, true]) {
    for (const [mname, mo, chk] of MODES.filter(m => !process.env.ANDROID_MODES || process.env.ANDROID_MODES.split(",").includes(String(MODES.indexOf(m))))) {
      const noisyMode = chk && chk.noisy;
      const agg = { missStart: 0, missOther: 0, ok: 0, total: 0, jump: 0, back: 0, startSays: 0, notEnd: 0, clipped: 0, rereads: 0, attempts: 0 };
      let bad = 0;
      for (const [pname, s, a1, a2] of PASSAGES) {
        for (const sd of SEEDS) {
          const r = run(s, a1, a2, Object.assign({ strict }, mo), sd, T);
          for (const k of ['missStart', 'missOther', 'jump', 'back', 'startSays', 'clipped', 'rereads', 'attempts']) agg[k] += r[k];
          agg.ok += r.okWords; agg.total += r.total; agg.notEnd += r.end ? 0 : 1;
          // clean audio: nothing at a session start may be reported; noisy: the recogniser really loses words, but no
          // page goes back, nothing jumps, the end is reached
          const fail = (!noisyMode && (r.missStart || r.startSays)) || r.back || r.jump || !r.end;
          if (fail) bad++;
          if (fail || VERBOSE) console.log(`    ${fail ? 'FAIL' : 'ok  '} ${strict ? 'hidden' : 'follow'} / ${mname} / ${pname} seed ${sd}: start not heard ${r.missStart} (${r.clipped} clipped), other ${r.missOther}, back ${r.back} ${r.backAt.slice(0, 4).join(' ')}, jumps ${r.jump}, read again ${r.rereads}, attempts ${r.attempts}, end ${r.end ? 'yes' : 'no (' + r.last + ')'}${r.found.length ? ', ' + r.found.slice(0, 4).join(', ') : ''}${strict && r.says.length ? ', says ' + r.says.slice(0, 6).join(' ') : ''}`);
        }
      }
      F += bad;
      console.log(`${bad ? 'FAIL' : 'ok  '} ${strict ? 'hidden' : 'follow'} / ${mname}: ${PASSAGES.length * SEEDS.length - bad}/${PASSAGES.length * SEEDS.length}; clipped ${agg.clipped}, session-start words not heard ${agg.missStart}, other ${agg.missOther}, ok ${(100 * agg.ok / agg.total).toFixed(1)}%, pages back ${agg.back}, jumps ${agg.jump}, gate at a verse start ${agg.startSays}, read again ${agg.rereads}, failed attempts ${agg.attempts}, not finished ${agg.notEnd}`);
    }
  }
  console.log(F ? F + ' run(s) failed' : 'all android runs ok');
  if (F) process.exitCode = 1;
}
module.exports = { run, PASSAGES, Q, QC, gOf, refOfG, verseWords, setSeed: x => { seed = x; } };
