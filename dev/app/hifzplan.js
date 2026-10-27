/* The hifz plan of MyHifz: what to learn new this week and today, and which pages to recite again today, by one of
   three models of reviewing. Shared by the app (browser) and the tests (Node). No DOM access in here.

   What the research says, and what the models take from it (sources in README.md and in the app):
   - recite from memory, not only read again: recalling fixes memory better than rereading (Roediger & Karpicke 2006)
   - spread over days, not all at once (Cepeda et al. 2006, 2008); recalled again on later days until it sits
     (successive relearning, Rawson & Dunlosky 2022)
   - growing or equal gaps: in the long run about the same (Karpicke & Roediger 2007, 2010; Kang et al. 2014); growing
     gaps help while the material is still easily forgotten (Storm, Bjork & Storm 2010), so new pages come back daily
     or after short gaps first in every model
   The models:
   - 'ssm'  Sabaq, Sabqi, Manzil, the daily cycle of the hifz schools (Deobandi madrasas, Gent 2011): the new portion
            (sabaq), the pages learnt in the last days every day (sabqi), all other pages in a fixed round (manzil).
            A page recited badly is recited daily until it sits again, as a teacher would have it.
   - 'fsrs' every page when it is about to fade: FSRS-6 (as the words) for a chosen probability of recall, at the
            latest after 30 days
   - 'leitner' fixed steps of 1, 3, 7, 14 and 30 days (Leitner 1972): a page recited well goes one step on, a page
            forgotten back to the first
   A page is the unit of reviewing: the verses of it that are memorised. Days are whole local days (app: today()).
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vocab.js'));
  else root.QuranPlan = factory(root.QuranVocab);
})(typeof self !== 'undefined' ? self : this, function (V) {
  'use strict';

  const PAGES = 604;
  const EPS = 1e-6;

  // ------------------------------------------------------------------ the book
  /**
   * Verses, pages, surahs and juz of the Madina Mushaf, and the size of every verse as a share of the page it starts on
   * (its words by the words of that page): a page is 1, half a page 0.5.
   * q: { verseStart: first word of every verse and the end, pages: first verse of every page, juz: first verse of every
   * juz, surahs: [{ n, start, ayahs }] }
   */
  function book(q) {
    const n = q.verseStart.length - 1;
    const pageStart = Array.from(q.pages), juzStart = Array.from(q.juz);
    const pageOf = new Uint16Array(n), juzOf = new Uint8Array(n), surahOf = new Uint8Array(n);
    for (let p = 0; p < PAGES; p++) for (let v = pageStart[p], e = p < PAGES - 1 ? pageStart[p + 1] : n; v < e; v++) pageOf[v] = p + 1;
    for (let j = 0; j < 30; j++) for (let v = juzStart[j], e = j < 29 ? juzStart[j + 1] : n; v < e; v++) juzOf[v] = j + 1;
    const surahs = q.surahs.map(s => ({ n: s.n, start: s.start, ayahs: s.ayahs }));
    for (const s of surahs) for (let v = s.start; v < s.start + s.ayahs; v++) surahOf[v] = s.n;
    const words = new Uint16Array(n), pageWords = new Float64Array(PAGES + 1);
    for (let v = 0; v < n; v++) { words[v] = q.verseStart[v + 1] - q.verseStart[v]; pageWords[pageOf[v]] += words[v]; }
    const size = new Float64Array(n);
    for (let v = 0; v < n; v++) size[v] = words[v] / pageWords[pageOf[v]];
    return { n, pageStart, juzStart, pageOf, juzOf, surahOf, surahs, words, size, seq: {} };
  }
  const pageFirst = (b, p) => b.pageStart[p - 1];
  const pageLast = (b, p) => (p < PAGES ? b.pageStart[p] : b.n) - 1;
  const surahFirst = (b, s) => b.surahs[s - 1].start;
  const surahLast = (b, s) => b.surahs[s - 1].start + b.surahs[s - 1].ayahs - 1;
  const juzFirst = (b, j) => b.juzStart[j - 1];
  const juzLast = (b, j) => (j < 30 ? b.juzStart[j] : b.n) - 1;
  /** the size in pages of the verses a..z that are not memorised (or all of them with all) */
  function open(b, has, a, z, all) { let s = 0; for (let v = a; v <= z; v++) if (all || !has(v)) s += b.size[v]; return s; }
  /** pages with at least one memorised verse, in the order of the mushaf */
  function memPages(b, has) {
    const out = [];
    for (let p = 1; p <= PAGES; p++) for (let v = pageFirst(b, p), z = pageLast(b, p); v <= z; v++) if (has(v)) { out.push(p); break; }
    return out;
  }
  /** runs of consecutive verses: [[first, last], ...] */
  function runs(vs) {
    const out = [];
    for (const v of vs) { const r = out[out.length - 1]; if (r && r[1] === v - 1) r[1] = v; else out.push([v, v]); }
    return out;
  }

  // ------------------------------------------------------------------ the order of learning
  const ORDERS = ['back', 'juz', 'front'];
  /**
   * All verses in the order they are learnt. back: surah by surah from the end (an-Nas, al-Falaq, ...), each surah from
   * its first verse; juz: juz by juz from the end (juz 30, 29, ...), each juz in the order of the mushaf; front: the
   * order of the mushaf. from (a surah): that surah first, then on in the same order and around.
   */
  function sequence(b, order, from) {
    const key = order + ':' + (from || 0);
    if (b.seq[key]) return b.seq[key];
    let out = new Int16Array(b.n), k = 0;
    const push = (a, z) => { for (let v = a; v <= z; v++) out[k++] = v; };
    if (order === 'front') push(0, b.n - 1);
    else if (order === 'juz') for (let j = 30; j >= 1; j--) push(juzFirst(b, j), juzLast(b, j));
    else for (let s = 114; s >= 1; s--) push(surahFirst(b, s), surahLast(b, s));
    if (from >= 1 && from <= 114) {
      const at = out.indexOf(surahFirst(b, from));
      if (at > 0) { const r = new Int16Array(b.n); r.set(out.subarray(at)); r.set(out.subarray(0, at), b.n - at); out = r; }
    }
    b.seq[key] = out;
    return out;
  }
  /**
   * The next verses to learn, in the order of the plan and without those memorised: about `target` pages, ending at
   * the verse boundary nearest to it (at least one verse). The rest of a surah comes along when it is short (at most
   * half the portion), so that a surah is not left with a verse or two for the next day.
   * -> { verses: [v ...], size, runs: [[first, last] ...] }
   */
  function nextPortion(b, has, order, from, target) {
    const seq = sequence(b, order, from);
    const out = [];
    let sum = 0, i = 0;
    for (; i < seq.length; i++) {
      const v = seq[i];
      if (has(v)) continue;
      const s = b.size[v];
      if (out.length && sum + s - target > target - sum) break;    // nearer to the target without it
      out.push(v); sum += s;
      if (sum >= target - EPS) { i++; break; }
    }
    if (out.length) {
      const su = b.surahOf[out[out.length - 1]], rest = [];
      let rs = 0;
      for (let j = i; j < seq.length && b.surahOf[seq[j]] === su; j++) if (!has(seq[j])) { rest.push(seq[j]); rs += b.size[seq[j]]; }
      if (rest.length && rs <= target / 2 + EPS) { for (const v of rest) out.push(v); sum += rs; }
    }
    return { verses: out, size: sum, runs: runs(out) };
  }

  // ------------------------------------------------------------------ the week
  const weekday = day => ((day + 3) % 7 + 7) % 7;      // 0 Monday ... 6 Sunday (day 0, 1 Jan 1970, was a Thursday)
  const weekStart = day => day - weekday(day);
  /**
   * The week of a plan on `day`: the goal in pages, what was learnt (on each day, and today), and today's share of
   * what is left: shared over the learning days still to come, today included. md: { verse: day it was learnt }.
   */
  function week(b, md, plan, day) {
    const ws = weekStart(day), per = [0, 0, 0, 0, 0, 0, 0];
    let done = 0, now = 0;
    for (const k in md) {
      const d = md[k];
      if (d < ws || d > day) continue;
      const s = b.size[+k];
      done += s; per[d - ws] += s;
      if (d === day) now += s;
    }
    const days = plan.days, wd = weekday(day);
    let left = 0;
    for (let w = wd; w < 7; w++) if (days[w]) left++;
    const learnDay = !!days[wd];
    const target = learnDay && left ? Math.max(0, (plan.weekly - (done - now)) / left) : 0;
    const per1 = perDay(plan);
    return { goal: plan.weekly, done, today: now, per, target, left: Math.max(0, target - now), learnDay, daysLeft: left,
      reached: done >= plan.weekly - 0.02, usual: per1 };
  }
  /** the usual portion of a learning day */
  function perDay(plan) { let n = 0; for (const d of plan.days) if (d) n++; return plan.weekly / Math.max(1, n); }

  // ------------------------------------------------------------------ the models
  const MODELS = ['ssm', 'fsrs', 'leitner'];
  const DEFAULTS = { model: 'ssm', weekly: 2, days: [1, 1, 1, 1, 1, 0, 0], order: 'back', from: 0, recent: 7, cycle: 14, retention: 0.95 };
  const STEPS = [1, 3, 7, 14, 30];
  const CAP = 30;                  // every page at least once in 30 days, whatever the model
  const MAX_DAY = 20;              // FSRS and the steps: at most this many pages a day (a backlog is worked off over days)
  const MAX_BLOCK = 5;             // a passage recited in one go: at most five pages
  const GOOD_Q = 0.95, WEAK_Q = 0.85;
  const gradeOf = q => q >= GOOD_Q ? V.GOOD : q >= WEAK_Q ? V.HARD : V.AGAIN;
  function stepOf(i) { let k = 0; for (let j = 0; j < STEPS.length; j++) if (STEPS[j] <= i) k = j; return k; }
  function normalize(plan) {
    const p = Object.assign({}, DEFAULTS, plan || {});
    if (MODELS.indexOf(p.model) < 0) p.model = DEFAULTS.model;
    if (ORDERS.indexOf(p.order) < 0) p.order = DEFAULTS.order;
    if (!Array.isArray(p.days) || p.days.length !== 7 || !p.days.some(Boolean)) p.days = DEFAULTS.days.slice();
    return p;
  }

  /**
   * A page record: { r day the schedule counts from (the last recitation, or new verses learnt on the page), i days from
   * r to the next time (FSRS, steps), t last day it was recited, q quality of that recitation in %, s stability,
   * d difficulty, n recitations, l lapses (FSRS), w weak (Sabaq/Sabqi/Manzil) }.
   */
  function card(rec, plan) {
    if (!rec || rec.r == null) return null;
    const i = rec.i || 1;
    return { s: rec.s != null ? rec.s : Math.max(1, Math.min(i, plan.cycle || 14)), d: rec.d != null ? rec.d : 5, last: rec.r, due: rec.r + i, n: rec.n || 0, l: rec.l || 0, c: {} };
  }
  /** a page with verses learnt today: recited again tomorrow; new verses make the page as fragile as a new one */
  function learnt(rec, day, plan) {
    const out = Object.assign({}, rec);
    out.r = day; out.i = 1; delete out.w;
    if (plan.model === 'fsrs') {
      const c = V.review(null, V.GOOD, day);
      out.s = rec && rec.s != null ? Math.min(rec.s, c.s) : c.s;
      if (out.d == null) out.d = c.d;
      if (out.n == null) out.n = 0;
    }
    return out;
  }
  /** a page known from before (marked, not learnt now): its first recitation after k + 1 days, so that pages marked
   *  together come one after another and not all on one day */
  function known(day, plan, k) {
    const out = { r: day, i: 1 + k };
    if (plan.model === 'fsrs') { out.s = 7; out.d = 5; out.n = 0; }
    return out;
  }
  /** how many days pages marked together are spread over: about 15 a day, a week at least and a month at most */
  const spreadDays = n => Math.max(7, Math.min(CAP, Math.ceil(n / 15)));
  /**
   * A page recited with quality q (share of its words that were there, or the learner's own rating): the new record.
   * fsrs: good from 95 %, hard from 85 %, else forgotten (again tomorrow). leitner: one step on from 95 %, the same
   * step from 85 %, else back to the first. ssm: below 85 % the page is weak (recited daily) until it reaches 95 %.
   */
  function review(rec, q, day, plan, seed) {
    const out = Object.assign({}, rec);
    out.q = Math.round(q * 100);
    if (plan.model === 'fsrs') {
      const g = gradeOf(q);
      const c = V.review(card(rec, plan), g, day, seed, { retention: plan.retention, max: CAP });
      out.s = c.s; out.d = c.d; out.n = c.n; out.l = c.l;
      out.i = g === V.AGAIN ? 1 : Math.max(1, c.due - day);
      delete out.w;
    } else if (plan.model === 'leitner') {
      let k = rec && rec.i != null ? stepOf(rec.i) : 0;
      if (q >= GOOD_Q) k = Math.min(STEPS.length - 1, k + 1); else if (q < WEAK_Q) k = 0;
      out.i = STEPS[k];
      out.n = (out.n || 0) + 1;
      delete out.w;
    } else {
      if (q < WEAK_Q) out.w = 1; else if (q >= GOOD_Q) delete out.w;
      out.n = (out.n || 0) + 1;
    }
    out.r = day; out.t = day;
    return out;
  }
  /** days until a page comes again in the FSRS and step models, for every quality (good, with mistakes, forgotten) */
  function preview(rec, day, plan, seed) {
    return [1, 0.9, 0.5].map(q => { const r = review(rec, q, day, plan, seed); return r.i; });
  }

  /**
   * Every page with memorised verses has a record that the model can work with: pages without one (memorised before
   * any plan) are spread over the coming days, records of another model are made usable (an interval at most CAP).
   * Changes pages in place; returns true when something changed.
   */
  function ensure(b, has, pages, plan, day) {
    let changed = false;
    const mem = memPages(b, has), set = new Set(mem);
    for (const k of Object.keys(pages)) if (!set.has(+k)) { delete pages[k]; changed = true; }
    if (plan.model === 'ssm') return changed;
    const missing = mem.filter(p => !pages[p] || pages[p].r == null);
    const spread = spreadDays(missing.length);
    missing.forEach((p, k) => { pages[p] = Object.assign({}, pages[p], known(day, plan, k % spread)); changed = true; });
    for (const p of mem) {
      const r = pages[p];
      if (r.i == null) { r.i = 1 + (p % spread); changed = true; }
      if (r.i > CAP) { r.i = CAP; changed = true; }
      if (plan.model === 'fsrs' && r.s == null) { const c = card(r, plan); r.s = c.s; r.d = c.d; changed = true; }
    }
    return changed;
  }

  /**
   * Today's work: the pages to recite again, each with its section ('recent' learnt in the last days, 'weak' recited
   * badly, 'manzil' the round of all others; 'due' in FSRS and the steps). Made once a day and kept in state.today, so
   * that pages done during the day stay in the list (as done) and it does not grow while working through it.
   * ctx: { b, has(v), pages, md, plan, day, state: { today, manzil } (changed in place), again: make it anew (the
   * plan was changed) } -> { d, m, items: [[page, section] ...], more: pages due beyond today's list }
   */
  function today(ctx) {
    const { plan, day, state, has, b, pages } = ctx;
    let t = state.today;
    if (t && t.d === day && t.m === plan.model && !ctx.again) {
      const items = t.items.filter(([p]) => { for (let v = pageFirst(b, p), z = pageLast(b, p); v <= z; v++) if (has(v)) return true; return false; });
      return Object.assign({}, t, { items });
    }
    // made anew on the same day (the plan was changed): the round from where it stood this morning, with the same pages
    // carried over from the day before
    const same = !!t && t.d === day, again = same && t.m === 'ssm' && t.at0 != null;
    if (again && state.manzil) { state.manzil.at = t.at0; state.manzil.round = t.round0; }
    let res;
    if (plan.model === 'ssm') res = ssmToday(ctx, same ? null : t, again ? t.carry : null);
    else {
      const mem = memPages(b, has);
      const due = mem.filter(p => pages[p] && pages[p].r != null && pages[p].r + (pages[p].i || 1) <= day);
      // the most at risk first: FSRS by the probability of recall, the steps by the days overdue
      const risk = p => plan.model === 'fsrs' && pages[p].s ? V.retrievability(day - pages[p].r, pages[p].s) : -(day - pages[p].r - (pages[p].i || 1));
      due.sort((x, y) => risk(x) - risk(y) || x - y);
      res = { items: due.slice(0, MAX_DAY).sort((x, y) => x - y).map(p => [p, 'due']), more: Math.max(0, due.length - MAX_DAY) };
    }
    t = Object.assign({ d: day, m: plan.model, more: 0 }, res);
    state.today = t;
    return t;
  }
  /** Sabaq, Sabqi, Manzil: the pages learnt in the last `recent` days, the weak ones, and today's part of the round */
  function ssmToday(ctx, prev, carried) {
    const { b, has, pages, md, plan, day, state } = ctx;
    const mem = memPages(b, has);
    const fresh = new Set(), recent = new Set();
    for (const k in md) {
      const d = md[k];
      if (d < day - plan.recent || d > day || !has(+k)) continue;
      fresh.add(b.pageOf[+k]);                     // learnt in the window or today: not in the round
      if (d < day) recent.add(b.pageOf[+k]);       // learnt before today: recited every day
    }
    const weak = mem.filter(p => !fresh.has(p) && pages[p] && pages[p].w);
    const weakSet = new Set(weak);
    const old = mem.filter(p => !fresh.has(p) && !weakSet.has(p));
    const oldSet = new Set(old);
    const m = state.manzil || (state.manzil = { at: 0, round: 1 });
    const at0 = m.at, round0 = m.round;
    // what was not recited of the last list comes first; the round goes on only as far as it is recited
    const carry = carried ? carried.filter(p => oldSet.has(p))
      : prev ? prev.items.filter(([p, sec]) => sec === 'manzil' && oldSet.has(p) && !(pages[p] && pages[p].t >= prev.d)).map(x => x[0]) : [];
    const quota = old.length ? Math.ceil(old.length / plan.cycle) : 0;
    const list = carry.slice(), inList = new Set(list);
    for (let guard = 0; list.length < quota && guard < old.length; guard++) {
      let idx = old.findIndex(p => p > m.at);
      if (idx < 0) { m.round++; idx = 0; }
      const p = old[idx];
      m.at = p;
      if (!inList.has(p)) { list.push(p); inList.add(p); }
    }
    list.sort((x, y) => x - y);
    const items = [...recent].sort((x, y) => x - y).map(p => [p, 'recent']).concat(weak.map(p => [p, 'weak']), list.map(p => [p, 'manzil']));
    return { items, at0, round0, carry, round: m.round, roundDone: old.filter(p => p <= m.at).length, roundOf: old.length };
  }

  /**
   * The passages to recite: consecutive pages of a section with their memorised verses, at most MAX_BLOCK pages each;
   * a verse not memorised ends a passage. -> [{ sec, a first verse, z last verse, pages: [p ...] }]
   */
  function blocks(b, has, items) {
    const out = [];
    let cur = null;
    for (const [p, sec] of items) {
      for (let v = pageFirst(b, p), z = pageLast(b, p); v <= z; v++) {
        if (!has(v)) { cur = null; continue; }
        const last = cur && cur.pages[cur.pages.length - 1];
        if (cur && cur.sec === sec && cur.z === v - 1 && (last === p || cur.pages.length < MAX_BLOCK)) {
          cur.z = v;
          if (last !== p) cur.pages.push(p);
        } else { cur = { sec, a: v, z: v, pages: [p] }; out.push(cur); }
      }
    }
    return out;
  }

  /** how much a day of Sabaq, Sabqi, Manzil asks, about: pages learnt in the window, and the round */
  function ssmLoad(plan, memorised) {
    const recent = Math.min(memorised, Math.ceil(plan.weekly * plan.recent / 7));
    return { recent, manzil: Math.ceil(Math.max(0, memorised - recent) / plan.cycle) };
  }

  return { PAGES, ORDERS, MODELS, DEFAULTS, STEPS, CAP, MAX_DAY, MAX_BLOCK, GOOD_Q, WEAK_Q,
    book, pageFirst, pageLast, surahFirst, surahLast, juzFirst, juzLast, open, memPages, runs,
    sequence, nextPortion, weekday, weekStart, week, perDay, normalize,
    card, learnt, known, spreadDays, review, preview, ensure, today, blocks, ssmLoad, gradeOf, stepOf };
});
