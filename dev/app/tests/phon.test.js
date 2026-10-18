// The recogniser on the phone, from its units to the Tracker: what the Quran Lab model heard in real recitations
// (EveryAyah, per ayah, testdata/phon-ref.json) goes through PhonDecoder in chunks of 0.48 s, as asr/worker.js
// delivers it, and on into the Tracker, as the app does it.
// Run: node dev/app/tests/phon.test.js quran.json asr/model/words.json asr/model/tokens.txt dev/testdata/phon-ref.json [-v]
// Checked: every word read is heard and none reported missing; a word or verse left out is not heard; the place is
// found when the reciter starts anywhere; isti'adha and basmala are named, not searched; noise between verses is
// not taken for words.
const fs = require('fs');
const QC = require('../core.js');
const [,, quranPath, wordsPath, tokensPath, refPath] = process.argv;
const VERBOSE = process.argv.includes('-v');
const quran = JSON.parse(fs.readFileSync(quranPath, 'utf8'));
const Q = QC.buildWords(quran);
const wj = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const data = { units: Uint8Array.from(Buffer.from(wj.units, 'base64')), count: Uint8Array.from(Buffer.from(wj.count, 'base64')) };
const tokens = [];
for (const ln of fs.readFileSync(tokensPath, 'utf8').split('\n')) { const i = ln.lastIndexOf(' '); if (i > 0) tokens[+ln.slice(i + 1)] = ln.slice(0, i); }
const ref = JSON.parse(fs.readFileSync(refPath, 'utf8')).clips;
const dec0 = new QC.PhonDecoder(Q, data, tokens);
const ST = QC.ST;
const gOf = (s, a) => Q.verseStart[quran.surahs[s - 1].start + a - 1];
const refOf = g => { const v = Q.words[Math.min(g, Q.words.length - 1)].v; return Q.verseSurah[v] + ':' + Q.verseAyah[v] + '#' + (g - Q.verseStart[v] + 1); };
let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) ok = false; };

/** pieces: [{units, times}] one after the other, as one stream (a pause of `gap` seconds between them) */
function stream(pieces, gap) {
  const out = []; let t0 = 0;
  for (const p of pieces) {
    for (let i = 0; i < p.u.length; i++) out.push({ id: p.u[i], t: t0 + p.t[i], p: 0.99 });
    t0 += (p.t.length ? p.t[p.t.length - 1] : 0) + (p.tail != null ? p.tail : 0.6) + (gap || 0);
  }
  return { units: out, end: t0 };
}
const clip = (r, s, a) => ref[r + '/' + s + ':' + a];
function verses(r, s, a1, a2, skip) { const out = []; for (let a = a1; a <= a2; a++) if (!(skip || []).includes(a)) out.push(clip(r, s, a)); return out; }
/** units of a phrase, as the model writes it (the decoder's own phrase units, times spread over its length) */
function phrase(name) { const P = dec0.phrases.find(p => p.name === name); return { u: Array.from(P.u), t: P.u.map((_, i) => 0.12 * i) }; }

/** the app's bridge: chunks of 0.48 s into the decoder, its words into the Tracker as one long session */
function run(st, g0, opts) {
  opts = opts || {};
  const t = new QC.Tracker(Q, { strictness: 0 });
  t.reset(g0, { search: !!opts.search });
  const dec = new QC.PhonDecoder(Q, data, tokens);
  dec.ix = dec0.ix; dec.plain = dec0.plain;
  dec.reset(opts.search ? -1 : g0);
  const ev = [];
  t.on('found', e => ev.push('found ' + refOf(e.to)));
  t.on('jump', e => ev.push('jump ' + refOf(e.to)));
  t.on('phrase', e => ev.push('phrase ' + e.name));
  let finals = [];
  const take = r => {
    if (r.text) finals.push(r.text);
    if (r.text || r.interim || t.tentative.size) t.feed(finals, r.interim);
    if (finals.length > 24 && !r.interim) { t.rollSession(); finals = []; }
    if (VERBOSE && (r.text || r.jump || r.phrase)) console.log('   ', r.phrase ? 'phrase ' + r.phrase : '', r.jump ? 'jump' : '', r.text, '|', r.interim, '-> ptr', refOf(t.pointer), t.mode);
  };
  let k = 0;
  for (let c = 0.48; c < st.end + 0.48; c += 0.48) {
    const chunk = [];
    while (k < st.units.length && st.units[k].t < c) chunk.push(st.units[k++]);
    dec.push(chunk);
    take(dec.step(t.pointer, t.mode === 'search', false));
  }
  for (let i = 0; i < 4; i++) take(dec.step(t.pointer, t.mode === 'search', true));
  t.feed(finals, '');
  return { t, ev };
}
function words(t, ga, gb) {
  let heard = 0, missed = [];
  for (let g = ga; g <= gb; g++) { if (t.status[g] === ST.OK || t.status[g] === ST.CORRECTED) heard++; else missed.push(refOf(g) + ':' + t.status[g]); }
  return { heard, n: gb - ga + 1, missed };
}
const lastG = (s, a) => gOf(s, a + 1) - 1;

// 1. straight reading, three reciters
for (const r of ['Alafasy', 'Husary', 'Maher']) {
  for (const [s, a1, a2] of [[1, 1, 7], [67, 1, 30], [112, 1, 4], [114, 1, 6]]) {
    const v = verses(r, s, a1, a2);
    if (v.some(x => !x)) continue;
    const { t } = run(stream(v), gOf(s, a1));
    const w = words(t, gOf(s, a1), lastG(s, a2));
    check(w.missed.length === 0 && t.pointer > lastG(s, a2), `${r} ${s}:${a1}-${a2}: ${w.heard}/${w.n} words heard${w.missed.length ? ', not heard: ' + w.missed.slice(0, 6).join(' ') : ''}, pointer ${refOf(t.pointer)}`);
  }
}
// 2. starting anywhere: the place is found (al-Mulk 5-12 with al-Baqara in view)
for (const r of ['Alafasy', 'Husary']) {
  const { t, ev } = run(stream(verses(r, 67, 5, 12)), gOf(2, 1), { search: true });
  const w = words(t, gOf(67, 7), lastG(67, 12));
  check(t.mode === 'track' && ev.some(e => /found 67:5/.test(e)) && w.missed.length === 0, `${r}: started at al-Mulk 5 with al-Baqara in view: ${ev.join(', ')}; 67:7-12 ${w.heard}/${w.n} heard`);
}
// 3. a verse left out: its words are not heard (the Tracker jumps or reports them)
for (const r of ['Alafasy', 'Husary']) {
  const { t } = run(stream(verses(r, 67, 1, 10, [5])), gOf(67, 1));
  const w5 = words(t, gOf(67, 5), lastG(67, 5)), rest = words(t, gOf(67, 6), lastG(67, 10));
  check(w5.heard === 0 && rest.missed.length === 0, `${r}: al-Mulk 1-10 without verse 5: verse 5 ${w5.heard}/${w5.n} heard, 6-10 ${rest.heard}/${rest.n}`);
}
// 4. a word left out: its units cut from the stream
for (const r of ['Alafasy', 'Husary']) {
  // al-Mulk 2, the third word (ٱلۡمَوۡتَ): cut the units the decoder expects for it out of what the model heard
  const v = verses(r, 67, 1, 4).map(x => ({ u: x.u.slice(), t: x.t.slice() }));
  const g = gOf(67, 2) + 2, want = Array.from(dec0.unitsOf(g));
  const c = v[1], s = dec0.toUnits('').length;
  void s;
  // find the expected units in the heard ones (consonants in order) and cut that stretch
  let i0 = -1;
  for (let i = 0; i + 2 < c.u.length && i0 < 0; i++) if (dec0.base[c.u[i]] === dec0.base[want.find(u => dec0.kind[u] === 0)] && dec0.base[c.u[i + 1]] === dec0.base[want.filter(u => dec0.kind[u] === 0)[1]]) i0 = i;
  if (i0 >= 0) { c.u.splice(i0, want.length); c.t.splice(i0, want.length); }
  const { t } = run(stream(v), gOf(67, 1));
  const st = t.status[g];
  const others = words(t, gOf(67, 1), lastG(67, 4));
  check(i0 >= 0 && st !== ST.OK && others.missed.length === 1, `${r}: ${refOf(g)} cut out (${want.map(u => tokens[u]).join(' ')}): status ${st}; ${others.heard}/${others.n} of 67:1-4 heard`);
}
// 5. isti'adha and basmala before al-Mulk: named, not searched, then al-Mulk followed
for (const r of ['Alafasy', 'Husary']) {
  const { t, ev } = run(stream([phrase('isti'), phrase('basm')].concat(verses(r, 67, 1, 5)), 0.4), gOf(67, 1));
  const w = words(t, gOf(67, 1), lastG(67, 5));
  check(ev.includes('phrase isti') && ev.includes('phrase basm') && !ev.some(e => /found|jump/.test(e)) && w.missed.length === 0, `${r}: isti'adha, basmala, al-Mulk 1-5: ${ev.join(', ') || '-'}; ${w.heard}/${w.n} heard`);
}
// 6. noise between verses (units that are no text): no word taken from it, the reading goes on
for (const r of ['Alafasy', 'Husary']) {
  let sd = 3; const rnd = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const noise = () => { const n = 4 + Math.floor(rnd() * 5), u = [], t = []; for (let i = 0; i < n; i++) { u.push(Math.floor(rnd() * 250)); t.push(0.15 * i); } return { u, t }; };
  const v = verses(r, 67, 1, 8), mixed = [];
  v.forEach((x, i) => { mixed.push(x); if (i % 2) mixed.push(noise()); });
  const { t, ev } = run(stream(mixed), gOf(67, 1));
  const w = words(t, gOf(67, 1), lastG(67, 8));
  check(w.missed.length === 0 && !ev.some(e => /jump/.test(e)), `${r}: al-Mulk 1-8 with noise after every second verse: ${w.heard}/${w.n} heard${w.missed.length ? ', not heard: ' + w.missed.join(' ') : ''} ${ev.join(', ')}`);
}
console.log(ok ? 'ok   phon' : 'FAIL phon');
process.exitCode = ok ? 0 : 1;
