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

  // words whose modern spelling has no alif where the mushaf writes a small one (هذا, ذلك, لكن, أولئك, إله, الرحمن)
  const PLAIN_NO_ALIF = /هٰذ|هٰؤ|ذٰل|لٰكن|ولٰئك|لٰه|رحمٰن/;
  /** a mushaf word in plain modern spelling without signs, as a recogniser writes it (approximate; to bias the recogniser) */
  function plainText(word) {
    if (!word) return '';
    const cl = clusters(word.replace(/ﷲ/g, 'الله'));
    let plain = '';
    for (const c of cl) { if (c.b !== 'ـ') plain += c.b; if (c.m.indexOf(DAGGER) >= 0) plain += DAGGER; }
    const dAlif = !PLAIN_NO_ALIF.test(plain);
    let out = '';
    for (let i = 0; i < cl.length; i++) {
      const { b, m } = cl[i];
      const hasD = m.indexOf(DAGGER) >= 0, above = m.indexOf('ٔ') >= 0, below = m.indexOf('ٕ') >= 0;
      let hasV = false;
      for (const x of m) if (VOWELS.has(x)) { hasV = true; break; }
      if (b === 'ـ') { if (above) out += 'ئ'; if (hasD && dAlif) out += 'ا'; if (m.indexOf('ۧ') >= 0) out += 'ي'; continue; }
      if (b === 'ۥ' || b === 'ۦ' || SKIP_BASE.has(b) || !isArabicLetter(b)) continue;
      if (b === 'و' && hasD && !hasV) { out += 'ا'; continue; }                              // صلوٰة -> صلاة
      if ((b === 'ى' || b === 'ي') && hasD && !hasV && i < cl.length - 1) { out += 'ا'; continue; }
      if (b === 'ء' && cl[i + 1] && cl[i + 1].b === 'ا') { out += 'آ'; i++; continue; }      // ءَا -> آ
      let ch = b === 'ٱ' ? 'ا' : b;                       // (a madda sign over a long letter is only its length)
      if (b === 'ا') ch = above ? 'أ' : below ? 'إ' : 'ا';
      else if (b === 'و' && above) ch = 'ؤ';
      else if ((b === 'ي' || b === 'ى') && above) ch = 'ئ';
      else if (b === 'أ' && m.indexOf('ٓ') >= 0) ch = 'آ';
      // al- + doubled lam (ٱلَّيۡل): modern spelling writes the lam twice
      if (b === 'ل' && m.indexOf(SHADDA) >= 0 && /^[وفبك]?ا$/.test(out) && cl[i + 1] && cl[i + 1].b !== 'ذ' && cl[i + 1].b !== 'ت') ch = 'لل';
      out += ch;
      if (hasD && dAlif && b !== 'ى') out += 'ا';
      if (m.indexOf('ۧ') >= 0) out += 'ي';
      if (m.indexOf('ۨ') >= 0) out += 'ن';
    }
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
  const ST = { NONE: 0, OK: 1, MISSED: 2, NEAR: 3, WRONG: 4, LETTER: 5, MADD: 6, CORRECTED: 7, HINT: 8 };   // HINT: recited after the app showed the word

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
    if (sk === 'بسم') alts.push('باسم');                // the basmala's بسم is written باسم everywhere else
    return { sk, alts, core: core(sk), muq };
  }

  // ------------------------------------------------------------------ recogniser text
  // phrases around the recitation that are not the place being recited: [name, words, similarity needed]
  // (where they are real Quran text at the pointer, al-Fatiha 1:1, an-Naml 27:30 or an-Nahl 16:98, they count as words)
  const NEUTRAL = [
    // the longer forms of the isti'adha first (the short one would only match them in part)
    ['isti', ['أعوذ', 'بالله', 'السميع', 'العليم', 'من', 'الشيطان', 'الرجيم'], 0.8],
    ['isti', ['أعوذ', 'بالله', 'العظيم', 'من', 'الشيطان', 'الرجيم'], 0.8],
    ['isti', ['أستعيذ', 'بالله', 'من', 'الشيطان', 'الرجيم'], 0.8],
    ['isti', ['أعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم'], 0.8],
    ['basm', ['بسم', 'الله', 'الرحمن', 'الرحيم'], 0.8],
    ['isti', ['من', 'همزه', 'ونفخه', 'ونفثه'], 0.75],                 // ... from his whispering, his pride and his poetry
    ['isti', ['همزه', 'ونفخه', 'ونفثه'], 0.75],
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
  // the words that open a phrase: when a result ends with the first words of one, they wait for the next result
  const OPENERS = new Set(['أعوذ', 'أستعيذ', 'بسم']);
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
      // the same words sent twice; a single word may well be said again (الرحمن after a basmala without الرحيم)
      else if (acc && s.indexOf(' ') > 0 && acc.endsWith(' ' + s)) continue;
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
        // a result that ends with the first words of a phrase waits for the next one, so the phrase is judged whole
        // (only phrases with a rare opening word: أعوذ / بسم hardly ever end a result of real text)
        // (the forms without their first word only before the recitation has begun: بالله and الله are everywhere in the text)
        const pre = [];
        const opener = OPENERS.has(ws[0]), lostFirst = name !== 'end' && ws[0] === 'بالله' || ws[0] === 'الله';
        if (opener || lostFirst) for (let h = 1; h < ws.length; h++) pre[h] = sks.slice(0, h).join('');
        return { name, n: ws.length, th, sk: sks.join(''), sks, first: sks[0], pre, early: lostFirst };
      });
      // every word of these phrases: a failed attempt made only of them is a phrase the recogniser cut up, not a mistake
      this._nvocab = [...new Set(NEUTRAL.map(x => x[1]).reduce((a, b) => a.concat(b), []).map(w => skeleton(w)))];
      this._tail = ['من', 'همزه', 'ونفخه'].map(w => skeleton(w));
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
      // memorising with hidden text: the text must go on at the pointer; wrong verses are counted, not followed
      this.strict = !!(opts && opts.strict);
      this.help = Object.assign({ on: true, tries: 3 }, (opts && opts.help) || {});
      this.revealed = new Set();
      this.tries = 0; this.level = 0; this.fail = null; this.idle = 0; this.idleOpen = false; this.failOpen = false;
      // gate (memorising): the pointer never passes a word that was left out or heard as another word.
      // spot: the word it stopped at and how often; accepted: words let through after the third time (the recogniser may never hear them)
      this.gate = !(opts && opts.gate === false);
      this.spot = null; this.accepted = new Set(); this.vDone = new Set(); this.lastSkip = null; this._says = [];
      this.lookFrom = null; this.graceUntil = null; this.whereAt = -1;
    }
    get follow() { return !this.bounds && !this.stay && !this.strict; }
    get gated() { return this.strict && this.gate; }
    /** text hidden or shown again during the recitation */
    setStrict(on) {
      on = !!on;
      if (on === this.strict) return;
      this.strict = on; this.pend = []; this.offChunks = 0;
      this.tries = 0; this.level = 0; this.fail = null; this.spot = null;
      this.emit('progress', {});
    }
    setHelp(h) {
      this.help = Object.assign({}, this.help, h || {});
      if (!this.help.on) { this.tries = 0; this.level = 0; this.fail = null; this.emit('progress', {}); }
    }
    /** the reciter asks for help (button): the next word, right away */
    requestHint() { if (this.strict && this.mode === 'track') this._hint(true); }
    /** the gate stops at a word left out or heard as another word; at normal strictness also at a word that sounded
        different, at strict also at a single letter or a lengthening */
    _stops(st) {
      if (st === ST.NONE || st === ST.MISSED || st === ST.WRONG) return true;
      const k = this.opts.strictness;
      return (st === ST.NEAR && k >= 1) || ((st === ST.LETTER || st === ST.MADD) && k >= 2);
    }
    /** the reciter gives up on this verse (button): its words count as shown, it goes on with the next verse */
    skipVerse() {
      if (!this.strict || this.mode !== 'track' || this.pointer >= this.N) return;
      const g0 = this.pointer, v = this.Q.words[g0].v, end = this.Q.verseStart[v + 1];
      for (let g = g0; g < end; g++) { this.revealed.add(g); if (this.status[g] !== ST.OK && this.status[g] !== ST.CORRECTED) this.status[g] = ST.HINT; }
      this._cover(g0, end - 1);
      this.pointer = end; this.spot = null; this.pend = []; this.carry = [];
      this.emit('hint', { kind: 'verse', v, words: [], manual: true });
      this._versesDone(g0);
      this._progress(true);
      this.emit('update', this.state());
    }
    _mayJump(pos, anchor) {
      if (this.bounds) return pos >= this.bounds[0] && pos <= this.bounds[1];
      if (this.stay) return this.surahOfWord(pos) === this.surahOfWord(anchor);
      return true;
    }
    newSession() {
      this.committedTokens = 0; this.sessTokens = []; this.tentative.clear(); this.failOpen = false; this.idleOpen = false;
      // memorising: a lone word left from the last result is judged on its own, not glued to the next attempt
      if (this.strict && this.mode === 'track' && this.pend.length) {
        const p = this.pend; this.pend = [];
        this._strictFit(Math.min(this.pointer, this.N - 1), p, false);
      }
      // a pause in the middle of a verse: where the reciter was (also when the recogniser lost the last word of a verse)
      const g = this.pointer;
      if (this.gated && this.mode === 'track' && !this.spot && g < this.N && g > 0 && this.Q.words[g].k > 0 && this.status[g - 1] && !this.status[g] &&
          (!this.bounds || g <= this.bounds[1]) && this.whereAt !== g) { this.whereAt = g; this.emit('say', { type: 'where', g, from: g - 1 }); }
    }
    /** the reciter says: continue at this word */
    moveTo(gi) {
      this.pointer = Math.max(0, Math.min(this.N - 1, gi)); this.mode = 'track';
      this.pend = []; this.offChunks = 0; this.afterBasm = false; this.basmTok = null; this.carry = [];
      this.tries = 0; this.level = 0; this.fail = null;
      this.newSession();
      this.emit('progress', {});
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
    /** the neutral phrase that begins at R[i] and ends before R[end], or null */
    _phraseAt(R, i, end) {
      let hit = null;
      for (const ph of this._neutral) {                   // in order of preference: complete phrases first
        if (compare(ph.first, R[i].sk.slice(0, ph.first.length + 1), false).sim < 0.6) continue;
        for (const c of [ph.n, ph.n - 1, ph.n + 1, ph.n - 2]) {
          if (c < 1 || i + c > end) continue;
          let s = '';
          for (let x = i; x < i + c; x++) s += R[x].sk;
          const sim = compare(ph.sk, s, false).sim;
          if (sim >= ph.th && (!hit || sim > hit.sim + 1e-9)) hit = { name: ph.name, c, sim, ph };
        }
        if (hit) break;
      }
      return hit;
    }
    /** split heard tokens into words and neutral phrases (isti'adha, basmala, closing words) */
    _split(R) {
      const out = [];
      let cur = [];
      for (let i = 0; i < R.length;) {
        let hit = this._phraseAt(R, i, R.length);
        // the recogniser lost the last word of the phrase, and the first word of the text took its place
        // (بسم الله الرحمن | الرحمن, أعوذ بالله من الشيطان | الم): the phrase without that word fits clearly better,
        // and the word is not just the phrase's own last word misheard (الرجيم as الرحيم)
        while (hit && hit.c > 1) {
          const t = this._phraseAt(R, i, i + hit.c - 1);
          if (!t || t.sim <= hit.sim + 0.02) break;
          const tok = R[i + hit.c - 1].sk, own = this._wordSim(hit.ph.sks[hit.ph.n - 1], tok);
          if (own >= 0.75 && this._textNext(tok) <= own + 0.05) break;
          hit = t;
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
    /** the last words may be the beginning of a basmala or isti'adha that the next result completes */
    _heldPrefix(R) {
      for (let h = Math.min(6, R.length); h >= 1; h--) {
        let s = '';
        for (let x = R.length - h; x < R.length; x++) s += R[x].sk;
        for (const ph of this._neutral) if (ph.pre[h] && (!ph.early || !this.started) && compare(ph.pre[h], s, false).sim >= 0.85) return h;
      }
      return 0;
    }
    /** while following: how well the word fits one of the next words of the text (0 when the place is not known) */
    _textNext(sk) {
      if (this.mode !== 'track') return 0;
      let best = 0;
      for (let g = this.pointer; g < Math.min(this.N, this.pointer + 2); g++) {
        for (const alt of this.exp(g).alts) best = Math.max(best, compare(alt, sk, false).sim);
      }
      return best;
    }
    /** similarity of two words, with or without the article (الرجيم / رجيم) */
    _wordSim(a, b) {
      const s = compare(a, b, false).sim;
      const a2 = a.replace(/^ال/, ''), b2 = b.replace(/^ال/, '');
      return a2 === a && b2 === b ? s : Math.max(s, compare(a2, b2, false).sim);
    }
    /** a word of the isti'adha, basmala or closing words */
    _isNeutralWord(sk) {
      for (const w of this._nvocab) if (this._wordSim(w, sk) >= 0.8) return true;
      return false;
    }
    /** only words of the isti'adha, basmala or closing words (pieces of them the recogniser cut apart) */
    _neutralOnly(R) {
      if (!R.length) return false;
      for (const t of R) if (!this._isNeutralWord(t.sk)) return false;
      return true;
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
        this.sessTokens = C.slice(0, P);
        this._commit(chunk);
        changed = true;
      }
      const hadTentative = this.tentative.size > 0;
      this.tentative.clear();
      if (this.mode === 'track') {
        const RI = this._wordsOnly(this.carry.concat(C.slice(Math.min(this.committedTokens, C.length))));
        if (RI.length) {
          const anchor = Math.min(this.pointer, this.N - 1);
          const { E, G, ptr } = this.strict ? this.window(anchor, RI.length, this._runUp(anchor), RI.length + 3) : this.window(anchor, RI.length);
          const a = align(E, RI, ptr);
          // memorising: show words only when they really are the next ones (a wrong verse must not flash up)
          if (a.pairs.length && a.score > -0.5 && (!this.strict || (a.score > 0.4 && this.quality(a, E, RI).ratio >= 0.6))) {
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
      const parts = this._split(R);
      // the isti'adha may go on with من همزه ونفخه ونفثه: its first words wait for the next result
      const last = parts[parts.length - 1];
      const before = parts.length > 1 ? parts[parts.length - 2].marker : this.lastMarker;
      if (before === 'isti' && !last.marker && last.toks.length <= 3 && !this.carry.length &&
          compare(this._tail.slice(0, last.toks.length).join(''), last.toks.map(t => t.sk).join(''), false).sim >= 0.85) {
        this.carry = last.toks; parts.pop();
      }
      for (const part of parts) {
        this.lastMarker = part.marker || null;
        if (part.marker) { this._marker(part); continue; }
        this.started = true;
        if (this.mode === 'search') this._search(part.toks);
        else if (this.strict) this._trackStrict(part.toks);
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

    // ---------------------------------------------------------------- memorising (text hidden)
    /** how far back a run-up may start: the beginning of the previous verse of the same surah */
    _runUp(anchor) {
      const v = this.Q.words[anchor].v;
      const pv = v > 0 && this.Q.verseSurah[v - 1] === this.Q.verseSurah[v] ? v - 1 : v;
      const lb = Math.min(anchor - this.Q.verseStart[pv], 60);
      // after the gate let the reciter through to where he had read on: reading the mended verse again is no repeat
      return this.lookFrom != null && this.lookFrom < anchor ? Math.max(lb, Math.min(anchor - this.lookFrom, 120)) : lb;
    }
    _strictTry(anchor, R, lb) { return this.tryAt(anchor, R, lb == null ? this._runUp(anchor) : lb, Math.round(R.length * 1.5) + 6); }
    /** how similar the heard words of an aligned pair are to the expected ones */
    _pairSim(T, p, R) {
      let rs = '';
      for (let x = 0; x < p.rk; x++) rs += R[p.rj + x].sk;
      if (p.ek === 1) { let s = 0; for (const alt of T.E[p.ei].alts) s = Math.max(s, compare(alt, rs, false).sim); return s; }
      let es = '';
      for (let x = 0; x < p.ek; x++) es += T.E[p.ei + x].sk;
      return compare(es, rs, false).sim;
    }
    /** does R go on at the pointer? A run-up from the previous verse is fine; a skipped verse (at the start or inside) is not */
    _strictOk(anchor, R, needProgress, full, lb) {
      const L = this._strictTry(anchor, R, lb);
      if (!L.good) return null;
      const real = L.a.pairs.filter(p => L.G[p.ei] >= 0);
      if (!real.length) return null;
      if (R.length <= 2 && L.q.matched < R.length) {
        // one or two words, not all fitting: fine if they are noise, not if they are another verse (ثم أدبر after ثم نظر)
        const c = this.locateAll(R)[0];
        if (c && (c.pos < anchor - this._runUp(anchor) - 2 || c.pos > anchor + 4) && c.t.q.real > L.q.real) return null;
      }
      const VS = this.Q.verseStart, W = this.Q.words;
      const first = L.G[real[0].ei];
      const lp = real[real.length - 1];
      if (lb === 0 && this._pairSim(L, real[0], R) < 0.6) return null;   // forced onto the pointer word (a run-up glued to it): let the run-up try
      const lastG = L.G[lp.ei + lp.ek - 1] >= 0 ? L.G[lp.ei + lp.ek - 1] : L.G[lp.ei];
      if (needProgress && lastG < anchor) return null;
      // left out: at the start up to five words (the end of a verse may be swallowed by the recogniser), inside no run of four;
      // a whole verse of three or more words never (that is a skipped verse, not a missed word).
      // (with the gate, words already heard after the word it stopped at are not left out)
      const heardBefore = g => this.gated && this.status[g] !== ST.NONE && this.status[g] !== ST.MISSED;
      const gone = new Set();
      for (let g = anchor; g < first; g++) if (!heardBefore(g)) gone.add(g);
      if (gone.size > 5) return null;
      for (const d of L.a.dels) if (L.G[d] >= 0 && !heardBefore(L.G[d])) gone.add(L.G[d]);
      let run = 0;
      for (let g = Math.max(first, anchor); g <= lastG; g++) { run = gone.has(g) ? run + 1 : 0; if (run >= 4) return null; }
      const seenV = new Set();
      for (const g of gone) {
        const v = W[g].v;
        if (seenV.has(v)) continue;
        seenV.add(v);
        const len = VS[v + 1] - VS[v];
        if (len < 3) continue;
        let n = 0;
        for (let x = VS[v]; x < VS[v + 1]; x++) if (gone.has(x)) n++;
        if (n >= Math.max(3, Math.ceil(0.6 * len))) return null;   // (most of) a verse left out: it was skipped
      }
      // only partly fitting: if another passage explains these words clearly better, the reciter is there (16:85 / 16:86)
      if (!full && L.q.ratio < 0.8 && R.length >= 3) {
        const c = this.locateAll(R)[0];
        if (c && (c.pos < anchor - this._runUp(anchor) - 2 || c.pos > anchor + R.length + 3) && c.t.q.real >= L.q.real + 2) return null;
      }
      // when the words are split off a longer result, the split must end on a clearly recognised word
      if (full) {
        if (L.a.ins.indexOf(R.length - 1) >= 0 || L.q.ratio < 0.8) return null;
        const p = lp.rj + lp.rk === R.length ? lp : null;
        if (!p || p.ek !== 1) return null;
        let sim = 0;
        for (const alt of L.E[p.ei].alts) sim = Math.max(sim, compare(alt, R.slice(p.rj, p.rj + p.rk).map(x => x.sk).join(''), false).sim);
        if (sim < 0.75) return null;
      }
      return L;
    }
    _strictFit(anchor, R, needProgress, full, lb) {
      const L = this._strictOk(anchor, R, needProgress, full, lb);
      if (!L) return false;
      return this._takeStrict(L, R, anchor);
    }
    /** the gate stopped at a word: is it there now (read again, heard well enough)? */
    _fills(L, R) {
      const g = this.spot.g;
      for (const p of L.a.pairs) for (let x = 0; x < p.ek; x++) if (L.G[p.ei + x] === g) return this._pairSim(L, p, R) >= 0.6;
      return false;
    }
    _takeStrict(L, R, anchor) {
      const before = this.pointer;
      this._apply(L, R, anchor, false);
      const real0 = L.a.pairs.find(p => L.G[p.ei] >= 0);
      this._says = [];
      const stopped = this.gated ? this._gate(before, L.G[real0.ei]) : (this._versesDone(before), false);
      if (this.pointer > before) this._progress();
      // what the gate has to say comes after "going on" (the reciter went on, up to the word it stopped at)
      for (const e of this._says.splice(0)) this.emit('say', e);
      if (this.pointer > before) return true;
      else if (stopped) return true;
      else if (this.graceUntil != null && this.pointer <= this.graceUntil) return true;   // reading the mended verse again
      else if (!this.idleOpen) {
        // only the run-up again, without going on: once is a run-up, from the second time on it is being stuck
        this.idleOpen = true;
        if (++this.idle >= 2) {
          const real = L.a.pairs.filter(p => L.G[p.ei] >= 0);
          this._count({ kind: 'repeat', pos: L.G[real[0].ei], end: before - 1, anchor, va: this.Q.words[anchor].v, vp: this.Q.words[L.G[real[0].ei]].v });
        }
      }
      return true;
    }
    /** the whole result is (almost) word for word another passage: the reciter is there, not here */
    _elsewhere(anchor, R) {
      if (R.length < 3) return false;
      const c = this.locateAll(R)[0];
      if (!c || c.t.q.real < R.length - 1 || c.ratio < 0.85) return false;
      return c.pos < anchor - this._runUp(anchor) || c.pos > anchor + 2;
    }
    /** memorising: never follow the reciter to another verse; a wrong verse is a failed attempt */
    _trackStrict(R) {
      const anchor = Math.min(this.pointer, this.N - 1);
      const all = this.pend.length ? this.pend.concat(R) : R;
      this.pend = [];
      // still reading on in the wrong passage of this attempt (even where some words happen to fit here)
      const f = this.fail;
      if (this.failOpen && f && f.end != null && f.end + 1 < this.N) {
        const c = this.tryAt(f.end + 1, all, 1, all.length + 3);
        if (c.good && c.first >= f.end && c.first <= f.end + 2) {
          const real = c.a.pairs.filter(p => c.G[p.ei] >= 0), lp = real[real.length - 1];
          f.end = c.G[lp.ei + lp.ek - 1] >= 0 ? c.G[lp.ei + lp.ek - 1] : c.G[lp.ei];
          return;
        }
      }
      if (this.gated && this.spot) {
        // the gate stopped at a word. Going back to it comes first (the same words may follow later: 102:3-4)
        const L = this._strictOk(anchor, all, true, false);
        if (L && this._fills(L, all)) { this._takeStrict(L, all, anchor); return; }
        // reading on after it: taken as heard, the pointer waits at the spot
        if (this._spotGoesOn(all)) return;
      }
      // words that occur twice close together (78:4-5, 94:5-6, 109:3-5): going on is likelier than repeating
      if (this._strictFit(anchor, all, true, false, 0)) return;
      if (this._strictFit(anchor, all, false)) return;
      // leftovers of the isti'adha or basmala (الرجيم, الرحيم) before the text
      let k = 0;
      while (k < all.length - 1 && this._isNeutralWord(all[k].sk) && this._textNext(all[k].sk) < 0.75) k++;
      if (k && this._strictFit(anchor, all.slice(k), true, false, 0)) return;
      if (all.length < 2) { this.pend = all; return; }     // one word says nothing yet
      if (!this._elsewhere(anchor, all)) {
        // a right beginning, then off: keep the right part, judge the rest on its own
        for (let k = all.length - 1; k >= 2; k--) {
          if (this._strictFit(anchor, all.slice(0, k), true, true)) { if (all.length - k >= 1) this._trackStrict(all.slice(k)); return; }
        }
        // a false start, then the right words
        for (let k = 1; k <= all.length - 2; k++) if (this._strictFit(anchor, all.slice(k), true, true)) return;
      }
      if (this._neutralOnly(all)) return;                 // a piece of the isti'adha or basmala, not an attempt
      this._failed(all, anchor);
    }
    _progress(force) {
      const had = this.tries || this.level || this.fail;
      this.tries = 0; this.level = 0; this.fail = null; this.failOpen = false; this.idle = 0; this.afterBasm = false; this.basmTok = null;
      if (this.graceUntil != null && this.pointer > this.graceUntil) { this.graceUntil = null; this.lookFrom = null; }
      if (had || force) this.emit('progress', {});
    }

    /** the gate: what was just read may only be passed where every word was heard. Stops at the first word that was
        left out or heard as another word: the first time it may be the recogniser (read it again), the second time the
        word is shown, the third time it is let through (some words the recogniser never hears). True when it stopped. */
    _gate(before, firstG) {
      // at: where the reciter is now; reach: the furthest he has read. Words read after the spot were heard already:
      // once the spot is filled, the pointer may pass them too
      const sp = this.spot, at = this.pointer;
      const reach = Math.max(at, sp && sp.reach || 0);
      for (let g = before; g < reach; g++) {
        const st = this.status[g];
        if (!this._stops(st) || this.accepted.has(g)) continue;
        const again = sp && sp.g === g;
        if (again && firstG > g && firstG >= sp.at - 1) {
          // read on after the spot (not back to it): nothing new to say
          sp.reach = reach; sp.at = at; this.pointer = g;
          if (st === ST.MISSED) this.status[g] = ST.NONE;
          return true;
        }
        const n = again ? sp.n + 1 : 1;
        const wrong = st !== ST.NONE && st !== ST.MISSED, heard = this.heard.get(g) || '';
        if (n >= 3) {
          this.accepted.add(g); this.spot = null;
          if (st === ST.NONE) this.status[g] = ST.MISSED;
          this._says.push({ type: 'accept', g, wrong, heard });
          continue;
        }
        this.spot = { g, n, reach, at };
        this.pointer = g;
        const from = this._fromWord(g);
        if (n === 1) {
          if (!wrong) this.status[g] = ST.NONE;           // perhaps only the recogniser lost it: judged afresh when read again
          this._says.push({ type: wrong ? 'misheard' : 'unheard', g, from, heard });
        } else {
          this.revealed.add(g);                            // the same place again: say which word belongs here
          this._says.push({ type: wrong ? 'wrong' : 'missing', g, from, heard });
        }
        this._versesDone(before);
        this.emit('update', this.state());
        return true;
      }
      if (reach > this.pointer) {
        // the spot is mended: on to where the reciter had read; reading the mended verse again from there is fine
        this.lookFrom = this.Q.verseStart[this.Q.words[Math.min(before, this.N - 1)].v];
        this.graceUntil = reach; this.idle = 0;
        this.pointer = reach;
      }
      this.spot = null;
      this._versesDone(before);
      return false;
    }
    /** the gate stopped at a word, and the reciter reads on after it (not back to it): the words are taken as heard,
        the pointer stays at the spot. Crossing into the next verse, the reciter is reminded once. */
    _spotGoesOn(R) {
      const sp = this.spot;
      if (!sp || !(sp.at > sp.g + 1) || sp.at >= this.N) return false;
      const L = this.tryAt(sp.at, R, 1, R.length + 6);
      if (!L.good) return false;
      const real = L.a.pairs.filter(p => L.G[p.ei] >= 0);
      if (!real.length || L.G[real[0].ei] <= sp.g + 1 || L.q.ratio < 0.6) return false;
      const lp = real[real.length - 1];
      const lastG = L.G[lp.ei + lp.ek - 1] >= 0 ? L.G[lp.ei + lp.ek - 1] : L.G[lp.ei];
      if (this.bounds && lastG > this.bounds[1] + 2) return false;
      this._apply(L, R, sp.at, false);
      sp.at = lastG + 1; sp.reach = Math.max(sp.reach, sp.at);
      this.pointer = sp.g;
      const vEnd = this.Q.verseStart[this.Q.words[sp.g].v + 1];
      if (sp.reach > vEnd && !sp.told) {
        sp.told = true;
        this.emit('say', { type: 'open', g: sp.g, from: this._fromWord(sp.g), n: sp.n });
      }
      this.emit('update', this.state());
      return true;
    }
    /** where to start again before word g: a word or two earlier in the same verse (g itself at the start of a verse) */
    _fromWord(g) {
      const vs = this.Q.verseStart[this.Q.words[g].v];
      return Math.max(vs, g - 2);
    }
    /** a few words before the pointer, in the same surah: where to start again */
    _runUpWords() {
      const g = Math.min(this.pointer, this.N - 1);
      const s0 = this.Q.verseStart[this.sStartV[this.surahOfWord(g)]];
      const out = [];
      for (let x = Math.max(s0, g - 3); x < g; x++) out.push(x);
      return out;
    }
    /** verses the pointer has passed: reported once each, with what was not quite right in them */
    _versesDone(before) {
      const W = this.Q.words, VS = this.Q.verseStart;
      for (let v = W[Math.min(before, this.N - 1)].v; v < VS.length - 1 && VS[v + 1] <= this.pointer; v++) {
        if (this.vDone.has(v)) continue;
        this.vDone.add(v);
        const issues = [];
        let help = false;
        for (let g = VS[v]; g < VS[v + 1]; g++) {
          const st = this.status[g];
          if (st === ST.HINT) help = true;
          if (st !== ST.OK) issues.push({ g, st: st || ST.MISSED, heard: this.heard.get(g) || '' });
        }
        if (this.lastSkip && v >= this.lastSkip.vp) this.lastSkip = null;
        this.emit('verseDone', { v, issues, help });
      }
    }
    /** where the wrong words come from: skipped ahead, an earlier verse again, or a similar verse elsewhere */
    _diagnose(R, anchor) {
      const cands = this.locateAll(R);
      if (!cands.length) return { kind: 'unclear', anchor };
      // equally good places (refrains): take the one closest to where the reciter should be
      let best = cands[0];
      const as = this.surahOfWord(anchor);
      for (const c of cands) {
        if (c.score < cands[0].score - 0.5) continue;
        const near = x => (this.surahOfWord(x.pos) === as ? 0 : 1e6) + Math.abs(x.pos - anchor);
        if (near(c) < near(best)) best = c;
      }
      if (best.t.q.real < Math.min(3, R.length) || best.ratio < 0.6) return { kind: 'unclear', anchor };
      const T = best.t, real = T.a.pairs.filter(p => T.G[p.ei] >= 0);
      const lp = real[real.length - 1];
      const end = T.G[lp.ei + lp.ek - 1] >= 0 ? T.G[lp.ei + lp.ek - 1] : T.G[lp.ei];
      const pos = best.pos, W = this.Q.words, va = W[anchor].v, vp = W[pos].v;
      const out = { pos, end, anchor, va, vp };
      if (this.Q.verseSurah[vp] !== this.Q.verseSurah[va]) out.kind = 'other';
      else if (pos > anchor) { out.kind = vp === va ? 'words' : 'skip'; out.n = vp - va; out.mid = anchor > this.Q.verseStart[va]; }
      else out.kind = 'repeat';
      return out;
    }
    _failed(R, anchor) {
      const d = this._diagnose(R, anchor);
      if (d.kind === 'unclear' && R.length < 3) return;    // a word or two of noise is no attempt
      // the next verse first, then this one, and now the one after the next: two verses swapped
      if (d.kind === 'skip' && d.n === 1 && !d.mid && this.lastSkip && this.lastSkip.vp === d.va) { d.kind = 'order'; d.swap = this.lastSkip.va; }
      else if (d.kind === 'skip') this.lastSkip = { va: d.va, vp: d.vp };
      const f = this.fail;
      // reading on in the same wrong passage is still the same attempt; starting again (further back) or after a pause is a new one
      const restart = !!(f && d.pos != null && f.pos != null && this.surahOfWord(d.pos) === this.surahOfWord(f.pos) && d.pos < f.end - 3);
      const onward = !!(f && f.kind === d.kind && d.pos != null && f.end != null && d.pos > f.pos + 1 && d.pos >= f.end - 2 && d.pos <= f.end + 12);
      const same = (this.failOpen && f && !restart) || onward;
      if (!same || d.kind !== 'unclear' || !f) this.fail = d;
      this.failOpen = true;
      if (same) return;
      this._count(d);
    }
    _count(d) {
      if (d.kind !== 'unclear' || !this.fail) this.fail = d;
      this.tries++;
      this.emit('attempt', { tries: this.tries, max: this.help.tries, kind: d.kind, fail: this.fail });
      if (this.help.on && this.tries >= this.help.tries) this._hint(false);
    }
    /** help, one step each time the attempts are used up: first where to start again (the last words before the spot,
        and what went wrong, if known), then the next word, one more each time. The button shows the next word right away. */
    _hint(manual) {
      this.tries = 0;
      const d = this.fail;
      if (!manual && this.level === 0) {
        this.level = 1;
        const words = this._runUpWords();
        if (words.length || (d && d.kind !== 'unclear')) { this.emit('hint', { kind: 'runup', words, fail: d, manual: false }); return; }
      }
      let g = Math.min(this.pointer, this.N - 1);
      while (g < this.N && this.revealed.has(g)) g++;
      if (g >= this.N || (this.bounds && g > this.bounds[1])) return;
      this.revealed.add(g);
      this.level = Math.max(2, this.level + 1);
      const words = [];
      for (let x = Math.min(this.pointer, this.N - 1); x <= g; x++) if (this.revealed.has(x) && !this.status[x]) words.push(x);
      this.emit('hint', { kind: 'word', g, words, manual: !!manual });
      this.emit('update', this.state());
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
    // (a word shown by the app but still not heard: with the gate it stays open, it must be read)
    _missed(gi) { if (this.status[gi] === ST.NONE) this.status[gi] = this.revealed.has(gi) && !this.gated ? ST.HINT : ST.MISSED; }
    _result(gi, c, heard) {
      const prev = this.status[gi];
      if (c.st === ST.OK && this.revealed.has(gi)) {          // shown by the app first: right, but with help
        if (prev !== ST.OK && prev !== ST.CORRECTED) this.status[gi] = ST.HINT;
        return;
      }
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

    /** n-best: of the recogniser's alternatives for one final result, the one that fits the expected text best.
        prev: the session's earlier final results. The recogniser's own first choice wins a tie, and nothing is changed
        once part of this result was taken early from the interim text. */
    pick(alts, prev) {
      if (!alts || alts.length < 2 || this.mode !== 'track') return 0;
      // part of this result may have been taken early from the interim text: then only alternatives that begin with it
      const base = tokenizeHeard(mergeResults(prev || [])).length;
      const early = this.committedTokens - base;
      const taken = early > 0 ? (this.sessTokens || []).slice(base, this.committedTokens).map(t => t.sk).join(' ') : '';
      const anchor = Math.min(this.pointer, this.N - 1);
      const lb = this.strict ? this._runUp(anchor) : this.opts.lookbehind;
      let best = 0, bestSc = -Infinity;
      for (let i = 0; i < alts.length; i++) {
        let T = tokenizeHeard(alts[i]);
        if (early > 0) {
          if (T.slice(0, early).map(t => t.sk).join(' ') !== taken) continue;
          T = T.slice(early);
        }
        const R = this._wordsOnly(this.carry.concat(T));
        let sc = 0;
        if (R.length) { const w = this.window(anchor, R.length, lb, R.length + 6); sc = align(w.E, R, w.ptr).score; }
        if (i === 0) sc += 0.5;
        if (sc > bestSc + 1e-9) { bestSc = sc; best = i; }
      }
      return best;
    }
    /** the expected text from word g on, in plain modern spelling, as a few short phrases (to bias the recogniser) */
    phrasesAt(g, maxWords) {
      const out = [];
      let cur = [];
      const end = Math.min(this.N, g + (maxWords || 24));
      for (let x = Math.max(0, g); x < end; x++) {
        const w = this.Q.words[x];
        if (cur.length && (w.k === 0 || cur.length >= 6)) { out.push(cur.join(' ')); cur = []; }
        const p = plainText(w.t);
        if (p) cur.push(p);
      }
      if (cur.length) out.push(cur.join(' '));
      return out;
    }

    state() { return { pointer: this.pointer, status: this.status, tentative: this.tentative }; }

    summary() {
      const counts = { ok: 0, missed: 0, near: 0, wrong: 0, letter: 0, madd: 0, corrected: 0, hint: 0 };
      const issues = [];
      let words = 0;
      for (const [a, b] of this.ranges) {
        for (let g = a; g <= b; g++) {
          words++;
          const st = this.status[g];
          if (st === ST.OK) { counts.ok++; continue; }
          const key = { 2: 'missed', 3: 'near', 4: 'wrong', 5: 'letter', 6: 'madd', 7: 'corrected', 8: 'hint' }[st] || 'missed';
          counts[key]++;
          issues.push({ g, st: st || ST.MISSED, heard: this.heard.get(g) || '', detail: this.detail.get(g) || null });
        }
      }
      const r0 = this.ranges.length ? this.ranges[0][0] : -1;
      const r1 = this.ranges.length ? this.ranges[this.ranges.length - 1][1] : -1;
      return { counts, issues, words, from: r0, to: r1, extra: this.extra.slice() };
    }
  }

  return { skeleton, core, compare, classify, buildWords, expectedToken, tokenizeHeard, align, mergeResults, Tracker, ST, CONFUSABLE, isArabicLetter, isMark, clusters, plainText };
});
