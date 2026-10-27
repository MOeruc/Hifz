// The vocabulary engine (vocab.js): FSRS-6 against the reference implementation py-fsrs, the words of a surah, and the
// order of a learning session; with the data files also 60 days of a simulated learner on the real Quran.
// Run: node tests/vocab.test.js FSRS_REF_JSON [QURAN_JSON LEX_JSON WORDS_JSON]
const fs = require('fs');
const assert = require('assert');
const V = require('../vocab.js');
const ref = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok  ', name); };

ok('FSRS-6: stability, difficulty and interval as py-fsrs', () => {
  for (const steps of ref.scenarios) {
    let c = null;
    for (const st of steps) {
      c = V.review(c, st.g, st.day);
      assert(Math.abs(c.s - st.s) < 1e-9 * Math.max(1, st.s), `s ${c.s} != ${st.s} (day ${st.day}, grade ${st.g})`);
      assert(Math.abs(c.d - st.d) < 1e-9, `d ${c.d} != ${st.d} (day ${st.day}, grade ${st.g})`);
      if (st.g !== V.AGAIN) assert.strictEqual(V.interval(c.s), st.ivl, `interval on day ${st.day}`);
      else assert.strictEqual(c.due, st.day, 'not recalled: again today');
    }
  }
});

ok('FSRS-6: 90 % recall after one stability, less later', () => {
  assert(Math.abs(V.retrievability(10, 10) - 0.9) < 1e-12);
  assert(V.retrievability(20, 10) < 0.9 && V.retrievability(5, 10) > 0.9 && V.retrievability(0, 10) === 1);
});

ok('a new word: again today, hard 1 day, good 2 days, easy 8 days', () => {
  assert.deepStrictEqual(V.preview(null, 100, 'x'), [0, 1, 2, 8]);
  const c = V.review(null, V.GOOD, 100, 7);
  assert.strictEqual(c.n, 1); assert.strictEqual(c.a, 100); assert.strictEqual(c.last, 100); assert.strictEqual(c.due, 102);
  assert.strictEqual(V.status(c), 'learn'); assert.strictEqual(V.status(null), 'new');
});

ok('fuzz: same seed same day, within the FSRS range, never below 2 days', () => {
  for (const ivl of [3, 5, 10, 30, 100, 400]) {
    const a = V.fuzz(ivl, 'w1'), b = V.fuzz(ivl, 'w1');
    assert.strictEqual(a, b);
    assert(a >= 2 && Math.abs(a - ivl) <= Math.max(1, Math.ceil(ivl * 0.1) + 2), `${ivl} -> ${a}`);
  }
  assert.strictEqual(V.fuzz(2, 'z'), 2);
  const seen = new Set(); for (let k = 0; k < 40; k++) seen.add(V.fuzz(30, 'id' + k));
  assert(seen.size > 3, 'words learnt together come back on different days');
});

ok('a word forgotten after it was learnt counts as a lapse; same-day relearning keeps the lapse count', () => {
  let c = V.review(null, V.GOOD, 0);
  c = V.review(c, V.GOOD, c.due);
  const s = c.s;
  c = V.review(c, V.AGAIN, c.due + 3);
  assert.strictEqual(c.l, 1); assert(c.s < s); assert.strictEqual(c.due, c.last);
  c = V.review(c, V.GOOD, c.last);
  assert.strictEqual(c.l, 1); assert(c.due > c.last);
});

ok('cards of the old scheduler become FSRS cards', () => {
  const m = V.migrate({ i: 6, e: 2.5, n: 3, l: 1, a: 10, d: 30 }, 28);
  assert.deepStrictEqual(m, { s: 6, d: 5, last: 24, due: 30, n: 3, l: 1, a: 10, c: {} });
  const hard = V.migrate({ i: 0, e: 1.3, n: 1, l: 1, a: 5, d: 5 }, 9);
  assert.strictEqual(hard.s, 0.5); assert.strictEqual(hard.d, 9); assert.strictEqual(hard.due, 5);
  const fresh = V.review(null, 3, 1);
  assert.strictEqual(V.migrate(fresh, 2), fresh);
});

ok('a lemma learnt as two words: progress of a surah that has only the new word moves to it', () => {
  // دِين: "Religion" (id 12) and "Gericht" (id 90, يَوۡمِ ٱلدِّينِ). Surah 1 has only "Gericht", surah 2 both, surah 109 only "Religion"
  const has = { 1: [90], 2: [12, 90], 109: [12] };
  const H = (n, id) => (has[n] || []).indexOf(id) >= 0;
  const card = c => ({ s: 3, d: 5, last: 10, due: 13, n: 2, l: 0, a: 5, c });
  let cards = { 12: card({ 1: 10 }) };
  assert(V.migrateSplit(cards, { 90: 12 }, H));
  assert.deepStrictEqual(Object.keys(cards), ['90']);              // learnt only in al-Fatiha: it was "Gericht" all along
  assert.deepStrictEqual(cards[90].c, { 1: 10 }); assert.strictEqual(cards[90].s, 3);
  cards = { 12: card({ 1: 10, 2: 11, 109: 12 }) };
  assert(V.migrateSplit(cards, { 90: 12 }, H));
  assert.deepStrictEqual(cards[12].c, { 2: 11, 109: 12 }); assert.deepStrictEqual(cards[90].c, { 1: 10 });
  assert(!V.migrateSplit(cards, { 90: 12 }, H), 'a second run changes nothing');
  cards = { 12: card({ 109: 12 }) };
  assert(!V.migrateSplit(cards, { 90: 12 }, H)); assert.deepStrictEqual(Object.keys(cards), ['12']);
});

// a small "surah": verses of words, each word with an item (or -1)
const words = [[10, 11, -1], [12, 10], [13, 14, 12, 15], [16], [-1]];
const itemOf = [], verseOf = [];
words.forEach((ws, v) => ws.forEach(id => { itemOf.push(id); verseOf.push(v); }));
const idx = V.surahIndex(0, itemOf.length, g => itemOf[g], g => verseOf[g]);

ok('the words of a surah: in order of appearance, every occurrence, per verse', () => {
  assert.deepStrictEqual(idx.items, [10, 11, 12, 13, 14, 15, 16]);
  assert.deepStrictEqual(idx.occ.get(10), [0, 4]);
  assert.deepStrictEqual(idx.occ.get(12), [3, 7]);
  assert.deepStrictEqual(idx.verses.map(x => x.items), [[10, 11], [12, 10], [13, 14, 12, 15], [16], []]);
  assert.strictEqual(V.pickOccurrence(idx.occ.get(10), null), 0);
  assert.strictEqual(V.pickOccurrence(idx.occ.get(10), { n: 1 }), 4);
  assert.strictEqual(V.pickOccurrence(idx.occ.get(10), { n: 2 }), 0);
});

ok('a verse is understood when all its words are learnt; a verse of separate letters only is not counted', () => {
  const cards = { 10: {}, 11: {}, 12: {} };
  const p = V.verseProgress(idx, cards);
  assert.deepStrictEqual(p.per.map(x => x.done), [true, true, false, false, false]);
  assert.deepStrictEqual(p.per.map(x => x.none), [false, false, false, false, true]);
  assert.strictEqual(p.understood, 2); assert.strictEqual(p.total, 4);
  assert.strictEqual(V.verseProgress(idx, {}).understood, 0);
});

ok('plan: due words (most forgotten first), words from other surahs, new words without two of a family', () => {
  const day = 50;
  const cards = {
    10: { s: 10, d: 5, last: 40, due: 50, n: 2, c: { 7: 40 } },      // due, recall 90 %
    12: { s: 2, d: 5, last: 40, due: 45, n: 2, c: { 7: 40 } },       // overdue, recall lower
    13: { s: 30, d: 5, last: 45, due: 75, n: 3, c: { 2: 45 } },      // learnt in surah 2, not yet here
    14: { s: 30, d: 5, last: 45, due: 75, n: 3, c: { 7: 45 } },      // learnt here, not due
  };
  const fam = { 11: 'k-t-b', 15: 'k-t-b', 16: null };
  const p = V.plan(idx, cards, { day, n: 7, newLimit: 3, queued: [16], family: id => fam[id] || null });
  assert.deepStrictEqual(p.due, [12, 10]);
  assert.deepStrictEqual(p.again, [13]);
  assert.deepStrictEqual(p.fresh, [16, 11]);          // 16 marked first; 15 shares the root of 11: another day
  assert.strictEqual(p.newLeft, 1);
  const p0 = V.plan(idx, cards, { day, n: 7, newLimit: 0 });
  assert.deepStrictEqual(p0.fresh, []); assert.strictEqual(p0.newLeft, 3);
});

ok('session: reviews and new words mixed, a new word asked after its intro, a missed word again later', () => {
  const s = new V.Session({ due: [1, 2, 3], again: [4], fresh: [5, 6] });
  const seq = [];
  const grade = { 2: [V.AGAIN, V.GOOD], 5: [V.AGAIN, V.HARD] };
  let t, guard = 0;
  while ((t = s.next()) && guard++ < 50) {
    seq.push(t.id + (t.mode === 'intro' ? 'i' : t.retry ? 'r' : ''));
    if (t.mode === 'intro') s.answer(t, 'seen');
    else s.answer(t, (grade[t.id] && grade[t.id].length) ? grade[t.id].shift() : V.GOOD);
  }
  assert.deepStrictEqual(seq, ['1', '2', '5i', '3', '4', '2r', '5', '6i', '5r', '6']);
  assert.strictEqual(s.left, 0);
  assert.deepStrictEqual(s.stats, { reviewed: 4, learnt: 2, forgotten: 1, known: 0 });
  assert.strictEqual(s.done, s.total);
  // the distance between a word and its next appearance is at least LAG cards, while there are other cards
  const pos = id => seq.reduce((a, x, i) => (x.replace(/[ir]/g, '') === String(id) ? a.concat(i) : a), []);
  assert(pos(2)[1] - pos(2)[0] > V.LAG);
  assert(pos(5)[1] - pos(5)[0] > V.LAG);
});

ok('session: an intro answered "known" is not asked again; an empty plan has nothing', () => {
  const s = new V.Session({ due: [], again: [], fresh: [8, 9] });
  let t = s.next(); assert.deepStrictEqual([t.id, t.mode], [8, 'intro']); s.answer(t, 'known');
  t = s.next(); assert.deepStrictEqual([t.id, t.mode], [9, 'intro']); s.answer(t, 'seen');
  t = s.next(); assert.deepStrictEqual([t.id, t.mode], [9, 'test']); s.answer(t, V.GOOD);
  assert.strictEqual(s.next(), null);
  assert.strictEqual(s.done, s.total);
  assert.strictEqual(new V.Session({ due: [], again: [], fresh: [] }).next(), null);
});


// ------------------------------------------------------------------ 60 days of a learner on the real data
// node tests/vocab.test.js FSRS_REF QURAN_JSON LEX_JSON WORDS_JSON
if (process.argv[5]) {
  const QC = require('../core.js');
  const quran = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const lex = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
  const wd = JSON.parse(fs.readFileSync(process.argv[5], 'utf8')).words;
  const Q = QC.buildWords(quran);
  // the item of every word: the lemma of its main segment (the first that is neither prefix nor suffix), as app.js
  const main = Q.words.map(w => {
    const flat = wd[w.v] && wd[w.v][w.k];
    if (!flat || !flat.length) return -1;
    let first = -1;
    for (let i = 0; i < flat.length; i += 3) {
      const tags = lex.feats[flat[i + 1]].split('|').slice(1);
      if (tags.indexOf('PREF') < 0 && tags.indexOf('SUFF') < 0) { first = flat[i + 2]; break; }
    }
    if (first === -1 && flat.length) first = flat[2];
    return first >= 0 && lex.lemmas[first] && lex.lemmas[first][4] ? first : -1;
  });
  const idx = n => { const s = quran.surahs[n - 1]; return V.surahIndex(Q.verseStart[s.start], Q.verseStart[s.start + s.ayahs], g => main[g], g => Q.words[g].v); };
  ok('real data: every word of the Quran with a meaning has its item; no item without a meaning', () => {
    let words = 0, none = 0;
    for (let g = 0; g < Q.words.length; g++) { if (main[g] >= 0) words++; else none++; }
    assert(words > 77000, 'words with an item: ' + words);
    for (const s of quran.surahs) for (const id of idx(s.n).items) assert(lex.lemmas[id] && lex.lemmas[id][4], 'meaning of ' + id);
    // the forms of ذا and الَّذِي are words of their own; the old lemmas have no words left
    for (const old of Object.keys(lex.moved)) { assert.strictEqual(lex.lemmas[old], null); for (const id of lex.moved[old]) assert(lex.lemmas[id][3] > 0); }
    console.log(`     ${words} words with an item, ${none} without (separate letters such as الٓمٓ)`);
  });
  // the meaning a card shows: worded for its verse (lex.alt), else the meaning of its word, as glossOf in app.js
  const vref = [];
  for (const s of quran.surahs) for (let a = 1; a <= s.ayahs; a++) vref.push(s.n + ':' + a);
  const refOf = g => vref[Q.words[g].v] + ':' + (Q.words[g].k + 1);
  const gAt = r => { const [s, a, w] = r.split(':').map(Number); return Q.verseStart[quran.surahs[s - 1].start + a - 1] + w - 1; };
  const glossAt = g => lex.alt[refOf(g)] || (main[g] >= 0 ? lex.lemmas[main[g]][4] : '');
  ok('real data: every card shows the meaning of its own verse', () => {
    for (const l of lex.lemmas) if (l) assert(l[4].indexOf(';') < 0, 'a meaning with ";" mixes the verses of two meanings: ' + l[4]);
    for (const r of Object.keys(lex.alt)) { const g = gAt(r); assert.strictEqual(refOf(g), r); assert(main[g] >= 0, r); }
    for (const sid of Object.keys(lex.split)) {
      const base = lex.split[sid];
      assert.strictEqual(lex.lemmas[sid][0], lex.lemmas[base][0], 'a sense has the form of its lemma');
      assert.notStrictEqual(lex.lemmas[sid][4], lex.lemmas[base][4]);
    }
    const is = (r, re) => assert(re.test(glossAt(gAt(r))), `${r}: "${glossAt(gAt(r))}" should match ${re}`);
    const not = (r, re) => assert(!re.test(glossAt(gAt(r))), `${r}: "${glossAt(gAt(r))}" must not match ${re}`);
    // مَٰلِكِ يَوۡمِ ٱلدِّينِ: Allah, the Ruler of the Day of Judgement; Malik is the angel of 43:77, another word
    is('1:4:1', /^Herrscher, Besitzer$/); not('1:4:1', /Malik|Engel/);
    is('43:77:2', /Malik/); assert.notStrictEqual(main[gAt('43:77:2')], main[gAt('1:4:1')]);
    is('1:4:3', /Gericht/); is('109:6:4', /Religion/);
    // the names of Allah in 59:23 and 57:3, never the human meaning of the word
    for (const w of [10, 11, 14, 15]) { is('59:23:' + w, /Allah/); not('59:23:' + w, /gläubig|gewalttätig|hochmütig|Gruß/i); }
    is('57:3:2', /erste/i); is('57:3:3', /Letzte.*Allah/); is('57:3:4', /Offenbare.*Allah/); is('57:3:5', /Verborgene.*Allah/);
    is('112:1:4', /Einzige.*Allah/); not('112:1:4', /jemand/);
    // His attributes as the verse states them (Hand, Eyes, Face, rising over the Throne), no other meaning in their place
    is('48:10:7', /^Hand$/); is('5:64:3', /^Hand$/); is('5:64:12', /^Hand$/); is('38:75:9', /^Hand$/); is('11:37:3', /^Auge$/);
    is('55:27:2', /Angesicht/); is('20:5:4', /erheben/); is('7:54:12', /Thron/); is('2:255:42', /Thronschemel/);
    is('2:29:10', /zuwenden/); is('39:67:13', /Rechte/); is('20:5:3', /^Thron$/);
    is('6:12:11', /Selbst/); not('6:12:11', /Seele/); is('19:65:12', /gleich/i);
    // His actions against those who plot and mock: as an answer to them
    is('3:54:2', /Erwiderung/); is('86:16:1', /Erwiderung/); is('2:15:2', /Vergeltung/); is('9:79:15', /Vergeltung/);
    is('9:67:15', /verlassen/); is('2:37:6', /Reue annehmen/); is('2:222:25', /^Reumütige$/); is('59:23:13', /allmächtig/);
    not('2:26:4', /am Leben lassen/); is('52:28:8', /Gütige/); not('4:84:19', /schlimmer/); not('4:84:21', /schlimmer/);
    // people are not "allsehend", "allhörend", "allwissend"
    is('35:19:4', /^sehend$/); is('76:2:9', /^hörend$/); is('76:2:10', /^sehend$/); is('12:76:33', /^kenntnisreich$/); is('12:76:19', /Gesetz/);
    // particles: إِنَّمَا "nur", يَٰٓأَيُّهَا "o", the negating إِنۡ
    is('2:11:9', /^nur/); is('2:21:1', /^o /); is('2:6:1', /wahrlich/);
  });
  ok('real data: 60 days of learning al-Fatiha, al-Ikhlas, al-Mulk and Ya-Sin (a simulated learner)', () => {
    const cards = {};
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const plan = [[0, 1], [6, 112], [12, 67], [30, 36]];
    let again = 0, reviewsOther = 0;
    for (let day = 1000; day < 1060; day++) {
      const n = plan.filter(x => x[0] <= day - 1000).pop()[1];
      const ix = idx(n);
      const before = Object.keys(cards).length;
      const p = V.plan(ix, cards, { day, n, newLimit: 10 - Object.values(cards).filter(c => c.a === day).length, againLimit: 12, family: id => lex.lemmas[id][1] || null });
      for (const id of p.again) assert(cards[id] && !(cards[id].c[n] != null), 'again: learnt elsewhere');
      again += p.again.length;
      const s = new V.Session(p);
      const tested = new Set();
      let t, guard = 0;
      while ((t = s.next()) && guard++ < 2000) {
        assert(ix.occ.has(t.id), 'only words of the surah');
        if (t.mode === 'intro') { s.answer(t, 'seen'); continue; }
        const c = cards[t.id];
        const pr = c ? V.retrievability(day - c.last, c.s) : 0.75;
        const g = rnd() < pr ? (rnd() < 0.15 ? V.EASY : rnd() < 0.2 ? V.HARD : V.GOOD) : V.AGAIN;
        cards[t.id] = V.review(c, g, day, t.id);
        cards[t.id].c[n] = day;
        tested.add(t.id);
        s.answer(t, g);
      }
      assert(guard < 2000, 'the session ends');
      assert.strictEqual(s.left, 0);
      for (const id of tested) assert(cards[id].due > day, 'every word of the session is recalled once before it ends');
      assert(Object.values(cards).filter(c => c.a === day).length <= 10, 'at most 10 new words a day');
      assert(Object.keys(cards).length - before === p.fresh.length);
      // due words of the other surahs, each in its own surah
      const other = Object.keys(cards).map(Number).filter(id => cards[id].due <= day && !ix.occ.has(id));
      for (const id of other) { cards[id] = V.review(cards[id], rnd() < V.retrievability(day - cards[id].last, cards[id].s) ? V.GOOD : V.AGAIN, day, id); if (cards[id].due <= day) cards[id] = V.review(cards[id], V.GOOD, day, id); reviewsOther++; }
    }
    const per = n => V.verseProgress(idx(n), cards);
    for (const n of [1, 112, 67]) { const pv = per(n); assert.strictEqual(pv.understood, pv.total, `all verses of ${n} understood: ${pv.understood}/${pv.total}`); }
    assert(again > 5, 'words of earlier surahs were asked again in later ones: ' + again);
    const st = Object.values(cards);
    console.log(`     ${st.length} words learnt, ${st.filter(c => c.s >= V.KNOWN).length} known (21+ days), ${again} asked again in a new surah, ${reviewsOther} reviews in their own surah; Ya-Sin ${per(36).understood}/${per(36).total} verses`);
  });
}
console.log(`${n} vocabulary tests passed`);
