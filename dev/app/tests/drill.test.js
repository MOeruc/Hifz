// Learning with counting: a step said again and again, and every time counted. The step as a text of copies
// (hifzplan.js drillText), the recogniser's results through core.js Repeats into a Tracker, the times passed counted
// as the app does it (drillPassed, drillCounts). With the browser's recogniser as it behaves on a phone and on a
// computer (a session per time, one long session, phones that send every result again with all before it, a result
// sent twice, the first word lost, recognition errors), and with the recogniser on the phone (Quran Lab's model, what
// it heard in real recitations, testdata/phon-ref.json).
// Run: node tests/drill.test.js QURAN_JSON SIMPLE_CLEAN_JSON WORDS_JSON TOKENS_TXT PHON_REF_JSON
const fs = require('fs');
const assert = require('assert');
const QC = require('../core.js');
const P = require('../hifzplan.js');
const [,, quranPath, simplePath, wordsPath, tokensPath, refPath] = process.argv;
const quran = JSON.parse(fs.readFileSync(quranPath, 'utf8'));
const simple = JSON.parse(fs.readFileSync(simplePath, 'utf8'));
const Q = QC.buildWords(quran), ST = QC.ST;
const HEARD = new Set([ST.OK, ST.CORRECTED, ST.NEAR, ST.LETTER, ST.MADD, ST.HINT]);
const vi = (s, a) => quran.surahs[s - 1].start + a - 1;
const span = (s, a1, a2) => [Q.verseStart[vi(s, a1)], Q.verseStart[vi(s, a2) + 1] - 1];
/** a verse as the browser's recogniser writes it */
function said(s, a) { let w = simple[String(s)][a - 1].text.split(' '); if (a === 1 && s !== 1 && s !== 9) w = w.slice(4); return w.join(' '); }
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const letters = 'بتثجحخدذرزسشصضطظعغفقكلمنهوي';
const garble = w => { const p = 1 + Math.floor(rnd() * (w.length - 1)); return w.slice(0, p) + letters[Math.floor(rnd() * letters.length)] + w.slice(p + 1); };
const respell = w => (rnd() < 0.5 ? w.replace(/^ا/, 'أ').replace(/ى$/, 'ي').replace(/ة$/, 'ه') : w.length > 3 ? garble(w) : w);

/** a step of the drill: its text (copies), a Tracker, Repeats, and the times counted as the app counts them */
function step(ranges, copies) {
  const q = P.drillText(Q, ranges, copies);
  const t = new QC.Tracker(q, { strictness: 0 });
  t.reset(0, { bounds: [0, q.words.length - 1], strict: false, help: { on: false } });
  const o = { q, t, rep: new QC.Repeats(), lap: 0, counted: 0, marks: [], clock: 0 };
  t.on('update', () => {
    for (const x of P.drillPassed(q, t.pointer, o.lap, g => HEARD.has(t.status[g]))) {
      o.lap = x.r + 1;
      if (P.drillCounts(x)) { o.counted++; o.marks.push(x.heard < x.len ? 'g' : 'c'); } else o.marks.push('-');
    }
  });
  o.result = (finals, interim) => { const r = o.rep.push(finals, interim, o.clock); t.feed(r.finals, r.interim); };
  // the app: when the recogniser's session ends, and after a pause in the session, words held back are settled
  o.restart = () => { t.settle(); o.rep.reset(); t.newSession(); };
  o.pause = () => t.settle();
  return o;
}
/**
 * The browser's recogniser: sessions, each a list of utterances (one final result each, the interim text growing word
 * by word before it). opts: cum (every result again with all before it, earlier words respelled now and then), dup
 * (every final result sent twice), clip (the first word of a session lost), noise (share of words misheard)
 */
function speak(o, sessions, opts) {
  opts = opts || {};
  for (const sess of sessions) {
    o.restart();
    let finals = [], before = [];
    sess.forEach((u, i) => {
      let w = u.split(' ');
      if (i === 0 && opts.clip && w.length > 1) w = w.slice(1);
      if (opts.noise) w = w.map(x => (rnd() < opts.noise && x.length > 2 ? garble(x) : x));
      o.clock += 300;
      const prev = opts.cum ? before.map(x => (rnd() < 0.1 ? respell(x) : x)) : [];
      for (let k = 1; k <= w.length; k++) { o.result(finals, prev.concat(w.slice(0, k)).join(' ')); o.clock += 320; }
      before = before.concat(w);
      finals = finals.concat([(opts.cum ? prev.concat(w) : w).join(' ')]);
      o.result(finals, '');
      if (opts.dup) { o.clock += 20; finals = finals.concat([finals[finals.length - 1]]); o.result(finals, ''); }
      o.clock += 700;
    });
  }
  o.pause();
  return o;
}
const times = (n, x) => Array.from({ length: n }, () => x);

let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n     ', e.message); process.exitCode = 1; } }

const V = said(67, 2), Vw = V.split(' ');
const R67 = [span(67, 2, 2)];

test('a session for every time (a phone that stops listening at every pause): 20 of 20', () => {
  const o = speak(step(R67, 24), times(20, [V]));
  assert.strictEqual(o.counted, 20); assert(o.marks.every(m => m === 'c'), o.marks.join(''));
});
test('one long session, a result for every time (a computer): 5 of 5, nothing taken for a result sent again', () => {
  QC.Repeats.cum = null;
  const o = speak(step(R67, 9), [times(5, V)]);
  assert.strictEqual(o.counted, 5);
  assert.strictEqual(QC.Repeats.cum, false, 'not a phone that sends everything again');
});
test('a phone that sends every result again with all before it (earlier words a little different): 5 of 5', () => {
  QC.Repeats.cum = null;
  const o = speak(step(R67, 9), [times(5, V)], { cum: true });
  assert.strictEqual(o.counted, 5, o.marks.join(''));
  assert.strictEqual(QC.Repeats.cum, true);
  QC.Repeats.cum = null;
});
test('every result sent twice: still 5, not 10', () => {
  QC.Repeats.cum = null;
  const o = speak(step(R67, 14), [times(5, V)], { dup: true });
  assert.strictEqual(o.counted, 5);
});
test('two times in one result, without a pause: 2', () => {
  const o = speak(step(R67, 6), [[V + ' ' + V]]);
  assert.strictEqual(o.counted, 2);
});
test('a stumble: begun, begun again from the start, said to the end: once', () => {
  const half = Vw.slice(0, 5).join(' ');
  assert.strictEqual(speak(step(R67, 6), [[half], [V]]).counted, 1);
  assert.strictEqual(speak(step(R67, 6), [[half, V]]).counted, 1);
  assert.strictEqual(speak(step(R67, 6), [[half], [half]]).counted, 0, 'half twice is not a time');
});
test('the first word of every session lost before the recogniser listens: counted, nothing missed', () => {
  const o = speak(step(R67, 9), times(5, [V]), { clip: true });
  assert.strictEqual(o.counted, 5); assert(o.marks.every(m => m === 'c'), o.marks.join(''));
});
test('a word left out every time: counted, with a gap; only the last words said: not counted', () => {
  const o = speak(step(R67, 7), times(3, [Vw.filter((_, i) => i !== 4).join(' ')]));
  assert.strictEqual(o.counted, 3); assert(o.marks.every(m => m === 'g'), o.marks.join(''));
  const e = speak(step(R67, 6), [[Vw.slice(-3).join(' ')]]);
  assert.strictEqual(e.counted, 0, e.marks.join(''));
});
test('recognition errors (15 % of the words misheard): every time counted', () => {
  seed = 11;
  const o = speak(step(R67, 13), times(10, [V]), { noise: 0.15 });
  assert.strictEqual(o.counted, 10, o.marks.join(''));
});
test('four verses together, said verse by verse (a result each), in one session and in many', () => {
  const R = [span(112, 1, 4)], G = [1, 2, 3, 4].map(a => said(112, a));
  assert.strictEqual(speak(step(R, 9), [[].concat(...times(5, G))]).counted, 5);
  assert.strictEqual(speak(step(R, 9), times(5, G)).counted, 5);
  QC.Repeats.cum = null;
  assert.strictEqual(speak(step(R, 9), [[].concat(...times(5, G))], { cum: true }).counted, 5);
  QC.Repeats.cum = null;
});
test('short verses (al-Ikhlas 1, ar-Rahman 64: one word): 10 of 10, in one session too', () => {
  for (const [s, a] of [[112, 1], [55, 64]]) {
    QC.Repeats.cum = null;
    assert.strictEqual(speak(step([span(s, a, a)], 14), [times(10, said(s, a))]).counted, 10, `${s}:${a} in one session`);
    assert.strictEqual(speak(step([span(s, a, a)], 14), times(10, [said(s, a)])).counted, 10, `${s}:${a} a session each`);
  }
  QC.Repeats.cum = null;
  assert.strictEqual(speak(step([span(112, 1, 1)], 14), [times(10, said(112, 1))], { cum: true }).counted, 10, 'cumulative');
  QC.Repeats.cum = null;
});
test('a piece of a long verse (2:282, the first line or two): 5 of 5', () => {
  const ps = P.pieces(Q, vi(2, 282));
  const first = said(2, 282).split(' ').slice(0, ps[0][1] - ps[0][0] + 2).join(' ');   // يا أيها: one word in the mushaf
  assert.strictEqual(speak(step([ps[0]], 9), times(5, [first])).counted, 5);
});

test('40 recitations each with other misheard and respelled words: every count right', () => {
  const G4 = n => [1, 2, 3, 4].map(a => said(n, a));
  const cases = [
    ['al-Ikhlas 1-4 verse by verse, a phone that sends all again', [span(112, 1, 4)], 9, () => [[].concat(...times(5, G4(112)))], { cum: true }, 5],
    ['al-Ikhlas 2 (two words), a phone that sends all again', [span(112, 2, 2)], 14, () => [times(10, said(112, 2))], { cum: true }, 10],
    ['ar-Rahman 64 (one word), a phone that sends all again', [span(55, 64, 64)], 14, () => [times(10, said(55, 64))], { cum: true }, 10],
    ['al-Mulk 2, a phone that sends all again, misheard words', [span(67, 2, 2)], 12, () => [times(8, said(67, 2))], { cum: true, noise: 0.1 }, 8],
    ['al-Mulk 2, a session each, first word lost, misheard words', [span(67, 2, 2)], 12, () => times(8, [said(67, 2)]), { clip: true, noise: 0.15 }, 8],
    ['al-Mulk 1-4 verse by verse, misheard words', [span(67, 1, 4)], 7, () => [[].concat(...times(4, G4(67)))], { noise: 0.15 }, 4],
    ['al-Mulk 1-4 verse by verse, all again, misheard words', [span(67, 1, 4)], 7, () => [[].concat(...times(4, G4(67)))], { cum: true, noise: 0.1 }, 4],
  ];
  for (const [name, R, copies, sess, opts, want] of cases) {
    const wrong = [];
    for (let sd = 1; sd <= 40; sd++) {
      seed = sd; QC.Repeats.cum = null;
      const o = speak(step(R, copies), sess(), opts);
      if (o.counted !== want) wrong.push(`seed ${sd}: ${o.counted}`);
    }
    assert.deepStrictEqual(wrong, [], name);
  }
  QC.Repeats.cum = null;
});

// ------------------------------------------------------------------ the recogniser on the phone
const wj = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const data = { units: Uint8Array.from(Buffer.from(wj.units, 'base64')), count: Uint8Array.from(Buffer.from(wj.count, 'base64')) };
const tokens = [];
for (const ln of fs.readFileSync(tokensPath, 'utf8').split('\n')) { const i = ln.lastIndexOf(' '); if (i > 0) tokens[+ln.slice(i + 1)] = ln.slice(0, i); }
const ref = JSON.parse(fs.readFileSync(refPath, 'utf8')).clips;
const base = new QC.PhonDecoder(Q, data, tokens);
/** what the model heard, as one stream: clips one after the other, a pause of `gap` seconds between them */
function stream(clips, gap) {
  const out = []; let t0 = 0;
  for (const c of clips) {
    for (let i = 0; i < c.u.length; i++) out.push({ id: c.u[i], t: t0 + c.t[i], p: 0.99 });
    t0 += (c.t.length ? c.t[c.t.length - 1] : 0) + 0.6 + gap;
  }
  return { units: out, end: t0 };
}
/** as ModelSpeech does it: chunks of 0.48 s into the decoder of the step's text, its words through Repeats */
function hear(o, st) {
  const dec = new QC.PhonDecoder(o.q, P.drillUnits(o.q, g => base.unitsOf(g)), base.tokens);
  dec.reset(o.t.pointer);
  let finals = [], quiet = 0, k = 0;
  const take = force => {
    const r = dec.step(o.t.pointer, false, force);
    if (r.text) finals.push(r.text);
    o.clock += 480;
    o.result(finals.slice(), r.interim);
    if (finals.length > 24 && !r.interim) { o.t.rollSession(); finals = []; }
  };
  for (let c = 0.48; c < st.end + 0.48; c += 0.48) {
    const chunk = [];
    while (k < st.units.length && st.units[k].t < c) chunk.push(st.units[k++]);
    if (chunk.length) { dec.push(chunk); quiet = 0; } else quiet += 12;
    take(quiet >= 24);
  }
  for (let i = 0; i < 4; i++) take(true);
  o.pause();
  return o;
}
test('the recogniser on the phone: al-Ikhlas 1 five times, al-Mulk 2 three times, al-Ikhlas 1-3 together, three reciters', () => {
  for (const r of ['Alafasy', 'Husary', 'Maher']) {
    const c1 = ref[r + '/112:1'], c2 = ref[r + '/67:2'];
    let o = hear(step([span(112, 1, 1)], 9), stream(times(5, c1), 0.8));
    assert.strictEqual(o.counted, 5, `${r} 112:1: ${o.counted} (${o.marks.join('')})`);
    o = hear(step([span(67, 2, 2)], 7), stream(times(3, c2), 0.8));
    assert.strictEqual(o.counted, 3, `${r} 67:2: ${o.counted} (${o.marks.join('')})`);
    const g = [1, 2, 3].map(a => ref[r + '/112:' + a]);
    o = hear(step([span(112, 1, 3)], 7), stream([].concat(...times(3, g)), 0.5));
    assert.strictEqual(o.counted, 3, `${r} 112:1-3: ${o.counted} (${o.marks.join('')})`);
  }
});
test('the recogniser on the phone: three times without a pause between them', () => {
  const o = hear(step([span(112, 1, 1)], 7), stream(times(3, ref['Alafasy/112:1']), 0));
  assert.strictEqual(o.counted, 3, o.marks.join(''));
});

console.log(`${passed} drill tests passed`);
