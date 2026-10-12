// Memorising with hidden text: skipped or confused verses are not followed; attempts, then hints.
// Run: node tests/memorise.test.js QURAN_JSON SIMPLE_CLEAN_JSON
const fs = require('fs');
const assert = require('assert');
const QC = require('../core.js');
const quran = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const simple = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const Q = QC.buildWords(quran);
const ST = QC.ST;

const vIndex = (s, a) => quran.surahs[s - 1].start + a - 1;
const gOf = (s, a) => Q.verseStart[vIndex(s, a)];
const refOf = g => { const v = Q.words[g].v; return Q.verseSurah[v] + ':' + Q.verseAyah[v]; };
function words(s, a) { let w = simple[String(s)][a - 1].text.split(' '); if (a === 1 && s !== 1 && s !== 9) w = w.slice(4); return w; }
function range(s, a1, a2) { let w = []; for (let a = a1; a <= a2; a++) w = w.concat(words(s, a)); return w; }

/** one attempt = one recogniser session, in chunks of up to 5 words */
function say(t, toks, chunk = 5) {
  t.newSession();
  const finals = [];
  for (let i = 0; i < toks.length; i += chunk) {
    const part = toks.slice(i, i + chunk).join(' ');
    t.feed(finals, part); finals.push(part); t.feed(finals, '');
  }
}
function tracker(s, a, b, opts) {
  const t = new QC.Tracker(Q);
  const ev = { attempt: [], hint: [], progress: 0, jump: 0, found: 0 };
  t.on('attempt', e => ev.attempt.push(e));
  t.on('hint', e => ev.hint.push(e));
  t.on('progress', () => ev.progress++);
  t.on('jump', () => ev.jump++);
  t.on('found', () => ev.found++);
  const g0 = gOf(s, a), g1 = Q.verseStart[vIndex(s, b) + 1] - 1;
  t.reset(g0, Object.assign({ bounds: [g0, g1], strict: true }, opts || {}));
  return { t, ev };
}

let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n     ', e.message); process.exitCode = 1; } }

test('M1 skipping a verse is not followed; three attempts, then what happened', () => {
  const { t, ev } = tracker(67, 1, 5);
  say(t, range(67, 1, 2));
  const at3 = gOf(67, 3);
  assert.strictEqual(t.pointer, at3, 'after 67:1-2 pointer at ' + refOf(t.pointer));
  for (let i = 0; i < 3; i++) say(t, words(67, 4));
  assert.strictEqual(t.pointer, at3, 'followed the skip to ' + refOf(t.pointer));
  assert.strictEqual(ev.jump, 0);
  assert.strictEqual(ev.attempt.length, 3, JSON.stringify(ev.attempt));
  assert.strictEqual(ev.hint.length, 1);
  assert.strictEqual(ev.hint[0].kind, 'diag');
  assert.strictEqual(ev.hint[0].fail.kind, 'skip');
  assert.strictEqual(ev.hint[0].fail.n, 1);
  for (let g = gOf(67, 4); g < gOf(67, 5); g++) assert.strictEqual(t.status[g], 0, 'a word of the skipped-to verse was marked');
});

test('M2 three more failures show the next word; reciting it counts as "with help"', () => {
  const { t, ev } = tracker(67, 1, 5);
  say(t, range(67, 1, 2));
  for (let i = 0; i < 6; i++) say(t, words(67, 4));
  assert.strictEqual(ev.hint.length, 2, JSON.stringify(ev.hint.map(h => h.kind)));
  const at3 = gOf(67, 3);
  assert.strictEqual(ev.hint[1].kind, 'word');
  assert.strictEqual(ev.hint[1].g, at3);
  assert(t.revealed.has(at3));
  say(t, words(67, 3));
  assert(t.pointer >= gOf(67, 4), 'did not go on: ' + refOf(t.pointer));
  assert.strictEqual(t.status[at3], ST.HINT);
  assert.strictEqual(t.status[at3 + 1], ST.OK);
  assert(ev.progress >= 1);
  // a further word only after three new failures
  for (let i = 0; i < 2; i++) say(t, words(67, 5).slice(3));
  assert.strictEqual(ev.hint.length, 2);
});

test('M3 a run-up over the previous verse is fine and counts nothing', () => {
  const { t, ev } = tracker(67, 1, 5);
  say(t, range(67, 1, 2));
  say(t, range(67, 2, 3));
  assert.strictEqual(ev.attempt.length, 0, JSON.stringify(ev.attempt));
  assert.strictEqual(t.pointer, gOf(67, 4));
});

test('M4 reciting an earlier verse again: "you repeat verse 1"', () => {
  const { t, ev } = tracker(67, 1, 8);
  say(t, range(67, 1, 4));
  for (let i = 0; i < 3; i++) say(t, words(67, 1));
  assert.strictEqual(t.pointer, gOf(67, 5));
  assert.strictEqual(ev.hint.length, 1);
  assert.strictEqual(ev.hint[0].fail.kind, 'repeat');
  assert.strictEqual(refOf(ev.hint[0].fail.pos), '67:1');
});

test('M5 a similar verse from another surah: named in the hint', () => {
  const { t, ev } = tracker(67, 1, 5);
  say(t, range(67, 1, 2));
  for (let i = 0; i < 3; i++) say(t, words(71, 15));
  assert.strictEqual(t.pointer, gOf(67, 3));
  assert.strictEqual(ev.hint.length, 1, JSON.stringify(ev.attempt));
  assert.strictEqual(ev.hint[0].fail.kind, 'other');
  assert.strictEqual(refOf(ev.hint[0].fail.pos), '71:15');
});

test('M6 reading on in the same wrong verse is one attempt, not several', () => {
  const { t, ev } = tracker(18, 1, 10);
  say(t, range(18, 1, 2));
  say(t, range(18, 4, 5), 4);           // skips verse 3, in four results
  assert.strictEqual(ev.attempt.length, 1, JSON.stringify(ev.attempt));
});

test('M7 help switched off: nothing is counted or shown, the skip is still not followed', () => {
  const { t, ev } = tracker(67, 1, 5, { help: { on: false } });
  say(t, range(67, 1, 2));
  for (let i = 0; i < 6; i++) say(t, words(67, 4));
  assert.strictEqual(ev.attempt.length, 0);
  assert.strictEqual(ev.hint.length, 0);
  assert.strictEqual(t.pointer, gOf(67, 3));
});

test('M8 the help button shows the next word right away', () => {
  const { t, ev } = tracker(67, 1, 5);
  say(t, range(67, 1, 2));
  t.requestHint();
  assert.strictEqual(ev.hint.length, 1);
  assert.strictEqual(ev.hint[0].kind, 'word');
  assert.strictEqual(ev.hint[0].g, gOf(67, 3));
  t.requestHint();
  assert.strictEqual(ev.hint[1].g, gOf(67, 3) + 1);
  assert.deepStrictEqual(ev.hint[1].words, [gOf(67, 3), gOf(67, 3) + 1]);
});

test('M9 two attempts setting: the hint comes after two', () => {
  const { t, ev } = tracker(67, 1, 5, { help: { on: true, tries: 2 } });
  say(t, range(67, 1, 2));
  for (let i = 0; i < 2; i++) say(t, words(67, 4));
  assert.strictEqual(ev.hint.length, 1);
});

test('M10 a right beginning, then a jump: the right part is kept', () => {
  const { t, ev } = tracker(18, 1, 10);
  say(t, range(18, 1, 1));
  say(t, words(18, 2).concat(words(18, 5)), 30);   // one result: verse 2, then verse 5
  assert.strictEqual(t.pointer, gOf(18, 3), refOf(t.pointer));
  assert.strictEqual(ev.attempt.length, 1);
});

test('M11 text shown again (not strict): normal following works', () => {
  const { t, ev } = tracker(18, 1, 15);
  say(t, range(18, 1, 2));
  t.setStrict(false);
  say(t, range(18, 9, 12));
  assert(t.pointer > gOf(18, 9), 'did not follow after the text was shown: ' + refOf(t.pointer));
});

test('M13 saying the previous verse again and again (here a refrain) counts from the second time', () => {
  const { t, ev } = tracker(55, 58, 62);
  say(t, range(55, 58, 59));
  for (let i = 0; i < 4; i++) say(t, words(55, 59));
  assert.strictEqual(t.pointer, gOf(55, 60));
  assert.strictEqual(ev.attempt.length, 3, JSON.stringify(ev.attempt));
  assert.strictEqual(ev.hint.length, 1);
  assert.strictEqual(ev.hint[0].fail.kind, 'repeat');
});

test('M14 after the diagnosis, the help button shows the next word', () => {
  const { t, ev } = tracker(67, 1, 5);
  say(t, range(67, 1, 2));
  for (let i = 0; i < 3; i++) say(t, words(67, 4));
  t.requestHint();
  assert.strictEqual(ev.hint.length, 2);
  assert.strictEqual(ev.hint[1].kind, 'word');
  assert.strictEqual(ev.hint[1].g, gOf(67, 3));
});

// recogniser noise must not produce failed attempts when the reciter is right
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const letters = 'بتثجحخدذرزسشصضطظعغفقكلمنهوي';
function noisy(ws, nz) {
  const out = [];
  for (let i = 0; i < ws.length; i++) {
    const r = rnd(), w = ws[i];
    if (r < nz.drop) continue;
    if (r < nz.drop + nz.garble && w.length > 2) { const p = 1 + Math.floor(rnd() * (w.length - 1)); out.push(w.slice(0, p) + letters[Math.floor(rnd() * letters.length)] + w.slice(p + 1)); continue; }
    if (r < nz.drop + nz.garble + nz.merge && i + 1 < ws.length) { out.push(w + ws[i + 1]); i++; continue; }
    out.push(w);
  }
  return out;
}
test('M12 recogniser noise while reciting correctly: (almost) no false attempts', () => {
  let attempts = 0, total = 0;
  const lines = [];
  for (const [s, a1, a2] of [[67, 1, 30], [18, 1, 30], [2, 1, 25], [36, 1, 40], [55, 1, 40], [78, 1, 40], [77, 1, 30], [26, 100, 140], [94, 1, 8], [102, 1, 8], [109, 1, 6], [112, 1, 4], [114, 1, 6], [20, 1, 30]]) {
    for (const nz of [{ drop: 0.03, garble: 0.04, merge: 0.03 }, { drop: 0.06, garble: 0.08, merge: 0.04 }]) {
      const { t, ev } = tracker(s, a1, a2);
      for (let a = a1; a <= a2; a++) say(t, noisy(words(s, a), nz), 4 + Math.floor(rnd() * 4));
      attempts += ev.attempt.length; total += Q.verseStart[vIndex(s, a2) + 1] - gOf(s, a1);
      const end = Q.verseStart[vIndex(s, a2) + 1];
      // (if the recogniser swallows most of the very last verse, that verse may stay open: the reciter would simply say it again)
      const lastV = gOf(s, a2);
      lines.push(`${s}:${a1}-${a2} noise ${nz.drop}: attempts ${ev.attempt.length}, hints ${ev.hint.length}, end ${t.pointer >= end - 2 ? 'reached' : t.pointer >= lastV ? 'last verse open' : 'stuck at ' + refOf(t.pointer)}`);
      assert(t.pointer >= lastV, lines[lines.length - 1]);
    }
  }
  console.log('      ' + lines.join('\n      '));
  assert(attempts / total < 0.004, `false attempts: ${attempts} in ${total} words`);
});

console.log(passed + ' passed');
