// Realistic recitation scenarios for the tracker. Run: node tests/scenarios.test.js QURAN_JSON SIMPLE_CLEAN_JSON
const fs = require('fs');
const assert = require('assert');
const QC = require('../core.js');
const quran = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const simple = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const Q = QC.buildWords(quran);
const ST = QC.ST;

function verseIndex(s, a) { return quran.surahs[s - 1].start + a - 1; }
function simpleWords(s, a) {
  let w = simple[String(s)][a - 1].text.split(' ');
  if (a === 1 && s !== 1 && s !== 9) w = w.slice(4); // drop basmala
  return w;
}
function range(s, a1, a2) { let w = []; for (let a = a1; a <= a2; a++) w = w.concat(simpleWords(s, a)); return w; }
function wordsOf(s, a) { const v = verseIndex(s, a); return [Q.verseStart[v], Q.verseStart[v + 1]]; }

/** feed tokens as a recogniser would: several sessions, each with a few final chunks */
function recite(t, toks, opts = {}) {
  const chunk = opts.chunk || 5, perSession = opts.perSession || 18;
  let i = 0;
  while (i < toks.length) {
    t.newSession();
    const finals = [];
    const end = Math.min(toks.length, i + perSession);
    while (i < end) {
      const n = Math.min(end - i, chunk);
      const part = toks.slice(i, i + n).join(' ');
      // interim first, then final
      t.feed(finals, part);
      finals.push(part);
      t.feed(finals, '');
      i += n;
    }
  }
}
function statuses(t, a, b) { const out = {}; for (let g = a; g < b; g++) { const s = t.status[g]; out[s] = (out[s] || 0) + 1; } return out; }
function issueList(t, a, b) { const out = []; for (let g = a; g < b; g++) if (t.status[g] !== ST.OK) out.push([g, Q.words[g].t, t.status[g], t.heard.get(g) || '']); return out; }

let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n     ', e.message); process.exitCode = 1; } }

test('A perfect recitation of al-Mulk in chunks and sessions', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(67, 1); const [, b] = wordsOf(67, 30);
  t.reset(a); recite(t, range(67, 1, 30), { chunk: 4, perSession: 15 });
  const st = statuses(t, a, b);
  assert.strictEqual(st[ST.OK], b - a, JSON.stringify(st) + ' ' + JSON.stringify(issueList(t, a, b)));
  assert.strictEqual(t.pointer, b);
});

test('B three skipped words in the middle are marked as not heard', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(67, 1); const [, b] = wordsOf(67, 5);
  const toks = range(67, 1, 5); const cut = 20; const dropped = toks.splice(cut, 3);
  t.reset(a); recite(t, toks, { chunk: 6, perSession: 30 });
  const iss = issueList(t, a, b);
  assert.strictEqual(iss.length, 3, JSON.stringify(iss) + ' dropped ' + dropped.join(' '));
  assert(iss.every(x => x[2] === ST.MISSED));
});

test('C ح pronounced as ه is a letter error', () => {
  const t = new QC.Tracker(Q); const [a, b] = wordsOf(1, 2);
  t.reset(a); recite(t, ['الهمد', 'لله', 'رب', 'العالمين']);
  assert.strictEqual(t.status[a], ST.LETTER, JSON.stringify(issueList(t, a, b)));
  assert.deepStrictEqual(t.detail.get(a).pairs, [['ح', 'ه']]);
  assert.strictEqual(statuses(t, a, b)[ST.OK], 3);
});

test('D a different word in place of the text is flagged', () => {
  const t = new QC.Tracker(Q); const [a, b] = wordsOf(112, 1);
  t.reset(a); recite(t, ['قل', 'هو', 'الرحمن', 'أحد']);
  const iss = issueList(t, a, b);
  assert.strictEqual(iss.length, 1, JSON.stringify(iss));
  assert(iss[0][2] === ST.WRONG || iss[0][2] === ST.NEAR);
});

test('E repeating the last words before continuing is not an error', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(103, 1); const [, b] = wordsOf(103, 3);
  const toks = range(103, 1, 3); toks.splice(8, 0, ...toks.slice(4, 8));
  t.reset(a); recite(t, toks, { chunk: 4 });
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b)));
});

test('F a slip that is immediately corrected counts as self-corrected', () => {
  const t = new QC.Tracker(Q); const [a, b] = wordsOf(112, 2);
  t.reset(a);
  t.newSession(); t.feed(['الله'], ''); t.feed(['الله', 'السمد'], '');
  t.newSession(); t.feed(['الله الصمد'], '');
  assert.strictEqual(t.status[a + 1], ST.CORRECTED, JSON.stringify(issueList(t, a, b)));
});

test('G reciting a different place relocates the reading position', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(2, 1);
  let jumped = null; t.on('jump', e => { jumped = e.to; });
  t.reset(a); recite(t, range(36, 1, 4), { chunk: 6, perSession: 40 });
  const [s36] = wordsOf(36, 1); const [, e36] = wordsOf(36, 4);
  assert(jumped != null && jumped >= s36 && jumped < s36 + 3, 'jump ' + jumped + ' expected ~' + s36);
  assert.strictEqual(statuses(t, s36, e36)[ST.OK] >= (e36 - s36) - 1, true, JSON.stringify(issueList(t, s36, e36)));
});

test('H disjoined letters spoken as letter names', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(2, 1); const [, b] = wordsOf(2, 2);
  t.reset(a); recite(t, ['ألف', 'لام', 'ميم', ...simpleWords(2, 2)]);
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b)));
});

test('I basmala before a surah is accepted and not counted', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(114, 1); const [, b] = wordsOf(114, 6);
  t.reset(a); recite(t, ['بسم', 'الله', 'الرحمن', 'الرحيم', ...range(114, 1, 6)], { chunk: 5 });
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b)));
});

test('J isti\'adha at the start is ignored', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(1, 1); const [, b] = wordsOf(1, 7);
  t.reset(a); recite(t, ['أعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم', ...range(1, 1, 7)], { chunk: 7 });
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b)));
});

test('K interim words light up before they are final', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(1, 2);
  t.reset(a); t.newSession(); t.feed([], 'الحمد لله رب');
  assert.strictEqual(t.tentative.size, 3);
  assert.strictEqual(t.status[a], ST.NONE);
});

test('L continuing across surahs (al-Fatiha into al-Baqara with basmala)', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(1, 1); const [, b] = wordsOf(2, 5);
  const toks = [...range(1, 1, 7), 'آمين', 'بسم', 'الله', 'الرحمن', 'الرحيم', ...range(2, 1, 5)];
  t.reset(a); recite(t, toks, { chunk: 6, perSession: 25 });
  const iss = issueList(t, a, b);
  assert(iss.length === 0, JSON.stringify(iss));
});

test('M cumulative final results (Android) are not double counted', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(2, 2); const [, b] = wordsOf(2, 2);
  t.reset(a); t.newSession();
  t.feed(['ذلك الكتاب'], ''); t.feed(['ذلك الكتاب', 'ذلك الكتاب لا ريب'], '');
  t.feed(['ذلك الكتاب', 'ذلك الكتاب لا ريب', 'ذلك الكتاب لا ريب فيه هدى للمتقين'], '');
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b)));
  assert.strictEqual(t.pointer, b);
});

test('N a missing lengthening (قال read as قل) is noticed', () => {
  const t = new QC.Tracker(Q); const [a, b] = wordsOf(19, 9);
  const toks = simpleWords(19, 9); toks[0] = 'قل';
  t.reset(a); recite(t, toks);
  assert.strictEqual(t.status[a], ST.MADD, JSON.stringify(issueList(t, a, b)));
});

test('O long surah: al-Kahf 1-30 with random chunking stays perfect', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(18, 1); const [, b] = wordsOf(18, 30);
  t.reset(a); recite(t, range(18, 1, 30), { chunk: 3, perSession: 11 });
  const st = statuses(t, a, b);
  assert.strictEqual(st[ST.OK], b - a, JSON.stringify(issueList(t, a, b)));
});

test('P summary lists only the recited range', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(112, 1); const [, b] = wordsOf(112, 4);
  t.reset(a); const toks = range(112, 1, 4); toks.splice(6, 1);
  recite(t, toks);
  const s = t.summary();
  assert.strictEqual(s.words, b - a);
  assert.strictEqual(s.counts.missed, 1, JSON.stringify(s));
});

test('Q Safari style: one long interim result, final only at the end', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(67, 1); const [, b] = wordsOf(67, 6);
  const toks = range(67, 1, 6);
  t.reset(a); t.newSession();
  let committedMid = 0;
  for (let k = 1; k <= toks.length; k++) {
    t.feed([], toks.slice(0, k).join(' '));
    if (k === 30) committedMid = statuses(t, a, b)[ST.OK] || 0;
  }
  t.feed([toks.join(' ')], '');
  assert(committedMid >= 20, 'words committed while still interim: ' + committedMid);
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b)));
});

test('R interim revision of the last words does not create errors', () => {
  const t = new QC.Tracker(Q); const [a] = wordsOf(112, 1); const [, b] = wordsOf(112, 4);
  t.reset(a); t.newSession();
  t.feed([], 'قل هو الله أحد الله الصمد لم يلد'); t.feed([], 'قل هو الله أحد الله الصمد لم يلد ولم يولد');
  t.feed([], 'قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد');
  t.feed(['قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد'], '');
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b)));
});

// ---------------------------------------------------------------- finding the place and staying there
function events(t) { const ev = { jump: [], found: [] }; t.on('jump', e => ev.jump.push(e.to)); t.on('found', e => ev.found.push(e.to)); return ev; }
const refOf = g => { const v = Q.words[g].v; return Q.verseSurah[v] + ':' + Q.verseAyah[v]; };

test('S1 starting elsewhere: Ya-Sin is found from the Baqara page', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(2, 1); t.reset(a, { search: true });
  recite(t, range(36, 1, 5), { chunk: 4 });
  const [s, ] = wordsOf(36, 1); const [, e] = wordsOf(36, 5);
  assert.strictEqual(ev.found.length, 1, JSON.stringify(ev));
  assert(Math.abs(ev.found[0] - s) <= 3, 'found at ' + refOf(ev.found[0]));
  assert.strictEqual(ev.jump.length, 0);
  assert((statuses(t, s, e)[ST.OK] || 0) >= (e - s) - 1, JSON.stringify(issueList(t, s, e)));
});

test('S2 the place in view is accepted immediately', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(67, 1); t.reset(a, { search: true });
  recite(t, range(67, 1, 3), { chunk: 4 });
  assert.strictEqual(ev.found.length, 1); assert.strictEqual(ev.found[0], a);
  assert.strictEqual(ev.jump.length, 0);
});

test('S3 a refrain that occurs 8 times is not enough to decide; the next verses are', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(2, 1); t.reset(a, { search: true });
  recite(t, range(26, 121, 122), { chunk: 5, perSession: 40 });
  assert.strictEqual(ev.found.length, 0, 'decided too early at ' + ev.found.map(refOf));
  recite(t, range(26, 123, 127), { chunk: 5, perSession: 40 });
  assert.strictEqual(ev.found.length, 1, JSON.stringify(ev));
  const [s] = wordsOf(26, 121);
  assert(Math.abs(ev.found[0] - s) <= 3, 'found at ' + refOf(ev.found[0]));
});

test('S4 Ar-Rahman with its 31 refrains: no jumping', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(55, 1); const [, b] = wordsOf(55, 45);
  t.reset(a); recite(t, range(55, 1, 45), { chunk: 4, perSession: 13 });
  assert.strictEqual(ev.jump.length, 0, 'jumped to ' + ev.jump.map(refOf));
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b).slice(0, 5)));
});

test('S5 Al-Mursalat refrain: no jumping', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(77, 1); const [, b] = wordsOf(77, 50);
  t.reset(a); recite(t, range(77, 1, 50), { chunk: 3, perSession: 10 });
  assert.strictEqual(ev.jump.length, 0, 'jumped to ' + ev.jump.map(refOf));
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b).slice(0, 5)));
});

test('S6 slipping into the similar verse 7:161 while reciting 2:58 stays at 2:58 and marks the slip', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a, b] = wordsOf(2, 58);
  const v258 = simpleWords(2, 58), v7161 = simpleWords(7, 161);
  const toks = v258.slice(0, 6).concat(v7161.slice(6, 12)).concat(v258.slice(12));
  t.reset(a); recite(t, toks, { chunk: 4 });
  assert.strictEqual(ev.jump.length, 0, 'jumped to ' + ev.jump.map(refOf));
  const iss = issueList(t, a, b);
  assert(iss.length >= 1 && iss.length <= 8, JSON.stringify(iss));
  assert(t.pointer >= b - 1, 'pointer ' + t.pointer + ' end ' + b);
});

test('S7 really switching to another surah: one jump, no jumping back', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(2, 1);
  t.reset(a); recite(t, range(2, 1, 3).concat(range(67, 1, 6)), { chunk: 5, perSession: 20 });
  assert.strictEqual(ev.jump.length, 1, JSON.stringify(ev.jump.map(refOf)));
  const [s] = wordsOf(67, 1); const [, e] = wordsOf(67, 6);
  assert(Math.abs(ev.jump[0] - s) <= 6, 'jumped to ' + refOf(ev.jump[0]));
  assert((statuses(t, s, e)[ST.OK] || 0) >= (e - s) - 6, JSON.stringify(issueList(t, s, e)));
});

test('S8 going back to an earlier verse of the same surah follows the reciter', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(18, 10);
  t.reset(a); recite(t, range(18, 10, 20), { chunk: 5 });
  recite(t, range(18, 10, 12), { chunk: 5 });
  assert.strictEqual(ev.jump.length, 1, JSON.stringify(ev.jump.map(refOf)));
  const [s] = wordsOf(18, 10);
  assert(Math.abs(ev.jump[0] - s) <= 4, 'jumped to ' + refOf(ev.jump[0]));
});

test('S9 Ash-Shuara with its repeated refrains recited in order: no jumping', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(26, 100); const [, b] = wordsOf(26, 145);
  t.reset(a); recite(t, range(26, 100, 145), { chunk: 4, perSession: 16 });
  assert.strictEqual(ev.jump.length, 0, 'jumped to ' + ev.jump.map(refOf));
  assert.strictEqual(statuses(t, a, b)[ST.OK], b - a, JSON.stringify(issueList(t, a, b).slice(0, 5)));
});

test('S10 memorisation test of a page: drifting into another surah is marked, not followed', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(67, 1); const [, b] = wordsOf(67, 5);
  t.reset(a, { bounds: [a, b - 1] });
  recite(t, range(67, 1, 2).concat(range(2, 255, 255)), { chunk: 5, perSession: 20 });
  assert.strictEqual(ev.jump.length, 0, 'jumped to ' + ev.jump.map(refOf));
  assert(t.pointer <= b + 2, 'pointer left the page: ' + refOf(t.pointer));
  const [s3] = wordsOf(67, 3);
  assert(Object.keys(statuses(t, s3, b)).some(k => +k >= ST.MISSED && +k <= ST.MADD), 'no mistakes marked: ' + JSON.stringify(statuses(t, s3, b)));
});

test('S11 memorisation test: going back inside the tested page is still followed', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(18, 1); const [, b] = wordsOf(18, 15);
  t.reset(a, { bounds: [a, b - 1] });
  recite(t, range(18, 1, 12), { chunk: 5 });
  recite(t, range(18, 2, 4), { chunk: 5 });
  assert.strictEqual(ev.jump.length, 1, JSON.stringify(ev.jump.map(refOf)));
  const [s] = wordsOf(18, 2);
  assert(Math.abs(ev.jump[0] - s) <= 4, 'jumped to ' + refOf(ev.jump[0]));
});

test('S12 test from a verse (stay in the surah): another surah is not followed', () => {
  const t = new QC.Tracker(Q); const ev = events(t);
  const [a] = wordsOf(2, 1);
  t.reset(a, { stay: true }); recite(t, range(2, 1, 3).concat(range(67, 1, 6)), { chunk: 5, perSession: 20 });
  assert.strictEqual(ev.jump.length, 0, 'jumped to ' + ev.jump.map(refOf));
  assert.strictEqual(t.surahOfWord(Math.min(t.pointer, Q.words.length - 1)), 2);
});

console.log(passed + ' passed');
