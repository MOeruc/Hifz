/* Quran recitation core: text normalisation, word similarity, alignment and the live tracker.
   Shared by the app (browser) and the test-suite (Node). No DOM access in here. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QuranCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------ characters
  const DAGGER = 'ٰ';
  const SHADDA = 'ّ';
  const SILENT = 'ْ';           // KFGQPC: round sukun = letter that is written but never pronounced
  const VOWELS = new Set(['َ', 'ُ', 'ِ', 'ً', 'ٌ', 'ٍ', 'ٖ', 'ٗ', 'ٞ']);
  // Skeleton alphabet: letters, ا alif, ء hamza, ى alif maqsura, and optional letters:
  //   ~ alif   ° waw   ¹ ya   ² lam   (written in one spelling but not the other)
  const OPT_BASE = { '~': 'ا', '°': 'و', '¹': 'ي', '²': 'ل' };
  const LETTER_MAP = {
    'ٱ': 'ا', 'أ': 'ء', 'إ': 'ء', 'ٲ': 'ء', 'ٳ': 'ء', 'آ': 'ءا', 'ؤ': 'ء', 'ئ': 'ء',
    'ة': 'ه', 'ی': 'ي', 'ۍ': 'ي', 'ې': 'ي', 'ک': 'ك', 'ڪ': 'ك',
  };
  const SKIP_BASE = new Set(['۞', '۩', '۝', '‌', '‍', '‏', '‎']);

  function isMark(ch) {
    const c = ch.charCodeAt(0);
    return (c >= 0x064B && c <= 0x065F) || c === 0x0670 || (c >= 0x06D6 && c <= 0x06DC) ||
      (c >= 0x06DF && c <= 0x06E4) || c === 0x06E7 || c === 0x06E8 || (c >= 0x06EA && c <= 0x06ED) ||
      (c >= 0x0610 && c <= 0x061A) || (c >= 0x08D3 && c <= 0x08FF);
  }
  function isArabicLetter(ch) {
    const c = ch.charCodeAt(0);
    return (c >= 0x0621 && c <= 0x063A) || (c >= 0x0641 && c <= 0x064A) || c === 0x0671 ||
      (c >= 0x0672 && c <= 0x06D3 && c !== 0x06D4) || c === 0x06E5 || c === 0x06E6;
  }

  function clusters(word) {
    const out = [];
    for (const ch of word) {
      if (isMark(ch) && out.length) out[out.length - 1].m.push(ch);
      else out.push({ b: ch, m: [] });
    }
    return out;
  }

  // words whose modern spelling omits the alif that the mushaf writes as a small (dagger) alif
  const DAGGER_OPTIONAL = /هٰ|ذٰل|لٰكن|لٰئك|لٰه|رحمٰن/;

  /** Normalise an Arabic word (mushaf text or speech-recogniser output) to a matching skeleton. */
  function skeleton(word) {
    if (!word) return '';
    if (word.indexOf('ﷲ') >= 0) word = word.replace(/ﷲ/g, 'الله');
    const cl = clusters(word);
    let plain = '';
    for (const c of cl) { if (c.b !== 'ـ') plain += c.b; if (c.m.indexOf(DAGGER) >= 0) plain += DAGGER; }
    const dch = DAGGER_OPTIONAL.test(plain) ? '~' : 'ا';
    let lastLetter = -1;
    for (let i = cl.length - 1; i >= 0; i--) if (isArabicLetter(cl[i].b) && cl[i].b !== 'ۥ' && cl[i].b !== 'ۦ') { lastLetter = i; break; }
    let out = '';
    for (let i = 0; i < cl.length; i++) {
      const { b, m } = cl[i];
      const nx = cl[i + 1];
      const hasD = m.indexOf(DAGGER) >= 0;
      let hasV = false;
      for (const x of m) if (VOWELS.has(x)) { hasV = true; break; }
      if (b === 'ـ') {                                   // tatweel carries signs only
        if (m.indexOf('ٔ') >= 0 || m.indexOf('ٕ') >= 0) { out += 'ء'; if (hasD) out += dch; }
        else if (hasD) out += dch;
        if (m.indexOf('ۧ') >= 0) out += 'ي';
        if (m.indexOf('ۨ') >= 0) out += 'ن';
        continue;
      }
      if (b === 'ۥ') { out += '°'; continue; }     // small waw  -> optional waw
      if (b === 'ۦ') { out += '¹'; continue; }     // small ya   -> optional ya
      if (SKIP_BASE.has(b) || !isArabicLetter(b)) continue;
      if (b === 'و' && hasD && !hasV) { out += 'ا'; continue; }                 // صلوٰة -> صلاة
      if ((b === 'ى' || b === 'ي') && hasD && !hasV) { out += (i === lastLetter ? 'ى' : 'ا'); continue; }
      if (m.indexOf(SILENT) >= 0 && !hasV && (b === 'ا' || b === 'و' || b === 'ي' || b === 'ى')) {
        out += b === 'و' ? '°' : (b === 'ي' ? '¹' : '~');            // written, never pronounced
        continue;
      }
      let ch = LETTER_MAP[b] || b;
      if (b === 'أ' && m.indexOf('ٓ') >= 0) ch = 'ءا';               // أٓ = آ
      if (b === 'ص' && m.indexOf('ۜ') >= 0) ch = 'س';                     // small seen over sad
      // al- + doubled lam (ٱلَّيل): modern spelling may write the lam twice
      if (b === 'ل' && m.indexOf(SHADDA) >= 0 && /^[وفبكل]{0,2}ا$/.test(out)) ch = 'ل²';
      out += ch;
      // a dagger alif directly before a hamza with sukun is only its seat (فَٱدَّٰرَٰءۡتُمۡ)
      if (hasD && !(nx && nx.b === 'ء' && nx.m.indexOf('ۡ') >= 0)) out += dch;
      if (m.indexOf('ۧ') >= 0) out += 'ي';
      if (m.indexOf('ۨ') >= 0) out += 'ن';
      // و / ف followed by a letter with sukun: the mushaf drops the wasl alif that modern spelling keeps (وَسۡـَٔلۡ)
      if (i === 0 && (b === 'و' || b === 'ف') && nx && nx.m.indexOf('ۡ') >= 0 && isArabicLetter(nx.b) && nx.b !== 'ا') out += '~';
      // word-final ya with kasra (يُحۡيِ) is written with two ya in modern spelling
      if (i === lastLetter && b === 'ي' && m.indexOf('ِ') >= 0) out += '¹';
    }
    // final alif carrying the tanween (خَطَـٔٗا, مَلۡجَـًٔا) is often not written after a hamza
    if (out.length > 2 && out[out.length - 1] === 'ا' && lastLetter > 0) {
      const lc = cl[lastLetter], pc = cl[lastLetter - 1];
      if (lc.b === 'ا' && (pc.m.indexOf('ً') >= 0 || pc.m.indexOf('ٗ') >= 0)) out = out.slice(0, -1) + '~';
    }
    if (out.length > 2 && out.endsWith('وا')) out = out.slice(0, -1) + '~';    // كفروا / جاءو
    return out;
  }

  /** consonantal core used for fast lookup: no alifs, hamzas or optional letters */
  function core(sk) { return sk.replace(/[اء~ى°¹²]/g, ''); }
  function plainSk(sk) { return sk.replace(/[~°¹²]/g, ''); }

  // ------------------------------------------------------------------ disjoined letters (al-muqattaat)
  const LETTER_NAMES = { 'ا': 'ءلف', 'ل': 'لام', 'م': 'ميم', 'ص': 'صاد', 'ر': 'را', 'ك': 'كاف', 'ه': 'ها', 'ي': 'يا', 'ع': 'عين', 'ط': 'طا', 'س': 'سين', 'ح': 'حا', 'ق': 'قاف', 'ن': 'نون' };
  const MUQATTAAT = new Set(['الم', 'المص', 'الر', 'المر', 'كهيعص', 'طه', 'طسم', 'طس', 'يس', 'ص', 'حم', 'عسق', 'ق', 'ن']);
  function spokenLetters(sk) { let s = ''; for (const ch of sk) s += LETTER_NAMES[ch] || ch; return s; }

  // ------------------------------------------------------------------ similarity
  const CONFUSABLE = {};
  [['ح', 'ه'], ['ح', 'خ'], ['ع', 'ا'], ['ع', 'ء'], ['ق', 'ك'], ['ق', 'غ'], ['ص', 'س'], ['ض', 'د'], ['ض', 'ظ'],
   ['ط', 'ت'], ['ظ', 'ذ'], ['ظ', 'ز'], ['ذ', 'ز'], ['ذ', 'د'], ['ث', 'س'], ['ث', 'ت'], ['خ', 'ه'], ['غ', 'خ']]
    .forEach(([a, b]) => { CONFUSABLE[a + b] = 1; CONFUSABLE[b + a] = 1; });
  const SEAT = { 'ءا': 1, 'اء': 1, 'ءو': 1, 'وء': 1, 'ءي': 1, 'يء': 1, 'ءى': 1, 'ىء': 1, 'ء~': 1, '~ء': 1 };
  const LONG = new Set(['ا', 'و', 'ي', 'ى']);

  function subCost(a, b) {
    if (a === b) return 0;
    if (OPT_BASE[a] === b || OPT_BASE[b] === a) return 0;
    if ((a === '¹' && b === 'ى') || (a === 'ى' && b === '¹') || (a === '~' && b === 'ى') || (a === 'ى' && b === '~')) return 0;
    if ((a === 'ى' && b === 'ي') || (a === 'ي' && b === 'ى')) return 0.05;
    if ((a === 'ى' && b === 'ا') || (a === 'ا' && b === 'ى')) return 0.1;
    if (SEAT[a + b]) return 0.3;
    if (CONFUSABLE[a + b]) return 0.55;
    return 1;
  }
  function indelCost(c) {
    switch (c) {
      case '~': case '°': case '¹': case '²': return 0.05;
      case 'ا': case 'ى': return 0.4;
      case 'ء': return 0.3;
      case 'و': case 'ي': return 0.6;
      case 'ه': return 0.8;
      default: return 1;
    }
  }
  function wlen(s) { let n = 0; for (let i = 0; i < s.length; i++) n += indelCost(s[i]); return n; }

  let BUF = new Float32Array(64 * 64);
  const simCache = new Map();
  /** weighted edit distance; returns {sim, dist[, ops]} */
  function compare(e, r, wantOps) {
    if (e === r && !wantOps) return { sim: 1, dist: 0 };
    const key = wantOps ? e + '|' + r + '|o' : e + '|' + r;
    const hit = simCache.get(key);
    if (hit) return hit;
    const n = e.length, m = r.length, W = m + 1;
    if ((n + 1) * W > BUF.length) BUF = new Float32Array((n + 1) * W * 2);
    const D = BUF;
    D[0] = 0;
    for (let i = 1; i <= n; i++) D[i * W] = D[(i - 1) * W] + indelCost(e[i - 1]);
    for (let j = 1; j <= m; j++) D[j] = D[j - 1] + indelCost(r[j - 1]);
    for (let i = 1; i <= n; i++) {
      const ei = e[i - 1], dE = indelCost(ei);
      for (let j = 1; j <= m; j++) {
        const s = D[(i - 1) * W + j - 1] + subCost(ei, r[j - 1]);
        const d = D[(i - 1) * W + j] + dE;
        const ins = D[i * W + j - 1] + indelCost(r[j - 1]);
        D[i * W + j] = s < d ? (s < ins ? s : ins) : (d < ins ? d : ins);
      }
    }
    const dist = D[n * W + m];
    const norm = Math.max(wlen(e), wlen(r), 1);
    const res = { sim: Math.max(0, 1 - dist / norm), dist };
    if (wantOps) {
      const ops = [];
      let i = n, j = m;
      while (i > 0 || j > 0) {
        const here = D[i * W + j];
        if (i > 0 && j > 0 && Math.abs(here - (D[(i - 1) * W + j - 1] + subCost(e[i - 1], r[j - 1]))) < 1e-4) {
          const c = subCost(e[i - 1], r[j - 1]);
          if (c > 0) ops.push({ t: 's', e: e[i - 1], r: r[j - 1], c });
          i--; j--;
        } else if (i > 0 && Math.abs(here - (D[(i - 1) * W + j] + indelCost(e[i - 1]))) < 1e-4) {
          ops.push({ t: 'd', e: e[i - 1], c: indelCost(e[i - 1]) }); i--;
        } else {
          ops.push({ t: 'i', r: r[j - 1], c: indelCost(r[j - 1]) }); j--;
        }
      }
      res.ops = ops.reverse();
    }
    if (simCache.size > 60000) simCache.clear();
    simCache.set(key, res);
    return res;
  }

  // per-word result codes
  const ST = { NONE: 0, OK: 1, MISSED: 2, NEAR: 3, WRONG: 4, LETTER: 5, MADD: 6, CORRECTED: 7 };

  /** decide what kind of deviation a matched pair shows. strictness 0 relaxed, 1 normal, 2 strict */
  function classify(eTok, rsk, strictness) {
    let best = null;
    for (const alt of eTok.alts) {
      const c = compare(alt, rsk, true);
      if (!best || c.sim > best.sim) best = c;
    }
    if (best.dist <= 0.15) return { st: ST.OK, sim: best.sim };
    const ops = best.ops.filter(o => o.c > 0.06);
    const trivial = o => (o.t === 's' && (SEAT[o.e + o.r] || o.c <= 0.1)) || ((o.t === 'd' || o.t === 'i') && ((o.e || o.r) === 'ء'));
    const conf = ops.filter(o => o.t === 's' && CONFUSABLE[o.e + o.r]);
    const rest = ops.filter(o => !(o.t === 's' && CONFUSABLE[o.e + o.r]) && !trivial(o));
    if (!rest.length && !conf.length) return { st: ST.OK, sim: best.sim };
    if (conf.length && !rest.length) return { st: ST.LETTER, sim: best.sim, pairs: conf.map(o => [o.e, o.r]) };
    if (rest.length === 1 && !conf.length && (rest[0].t === 'd' || rest[0].t === 'i') && LONG.has(rest[0].e || rest[0].r)) {
      // one lengthening letter missing or added: a dropped or invented madd
      if (strictness === 0) return { st: ST.OK, sim: best.sim };
      return { st: ST.MADD, sim: best.sim, madd: rest[0].t === 'd' ? 'missing' : 'extra', letter: rest[0].e || rest[0].r };
    }
    if (best.sim >= 0.6) return { st: ST.NEAR, sim: best.sim };
    return { st: ST.WRONG, sim: best.sim };
  }

  // ------------------------------------------------------------------ Quran word list
  /** Build the flat word list from quran.json verses. */
  function buildWords(quran) {
    const words = [];      // {t: display text, v: verse index, k: index in verse}
    const verseStart = new Int32Array(quran.verses.length + 1);
    const verseSurah = new Uint8Array(quran.verses.length);
    const verseAyah = new Uint16Array(quran.verses.length);
    for (const s of quran.surahs) for (let a = 0; a < s.ayahs; a++) { verseSurah[s.start + a] = s.n; verseAyah[s.start + a] = a + 1; }
    for (let v = 0; v < quran.verses.length; v++) {
      verseStart[v] = words.length;
      let k = 0;
      for (const t of quran.verses[v].split(' ')) {
        if (!t) continue;
        let hasLetter = false;
        for (const ch of t) if (isArabicLetter(ch)) { hasLetter = true; break; }
        if (!hasLetter) continue; // ۞ and other standalone signs
        words.push({ t, v, k: k++ });
      }
    }
    verseStart[quran.verses.length] = words.length;
    const basmala = quran.verses[0].split(' ').filter(Boolean);
    return { words, verseStart, verseSurah, verseAyah, basmala };
  }

  function expectedToken(text) {
    const sk = skeleton(text);
    const alts = [sk];
    let muq = false;
    const p = plainSk(sk);
    if (MUQATTAAT.has(p)) { muq = true; alts.push(spokenLetters(p)); }
    return { sk, alts, core: core(sk), muq };
  }

  // ------------------------------------------------------------------ recogniser text
  // phrases around the recitation that are not the place being recited: [name, words, similarity needed]
  // (where they are real Quran text at the pointer, al-Fatiha 1:1, an-Naml 27:30 or an-Nahl 16:98, they count as words)
  const NEUTRAL = [
    ['isti', ['أعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم'], 0.8],
    ['basm', ['بسم', 'الله', 'الرحمن', 'الرحيم'], 0.8],
    // the recogniser lost one word
    ['isti', ['بالله', 'من', 'الشيطان', 'الرجيم'], 0.86],
    ['isti', ['أعوذ', 'بالله', 'من', 'الرجيم'], 0.86],
    ['isti', ['أعوذ', 'بالله', 'من', 'الشيطان'], 0.86],
    ['basm', ['الله', 'الرحمن', 'الرحيم'], 0.88],
    ['basm', ['بسم', 'الله', 'الرحمن'], 0.88],
    ['basm', ['بسم', 'الله', 'الرحيم'], 0.88],
    ['basm', ['بسم', 'الله'], 0.9],
    ['basm', ['بسم', 'الرحمن'], 0.9],
    ['basm', ['بسم', 'الرحيم'], 0.9],
    ['end', ['صدق', 'الله', 'العظيم'], 0.85],
  ];
  function tokenizeHeard(text) {
    const out = [];
    for (const raw of String(text || '').split(/[\s،؛؟.,!?؛،:"'()\[\]-]+/)) {
      if (!raw) continue;
      let w = '';
      for (const ch of raw) if (isArabicLetter(ch) || isMark(ch) || ch === 'ـ' || ch === 'ﷲ') w += ch;
      const sk = skeleton(w);
      if (sk) out.push({ raw: w, sk });
    }
    return out;
  }

  // ------------------------------------------------------------------ alignment
  const MERGES = [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1]];
  function matchScore(sim) { return sim >= 0.45 ? 2 * sim - 1 : -1.0; }
  const SKIP_E = -0.55, INS_R = -0.6;

  /** Align heard tokens R against expected tokens E.
      E items: {alts, sk, muq, virtual}. ptr: index in E of the expected next word.
      Returns {score, pairs:[{ei, ek, rj, rk}], dels:[ei], ins:[rj], first, last}. */
  function align(E, R, ptr) {
    const n = E.length, m = R.length, W = m + 1, NEG = -1e9;
    const D = new Float64Array((n + 1) * W).fill(NEG);
    const B = new Int16Array((n + 1) * W).fill(-1);
    // starting at the pointer is free; repeating recent words costs a little; starting ahead costs more
    // (optional tokens such as the basmala do not count as skipped words)
    const rc = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) rc[i + 1] = rc[i] + (E[i].virtual ? 0 : 1);
    for (let i = 0; i <= n; i++) {
      D[i * W] = i <= ptr ? -0.04 * (rc[ptr] - rc[i]) : -0.12 * Math.min(rc[i] - rc[ptr], 12);
    }
    // concatenations for merged words, built once: RC[k][j] = heard tokens j-k..j-1, EC[k][i] likewise for expected (null if it holds a virtual token)
    const RC = [null, null, new Array(m + 1), new Array(m + 1)], EC = [null, null, new Array(n + 1), new Array(n + 1)];
    for (let k = 2; k <= 3; k++) {
      for (let j = k; j <= m; j++) { let x = ''; for (let y = j - k; y < j; y++) x += R[y].sk; RC[k][j] = x; }
      for (let i = k; i <= n; i++) { let x = '', virt = false; for (let y = i - k; y < i; y++) { x += E[y].sk; if (E[y].virtual) virt = true; } EC[k][i] = virt ? null : x; }
    }
    for (let i = 0; i <= n; i++) {
      const ev = i > 0 ? E[i - 1] : null;
      for (let j = 1; j <= m; j++) {
        let best = D[i * W + j - 1] + INS_R, bp = 1;
        if (i > 0) {
          const b = D[(i - 1) * W + j] + (ev.virtual ? 0 : SKIP_E);
          if (b > best) { best = b; bp = 2; }
        }
        for (let q = 0; q < MERGES.length; q++) {
          const kE = MERGES[q][0], kR = MERGES[q][1];
          if (i < kE || j < kR) continue;
          const prev = D[(i - kE) * W + j - kR];
          if (prev <= NEG / 2) continue;
          const rs = kR > 1 ? RC[kR][j] : R[j - 1].sk;
          let sim = 0;
          if (kE === 1) {
            for (const alt of ev.alts) {
              if (kR > 1 && !ev.muq && alt.length < rs.length * 0.5) continue;
              const c = compare(alt, rs, false); if (c.sim > sim) sim = c.sim;
            }
          } else {
            const es = EC[kE][i];
            if (es === null || es.length > rs.length * 2.2 || rs.length > es.length * 2.2) continue;
            sim = compare(es, rs, false).sim;
          }
          let sc = matchScore(sim);
          if (kE === 1 && ev.virtual) sc -= 1;              // the optional basmala: free to absorb, but no evidence for the place
          if (kE !== kR) sc -= 0.08;                        // prefer one-to-one when equally good
          if (kE === 1 && kR > 1 && ev.muq) sc += 0.2;
          const v = prev + sc;
          if (v > best) { best = v; bp = 10 + q; }
        }
        if (i > 0 && ev.muq) {                               // alif-lam-mim spoken as separate letter names
          for (let kR = 4; kR <= 5 && kR <= j; kR++) {
            const prev = D[(i - 1) * W + j - kR];
            if (prev <= NEG / 2) continue;
            let rs = '';
            for (let x = j - kR; x < j; x++) rs += R[x].sk;
            let sim = 0;
            for (const alt of ev.alts) { const c = compare(alt, rs, false); if (c.sim > sim) sim = c.sim; }
            const v = prev + matchScore(sim) + 0.2;
            if (v > best) { best = v; bp = 20 + kR; }
          }
        }
        D[i * W + j] = best; B[i * W + j] = bp;
      }
    }
    let bi = 0, bs = NEG;
    for (let i = 0; i <= n; i++) if (D[i * W + m] > bs + 1e-9) { bs = D[i * W + m]; bi = i; }
    const pairs = [], dels = [], ins = [];
    let i = bi, j = m;
    while (j > 0) {
      const bp = B[i * W + j];
      if (bp === 1) { ins.push(j - 1); j--; }
      else if (bp === 2) { dels.push(i - 1); i--; }
      else if (bp >= 10 && bp < 20) { const [kE, kR] = MERGES[bp - 10]; pairs.push({ ei: i - kE, ek: kE, rj: j - kR, rk: kR }); i -= kE; j -= kR; }
      else if (bp >= 20) { const kR = bp - 20; pairs.push({ ei: i - 1, ek: 1, rj: j - kR, rk: kR }); i -= 1; j -= kR; }
      else break;
    }
    pairs.reverse(); dels.reverse(); ins.reverse();
    const first = pairs.length ? pairs[0].ei : -1;
    const lp = pairs[pairs.length - 1];
    const last = pairs.length ? lp.ei + lp.ek - 1 : -1;
    return { score: bs, pairs, dels: dels.filter(d => d > first && d < last), ins, first, last };
  }

  // ------------------------------------------------------------------ transcript merging (Android sends cumulative results)
  function mergeResults(list) {
    let acc = '';
    for (const t of list) {
      const s = (t || '').replace(/\s+/g, ' ').trim();
      if (!s) continue;
      if (acc && s.startsWith(acc)) acc = s;
      else if (acc && acc.endsWith(s)) continue;
      else acc = acc ? acc + ' ' + s : s;
    }
    return acc;
  }

  // ------------------------------------------------------------------ tracker
  class Tracker {
    constructor(Q, opts) {
      this.Q = Q;
      this.N = Q.words.length;
      this.status = new Uint8Array(this.N);
      this.heard = new Map();
      this.detail = new Map();
      this.tentative = new Map();
      this.pointer = 0;
      this.opts = Object.assign({ strictness: 1, lookbehind: 12 }, opts || {});
      this._exp = new Array(this.N);
      this._basm = Q.basmala.map(t => Object.assign(expectedToken(t), { virtual: true }));
      this.committedTokens = 0;
      this.ranges = [];
      this.extra = [];
      this.listeners = {};
      this.index = null;
      this.started = false;
      this.sStartV = new Int32Array(115);
      for (let v = 0; v < Q.verseSurah.length; v++) if (Q.verseAyah[v] === 1) this.sStartV[Q.verseSurah[v]] = v;
      this._neutral = NEUTRAL.map(([name, ws, th]) => {
        const sks = ws.map(w => skeleton(w));
        // only the full openers are held back at the end of a result (their first words are rare in the text itself)
        const hold = ws[0] === 'أعوذ' || ws[0] === 'بسم';
        return { name, n: ws.length, th, sk: sks.join(''), first: sks[0], pre: hold ? [null, sks[0], sks.slice(0, 2).join('')] : [] };
      });
      this.reset(0);
    }
    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, data) { for (const fn of this.listeners[ev] || []) fn(data); }
    exp(i) { let e = this._exp[i]; if (!e) { e = expectedToken(this.Q.words[i].t); this._exp[i] = e; } return e; }

    /** start a recitation at pointer. search: true when the reciter may start anywhere (find the place first) */
    reset(pointer, opts) {
      this.status.fill(0); this.heard.clear(); this.detail.clear(); this.tentative.clear();
      this.ranges = []; this.extra = [];
      this.pointer = Math.max(0, Math.min(this.N - 1, pointer | 0));
      this.committedTokens = 0; this.started = false;
      this.mode = opts && opts.search ? 'search' : 'track';
      // a memorisation test must not follow the reciter into another passage: a slip there is a mistake here.
      // bounds: [firstWord, lastWord] the reciter may move within; stay: only within the current surah
      this.bounds = (opts && opts.bounds) || null;
      this.stay = !!(opts && opts.stay);
      this.hint = this.pointer;
      this.pend = []; this.offChunks = 0; this.carry = [];
      this.committedTotal = 0; this.lastJumpTokens = -1e9; this.leftAt = null;
      // the basmala opens every surah but at-Tawba: it says that a surah begins, never which one
      this.afterBasm = false; this.basmTok = null; this.basmHeard = new Set();
      this.lastHeard = -1;
    }
    get follow() { return !this.bounds && !this.stay; }
    _mayJump(pos, anchor) {
      if (this.bounds) return pos >= this.bounds[0] && pos <= this.bounds[1];
      if (this.stay) return this.surahOfWord(pos) === this.surahOfWord(anchor);
      return true;
    }
    newSession() { this.committedTokens = 0; this.tentative.clear(); }
    /** the reciter says: continue at this word */
    moveTo(gi) {
      this.pointer = Math.max(0, Math.min(this.N - 1, gi)); this.mode = 'track';
      this.pend = []; this.offChunks = 0; this.afterBasm = false; this.basmTok = null; this.carry = [];
      this.newSession();
    }

    surahOfWord(g) { return this.Q.verseSurah[this.Q.words[Math.max(0, Math.min(this.N - 1, g))].v]; }
    isSurahStart(g) { const w = this.Q.words[g]; return !!w && w.k === 0 && this.Q.verseAyah[w.v] === 1; }
    /** first word of a surah's own text: after its basmala (al-Fatiha: its basmala is verse 1, the text goes on with 1:2) */
    startG(s) { const v = this.sStartV[s]; return this.Q.verseStart[s === 1 ? v + 1 : v]; }

    /** expected window around anchor, with the basmala inserted (optional) before each surah start */
    window(anchor, m, lookbehind, ahead) {
      const lbw = Math.min(lookbehind == null ? this.opts.lookbehind : lookbehind, anchor);
      const start = anchor - lbw;
      const end = Math.min(this.N, anchor + (ahead == null ? m * 2 + 40 : ahead));
      const E = [], G = [];
      let ptr = 0;
      for (let i = start; i < end; i++) {
        const w = this.Q.words[i];
        if (i === anchor) ptr = E.length;
        if (w.k === 0 && this.Q.verseAyah[w.v] === 1) {
          const s = this.Q.verseSurah[w.v];
          if (s !== 1 && s !== 9) for (const b of this._basm) { E.push(b); G.push(-1000 - s); }   // virtual: G encodes the surah
        }
        E.push(this.exp(i)); G.push(i);
      }
      if (anchor >= end) ptr = E.length;
      return { E, G, ptr };
    }

    /** word-pair and single-word index of the whole Quran, for finding a place. Built once (in slices, if wanted). */
    buildIndex(upTo) {
      if (this.index) return this.index;
      const b = this._ib || (this._ib = { i: 0, idx: new Map(), uni: new Map() });
      const end = Math.min(this.N, upTo == null ? this.N : upTo);
      for (let i = b.i; i < end; i++) {
        const c = this.exp(i).core;
        if (c.length >= 3) { let u = b.uni.get(c); if (!u) b.uni.set(c, u = []); u.push(i); }
        if (i + 1 < this.N) {
          const k = c + ' ' + this.exp(i + 1).core;
          let arr = b.idx.get(k);
          if (!arr) { arr = []; b.idx.set(k, arr); }
          arr.push(i);
        }
      }
      b.i = Math.max(b.i, end);
      if (b.i < this.N) return null;
      this.index = b.idx; this.uindex = b.uni; this._ib = null;
      return this.index;
    }
    /** build the index in small steps so the page stays responsive; schedule(fn) runs fn later (idle callback or timer) */
    buildIndexAsync(schedule, step) {
      if (this.index || this._ibRunning) return;
      this._ibRunning = true;
      const n = step || 4000;
      const run = () => {
        if (this.index) { this._ibRunning = false; return; }
        const b = this._ib;
        this.buildIndex((b ? b.i : 0) + n);
        if (this.index) this._ibRunning = false; else schedule(run);
      };
      schedule(run);
    }

    /** how well an alignment explains the heard tokens.
        matched: tokens explained (with the optional basmala), real: matched on real words, spanRatio: matched share between the first and last match */
    quality(a, E, R) {
      let matched = 0, real = 0, r0 = -1, r1 = -1;
      for (const p of a.pairs) {
        let rs = '';
        for (let x = 0; x < p.rk; x++) rs += R[p.rj + x].sk;
        let sim = 0;
        if (p.ek === 1) { for (const alt of E[p.ei].alts) { const c = compare(alt, rs, false); if (c.sim > sim) sim = c.sim; } }
        else { let es = ''; for (let x = 0; x < p.ek; x++) es += E[p.ei + x].sk; sim = compare(es, rs, false).sim; }
        if (sim >= 0.6) {
          matched += p.rk;
          if (!E[p.ei].virtual) real += p.rk;
          if (r0 < 0) r0 = p.rj;
          r1 = p.rj + p.rk;
        }
      }
      const span = r0 >= 0 ? r1 - r0 : 0;
      return { matched, real, ratio: R.length ? matched / R.length : 0, spanRatio: span ? matched / span : 0 };
    }

    /** align R at a place; good means it plausibly is the text recited there */
    tryAt(anchor, R, lookbehind, ahead) {
      const w = this.window(Math.max(0, Math.min(this.N - 1, anchor)), R.length, lookbehind, ahead);
      const a = align(w.E, R, w.ptr);
      const q = this.quality(a, w.E, R);
      const real = a.pairs.filter(p => w.G[p.ei] >= 0);
      const good = real.length > 0 && (R.length <= 2 ? a.score >= 0.3 : (q.ratio >= 0.55 && a.score >= Math.max(0.5, 0.3 * R.length)));
      return { a, E: w.E, G: w.G, q, good, first: real.length ? w.G[real[0].ei] : -1 };
    }

    /** candidate places in the whole Quran for R, best first: [{pos, score, matched, ratio, t}] */
    locateAll(R) {
      if (R.length < 2) return [];
      const idx = this.buildIndex(), uni = this.uindex;
      const votes = new Map();
      const vote = (p, w) => votes.set(p, (votes.get(p) || 0) + w);
      for (let j = 0; j + 1 < R.length; j++) {
        const arr = idx.get(core(R[j].sk) + ' ' + core(R[j + 1].sk));
        if (!arr || arr.length > 600) continue;
        const w = 1 / Math.sqrt(arr.length);
        for (const p of arr) vote(p - j, w);
      }
      // single, rarer words keep the search going when the recogniser garbled every other word
      for (let j = 0; j < R.length; j++) {
        const arr = uni.get(core(R[j].sk));
        if (!arr || arr.length > 150) continue;
        const w = 0.5 / Math.sqrt(arr.length);
        for (const p of arr) vote(p - j, w);
      }
      const seeds = [...votes.entries()].sort((x, y) => y[1] - x[1]);
      const picked = [];
      for (const [s0] of seeds) {
        if (picked.length >= 16) break;
        if (picked.some(p => Math.abs(p - s0) < 8)) continue;
        picked.push(s0);
      }
      const out = [];
      for (const s0 of picked) {
        const t = this.tryAt(Math.max(0, s0), R, 3, Math.round(R.length * 1.4) + 10);
        if (t.first < 0) continue;
        out.push({ pos: t.first, score: t.a.score, matched: t.q.matched, ratio: t.q.ratio, t });
      }
      out.sort((x, y) => y.score - x.score);
      // drop duplicates that resolved to the same place
      const uniq = [];
      for (const c of out) if (!uniq.some(u => Math.abs(u.pos - c.pos) <= 15)) uniq.push(c);
      return uniq;
    }

    /** compatibility helper: best place or -1 */
    locate(R) { const c = this.locateAll(R); return c.length ? c[0].pos : -1; }

    // ---------------------------------------------------------------- neutral phrases
    /** split heard tokens into words and neutral phrases (isti'adha, basmala, closing words) */
    _split(R) {
      const out = [];
      let cur = [];
      for (let i = 0; i < R.length;) {
        let hit = null;
        for (const ph of this._neutral) {                 // in order of preference: complete phrases first
          if (compare(ph.first, R[i].sk.slice(0, ph.first.length + 1), false).sim < 0.6) continue;
          for (const c of [ph.n, ph.n - 1, ph.n + 1, ph.n - 2]) {
            if (c < 1 || i + c > R.length) continue;
            let s = '';
            for (let x = i; x < i + c; x++) s += R[x].sk;
            const sim = compare(ph.sk, s, false).sim;
            if (sim >= ph.th && (!hit || sim > hit.sim + 1e-9)) hit = { name: ph.name, c, sim };
          }
          if (hit) break;
        }
        if (hit) {
          if (cur.length) { out.push({ toks: cur }); cur = []; }
          out.push({ marker: hit.name, toks: R.slice(i, i + hit.c) });
          i += hit.c;
        } else cur.push(R[i++]);
      }
      if (cur.length) out.push({ toks: cur });
      return out;
    }
    /** the last one or two words may be the beginning of a basmala or isti'adha that the next result completes */
    _heldPrefix(R) {
      for (let h = Math.min(2, R.length); h >= 1; h--) {
        let s = '';
        for (let x = R.length - h; x < R.length; x++) s += R[x].sk;
        for (const ph of this._neutral) if (ph.pre[h] && compare(ph.pre[h], s, false).sim >= 0.85) return h;
      }
      return 0;
    }
    /** the phrase is real Quran text right at the pointer (al-Fatiha 1:1, an-Naml 27:30, an-Nahl 16:98) */
    _fitsHere(toks, ptr) {
      const t = this.tryAt(ptr, toks, 2, toks.length + 6);
      return t.good && t.first >= 0 && t.first <= ptr + 2 && t.q.real >= toks.length - 1;
    }
    /** surah that begins at the pointer (or one or two words later: the end of a surah may have been missed) */
    _surahAt(ptr) {
      for (let g = ptr; g <= ptr + 2 && g < this.N; g++) if (this.isSurahStart(g)) return this.surahOfWord(g);
      return 0;
    }
    _wordsOnly(R) {
      if (!R.length) return R;
      const ptr = Math.min(this.pointer, this.N - 1);
      const out = [];
      for (const p of this._split(R)) if (!p.marker || (this.mode === 'track' && this._fitsHere(p.toks, ptr))) for (const t of p.toks) out.push(t);
      return out;
    }

    /** Feed recogniser output of the current session: final strings (in order) and the interim string.
        Long interim results are committed early except for their last words (Safari rarely marks results final). */
    feed(finals, interim) {
      const F = tokenizeHeard(mergeResults(finals));
      const C = interim && interim.trim() ? tokenizeHeard(mergeResults(finals.concat([interim]))) : F;
      const interimLen = Math.max(0, C.length - F.length);
      let P = F.length;
      if (interimLen >= 7) P = C.length - 3;
      let changed = false;
      if (P > this.committedTokens) {
        const chunk = C.slice(this.committedTokens, P);
        this.committedTokens = P;
        this._commit(chunk);
        changed = true;
      }
      const hadTentative = this.tentative.size > 0;
      this.tentative.clear();
      if (this.mode === 'track') {
        const RI = this._wordsOnly(this.carry.concat(C.slice(Math.min(this.committedTokens, C.length))));
        if (RI.length) {
          const { E, G, ptr } = this.window(Math.min(this.pointer, this.N - 1), RI.length);
          const a = align(E, RI, ptr);
          if (a.pairs.length && a.score > -0.5) {
            for (const p of a.pairs) for (let x = 0; x < p.ek; x++) {
              const gi = G[p.ei + x];
              if (gi >= this.pointer) this.tentative.set(gi, ST.OK);
            }
          }
        }
      }
      if (changed || hadTentative || this.tentative.size) this.emit('update', this.state());
    }

    _commit(R) {
      if (this.carry.length) { R = this.carry.concat(R); this.carry = []; }
      const h = this._heldPrefix(R);
      if (h) { this.carry = R.slice(R.length - h); R = R.slice(0, R.length - h); }
      if (!R.length) return;
      for (const part of this._split(R)) {
        if (part.marker) { this._marker(part); continue; }
        this.started = true;
        if (this.mode === 'search') this._search(part.toks);
        else this._track(part.toks);
      }
    }

    /** isti'adha, basmala or closing words were heard */
    _marker(part) {
      const ptr = Math.min(this.pointer, this.N - 1);
      if (this.mode === 'track' && this._fitsHere(part.toks, ptr)) { this.started = true; this._track(part.toks); return; }
      if (part.marker !== 'basm') return;                 // isti'adha and closing words say nothing about the place
      this.pend = []; this.offChunks = 0;                 // what came before the basmala belongs to the last passage
      this.afterBasm = true; this.basmTok = part.toks;
      if (this.mode === 'search') { this.emit('searching', { words: 0, basmala: true }); return; }
      if (this._surahAt(ptr)) return;                     // a surah begins at the pointer, as expected (its words will tell which)
      if (!this.follow) { this.afterBasm = false; this.basmTok = null; return; }   // memorisation test: stay
      // a basmala in the middle of a surah: a new surah (or a new start) begins. Find out where.
      this.mode = 'search'; this.hint = ptr;
      this.emit('searching', { words: 0, basmala: true });
    }

    /** position not known: weigh the place in view, the openings of all surahs and any other place; decide only when one clearly fits */
    _search(R) {
      this.pend = this.pend.concat(R);
      if (this.pend.length > 40) this.pend = this.pend.slice(-30);
      const P = this.pend.length > 16 ? this.pend.slice(-16) : this.pend;
      if (P.length < 3) { this.emit('searching', { words: P.length }); return; }
      const cands = this._candidates(P, P.length === this.pend.length);
      const best = cands[0], second = cands[1];
      if (best) {
        const margin = second ? best.total - second.total : 99;
        const strong = best.real >= (best.prior > 0 ? 3 : 4) && best.spanRatio >= 0.6;
        if (strong && margin >= Math.max(1.0, 0.1 * P.length)) { this._found(best, P); return; }
      }
      this.emit('searching', { words: P.length, ambiguous: !!(best && second) });
    }
    _candidates(P, fromStart) {
      const list = [];
      const add = (t, kind, prior) => {
        if (!t || t.first < 0) return;
        for (const c of list) {
          if (Math.abs(c.pos - t.first) > 6) continue;    // same place, found another way
          if (c.kinds.indexOf(kind) < 0) { c.kinds.push(kind); c.prior += prior; }
          if (t.a.score > c.score) { c.score = t.a.score; c.t = t; c.real = t.q.real; c.spanRatio = t.q.spanRatio; }
          c.total = c.score + c.prior;
          return;
        }
        list.push({ pos: t.first, score: t.a.score, prior, total: t.a.score + prior, real: t.q.real, spanRatio: t.q.spanRatio, t, kinds: [kind] });
      };
      // the place in view (or where the reciter just was), within that surah: the reader shows one surah at a time
      const hs = this.surahOfWord(this.hint);
      const hEnd = hs < 114 ? this.Q.verseStart[this.sStartV[hs + 1]] : this.N;
      add(this.tryAt(this.hint, P, 6, Math.max(1, Math.min(P.length * 2 + 40, hEnd - this.hint))), 'here', 1.0);
      // surah openings: after a basmala the reciter almost always begins a surah
      const sb = this.afterBasm ? 1.5 : 0.4;
      for (const s of fromStart === false ? [] : this._likelyStarts(P)) {
        const g = this.startG(s);
        const t = this.tryAt(g, P, 0, Math.round(P.length * 1.4) + 8);
        // only a match from the very first word counts as an opening: the same words often recur later in another surah (3:2 = 2:255)
        if (t.first === g) add(t, 'start', sb);
      }
      // anywhere else
      for (const c of this.locateAll(P)) add(c.t, 'any', 0);
      list.sort((x, y) => y.total - x.total);
      return list;
    }
    /** quick pass over all 114 openings with the first heard words; the best few are checked in full */
    _likelyStarts(P) {
      const head = P.slice(0, 5), sc = [];
      for (let s = 1; s <= 114; s++) {
        const w = this.window(this.startG(s), head.length, 0, head.length + 4);
        sc.push([align(w.E, head, w.ptr).score, s]);
      }
      sc.sort((x, y) => y[0] - x[0]);
      return sc.slice(0, 6).filter(x => x[0] > 0).map(x => x[1]);
    }
    _found(best, P) {
      let T = best.t, R = P, anchor = best.pos;
      const s = this.surahOfWord(best.pos);
      const atStart = best.pos <= this.startG(s) + 1 && best.pos >= this.startG(s);
      if (this.basmTok && s === 1 && atStart) {           // al-Fatiha: the basmala heard is its first verse
        R = this.basmTok.concat(P); anchor = 0; T = this.tryAt(0, R, 0);
      } else if (this.basmTok && atStart && s !== 9) this.basmHeard.add(s);
      const here = best.kinds.indexOf('here') >= 0;
      if (!here) { this.leftAt = this.hint; this.lastJumpTokens = this.committedTotal; }
      this.mode = 'track'; this.pend = []; this.offChunks = 0; this.afterBasm = false; this.basmTok = null;
      this._apply(T, R, anchor, true);
      this.emit('found', { to: T.first, here });
    }

    /** position known: stay here; switch only on clear, lasting evidence of another place */
    _track(R) {
      const anchor = Math.min(this.pointer, this.N - 1);
      const all = this.pend.length ? this.pend.concat(R) : R;
      const L = this.tryAt(anchor, all);
      // right after a basmala the expected text begins at the pointer, not somewhere further on
      const near = !(this.afterBasm && this.follow) || (L.first >= 0 && L.first <= anchor + 2);
      if (L.good && near) {
        if (this.basmTok) { const s0 = this.surahOfWord(L.first); if (s0 !== 1 && s0 !== 9 && L.first === this.startG(s0)) this.basmHeard.add(s0); }
        this.pend = []; this.offChunks = 0; this.afterBasm = false; this.basmTok = null;
        this._apply(L, all, anchor, false);
        return;
      }
      if (this.afterBasm && this.follow) {
        // a basmala, then not the expected text: the reciter begins another surah. Find it.
        this.mode = 'search'; this.hint = anchor; this.pend = [];
        this._search(all);
        return;
      }
      this.pend = all; this.offChunks++;
      if (all.length >= 6) {
        const cands = this.locateAll(all);
        const best = cands.find(c => this._mayJump(c.pos, anchor));
        const local = best && best.pos >= anchor - this.opts.lookbehind && best.pos <= anchor + all.length * 2 + 30;
        if (best && !local) {
          const second = cands.find(c => c !== best);     // any other place, allowed or not: the evidence must be unique
          const margin = best.score - (second ? second.score : -1);
          let need = Math.max(1.2, 0.12 * all.length);
          if (this.surahOfWord(best.pos) === this.surahOfWord(anchor)) need *= 0.6;      // moving within the surah is common
          if (this.committedTotal - this.lastJumpTokens < 20) need *= 2;                // just switched: be careful
          if (this.leftAt != null && Math.abs(best.pos - this.leftAt) < 40) need *= 2;   // no ping-pong
          const strong = best.t.q.real >= 6 && best.ratio >= 0.75;
          if (strong && margin >= need) {
            this.leftAt = anchor;
            this.lastJumpTokens = this.committedTotal;
            this.pend = []; this.offChunks = 0;
            this._apply(best.t, all, best.pos, true);
            this.emit('jump', { to: best.t.first });
            return;
          }
        }
      }
      if (this.offChunks >= 3 || all.length >= 24) {
        if (this.follow && L.q.real < 0.35 * all.length) {
          // these words fit nowhere near: the reciter is somewhere else. Look for the place instead of marking mistakes.
          this.mode = 'search'; this.hint = anchor; this.pend = []; this.offChunks = 0;
          this._search(all.slice(-16));
          return;
        }
        // no clear other place: these words belong here after all (mistakes or unclear audio)
        this.pend = []; this.offChunks = 0; this._apply(L, all, anchor, false);
      }
    }

    _apply(T, R, anchor, jumped) {
      const { a, G } = T;
      this.committedTotal += R.length;
      for (const p of a.pairs) if (G[p.ei] <= -1000) this.basmHeard.add(-1000 - G[p.ei]);   // a surah's basmala was recited
      const real = a.pairs.filter(p => G[p.ei] >= 0);
      if (!real.length) return;
      const firstG = G[real[0].ei];
      const lp = real[real.length - 1];
      const lastG = G[lp.ei + lp.ek - 1] >= 0 ? G[lp.ei + lp.ek - 1] : G[lp.ei];
      let from = firstG;
      const gap = firstG - anchor;
      if (!jumped && gap >= 1 && gap <= 3) {
        for (let g = anchor; g < firstG; g++) this._missed(g);
        from = anchor;
      }
      for (const p of real) {
        let heard = '', rsk = '';
        for (let x = 0; x < p.rk; x++) { heard += (x ? ' ' : '') + R[p.rj + x].raw; rsk += R[p.rj + x].sk; }
        if (p.ek === 1) {
          const gi = G[p.ei];
          this._result(gi, classify(this.exp(gi), rsk, this.opts.strictness), heard);
        } else {
          let esk = '';
          const gs = [];
          for (let x = 0; x < p.ek; x++) { const g = G[p.ei + x]; if (g >= 0) { esk += this.exp(g).sk; gs.push(g); } }
          const c = classify({ alts: [esk] }, rsk, this.opts.strictness);
          for (const g of gs) this._result(g, c, heard);
        }
      }
      for (const d of a.dels) if (G[d] >= 0) this._missed(G[d]);
      for (const j of a.ins) this.extra.push(R[j].raw);
      this._cover(from, lastG);
      const old = this.pointer;
      this.lastHeard = lastG;
      if (jumped || lastG + 1 > this.pointer) this.pointer = Math.min(this.N, lastG + 1);
      if (this.pointer !== old && this.pointer < this.N && this.isSurahStart(this.pointer)) this.afterBasm = true;   // a surah is finished: a surah opening comes next
      if (this.pointer > old) {
        const vs = this.Q.words[Math.min(old, this.N - 1)].v;
        const ve = this.pointer >= this.N ? this.Q.words[this.N - 1].v + 1 : this.Q.words[this.pointer].v;
        for (let v = vs; v < ve; v++) this.emit('verse', { v });
      }
    }

    _cover(a, b) {
      if (b < a) return;
      this.ranges.push([a, b]);
      this.ranges.sort((x, y) => x[0] - y[0]);
      const out = [];
      for (const r of this.ranges) {
        if (out.length && r[0] <= out[out.length - 1][1] + 1) out[out.length - 1][1] = Math.max(out[out.length - 1][1], r[1]);
        else out.push([r[0], r[1]]);
      }
      this.ranges = out;
    }
    _missed(gi) { if (this.status[gi] === ST.NONE) this.status[gi] = ST.MISSED; }
    _result(gi, c, heard) {
      const prev = this.status[gi];
      if (c.st === ST.OK) {
        if (prev >= ST.MISSED && prev <= ST.MADD) this.status[gi] = ST.CORRECTED;   // self-corrected
        else if (prev !== ST.CORRECTED) this.status[gi] = ST.OK;
        return;
      }
      if (prev === ST.OK || prev === ST.CORRECTED) return;   // a noisy repeat does not undo a correct reading
      this.status[gi] = c.st;
      this.heard.set(gi, heard);
      this.detail.set(gi, c);
    }

    state() { return { pointer: this.pointer, status: this.status, tentative: this.tentative }; }

    summary() {
      const counts = { ok: 0, missed: 0, near: 0, wrong: 0, letter: 0, madd: 0, corrected: 0 };
      const issues = [];
      let words = 0;
      for (const [a, b] of this.ranges) {
        for (let g = a; g <= b; g++) {
          words++;
          const st = this.status[g];
          if (st === ST.OK) { counts.ok++; continue; }
          const key = { 2: 'missed', 3: 'near', 4: 'wrong', 5: 'letter', 6: 'madd', 7: 'corrected' }[st] || 'missed';
          counts[key]++;
          issues.push({ g, st: st || ST.MISSED, heard: this.heard.get(g) || '', detail: this.detail.get(g) || null });
        }
      }
      const r0 = this.ranges.length ? this.ranges[0][0] : -1;
      const r1 = this.ranges.length ? this.ranges[this.ranges.length - 1][1] : -1;
      return { counts, issues, words, from: r0, to: r1, extra: this.extra.slice() };
    }
  }

  return { skeleton, core, compare, classify, buildWords, expectedToken, tokenizeHeard, align, mergeResults, Tracker, ST, CONFUSABLE, isArabicLetter, isMark, clusters };
});
