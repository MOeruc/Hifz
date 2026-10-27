/* Vocabulary engine of MyHifz: when a word comes back (FSRS-6), which words a surah has, and what a learning session
   asks in which order. Shared by the app (browser) and the tests (Node). No DOM access in here.

   How it learns, and why (sources in README.md):
   - a new word is shown with its meaning first, then asked a few cards later: the learner tries to recall it before
     seeing the answer again (Barcroft 2015; Karpicke & Roediger 2008)
   - asked again until it is recalled once in the session, then again on later days (successive relearning, Rawson &
     Dunlosky 2022); the days in between grow with every success (spacing, Cepeda et al. 2006; Nakata 2015), set by
     FSRS-6 (Ye, Su & Cao 2022; Su et al. 2023) for a probability of recall of 90 %
   - always inside a verse of the surah being learnt, a different one at each review where the surah has several
     (contextual diversity, Pagan & Nation 2019); words known from other surahs are asked again in the new surah
   - new words of the same root or the same small family (dieser/jener, der/die) are not introduced together, since
     similar new words interfere with each other (Erten & Tekin 2008)
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QuranVocab = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------ FSRS-6
  // Default parameters of FSRS-6 (open-spaced-repetition, py-fsrs 6), fitted on the reviews of about 10,000 Anki users.
  const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614,
    0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
  const DECAY = -W[20];
  const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
  const RETENTION = 0.9;              // desired probability of recall at the next review
  const MAX_IVL = 36500;
  const KNOWN = 21;                   // stability (days) from which a word counts as known ("sicher")
  const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

  const clampD = d => Math.min(10, Math.max(1, d));
  const clampS = s => Math.max(0.001, s);
  /** probability of recall t days after the last review */
  const retrievability = (t, s) => Math.pow(1 + FACTOR * Math.max(0, t) / s, DECAY);
  const initS = g => clampS(W[g - 1]);
  const initD = g => W[4] - Math.exp(W[5] * (g - 1)) + 1;
  function nextD(d, g) {
    const delta = -W[6] * (g - 3);
    const damped = d + delta * (10 - d) / 9;                        // linear damping
    return clampD(W[7] * initD(EASY) + (1 - W[7]) * damped);       // mean reversion
  }
  /** a second review on the same day */
  function shortS(s, g) {
    let inc = Math.exp(W[17] * (g - 3 + W[18])) * Math.pow(s, -W[19]);
    if (g >= HARD) inc = Math.max(1, inc);
    return clampS(s * inc);
  }
  function recallS(d, s, r, g) {
    const hard = g === HARD ? W[15] : 1, easy = g === EASY ? W[16] : 1;
    return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy);
  }
  function forgetS(d, s, r) {
    const long = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
    return Math.min(long, s / Math.exp(W[17] * W[18]));
  }
  /** days until the probability of recall falls to the desired one (90 % unless another is given) */
  function interval(s, retention) {
    const i = s / FACTOR * (Math.pow(retention || RETENTION, 1 / DECAY) - 1);
    return Math.min(MAX_IVL, Math.max(1, Math.round(i)));
  }
  /** FSRS spreads reviews a little so that words learnt together do not all come back on one day (deterministic here) */
  function fuzz(ivl, seed) {
    if (ivl < 3) return ivl;
    let delta = 1;
    for (const [a, b, f] of [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]]) delta += f * Math.max(Math.min(ivl, b) - a, 0);
    const lo = Math.max(2, Math.round(ivl - delta)), hi = Math.min(MAX_IVL, Math.round(ivl + delta));
    let h = 2166136261;
    for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return lo + ((h >>> 0) % (hi - lo + 1));
  }

  /**
   * A card: { s stability in days, d difficulty 1..10, last day of the last review, due day of the next review,
   * n reviews, l lapses (forgotten after it had been learnt), a day it was first learnt,
   * c { surah: day it was last practised in that surah } }. Days are whole local days (app: today()).
   * review() returns a new card; g: 1 again (not recalled), 2 hard, 3 good, 4 easy.
   * opts: { retention: desired probability of recall at the next review (default 0.9), max: longest interval in days }
   */
  function review(card, g, day, seed, opts) {
    const c = card ? Object.assign({}, card, { c: Object.assign({}, card.c) }) : { n: 0, l: 0, a: day, c: {} };
    if (c.s == null) {
      c.s = initS(g); c.d = clampD(initD(g));
    } else {
      const t = day - c.last;
      if (t < 1) c.s = shortS(c.s, g);
      else {
        const r = retrievability(t, c.s);
        c.s = clampS(g === AGAIN ? forgetS(c.d, c.s, r) : recallS(c.d, c.s, r, g));
        if (g === AGAIN && c.n > 0) c.l++;
      }
      c.d = nextD(c.d, g);
    }
    c.n++;
    c.last = day;
    const ivl = fuzz(interval(c.s, opts && opts.retention), (seed == null ? '' : seed) + ':' + c.n);
    c.due = g === AGAIN ? day : day + (opts && opts.max ? Math.min(opts.max, ivl) : ivl);
    return c;
  }
  /** days until the next review for each answer (0: again today) */
  function preview(card, day, seed, opts) {
    return [AGAIN, HARD, GOOD, EASY].map(g => review(card, g, day, seed, opts).due - day);
  }
  const status = card => !card ? 'new' : card.s >= KNOWN ? 'known' : 'learn';

  /** cards of earlier versions of the app (an SM-2 like scheduler: i interval, e ease, n, l, a, d due) */
  function migrate(old, day) {
    if (!old || old.s != null) return old;
    const i = old.i || 0;
    return {
      s: Math.max(0.5, i), d: clampD(5 + (2.5 - (old.e || 2.5)) * 10 / 3),
      last: Math.min(day, (old.d != null ? old.d : day) - i), due: old.d != null ? old.d : day,
      n: old.n || 0, l: old.l || 0, a: old.a != null ? old.a : day, c: {},
    };
  }

  /** A lemma whose verses have two different meanings is learnt as two words (Malik, the angel of 43:77, is not
   *  مَٰلِك "Herrscher" of 1:4). Progress made in a surah whose verses now have only the new word moves to it.
   *  cards: id -> card (changed in place); split: {new id: old id}; has(n, id): does surah n have word id.
   *  Returns true when something moved. */
  function migrateSplit(cards, split, has) {
    let changed = false;
    for (const sid of Object.keys(split)) {
      const base = split[sid], c = cards[base];
      if (!c || !c.c) continue;
      let moved = false;
      for (const n of Object.keys(c.c)) {
        if (has(+n, base) || !has(+n, +sid)) continue;
        if (!cards[sid]) cards[sid] = Object.assign({}, c, { c: {} });
        else if (!cards[sid].c) cards[sid].c = {};
        if (cards[sid].c[n] == null || cards[sid].c[n] < c.c[n]) cards[sid].c[n] = c.c[n];
        delete c.c[n];
        moved = true;
      }
      if (moved) { changed = true; if (!Object.keys(c.c).length) delete cards[base]; }
    }
    return changed;
  }

  // ------------------------------------------------------------------ the words of a surah
  /**
   * The vocabulary of a stretch of words (a surah): its items in the order they first appear, the words where each
   * item occurs, and the items of every verse.
   * itemOf(g): item of word g or -1 (words without a meaning to learn: the separate letters ﴿الٓمٓ﴾);
   * verseOf(g): verse index of word g.
   */
  function surahIndex(g0, g1, itemOf, verseOf) {
    const items = [], occ = new Map(), verses = [];
    let cur = null;
    for (let g = g0; g < g1; g++) {
      const v = verseOf(g);
      if (!cur || cur.v !== v) { cur = { v, items: [] }; verses.push(cur); }
      const id = itemOf(g);
      if (id < 0) continue;
      let o = occ.get(id);
      if (!o) { o = []; occ.set(id, o); items.push(id); }
      o.push(g);
      if (cur.items.indexOf(id) < 0) cur.items.push(id);
    }
    return { items, occ, verses };
  }
  /** a verse is understood word for word once every item in it has been learnt; verses without a word to learn
   *  (only the separate letters, ﴿الٓمٓ﴾) are not counted */
  function verseProgress(index, cards) {
    let understood = 0, total = 0;
    const per = index.verses.map(x => {
      let k = 0;
      for (const id of x.items) if (cards[id]) k++;
      const none = !x.items.length, done = !none && k === x.items.length;
      if (!none) total++;
      if (done) understood++;
      return { v: x.v, total: x.items.length, learnt: k, done, none };
    });
    return { per, understood, total };
  }
  /** which occurrence of an item a card shows: the first for a new word, then a different verse at each review */
  function pickOccurrence(occ, card) { return occ[(card ? card.n : 0) % occ.length]; }

  // ------------------------------------------------------------------ planning a session
  /**
   * What to practise in surah n today.
   *   due:   learnt words of this surah due for review (most likely forgotten first)
   *   again: words learnt in another surah, not yet practised in this one ("der Wiederholung zuliebe")
   *   fresh: new words, in the order of the surah (marked ones first), without two of one family
   * opts: day, n, newLimit, againLimit, queued [ids], family(id) -> key or null
   */
  function plan(index, cards, opts) {
    const day = opts.day, n = String(opts.n);
    const due = [], again = [], fresh = [];
    for (const id of index.items) {
      const c = cards[id];
      if (!c) continue;
      if (c.due <= day) due.push(id);
      else if (!(c.c && c.c[n] != null)) again.push(id);
    }
    const R = id => retrievability(day - cards[id].last, cards[id].s);
    due.sort((a, b) => R(a) - R(b));
    const queued = (opts.queued || []).filter(id => index.occ.has(id) && !cards[id]);
    const order = queued.concat(index.items.filter(id => !cards[id] && queued.indexOf(id) < 0));
    const fams = new Set();
    for (const id of order) {
      if (fresh.length >= (opts.newLimit || 0)) break;
      const f = opts.family ? opts.family(id) : null;
      if (f != null && fams.has(f)) continue;          // a relative of a word new today: another day
      if (f != null) fams.add(f);
      fresh.push(id);
    }
    const left = order.length - fresh.length;
    return { due, again: again.slice(0, opts.againLimit == null ? 12 : opts.againLimit), againAll: again.length, fresh, newLeft: left };
  }

  // ------------------------------------------------------------------ a session
  const LAG = 3;                                       // at least this many other cards before a word comes again
  /**
   * The order of the cards of one session. Reviews and new words are mixed (two reviews, one new word); a new word is
   * first shown (intro), then asked LAG cards later; a word not recalled is asked again LAG cards later, until it is.
   * next() gives { id, mode: 'intro' | 'test', kind: 'new' | 'due' | 'again' }; answer(task, r) with r = 'seen' or
   * 'known' after an intro, or the grade 1..4 after a test.
   */
  class Session {
    constructor(p) {
      const rev = p.due.map(id => ({ id, mode: 'test', kind: 'due' })).concat(p.again.map(id => ({ id, mode: 'test', kind: 'again' })));
      const fresh = p.fresh.map(id => ({ id, mode: 'intro', kind: 'new' }));
      this.main = [];
      while (rev.length || fresh.length) {
        for (let k = 0; k < 2 && rev.length; k++) this.main.push(rev.shift());
        if (fresh.length) this.main.push(fresh.shift());
      }
      this.pending = [];
      this.step = 0;
      this.total = this.main.length + p.fresh.length;    // every new word: intro and test
      this.done = 0;
      this.stats = { reviewed: 0, learnt: 0, forgotten: 0, known: 0 };
      this.failed = new Set();
    }
    next() {
      let i = this.pending.findIndex(t => t.at <= this.step);
      if (i < 0 && !this.main.length && this.pending.length) {
        i = 0;
        for (let k = 1; k < this.pending.length; k++) if (this.pending[k].at < this.pending[i].at) i = k;
      }
      const t = i >= 0 ? this.pending.splice(i, 1)[0] : this.main.shift();
      if (!t) return null;
      this.step++;
      return t;
    }
    answer(t, r) {
      if (t.mode === 'intro') {
        this.done++;
        if (r === 'known') { this.done++; this.stats.known++; return; }
        this.pending.push({ id: t.id, mode: 'test', kind: t.kind, at: this.step + LAG });
        return;
      }
      this.done++;
      if (r === AGAIN) {
        if (!this.failed.has(t.id)) { this.failed.add(t.id); if (t.kind !== 'new') this.stats.forgotten++; }
        this.total++;
        this.pending.push({ id: t.id, mode: 'test', kind: t.kind, retry: true, at: this.step + LAG });
        return;
      }
      if (t.kind === 'new') this.stats.learnt++; else this.stats.reviewed++;
    }
    get left() { return this.main.length + this.pending.length; }
  }

  return { W, KNOWN, AGAIN, HARD, GOOD, EASY, retrievability, interval, review, preview, status, migrate, migrateSplit, fuzz,
    surahIndex, verseProgress, pickOccurrence, plan, Session, LAG };
});
