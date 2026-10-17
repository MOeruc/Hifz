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
function say(t, toks, chunk = 5, pause) {
  t.newSession();
  const finals = [];
  for (let i = 0; i < toks.length; i += chunk) {
    const part = toks.slice(i, i + chunk).join(' ');
    t.feed(finals, part); finals.push(part); t.feed(finals, '');
  }
  if (pause) t.newSession();                // the reciter stops: the recogniser's session ends
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
  assert.strictEqual(ev.hint[0].kind, 'runup');                 // where to start again, and what happened
  assert.deepStrictEqual(ev.hint[0].words, [at3 - 3, at3 - 2, at3 - 1]);
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

test('M7 help switched off: the attempts are still told, but nothing is shown; the skip is still not followed', () => {
  const { t, ev } = tracker(67, 1, 5, { help: { on: false } });
  say(t, range(67, 1, 2));
  for (let i = 0; i < 6; i++) say(t, words(67, 4));
  assert.strictEqual(ev.attempt.length, 6);
  assert(ev.attempt.every(a => a.kind === 'skip'), JSON.stringify(ev.attempt.map(a => a.kind)));
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

// ---------------------------------------------------------------- the gate: no word may be left out
function gated(s, a, b, opts) {
  const r = tracker(s, a, b, opts);
  r.ev.say = []; r.ev.done = [];
  r.t.on('say', e => r.ev.say.push(e));
  r.t.on('verseDone', e => r.ev.done.push(e));
  return r;
}
const without = (ws, i) => ws.slice(0, i).concat(ws.slice(i + 1));

test('M15 a word left out: the app stops there ("not heard"), reading it again goes on without a mistake', () => {
  const { t, ev } = gated(67, 1, 5);
  say(t, words(67, 1));
  const gap = gOf(67, 2) + 4;                                   // أيكم
  say(t, without(words(67, 2), 4));
  assert.strictEqual(t.pointer, gap, 'pointer ' + refOf(t.pointer));
  assert.deepStrictEqual(ev.say.map(e => e.type), ['unheard']);
  assert.strictEqual(ev.say[0].g, gap);
  assert.strictEqual(ev.say[0].from, gap - 2);                 // "read again from the word two before"
  say(t, words(67, 2).slice(2));
  assert.strictEqual(t.pointer, gOf(67, 3), 'pointer ' + refOf(t.pointer));
  assert.strictEqual(t.status[gap], ST.OK);
  assert.strictEqual(ev.attempt.length, 0);
  assert.deepStrictEqual(ev.done.map(d => refOf(Q.verseStart[d.v])), ['67:1', '67:2']);
});

test('M16 the same word left out again: the app names it; the third time it lets it through', () => {
  const { t, ev } = gated(67, 1, 5);
  say(t, words(67, 1));
  const gap = gOf(67, 2) + 4;
  say(t, without(words(67, 2), 4));
  say(t, without(words(67, 2), 4).slice(2));
  assert.deepStrictEqual(ev.say.map(e => e.type), ['unheard', 'missing']);
  assert(t.revealed.has(gap), 'the word is shown');
  assert.strictEqual(t.pointer, gap);
  // reading it now: "with help"
  const t2 = gated(67, 1, 5);
  say(t2.t, words(67, 1)); say(t2.t, without(words(67, 2), 4)); say(t2.t, without(words(67, 2), 4).slice(2));
  say(t2.t, words(67, 2).slice(2));
  assert.strictEqual(t2.t.status[gap], ST.HINT);
  assert.strictEqual(t2.t.pointer, gOf(67, 3));
  // not even then: let through, marked as not heard
  say(t, without(words(67, 2), 4).slice(2));
  assert.deepStrictEqual(ev.say.map(e => e.type), ['unheard', 'missing', 'accept']);
  assert.strictEqual(t.pointer, gOf(67, 3));
  assert.strictEqual(t.status[gap], ST.MISSED);
});

test('M17 reading on after a left-out word: reminded once in the next verse; going back fills it, the rest stays read', () => {
  const { t, ev } = gated(67, 1, 6);
  say(t, words(67, 1));
  const gap = gOf(67, 2) + 4;
  say(t, without(words(67, 2), 4));
  say(t, words(67, 3));
  say(t, words(67, 4).slice(0, 5));
  assert.deepStrictEqual(ev.say.map(e => e.type), ['unheard', 'open']);
  assert.strictEqual(t.pointer, gap);
  assert.strictEqual(ev.attempt.length, 0, JSON.stringify(ev.attempt));
  assert.strictEqual(t.status[gOf(67, 3) + 5], ST.OK, 'words read after the gap are kept');
  say(t, words(67, 2).slice(2));
  assert.strictEqual(t.pointer, gOf(67, 4) + 5, 'went on to where the reader was: ' + refOf(t.pointer));
  assert.strictEqual(ev.attempt.length, 0);
});

test('M18 a word heard as another word: "read again"; right the second time counts as corrected', () => {
  const { t, ev } = gated(67, 1, 5);
  say(t, words(67, 1));
  const ws = words(67, 2).slice(), at = gOf(67, 2) + 7;          // عملا
  ws[7] = 'كتابا';
  say(t, ws);
  assert.strictEqual(t.pointer, at, refOf(t.pointer));
  assert.deepStrictEqual(ev.say.map(e => e.type), ['misheard']);
  assert.strictEqual(ev.say[0].heard, 'كتابا');
  say(t, words(67, 2).slice(5));
  assert.strictEqual(t.pointer, gOf(67, 3));
  assert.strictEqual(t.status[at], ST.CORRECTED);
  // the same wrong word twice: what was said, and what belongs there
  const r = gated(67, 1, 5);
  say(r.t, words(67, 1)); say(r.t, ws); say(r.t, ws.slice(5));
  assert.deepStrictEqual(r.ev.say.map(e => e.type), ['misheard', 'wrong']);
  assert.strictEqual(r.ev.say[1].heard, 'كتابا');
  assert(r.t.revealed.has(at));
});

test('M24 relaxed (the default in the app): a word heard as another word goes through, a word left out still stops', () => {
  const { t, ev } = gated(67, 1, 5, { });
  t.opts.strictness = 0;
  say(t, words(67, 1));
  const ws = words(67, 2).slice(), at = gOf(67, 2) + 7;          // عملا
  ws[7] = 'كتابا';
  say(t, ws);
  assert.strictEqual(t.pointer, gOf(67, 3), 'stopped at ' + refOf(t.pointer));
  assert.deepStrictEqual(ev.say.map(e => e.type), []);
  assert.strictEqual(t.status[at], ST.WRONG);                    // kept for the strict view, not shown at this level
  const left = words(67, 3).slice(); left.splice(4, 1);           // a whole word left out
  say(t, left);
  assert.strictEqual(t.pointer, gOf(67, 3) + 4, refOf(t.pointer));
  assert.deepStrictEqual(ev.say.map(e => e.type), ['unheard']);
});

test('M25 a word the recogniser had in its interim text but lost in the final one counts as said', () => {
  const { t, ev } = gated(67, 1, 5);
  say(t, words(67, 1));
  const ws = words(67, 2);
  t.newSession();
  t.feed([], ws.slice(0, 6).join(' '));                           // interim: ... أيكم أحسن
  const lost = without(ws, 4);                                    // final: أيكم is gone
  t.feed([lost.join(' ')], '');
  assert.strictEqual(t.pointer, gOf(67, 3), 'stopped at ' + refOf(t.pointer));
  assert.deepStrictEqual(ev.say.map(e => e.type), []);
  assert.strictEqual(t.status[gOf(67, 2) + 4], ST.OK);
  // never in the interim text: the app stops there as before
  const r = gated(67, 1, 5);
  say(r.t, words(67, 1));
  r.t.newSession(); r.t.feed([], ws.slice(0, 3).join(' ')); r.t.feed([lost.join(' ')], '');
  assert.strictEqual(r.t.pointer, gOf(67, 2) + 4, refOf(r.t.pointer));
  assert.deepStrictEqual(r.ev.say.map(e => e.type), ['unheard']);
});

test('M19 two verses swapped: the next verse, this one, then the one after the next', () => {
  const { t, ev } = gated(67, 1, 8);
  say(t, range(67, 1, 2));
  say(t, words(67, 4));
  say(t, words(67, 3));
  assert.strictEqual(t.pointer, gOf(67, 4));
  say(t, words(67, 5));
  assert.deepStrictEqual(ev.attempt.map(a => a.kind), ['skip', 'order'], JSON.stringify(ev.attempt));
  assert.strictEqual(ev.attempt[1].fail.swap, vIndex(67, 3));
});

test('M20 every verse is reported once with what was not quite right; giving up a verse counts it as shown', () => {
  const { t, ev } = gated(67, 1, 5);
  say(t, range(67, 1, 2));
  assert.deepStrictEqual(ev.done.map(d => [refOf(Q.verseStart[d.v]), d.issues.length, d.help]), [['67:1', 0, false], ['67:2', 0, false]]);
  t.requestHint();
  say(t, words(67, 3));
  assert.strictEqual(ev.done.length, 3);
  assert.strictEqual(ev.done[2].help, true);
  t.skipVerse();
  assert.strictEqual(t.pointer, gOf(67, 5));
  assert.strictEqual(ev.done.length, 4);
  assert(ev.done[3].help);
  for (let g = gOf(67, 4); g < gOf(67, 5); g++) assert.strictEqual(t.status[g], ST.HINT);
});

test('M21 isti\'adha and basmala before the first verse: nothing counted, nothing said', () => {
  for (const pre of [['أعوذ بالله من الشيطان الرجيم', 'بسم الله الرحمن الرحيم'], ['اعوذ بالله السميع العليم من الشيطان الرجيم'], ['بسم الله الرحمن']]) {
    const { t, ev } = gated(55, 1, 4);
    t.newSession();
    const finals = [];
    for (const p of pre.concat(words(55, 1).join(' '), words(55, 2).join(' '))) { t.feed(finals, p); finals.push(p); t.feed(finals, ''); }
    assert.strictEqual(ev.attempt.length, 0, pre + ' ' + JSON.stringify(ev.attempt));
    assert.strictEqual(ev.say.length, 0, pre + ' ' + JSON.stringify(ev.say));
    assert.strictEqual(t.pointer, gOf(55, 3), pre + ' pointer ' + refOf(t.pointer));
  }
});

test('M22 n-best: the alternative that fits the expected words is taken', () => {
  const { t } = gated(67, 1, 5);
  say(t, words(67, 1));
  const right = words(67, 2).slice(0, 6).join(' ');
  t.newSession();
  assert.strictEqual(t.pick(['الذي خلق الموت والحياة ليبلوكم أيهم', right], []), 1);
  assert.strictEqual(t.pick([right, 'الذي خلق الموت والحياة'], []), 0);
  // part of the result was already taken from the interim text: only an alternative that begins with it can be chosen
  const r2 = gated(67, 1, 5);
  say(r2.t, words(67, 1));
  r2.t.newSession(); r2.t.feed([], words(67, 2).slice(0, 9).join(' '));      // the first six words are taken
  const head = words(67, 2).slice(0, 6).join(' ');
  assert.strictEqual(r2.t.pick([head + ' أحسن عملنا', 'خلق الموت والحياة ليبلوكم أيكم أحسن عملا'], []), 0);
  assert.strictEqual(r2.t.pick([head + ' أحسن عملنا كتابا', head + ' أحسن عملا'], []), 1);
});

test('M23 a pause in the middle of a verse (or its last word lost): where the reciter was; at a verse end nothing', () => {
  const { t, ev } = gated(112, 1, 4);
  say(t, words(112, 1), 5, true);
  assert.strictEqual(ev.say.length, 0, 'after a whole verse: ' + JSON.stringify(ev.say));
  // (a verse of one or two words left out counts like words the recogniser swallowed: "read verse 2 again")
  say(t, words(112, 3).slice(0, 2), 5, true);
  assert.deepStrictEqual(ev.say.map(e => e.type), ['unheard']);
  assert.strictEqual(ev.say[0].g, gOf(112, 2));
  const r = gated(112, 1, 4);
  say(r.t, words(112, 1), 5, true); say(r.t, words(112, 2), 5, true);
  say(r.t, words(112, 3).slice(0, 2), 5, true);
  assert.deepStrictEqual(r.ev.say.map(e => e.type), ['where']);
  assert.strictEqual(r.ev.say[0].from, gOf(112, 3) + 1);
  say(r.t, words(112, 3).slice(1), 5, true);
  assert.strictEqual(r.t.pointer, gOf(112, 4));
  assert.strictEqual(r.ev.attempt.length, 0);
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
/** a reciter who listens to the app: verse by verse; when it stopped at a word ("not heard", "a word is missing"),
    the verse again from the word it names. Returns how often a verse had to be read again. */
const AGAIN = new Set(['unheard', 'misheard', 'missing', 'wrong', 'open', 'where']);
function reciteListening(t, s, a1, a2, nz, chunk) {
  let last = null;
  t.on('say', e => { if (AGAIN.has(e.type)) last = e; });
  t.on('attempt', () => { if (!last) last = { from: Math.min(t.pointer, Q.words.length - 1), attempt: true }; });
  let rereads = 0;
  for (let a = a1; a <= a2; a++) {
    const ws = words(s, a);
    last = null;
    say(t, noisy(ws, nz), chunk(), true);
    for (let k = 0; k < 6 && last; k++) {
      // the app names a word (or, after a failed attempt, the verse it waits for): start there; the simple text may have
      // a word more or less than the mushaf, so start proportionally
      const at = last.attempt ? Q.verseStart[Q.words[last.from].v] : last.from != null ? last.from : last.g;
      const va = Q.words[at].v, w0 = Q.verseStart[va], w1 = Q.verseStart[va + 1];
      const wsA = simple[String(Q.verseSurah[va])][Q.verseAyah[va] - 1].text.split(' ').slice(Q.verseAyah[va] === 1 && Q.verseSurah[va] !== 1 && Q.verseSurah[va] !== 9 ? 4 : 0);
      const i0 = Math.max(0, Math.min(wsA.length - 1, Math.floor((at - w0) * wsA.length / (w1 - w0))));
      rereads++;
      last = null;
      say(t, noisy(wsA.slice(i0), nz), chunk(), true);
      // the verse that was open is complete now: go on from there to the verse being read
      for (let b = Q.verseAyah[va] + 1; b <= a && !last; b++) say(t, noisy(words(s, b), nz), chunk(), true);
    }
  }
  return rereads;
}
test('M12 recogniser noise while reciting correctly: (almost) no false attempts, the reciter is asked again now and then', () => {
  // strictness 0 is what the app uses (only words left out stop it), 1 also stops at a word heard as another word
  const rate = {};
  for (const k of [0, 1]) {
    let attempts = 0, total = 0, rereads = 0, accepted = 0;
    const lines = [], stuck = [];
    for (const [s, a1, a2] of [[67, 1, 30], [18, 1, 30], [2, 1, 25], [36, 1, 40], [55, 1, 40], [78, 1, 40], [77, 1, 30], [26, 100, 140], [94, 1, 8], [102, 1, 8], [109, 1, 6], [112, 1, 4], [114, 1, 6], [20, 1, 30]]) {
      for (const nz of [{ drop: 0.03, garble: 0.04, merge: 0.03 }, { drop: 0.06, garble: 0.08, merge: 0.04 }]) {
        const { t, ev } = tracker(s, a1, a2);
        t.opts.strictness = k;
        let acc = 0;
        t.on('say', e => { if (e.type === 'accept') acc++; });
        if (process.env.DEBUG_M12 === `${k}:${s}:${a1}:${nz.drop}`) {
          t.on('say', e => console.log('   say', e.type, refOf(e.g) + '#' + Q.words[e.g].k, 'from', e.from != null ? Q.words[e.from].k : '-', e.heard || ''));
          t.on('attempt', e => console.log('   ATTEMPT', e.kind, e.fail && e.fail.pos != null ? refOf(e.fail.pos) : ''));
          t.on('verseDone', e => console.log('   done', refOf(Q.verseStart[e.v]), e.issues.length ? JSON.stringify(e.issues.map(i => i.st)) : ''));
          const f0 = t.feed.bind(t); t.feed = (fi, int) => { if (!int) console.log('  feed', fi[fi.length - 1], '| ptr', refOf(Math.min(t.pointer, Q.words.length - 1)) + '#' + Q.words[Math.min(t.pointer, Q.words.length - 1)].k, t.spot ? 'spot ' + refOf(t.spot.g) + '#' + Q.words[t.spot.g].k + ' n' + t.spot.n + ' reach ' + refOf(Math.min(t.spot.reach, Q.words.length - 1)) + '#' + Q.words[Math.min(t.spot.reach, Q.words.length - 1)].k : '', t.pend.length ? 'pend ' + t.pend.map(x => x.raw).join(' ') : '', t.carry.length ? 'carry ' + t.carry.map(x => x.raw).join(' ') : ''); return f0(fi, int); };
        }
        const rr = reciteListening(t, s, a1, a2, nz, () => 4 + Math.floor(rnd() * 4));
        const n = Q.verseStart[vIndex(s, a2) + 1] - gOf(s, a1);
        attempts += ev.attempt.length; total += n; rereads += rr; accepted += acc;
        const end = Q.verseStart[vIndex(s, a2) + 1];
        lines.push(`${s}:${a1}-${a2} noise ${nz.drop}: attempts ${ev.attempt.length}, hints ${ev.hint.length}, read again ${rr}, let through ${acc}, ${t.pointer >= end ? 'end reached' : 'stuck at ' + refOf(t.pointer)}`);
        if (t.pointer < end) stuck.push(lines[lines.length - 1]);
      }
    }
    if (process.env.M12_LINES) console.log('      ' + lines.join('\n      '));
    assert(!stuck.length, `strictness ${k}: ` + stuck.join('; '));
    rate[k] = rereads / total;
    console.log(`      strictness ${k}: read again ${rereads} times in ${total} words (${(100 * rereads / total).toFixed(1)} per 100), let through ${accepted}, false attempts ${attempts}`);
    assert(attempts / total < 0.004, `false attempts: ${attempts} in ${total} words`);
  }
  assert(rate[0] <= rate[1], 'the relaxed level asks more often than the normal one');
});

console.log(passed + ' passed');
