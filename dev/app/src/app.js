/* MyHifz: reader, recitation, hifz and vocabulary. Plain JS, no framework. */
(function () {
  'use strict';
  const QC = window.QuranCore;
  const IS_PREVIEW = !!(window.claude && typeof window.claude.use === 'function');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const TOTAL_VERSES = 6236;
  const APP_VERSION = '/*APP_VERSION*/';

  // ------------------------------------------------------------------ small helpers
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const arNum = n => String(n).replace(/\d/g, d => AR_DIGITS[d]);
  const fmt = n => n.toLocaleString('de-DE');
  const today = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  const ICON = {
    read: '<svg class="i" viewBox="0 0 24 24"><path d="M3.5 5.8c2.9-1.3 5.6-1.2 8.5.6v13c-2.9-1.8-5.6-1.9-8.5-.6z"/><path d="M20.5 5.8c-2.9-1.3-5.6-1.2-8.5.6v13c2.9-1.8 5.6-1.9 8.5-.6z"/></svg>',
    hifz: '<svg class="i" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><path d="M13.5 17l2.3 2.3 4.7-4.8"/></svg>',
    words: '<svg class="i" viewBox="0 0 24 24"><rect x="6.5" y="3.5" width="13" height="15" rx="2.2"/><path d="M4.5 7.5v11.2c0 1 .8 1.8 1.8 1.8h9.2"/><path d="M10 9.5h6M10 13h4"/></svg>',
    mic: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    gear: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    type: '<svg class="i" viewBox="0 0 24 24"><path d="M4 18 8.5 6h1L14 18M5.5 14h6.5"/><path d="M15.5 11.5c.5-1.1 1.5-1.7 2.7-1.7 1.6 0 2.6 1 2.6 2.6V18M20.8 14.2c-3.1 0-5.3.6-5.3 2.2 0 1 .8 1.7 2 1.7 1.8 0 3.3-1.3 3.3-3.3"/></svg>',
    eye: '<svg class="i" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg class="i" viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.4 6.5C3.9 8.2 2.5 12 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    close: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    bulb: '<svg class="i" viewBox="0 0 24 24"><path d="M9.5 17.5h5M10.5 20.5h3"/><path d="M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.5 1 1.2 1 2v.5h4.8V16c0-.8.4-1.5 1-2A5.8 5.8 0 0 0 12 3.5z"/></svg>',
    down: '<svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    left: '<svg class="i" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg class="i" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    stop: '<svg class="i" viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
    search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    copy: '<svg class="i" viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>',
    play: '<svg class="i" viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></svg>',
  };

  // ------------------------------------------------------------------ storage
  const KEY = 'rahle.v1';
  const DEFAULT_SETTINGS = { theme: 'system', qsize: 27, tajweed: false, layout: 'flow', translation: true, strict: 1, live: true, heard: true, newPerDay: 10, hints: true, tries: 3 };
  function defaults() {
    return { v: 1, mem: '', pages: {}, sessions: [], vocab: {}, queue: [], tests: {}, recent: [], settings: Object.assign({}, DEFAULT_SETTINGS), pos: { v: 0 }, tab: 'read' };
  }
  const Store = {
    data: defaults(),
    ok: true,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.v === 1) this.data = Object.assign(defaults(), d, { settings: Object.assign({}, DEFAULT_SETTINGS, d.settings || {}) });
        }
      } catch (e) { this.ok = false; }
    },
    write() { try { localStorage.setItem(KEY, JSON.stringify(Store.data)); } catch (e) { Store.ok = false; } },
    save: debounce(() => Store.write(), 350),
  };
  // never lose the last change when the app is closed or sent to the background
  window.addEventListener('pagehide', () => Store.write());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Store.write(); });

  // memorised verses as a bitset
  let MEM = new Uint8Array(Math.ceil(TOTAL_VERSES / 8));
  function memLoad() {
    MEM = new Uint8Array(Math.ceil(TOTAL_VERSES / 8));
    if (!Store.data.mem) return;
    try { const bin = atob(Store.data.mem); for (let i = 0; i < bin.length && i < MEM.length; i++) MEM[i] = bin.charCodeAt(i); } catch (e) { /* ignore broken value */ }
  }
  function memStore() { let s = ''; for (let i = 0; i < MEM.length; i++) s += String.fromCharCode(MEM[i]); Store.data.mem = btoa(s); Store.save(); }
  const memHas = v => (MEM[v >> 3] >> (v & 7)) & 1;
  function memSet(v, on) { if (on) MEM[v >> 3] |= 1 << (v & 7); else MEM[v >> 3] &= ~(1 << (v & 7)); }

  // ------------------------------------------------------------------ data
  const D = { quran: null, Q: null, pageOf: null, juzOf: null, pageStart: null, juzStart: null, de: null, tj: null, lex: null, wd: null, pending: {} };
  async function getJSON(name) {
    const r = await fetch(name, { cache: 'force-cache' });
    if (!r.ok) throw new Error(name + ' ' + r.status);
    return r.json();
  }
  async function loadCore() {
    D.quran = await getJSON('quran.json');
    D.Q = QC.buildWords(D.quran);
    D.pageStart = D.quran.pages; D.juzStart = D.quran.juz;
    D.pageOf = new Uint16Array(TOTAL_VERSES); D.juzOf = new Uint8Array(TOTAL_VERSES);
    for (let p = 0; p < 604; p++) { const a = D.pageStart[p], b = p < 603 ? D.pageStart[p + 1] : TOTAL_VERSES; for (let v = a; v < b; v++) D.pageOf[v] = p + 1; }
    for (let j = 0; j < 30; j++) { const a = D.juzStart[j], b = j < 29 ? D.juzStart[j + 1] : TOTAL_VERSES; for (let v = a; v < b; v++) D.juzOf[v] = j + 1; }
  }
  function ensure(key) {
    if (D[key]) return Promise.resolve(D[key]);
    if (D.pending[key]) return D.pending[key];
    const files = { de: ['de.json'], tj: ['tajweed.json'], lex: ['lex.json', 'words.json'] }[key];
    D.pending[key] = Promise.all(files.map(getJSON)).then(res => {
      if (key === 'de') D.de = res[0].verses;
      if (key === 'tj') D.tj = res[0];
      if (key === 'lex') { D.lex = res[0]; D.wd = res[1].words; buildLexIndex(); }
      return D[key];
    }).catch(err => { D.pending[key] = null; throw err; });
    return D.pending[key];
  }
  const surahOf = v => D.Q.verseSurah[v];
  const ayahOf = v => D.Q.verseAyah[v];
  const S = n => D.quran.surahs[n - 1];
  const vIndex = (s, a) => S(s).start + a - 1;
  const ref = v => surahOf(v) + ':' + ayahOf(v);
  const pageRange = p => [D.pageStart[p - 1], p < 604 ? D.pageStart[p] - 1 : TOTAL_VERSES - 1];
  const juzRange = j => [D.juzStart[j - 1], j < 30 ? D.juzStart[j] - 1 : TOTAL_VERSES - 1];

  // ------------------------------------------------------------------ lexicon
  const LEX = { main: null, occ: null, order: null, total: 0 };
  function buildLexIndex() {
    // main lemma of every word and occurrences per lemma
    const N = D.Q.words.length;
    LEX.main = new Int32Array(N).fill(-1);
    LEX.occ = new Map();
    for (let g = 0; g < N; g++) {
      const w = D.Q.words[g];
      const flat = D.wd[w.v] && D.wd[w.v][w.k];
      if (!flat || !flat.length) continue;
      const segs = segsOf(flat);
      const m = segs.find(x => x.main);
      if (m && m.lid >= 0) {
        LEX.main[g] = m.lid;
        let arr = LEX.occ.get(m.lid); if (!arr) { arr = []; LEX.occ.set(m.lid, arr); } arr.push(g);
      }
    }
    LEX.order = [];
    D.lex.lemmas.forEach((l, i) => { if (l && l[4]) LEX.order.push(i); });
    LEX.order.sort((a, b) => D.lex.lemmas[b][3] - D.lex.lemmas[a][3]);
    LEX.total = D.lex.lemmas.reduce((s, l) => s + (l ? l[3] : 0), 0);
  }
  function segsOf(flat) {
    const out = [];
    let start = 0, mainFound = false;
    for (let i = 0; i < flat.length; i += 3) {
      const end = flat[i], feats = D.lex.feats[flat[i + 1]].split('|'), lid = flat[i + 2];
      const pos = feats[0], tags = feats.slice(1);
      const isAffix = tags.indexOf('PREF') >= 0 || tags.indexOf('SUFF') >= 0;
      const main = !mainFound && !isAffix;
      if (main) mainFound = true;
      out.push({ start, end, pos, tags, lid, main });
      start = end;
    }
    if (!mainFound && out.length) out[0].main = true;
    return out;
  }

  // German grammar labels
  const PERS = { '1S': '1. Person Singular', '1P': '1. Person Plural', '2MS': '2. Person Singular m.', '2FS': '2. Person Singular f.', '2MP': '2. Person Plural m.', '2FP': '2. Person Plural f.', '2D': '2. Person Dual', '2MD': '2. Person Dual', '2FD': '2. Person Dual f.', '3MS': '3. Person Singular m.', '3FS': '3. Person Singular f.', '3MP': '3. Person Plural m.', '3FP': '3. Person Plural f.', '3D': '3. Person Dual', '3MD': '3. Person Dual m.', '3FD': '3. Person Dual f.' };
  const NUMG = { MS: 'Singular m.', FS: 'Singular f.', MP: 'Plural m.', FP: 'Plural f.', MD: 'Dual m.', FD: 'Dual f.', M: 'maskulin', F: 'feminin', P: 'Plural', D: 'Dual', S: 'Singular' };
  const PRON_DE = { '3MS': 'ihn, sein, ihm', '3FS': 'sie, ihr', '3MP': 'sie, ihr (Pl.)', '3FP': 'sie, ihr (f. Pl.)', '3D': 'sie beide', '3MD': 'sie beide', '3FD': 'sie beide', '2MS': 'dich, dein, dir', '2FS': 'dich, dein (f.)', '2MP': 'euch, euer', '2FP': 'euch, euer (f.)', '2D': 'euch beide', '2MD': 'euch beide', '2FD': 'euch beide', '1S': 'mich, mein, mir', '1P': 'uns, unser' };
  const PTYPE = { NEG: 'Verneinung', CONJ: 'Konjunktion', REM: 'Fortsetzung', RSLT: 'Folge', CAUS: 'Begründung', SUP: 'Ergänzung', EMPH: 'Bekräftigung', INTG: 'Frage', COND: 'Bedingung', VOC: 'Anruf', SUB: 'Nebensatz', ACC: 'Bekräftigung (inna)', CERT: 'Gewissheit', FUT: 'Zukunft', RES: 'Einschränkung', EXP: 'Ausnahme', T: 'Zeitangabe', LOC: 'Ortsangabe', P: 'Präposition', INL: 'Einzelbuchstaben', PRO: 'Verbot', PRP: 'Zweck', AMD: 'Berichtigung', ANS: 'Antwort', AVR: 'Abwehr', CIRC: 'Zustand', COM: 'Begleitung', EQ: 'Gleichsetzung', EXH: 'Aufforderung', EXL: 'Erläuterung', INC: 'Einleitung', INT: 'Deutung', PREV: 'Verhinderung', RET: 'Wiederaufnahme', SUR: 'Überraschung', NV: 'Verbalpartikel', DEM: 'Hinweiswort', REL: 'Relativwort', PRON: 'Pronomen', IMPV: 'Befehl', DET: 'Artikel', DIST: 'Ferne', ADDR: 'Anrede', ATT: 'Aufmerksamkeit' };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  function affixDE(seg, text) {
    const t = seg.tags, plain = text.replace(/[ً-ٰٟۖ-ۭ]/g, '');
    if (t.indexOf('PRON') >= 0) { const p = t.find(x => PRON_DE[x]); return p ? PRON_DE[p] : 'Pronomen'; }
    if (t.indexOf('DET') >= 0) return 'Artikel: der, die, das';
    if (t.indexOf('CONJ') >= 0) return 'und';
    if (t.indexOf('REM') >= 0) return plain.indexOf('ف') >= 0 ? 'so, dann' : 'und';
    if (t.indexOf('RSLT') >= 0 || t.indexOf('SUP') >= 0) return 'so, dann';
    if (t.indexOf('CAUS') >= 0) return 'denn';
    if (t.indexOf('CIRC') >= 0) return 'während';
    if (t.indexOf('EMPH') >= 0) return seg.pos === 'P' && plain.indexOf('ن') >= 0 ? 'Bekräftigung' : 'wahrlich';
    if (t.indexOf('PRP') >= 0) return 'damit, um zu';
    if (t.indexOf('IMPV') >= 0) return 'soll (Befehl)';
    if (t.indexOf('FUT') >= 0) return 'wird';
    if (t.indexOf('INTG') >= 0) return 'etwa? (Frage)';
    if (t.indexOf('EQ') >= 0) return 'ob';
    if (t.indexOf('VOC') >= 0) return 'o (Anruf)';
    if (t.indexOf('ATT') >= 0) return 'siehe (Hinweis)';
    if (t.indexOf('DIST') >= 0 || t.indexOf('ADDR') >= 0) return 'Hinweisendung';
    if (t.indexOf('P') >= 0) {
      if (plain.indexOf('ب') >= 0) return 'mit, in, durch';
      if (plain.indexOf('ك') >= 0) return 'wie';
      if (plain.indexOf('ل') >= 0) return 'für, zu';
      if (plain.indexOf('و') >= 0 || plain.indexOf('ت') >= 0) return 'bei (Schwur)';
    }
    const k = t.find(x => PTYPE[x]);
    return k ? PTYPE[k] : '';
  }
  function grammarDE(seg) {
    const t = seg.tags, parts = [];
    if (seg.pos === 'V') {
      parts.push('Verb');
      if (t.indexOf('PERF') >= 0) parts.push('Perfekt'); else if (t.indexOf('IMPF') >= 0) parts.push('Imperfekt'); else if (t.indexOf('IMPV') >= 0) parts.push('Imperativ');
      if (t.indexOf('PASS') >= 0) parts.push('Passiv');
      const p = t.find(x => PERS[x]); if (p) parts.push(PERS[p]);
      const vf = t.find(x => x.startsWith('VF:')); if (vf) parts.push('Stamm ' + (ROMAN[+vf.slice(3)] || vf.slice(3)));
      if (t.indexOf('MOOD:SUBJ') >= 0) parts.push('Subjunktiv'); if (t.indexOf('MOOD:JUS') >= 0) parts.push('Jussiv');
    } else if (seg.pos === 'N') {
      if (t.indexOf('PRON') >= 0) { const p = t.find(x => PERS[x]); parts.push('Pronomen' + (p ? ', ' + PERS[p] : '')); return parts.join(', '); }
      if (t.indexOf('PN') >= 0) parts.push('Eigenname');
      else if (t.indexOf('ACT_PCPL') >= 0) parts.push('Partizip aktiv');
      else if (t.indexOf('PASS_PCPL') >= 0) parts.push('Partizip passiv');
      else if (t.indexOf('VN') >= 0) parts.push('Verbalnomen');
      else if (t.indexOf('DEM') >= 0) parts.push('Hinweiswort');
      else if (t.indexOf('REL') >= 0) parts.push('Relativwort');
      else if (t.indexOf('T') >= 0) parts.push('Zeitadverb');
      else if (t.indexOf('LOC') >= 0) parts.push('Ortsadverb');
      else parts.push(t.indexOf('ADJ') >= 0 ? 'Adjektiv' : 'Nomen');
      const ng = t.find(x => NUMG[x] && x.length === 2); if (ng) parts.push(NUMG[ng]);
      if (t.indexOf('NOM') >= 0) parts.push('Nominativ'); else if (t.indexOf('ACC') >= 0) parts.push('Akkusativ'); else if (t.indexOf('GEN') >= 0) parts.push('Genitiv');
      if (t.indexOf('INDEF') >= 0) parts.push('unbestimmt');
      const vf = t.find(x => x.startsWith('VF:')); if (vf && +vf.slice(3) > 1) parts.push('Stamm ' + ROMAN[+vf.slice(3)]);
    } else {
      const k = t.find(x => PTYPE[x]);
      parts.push('Partikel' + (k ? ': ' + PTYPE[k] : ''));
    }
    return parts.join(', ');
  }
  const posDE = l => ({ N: 'Nomen', V: 'Verb', P: 'Partikel', PRON: 'Pronomen' }[l[2]] || '');

  // ------------------------------------------------------------------ tajweed
  const TJ_CLASS = ['m2', 'm246', 'm45', 'm45', 'm6', 'gh', 'gh', 'gh', 'gh', 'gh', 'gh', 'id', 'id', 'id', 'qq', 'sl', 'sl', 'sl'];
  const TJ_PRIO = { m6: 8, m45: 7, m246: 6, m2: 5, qq: 4, gh: 3, id: 2, sl: 1 };
  const TJ_NAME = ['Madd ṭabīʿī: 2 Harakat', 'Madd ʿāriḍ / līn: 2, 4 oder 6 Harakat', 'Madd munfaṣil: 4–5 Harakat', 'Madd muttaṣil: 4–5 Harakat', 'Madd lāzim: 6 Harakat',
    'Ghunna: 2 Harakat nasal', 'Ikhfāʾ: verborgen, nasal', 'Ikhfāʾ šafawī', 'Iqlāb: n wird zu m', 'Idġām mit Ghunna', 'Idġām šafawī',
    'Idġām ohne Ghunna', 'Idġām mutajānisain', 'Idġām mutaqāribain', 'Qalqala: abprallend', 'Hamzat al-waṣl: beim Weiterlesen stumm', 'Lām šamsiyya: nicht gesprochen', 'Nicht gesprochen'];
  const tjCache = new Map();
  function tjForVerse(v) {
    if (!D.tj) return null;
    let m = tjCache.get(v);
    if (m) return m;
    m = new Map();
    const f = D.tj.verses[v] || [];
    for (let i = 0; i < f.length; i += 4) { const k = f[i]; let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push([f[i + 1], f[i + 2], f[i + 3]]); }
    tjCache.set(v, m);
    return m;
  }
  function wordHTML(g, tajweed) {
    const w = D.Q.words[g];
    if (!tajweed) return esc(w.t);
    const m = tjForVerse(w.v);
    const anns = m && m.get(w.k);
    if (!anns) return esc(w.t);
    const L = w.t.length;
    const cls = new Array(L).fill(null);
    for (const [s, e, r] of anns) {
      const c = TJ_CLASS[r];
      for (let x = s; x < e && x < L; x++) if (!cls[x] || TJ_PRIO[c] > TJ_PRIO[cls[x]]) cls[x] = c;
    }
    let out = '', cur = null, buf = '';
    for (let x = 0; x < L; x++) {
      if (cls[x] !== cur) { if (buf) out += cur ? '<span class="tj-' + cur + '">' + esc(buf) + '</span>' : esc(buf); buf = ''; cur = cls[x]; }
      buf += w.t[x];
    }
    if (buf) out += cur ? '<span class="tj-' + cur + '">' + esc(buf) + '</span>' : esc(buf);
    return out;
  }

  // ------------------------------------------------------------------ UI scaffolding
  let toastTimer;
  function toast(msg, ms) {
    let t = $('#toast');
    if (!t) { t = el('<div id="toast" class="toast" role="status" aria-live="polite"></div>'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('Kopiert'); return true; }
    catch (e) { toast('Kopieren nicht möglich. Text markieren und manuell kopieren.'); return false; }
  }

  const sheets = [];
  function openSheet({ title, body, full, onClose, head }) {
    const z = 50 + sheets.length * 2;
    const scrim = el('<div class="scrim"></div>'); scrim.style.zIndex = z;
    const sh = el(`<section class="sheet${full ? ' full' : ''}" role="dialog" aria-modal="true" tabindex="-1">
      ${full ? '' : '<div class="sheet-grip"></div>'}
      <div class="sheet-head"><h2></h2><button class="icon-btn" data-close aria-label="Schließen">${ICON.close}</button></div>
      <div class="sheet-body"></div></section>`);
    sh.style.zIndex = z + 1;
    $('h2', sh).textContent = title || '';
    if (head) $('.sheet-head', sh).insertBefore(head, $('[data-close]', sh));
    const bodyEl = $('.sheet-body', sh);
    if (body) bodyEl.appendChild(body);
    document.body.appendChild(scrim); document.body.appendChild(sh);
    const prevFocus = document.activeElement;
    requestAnimationFrame(() => { scrim.classList.add('open'); sh.classList.add('open'); sh.focus({ preventScroll: true }); });
    const api = {
      el: sh, body: bodyEl,
      setTitle(t) { $('h2', sh).textContent = t; },
      close() {
        if (api.closed) return; api.closed = true;
        scrim.classList.remove('open'); sh.classList.remove('open');
        setTimeout(() => { scrim.remove(); sh.remove(); }, 300);
        const i = sheets.indexOf(api); if (i >= 0) sheets.splice(i, 1);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        if (onClose) onClose();
      },
    };
    scrim.addEventListener('click', () => api.close());
    $('[data-close]', sh).addEventListener('click', () => api.close());
    // swipe down to close
    let y0 = null;
    const grip = $('.sheet-grip', sh) || $('.sheet-head', sh);
    grip.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    grip.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 60) api.close(); y0 = null; });
    sheets.push(api);
    return api;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close(); });

  function applyTheme() {
    const t = Store.data.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.setProperty('--q-size', Store.data.settings.qsize + 'px');
  }

  // ------------------------------------------------------------------ layout
  const App = { tab: 'read', scroll: { read: 0, hifz: 0, words: 0 } };
  function buildFrame() {
    const app = $('#app');
    app.innerHTML = `
      <main class="view" id="v-read" aria-label="Lesen"></main>
      <main class="view" id="v-hifz" aria-label="Hifz" hidden></main>
      <main class="view" id="v-words" aria-label="Wörter" hidden></main>
      <button class="fab" id="fab" aria-label="Rezitation starten">${ICON.mic}<span>Rezitieren</span></button>
      <div class="recbar" id="recbar" hidden data-state="idle">
        <div class="rec-hint" id="rec-hint" role="status" aria-live="polite" hidden><span class="hi" aria-hidden="true">${ICON.bulb}</span><div class="ht" id="rec-hint-t"></div><button class="icon-btn hx" id="rec-hint-x" aria-label="Hinweis schließen">${ICON.close}</button></div>
        <div class="recbar-in">
        <span class="rec-dot" aria-hidden="true"></span>
        <div class="rec-info"><div class="l1" id="rec-l1">Ich höre zu</div><div class="l2" id="rec-l2"></div></div>
        <button class="icon-btn" id="rec-help" aria-label="Hinweis" hidden>${ICON.bulb}</button>
        <button class="icon-btn" id="rec-hide" aria-pressed="false" aria-label="Text verdecken">${ICON.eye}</button>
        <button class="btn primary small" id="rec-resume" hidden>${ICON.mic}<span>Weiter</span></button>
        <button class="btn stop" id="rec-stop">${ICON.stop}<span>Beenden</span></button>
      </div></div>
      <nav class="tabbar" aria-label="Bereiche"><div class="tabbar-in" role="tablist">
        <button class="tab" role="tab" data-tab="read">${ICON.read}<span>Lesen</span></button>
        <button class="tab" role="tab" data-tab="hifz">${ICON.hifz}<span>Hifz</span><span class="badge" id="due-badge" hidden></span></button>
        <button class="tab" role="tab" data-tab="words">${ICON.words}<span>Wörter</span></button>
      </div></nav>`;
    $$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('#fab').addEventListener('click', () => Rec.startFromView());
    $('#rec-stop').addEventListener('click', () => Rec.stop('user'));
    $('#rec-hide').addEventListener('click', () => Rec.toggleHide());
    $('#rec-help').addEventListener('click', () => { if (Rec.tracker) Rec.tracker.requestHint(); });
    $('#rec-hint-x').addEventListener('click', () => Rec.hideHint());
    $('#rec-resume').addEventListener('click', () => Rec.resume());
    document.addEventListener('visibilitychange', () => { if (document.hidden && Rec.active && !Rec.paused) Rec.pause('hidden'); });
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  function onScroll() {
    const tb = $('.view:not([hidden]) .topbar');
    if (tb) tb.classList.toggle('scrolled', window.scrollY > 4);
    if (App.tab === 'read') Reader.onScroll();
  }
  function showTab(tab, noScroll) {
    if (!['read', 'hifz', 'words'].includes(tab)) tab = 'read';
    App.scroll[App.tab] = window.scrollY;
    App.tab = tab; Store.data.tab = tab; Store.save();
    $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $('#v-read').hidden = tab !== 'read'; $('#v-hifz').hidden = tab !== 'hifz'; $('#v-words').hidden = tab !== 'words';
    $('#fab').hidden = tab !== 'read' || Rec.active;
    if (tab === 'hifz') Hifz.render();
    if (tab === 'words') Words.render();
    if (!noScroll) window.scrollTo(0, App.scroll[tab] || 0);
    try { history.replaceState(null, '', '#' + ({ read: 'lesen', hifz: 'hifz', words: 'woerter' }[tab])); } catch (e) { /* sandboxed */ }
  }

  // ------------------------------------------------------------------ reader
  const Reader = {
    surah: 1, words: new Map(), markers: new Map(), pageEls: [], root: null, topbar: null,
    init() {
      const v = $('#v-read');
      v.innerHTML = `
        <header class="topbar">
          <button class="title-btn" id="nav-btn" aria-label="Sure, Juz oder Seite wählen"><span class="sbadge on" id="nav-no"><b>1</b></span><span class="tt"><span class="t1"><span id="nav-t1"></span>${ICON.down.replace('class="i"', 'class="i chev"')}</span><span class="t2" id="nav-t2"></span></span></button>
          <span class="grow-space"></span>
          <button class="icon-btn" id="display-btn" aria-label="Darstellung">${ICON.type}</button>
          <button class="icon-btn" id="settings-btn" aria-label="Einstellungen">${ICON.gear}</button>
        </header>
        <div class="reader" id="reader"></div>`;
      this.root = $('#reader');
      $('#nav-btn').addEventListener('click', () => Nav.open());
      $('#display-btn').addEventListener('click', () => Display.open());
      $('#settings-btn').addEventListener('click', () => Settings.open());
      this.root.addEventListener('click', e => this.onClick(e));
    },
    classes() {
      const s = Store.data.settings;
      this.root.classList.toggle('tajweed', !!(s.tajweed && D.tj));
    },
    async render(s, focus) {
      // focus: {v, g, flash, block}
      this.surah = s;
      const st = Store.data.settings;
      if (st.tajweed && !D.tj) { try { await ensure('tj'); } catch (e) { toast('Tajweed-Daten konnten nicht geladen werden.'); } }
      if (st.layout === 'verse' && st.translation && !D.de) { try { await ensure('de'); } catch (e) { /* render without */ } }
      const tajweed = !!(st.tajweed && D.tj);
      const sur = S(s);
      const v0 = sur.start, v1 = sur.start + sur.ayahs - 1;
      let html = `<div class="surah-head"><div class="cartouche"><div class="inner"><div class="name-ar">سورة ${esc(sur.ar)}</div></div></div>
        <div class="name-de">${esc(sur.tr)}, ${esc(sur.de)}</div>
        <div class="surah-meta">Sure ${s}, ${fmt(sur.ayahs)} Verse, ${sur.type === 'm' ? 'mekkanisch' : 'medinensisch'}</div>
        <button class="btn small ghost head-link" data-vocab="${s}">${ICON.words}<span>Wörter und Test zu dieser Sure</span></button></div>`;
      if (s !== 1 && s !== 9) html += `<div class="basmala" data-bs="${s}">${esc(D.quran.verses[0])}</div>`;
      const pages = [];
      for (let v = v0; v <= v1; v++) { const p = D.pageOf[v]; if (!pages.length || pages[pages.length - 1].p !== p) pages.push({ p, a: v, b: v }); else pages[pages.length - 1].b = v; }
      const verseMode = st.layout === 'verse';
      for (const pg of pages) {
        html += `<div class="page" data-page="${pg.p}">`;
        if (!verseMode) html += '<p class="flow">';
        for (let v = pg.a; v <= pg.b; v++) {
          if (verseMode) html += `<div class="verse-block" data-v="${v}"><p class="flow">`;
          const txt = D.quran.verses[v];
          if (txt.startsWith('۞')) html += '<span class="hz" aria-label="Viertel-Hizb">۞</span>';
          const a = D.Q.verseStart[v], b = D.Q.verseStart[v + 1];
          for (let g = a; g < b; g++) html += `<span class="w" data-g="${g}">${wordHTML(g, tajweed)}</span> `;
          html += `<span class="an${memHas(v) ? ' mem' : ''}" data-v="${v}" role="button" aria-label="Vers ${ayahOf(v)}">${arNum(ayahOf(v))}</span>`;
          if (verseMode) {
            html += '</p>';
            if (st.translation && D.de) html += `<p class="tr">${esc(D.de[v])}</p>`;
            html += `<div class="vref"><span>${ref(v)}</span><span>Seite ${D.pageOf[v]}</span>${memHas(v) ? '<span style="color:var(--turq)">gelernt</span>' : ''}</div></div>`;
          } else html += ' ';
        }
        if (!verseMode) html += '</p>';
        const nextJuz = pg.b + 1 < TOTAL_VERSES && D.juzOf[pg.b + 1] !== D.juzOf[pg.b] ? D.juzOf[pg.b + 1] : 0;
        html += `<div class="pagebreak"><span class="pn">Seite ${pg.p}${nextJuz && pg.b < v1 ? ` <span class="juzflag">Juz ${nextJuz} beginnt</span>` : ''}</span></div></div>`;
      }
      html += '<div class="surah-nav">';
      html += s > 1 ? `<button class="btn" data-go="${s - 1}">${ICON.left}<span>${esc(S(s - 1).tr)}</span></button>` : '<span></span>';
      html += s < 114 ? `<button class="btn" data-go="${s + 1}"><span>${esc(S(s + 1).tr)}</span>${ICON.right}</button>` : '<span></span>';
      html += '</div>';
      this.root.innerHTML = html;
      this.words.clear(); this.markers.clear();
      for (const w of this.root.querySelectorAll('.w')) this.words.set(+w.dataset.g, w);
      for (const m of this.root.querySelectorAll('.an')) this.markers.set(+m.dataset.v, m);
      this.pageEls = $$('.page', this.root);
      this.pageByNo = new Map(this.pageEls.map(p => [+p.dataset.page, p]));
      this.vblocks = new Map($$('.verse-block', this.root).map(b => [+b.dataset.v, b]));
      this.classes();
      $('#nav-t1').textContent = sur.tr;
      $('#nav-no').innerHTML = '<b>' + s + '</b>';
      const rec = (Store.data.recent || []).filter(x => x !== s); rec.unshift(s); Store.data.recent = rec.slice(0, 8); Store.save();
      if (Rec.active || Rec.marksShown) Rec.paint(true);
      if (focus) this.focus(focus);
      else window.scrollTo(0, 0);
      this.onScroll();
    },
    focus({ v, g, flash, block }) {
      let target = null;
      if (g != null) target = this.words.get(g);
      if (!target && v != null) target = this.root.querySelector(`.verse-block[data-v="${v}"]`) || this.words.get(D.Q.verseStart[v]);
      if (!target) return;
      const r = target.getBoundingClientRect();
      const y = window.scrollY + r.top - (block === 'center' ? window.innerHeight * 0.4 : 110);
      window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
      if (flash) { const t = target.classList.contains('w') ? target : target; t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); }
    },
    open(v, opts) {
      const s = surahOf(v);
      Store.data.pos = { v }; Store.save();
      if (App.tab !== 'read') showTab('read', true);
      const o = Object.assign({ v, flash: true }, opts || {});
      if (s !== this.surah || !this.words.size) return this.render(s, o);
      this.focus(o);
      return Promise.resolve();
    },
    firstVisibleVerse() {
      const top = (this.topbarBottom() || 70) + 6;
      let best = null;
      for (const [v, m] of this.markers) {
        const r = m.getBoundingClientRect();
        if (r.bottom > top) { best = v; break; }
      }
      return best != null ? best : S(this.surah).start;
    },
    topbarBottom() { const t = $('#v-read .topbar'); return t ? t.getBoundingClientRect().bottom : 0; },
    onScroll: debounce(function () {
      if (!Reader.pageEls.length || App.tab !== 'read') return;
      const top = Reader.topbarBottom() + 20;
      let cur = Reader.pageEls[0];
      for (const p of Reader.pageEls) { if (p.getBoundingClientRect().top <= top) cur = p; else break; }
      const p = +cur.dataset.page;
      const fv = Reader.firstVisibleVerse();
      $('#nav-t2').textContent = `Seite ${p}, Juz ${D.juzOf[D.pageStart[p - 1]]}`;
      if (!Rec.active) { Store.data.pos = { v: fv }; Store.save(); }
    }, 120),
    onClick(e) {
      const go = e.target.closest('[data-go]');
      if (go) { this.render(+go.dataset.go); return; }
      const vb = e.target.closest('[data-vocab]');
      if (vb) { Words.surahSheet(+vb.dataset.vocab); return; }
      const an = e.target.closest('.an');
      if (an) { VerseSheet.open(+an.dataset.v); return; }
      const w = e.target.closest('.w');
      if (w) {
        const g = +w.dataset.g;
        if (Rec.active) { Rec.moveTo(g); return; }
        WordSheet.open(g);
      }
    },
    updateMem(v) { const m = this.markers.get(v); if (m) m.classList.toggle('mem', !!memHas(v)); },
  };

  // ------------------------------------------------------------------ navigator (surah / juz / page)
  // Turkish names (Diyanet spelling) so the search also understands "Bakara", "Kehf", "Mülk"
  const SURAH_TR = 'Fâtiha|Bakara|Âl-i İmrân|Nisâ|Mâide|En‘âm|A‘râf|Enfâl|Tevbe|Yûnus|Hûd|Yûsuf|Ra‘d|İbrâhîm|Hicr|Nahl|İsrâ|Kehf|Meryem|Tâhâ|Enbiyâ|Hac|Mü’minûn|Nûr|Furkân|Şuarâ|Neml|Kasas|Ankebût|Rûm|Lokmân|Secde|Ahzâb|Sebe’|Fâtır|Yâsîn|Sâffât|Sâd|Zümer|Mü’min Ğâfir|Fussilet|Şûrâ|Zuhruf|Duhân|Câsiye|Ahkâf|Muhammed|Fetih|Hucurât|Kâf|Zâriyât|Tûr|Necm|Kamer|Rahmân|Vâkıa|Hadîd|Mücâdele|Haşr|Mümtehine|Saff|Cuma|Münâfikûn|Teğâbün|Talâk|Tahrîm|Mülk|Kalem|Hâkka|Meâric|Nûh|Cin|Müzzemmil|Müddessir|Kıyâme|İnsân|Mürselât|Nebe’|Nâziât|Abese|Tekvîr|İnfitâr|Mutaffifîn|İnşikâk|Bürûc|Târık|A‘lâ|Ğâşiye|Fecr|Beled|Şems|Leyl|Duhâ|İnşirâh|Tîn|Alak|Kadr|Beyyine|Zilzâl|Âdiyât|Kâria|Tekâsür|Asr|Hümeze|Fîl|Kureyş|Mâûn|Kevser|Kâfirûn|Nasr|Tebbet Mesed|İhlâs|Felak|Nâs'.split('|');
  function normName(x) {
    return String(x).toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’ʿʾ'`´\-–_.\s]/g, '');
  }
  function editDist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  let NAME_INDEX = null;
  function nameIndex() {
    if (NAME_INDEX) return NAME_INDEX;
    NAME_INDEX = D.quran.surahs.map(s => {
      const bare = s.tr.replace(/^[A-Za-z]{1,4}-/, '');
      const latin = [s.tr, bare, s.de, SURAH_TR[s.n - 1]].map(normName);
      for (const x of latin.slice(0, 2)) latin.push(x.replace(/dsch/g, 'j').replace(/sch/g, 'sh'));
      for (const part of SURAH_TR[s.n - 1].split(' ')) latin.push(normName(part));
      const ar = [s.ar, s.ar.replace(/^ال/, '')];
      return { n: s.n, latin: [...new Set(latin)].filter(Boolean), ar };
    });
    return NAME_INDEX;
  }
  /** search surahs by name (German, Turkish, English spelling, Arabic) or number; best first */
  function findSurahs(q) {
    const t = q.trim();
    if (!t) return D.quran.surahs.map(s => s.n);
    if (/^\d{1,3}$/.test(t)) { const n = +t; return n >= 1 && n <= 114 ? [n] : []; }
    const isAr = /[؀-ۿ]/.test(t);
    const nq = isAr ? t.replace(/[ً-ٰٟ]/g, '') : normName(t);
    if (!nq) return [];
    const scored = [];
    for (const e of nameIndex()) {
      let best = 99;
      if (isAr) { for (const a of e.ar) { if (a === nq) best = 0; else if (a.startsWith(nq)) best = Math.min(best, 1); else if (a.indexOf(nq) >= 0) best = Math.min(best, 2); } }
      else for (const a of e.latin) {
        if (a === nq) best = 0;
        else if (a.startsWith(nq)) best = Math.min(best, 1);
        else if (nq.length >= 3 && a.indexOf(nq) >= 0) best = Math.min(best, 2);
        else if (nq.length >= 4) { const d = editDist(nq, a.slice(0, Math.max(nq.length, a.length)), nq.length > 6 ? 2 : 1); if (d <= (nq.length > 6 ? 2 : 1)) best = Math.min(best, 3 + d); }
      }
      if (best < 99) scored.push([best, e.n]);
    }
    scored.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    return scored.map(x => x[1]);
  }
  function surahMem(s) { let m = 0; for (let v = s.start; v < s.start + s.ayahs; v++) m += memHas(v); return m; }

  const Nav = {
    open(startMode) {
      const body = el('<div class="picker"></div>');
      body.innerHTML = `
        <div class="pk-head">
          <label class="pk-search">${ICON.search}<input id="pk-q" type="search" placeholder="Name, Nummer oder Vers wie 2:255" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"></label>
          <div class="pk-chips" id="pk-chips"></div>
          <div class="seg" role="group" aria-label="Ansicht"><button aria-pressed="true" data-m="s">Suren</button><button aria-pressed="false" data-m="j">Juz</button><button aria-pressed="false" data-m="p">Seite</button></div>
        </div>
        <div id="pk-list" class="list"></div>`;
      const sh = openSheet({ title: 'Sure wählen', body, full: true });
      let mode = startMode || 's';
      const list = $('#pk-list', body), q = $('#pk-q', body), chips = $('#pk-chips', body);
      const recent = (Store.data.recent || []).filter(n => n !== Reader.surah).slice(0, 5);
      const pos = Store.data.pos && Store.data.pos.v != null ? Store.data.pos.v : null;
      chips.innerHTML = '<span class="lbl">Zuletzt</span>' + recent.map(n => `<button class="chip" data-s="${n}">${esc(S(n).tr)}</button>`).join('');
      chips.hidden = !recent.length;
      const row = (n, extra) => {
        const su = S(n), m = surahMem(su);
        return `<button class="pk-row${n === Reader.surah ? ' active' : ''}" data-s="${n}"><span class="sbadge${n === Reader.surah ? ' on' : ''}"><b>${n}</b></span>
          <span class="main"><span class="a">${esc(su.tr)}</span><span class="b">${extra || `${esc(su.de)}, ${su.ayahs} Verse`}</span>${m ? `<span class="pk-mem"><i style="width:${Math.round(100 * m / su.ayahs)}%"></i></span>` : ''}</span>
          <span class="ar">${esc(su.ar)}</span></button>`;
      };
      const draw = () => {
        const term = q.value.trim();
        if (mode === 's') {
          let html = '';
          const mv = term.match(/^(\d{1,3})\s*[:.,\/ ]\s*(\d{1,3})$/);
          const mp = term.toLowerCase().match(/^(?:s|seite|page|sayfa)\s*(\d{1,3})$/);
          const mj = term.toLowerCase().match(/^(?:juz|cuz|cüz)\s*(\d{1,2})$/);
          if (mv && +mv[1] >= 1 && +mv[1] <= 114) {
            const su = S(+mv[1]); const a = Math.max(1, Math.min(su.ayahs, +mv[2]));
            html += `<button class="pk-row go" data-v="${su.start + a - 1}"><span class="sbadge on"><b>${su.n}</b></span><span class="main"><span class="a">${esc(su.tr)}, Vers ${a}</span><span class="b">Öffnen und markieren</span></span>${ICON.right}</button>`;
          }
          if (mp && +mp[1] >= 1 && +mp[1] <= 604) { const v = D.pageStart[+mp[1] - 1]; html += `<button class="pk-row go" data-v="${v}"><span class="sbadge"><b>S</b></span><span class="main"><span class="a">Seite ${+mp[1]}</span><span class="b">ab ${esc(S(surahOf(v)).tr)} ${ref(v)}</span></span>${ICON.right}</button>`; }
          if (mj && +mj[1] >= 1 && +mj[1] <= 30) { const v = D.juzStart[+mj[1] - 1]; html += `<button class="pk-row go" data-v="${v}"><span class="sbadge"><b>J</b></span><span class="main"><span class="a">Juz ${+mj[1]}</span><span class="b">ab ${esc(S(surahOf(v)).tr)} ${ref(v)}</span></span>${ICON.right}</button>`; }
          const ns = mv || mp || mj ? [] : findSurahs(term);
          for (const n of ns) html += row(n);
          list.innerHTML = html || `<div class="empty">Keine Sure gefunden. Versuch es mit der Nummer oder z. B. Kahf, Kehf, Höhle.</div>`;
        } else if (mode === 'j') {
          let html = '<div class="juz-grid">';
          for (let j = 1; j <= 30; j++) {
            const [a, b] = juzRange(j); const v = a;
            let m = 0; for (let x = a; x <= b; x++) m += memHas(x);
            html += `<button class="juz-tile${D.juzOf[pos != null ? pos : 0] === j ? ' active' : ''}" data-v="${v}"><b>${j}</b><span>${esc(S(surahOf(v)).tr)}</span><span class="tiny">${ref(v)}</span>${m ? `<span class="pk-mem"><i style="width:${Math.round(100 * m / (b - a + 1))}%"></i></span>` : ''}</button>`;
          }
          list.innerHTML = html + '</div>';
        } else {
          const cur = pos != null ? D.pageOf[pos] : 1;
          list.innerHTML = `<div class="pk-page">
            <div class="pk-page-num"><button class="icon-btn" data-step="-1" aria-label="Seite zurück">${ICON.left}</button><output id="pk-p" class="num">${cur}</output><button class="icon-btn" data-step="1" aria-label="Seite vor">${ICON.right}</button></div>
            <input type="range" id="pk-range" min="1" max="604" value="${cur}" aria-label="Seite wählen">
            <p class="note" id="pk-pinfo" style="text-align:center;margin:6px 0 14px"></p>
            <button class="btn primary block" id="pk-open">Seite öffnen</button>
            <p class="tiny" style="text-align:center;margin-top:10px">Seitenzählung des Madina-Mushafs, 604 Seiten</p></div>`;
          const rng = $('#pk-range', list), out = $('#pk-p', list), info = $('#pk-pinfo', list);
          const upd = () => { const p = +rng.value; out.textContent = p; const [a, b] = pageRange(p); info.textContent = `${S(surahOf(a)).tr} ${ref(a)} bis ${surahOf(b) !== surahOf(a) ? S(surahOf(b)).tr + ' ' : ''}${ref(b)}, Juz ${D.juzOf[a]}`; $('#pk-open', list).textContent = `Seite ${p} öffnen`; };
          rng.addEventListener('input', upd);
          $$('[data-step]', list).forEach(bt => bt.addEventListener('click', () => { rng.value = Math.max(1, Math.min(604, +rng.value + +bt.dataset.step)); upd(); }));
          $('#pk-open', list).addEventListener('click', () => { const v = D.pageStart[+rng.value - 1]; sh.close(); Reader.open(v); });
          upd();
        }
      };
      const setMode = m => {
        mode = m; sh.setTitle({ s: 'Sure wählen', j: 'Juz wählen', p: 'Seite wählen' }[m]);
        $$('.seg button', body).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.m === m)));
        $('.pk-search', body).hidden = m !== 's'; chips.hidden = m !== 's' || !recent.length; draw();
      };
      $$('.seg button', body).forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
      q.addEventListener('input', draw);
      // preventDefault: otherwise the Enter key also "clicks" the switcher button that gets focus back and reopens this sheet
      q.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const f = $('[data-s],[data-v]', list); if (!f) return;
        q.blur(); f.click();
        setTimeout(() => { const nb = $('#nav-btn'); if (document.activeElement === nb) nb.blur(); }, 0);
      });
      const pick = e => {
        const b = e.target.closest('[data-s],[data-v]');
        if (!b) return;
        sh.close();
        if (b.dataset.s) { const n = +b.dataset.s; Store.data.pos = { v: S(n).start }; Store.save(); if (App.tab !== 'read') showTab('read', true); Reader.render(n); }
        else Reader.open(+b.dataset.v, { block: 'center' });
      };
      list.addEventListener('click', pick);
      chips.addEventListener('click', pick);
      setMode(mode);
      if (mode === 's') { const act = $('.pk-row.active', list); if (act) setTimeout(() => act.scrollIntoView({ block: 'center' }), 80); }
    },
  };

  // ------------------------------------------------------------------ display options
  const Display = {
    open() {
      const st = Store.data.settings;
      const body = el('<div></div>');
      body.innerHTML = `
        <div class="setting col"><div class="txt"><b>Schriftgröße</b></div>
          <div class="row"><span class="tiny">klein</span><input class="grow" id="d-size" type="range" min="20" max="40" step="1" value="${st.qsize}"><span class="tiny">groß</span></div>
          <div class="q" id="d-sample" style="text-align:center;font-size:${st.qsize}px;line-height:2">ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ ٢</div></div>
        <div class="setting col"><div class="txt"><b>Anordnung</b></div>
          <div class="seg"><button data-l="flow" aria-pressed="${st.layout === 'flow'}">Fließtext wie im Mushaf</button><button data-l="verse" aria-pressed="${st.layout === 'verse'}">Vers für Vers</button></div></div>
        <label class="setting"><span class="txt"><b>Deutsche Übersetzung</b><span>In der Ansicht Vers für Vers, nach Bubenheim und Elyas</span></span><input type="checkbox" class="switch" id="d-tr" ${st.translation ? 'checked' : ''}></label>
        <label class="setting"><span class="txt"><b>Tajweed-Farben</b><span>Zeigt Dehnungen, Ghunna und weitere Regeln</span></span><input type="checkbox" class="switch" id="d-tj" ${st.tajweed ? 'checked' : ''}></label>
        <div id="d-legend" ${st.tajweed ? '' : 'hidden'}>${Display.legendHTML()}</div>`;
      openSheet({ title: 'Darstellung', body });
      const size = $('#d-size', body);
      size.addEventListener('input', () => { st.qsize = +size.value; $('#d-sample', body).style.fontSize = st.qsize + 'px'; applyTheme(); });
      size.addEventListener('change', () => Store.save());
      $$('[data-l]', body).forEach(b => b.addEventListener('click', () => {
        st.layout = b.dataset.l; Store.save();
        $$('[data-l]', body).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        Reader.render(Reader.surah, { v: Reader.firstVisibleVerse() });
      }));
      $('#d-tr', body).addEventListener('change', e => { st.translation = e.target.checked; Store.save(); if (st.layout === 'verse') Reader.render(Reader.surah, { v: Reader.firstVisibleVerse() }); });
      $('#d-tj', body).addEventListener('change', async e => {
        st.tajweed = e.target.checked; Store.save();
        $('#d-legend', body).hidden = !st.tajweed;
        Reader.render(Reader.surah, { v: Reader.firstVisibleVerse() });
      });
    },
    legendHTML() {
      const items = [['m2', 'Dehnung 2 Harakat'], ['m246', 'Dehnung 2, 4 oder 6 (vor Pause)'], ['m45', 'Dehnung 4 bis 5 Harakat'], ['m6', 'Dehnung 6 Harakat'],
        ['gh', 'Ghunna, Ikhfāʾ, Iqlāb, Idġām mit Ghunna'], ['id', 'Idġām ohne Ghunna'], ['qq', 'Qalqala'], ['sl', 'nicht gesprochen']];
      return '<div style="padding:8px 0 4px">' + items.map(([c, t]) => `<span class="rule-chip tj-${c}"><i></i><span style="color:var(--ink)">${t}</span></span>`).join('') + '</div>';
    },
  };

  // ------------------------------------------------------------------ word sheet
  const WordSheet = {
    async open(g) {
      const w = D.Q.words[g];
      const body = el('<div><div class="word-big"></div><div class="empty">Wird geladen …</div></div>');
      $('.word-big', body).innerHTML = wordHTML(g, !!(Store.data.settings.tajweed && D.tj));
      const sh = openSheet({ title: `${S(surahOf(w.v)).tr} ${ref(w.v)}, Wort ${w.k + 1}`, body });
      try { await ensure('lex'); } catch (e) { $('.empty', body).textContent = 'Wortdaten konnten nicht geladen werden.'; return; }
      if (sh.closed) return;
      const flat = D.wd[w.v] && D.wd[w.v][w.k];
      const segs = flat && flat.length ? segsOf(flat) : [];
      const main = segs.find(s => s.main);
      const lemma = main && main.lid >= 0 ? D.lex.lemmas[main.lid] : null;
      let html = '';
      if (lemma && lemma[4]) html += `<p class="gloss">${esc(lemma[4])}</p>`;
      else if (main && main.pos === 'P' && main.tags.indexOf('INL') >= 0) html += '<p class="gloss">Einzelbuchstaben</p><p class="gloss-sub">Die Bedeutung dieser Buchstaben kennt Allah.</p>';
      else html += '<p class="gloss" style="color:var(--ink-2)">Keine Kurzbedeutung</p>';
      if (main) html += `<p class="gloss-sub">${esc(grammarDE(main))}</p>`;
      if (segs.length > 1) {
        html += '<div class="parts">';
        for (const s of segs) {
          const txt = w.t.slice(s.start, s.end);
          const lab = s.main ? (lemma && lemma[4] ? lemma[4].split(',')[0] : 'Wortstamm') : affixDE(s, txt);
          html += `<div class="part${s.main ? ' stem' : ''}"><div class="pa">${esc(txt)}</div><div class="pd">${esc(lab)}</div></div>`;
        }
        html += '</div>';
      }
      html += '<dl class="facts">';
      if (lemma) html += `<dt>Grundform</dt><dd><span class="q" style="font-size:22px">${esc(lemma[0])}</span></dd>`;
      if (lemma && lemma[1]) html += `<dt>Wurzel</dt><dd><bdi class="q" style="font-size:20px;letter-spacing:.3em">${esc(lemma[1].split('').join(' '))}</bdi></dd>`;
      if (lemma && lemma[3]) html += `<dt>Häufigkeit</dt><dd>${fmt(lemma[3])}-mal im Koran</dd>`;
      html += '</dl>';
      // tajweed rules on this word
      if (D.tj) {
        const anns = (tjForVerse(w.v) || new Map()).get(w.k) || [];
        const seen = new Set();
        let chips = '';
        for (const [s, e, r] of anns) { if (seen.has(r)) continue; seen.add(r); chips += `<span class="rule-chip tj-${TJ_CLASS[r]}"><i></i><span style="color:var(--ink)">${esc(TJ_NAME[r])}: <span class="q" style="font-size:17px">${esc(w.t.slice(s, e))}</span></span></span>`; }
        if (chips) html += `<div class="section-title" style="margin-top:16px">Tajweed</div><div>${chips}</div>`;
      }
      const inVocab = lemma && Store.data.vocab[main.lid];
      html += '<div class="row" style="margin-top:18px">';
      if (lemma && lemma[4]) html += `<button class="btn grow" id="ws-learn" ${inVocab ? 'disabled' : ''}>${inVocab ? 'Im Wortschatz' : 'Wort lernen'}</button>`;
      html += `<button class="btn primary grow" id="ws-recite">${ICON.mic}<span>Ab hier lesen</span></button></div>`;
      $('.empty', body).remove();
      body.insertAdjacentHTML('beforeend', html);
      const lb = $('#ws-learn', body);
      if (lb) lb.addEventListener('click', () => { Vocab.queue(main.lid); lb.textContent = 'Im Wortschatz'; lb.disabled = true; toast('Kommt in deine nächste Lernrunde'); });
      $('#ws-recite', body).addEventListener('click', () => { sh.close(); Rec.start({ g, mode: 'follow' }); });
    },
  };

  // ------------------------------------------------------------------ verse sheet
  const VerseSheet = {
    async open(v) {
      const body = el('<div></div>');
      body.innerHTML = `<div class="verse-ar">${esc(D.quran.verses[v])} <span class="an">${arNum(ayahOf(v))}</span></div>
        <p class="verse-de" id="vs-de">${D.de ? esc(D.de[v]) : '<span class="tiny">Übersetzung wird geladen …</span>'}</p>
        <p class="tiny" style="margin:6px 0 0">Übersetzung: Bubenheim und Elyas</p>
        <label class="setting" style="margin-top:8px"><span class="txt"><b>Auswendig gelernt</b><span>Seite ${D.pageOf[v]}, Juz ${D.juzOf[v]}</span></span><input type="checkbox" class="switch" id="vs-mem" ${memHas(v) ? 'checked' : ''}></label>
        <div class="row" style="margin-top:12px"><button class="btn primary grow" id="vs-rec">${ICON.mic}<span>Rezitieren</span></button><button class="btn grow" id="vs-test">${ICON.eyeOff}<span>Prüfen</span></button></div>
        <button class="btn ghost block" id="vs-copy" style="margin-top:6px">${ICON.copy}<span>Arabischen Text kopieren</span></button>`;
      const sh = openSheet({ title: `${S(surahOf(v)).tr} ${ref(v)}`, body });
      $('#vs-mem', body).addEventListener('change', e => { Hifz.setVerses([v], e.target.checked); });
      $('#vs-rec', body).addEventListener('click', () => { sh.close(); Rec.start({ v, mode: 'follow' }); });
      $('#vs-test', body).addEventListener('click', () => { sh.close(); Rec.start({ v, mode: 'test' }); });
      $('#vs-copy', body).addEventListener('click', () => copyText(D.quran.verses[v] + ' (' + ref(v) + ')'));
      if (!D.de) { try { await ensure('de'); const d = $('#vs-de', body); if (d) d.textContent = D.de[v]; } catch (e) { const d = $('#vs-de', body); if (d) d.textContent = 'Übersetzung konnte nicht geladen werden.'; } }
    },
  };

  // ------------------------------------------------------------------ speech recognition
  class Speech {
    constructor(h) { this.h = h; this.want = false; this.fails = 0; this.rec = null; }
    start() { this.want = true; this.fails = 0; this._open(); }
    _open() {
      let r;
      try { r = new SR(); } catch (e) { this.want = false; this.h.error('unsupported'); return; }
      r.lang = 'ar-SA'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onstart = () => { this.sessions = (this.sessions || 0) + 1; this.h.state('listening'); };
      r.onspeechstart = () => this.h.state('speech');
      r.onspeechend = () => this.h.state('listening');
      r.onresult = e => {
        const finals = []; let interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i]; const t = res[0] ? res[0].transcript : '';
          if (res.isFinal) finals.push(t); else interim += t + ' ';
        }
        this.gotResult = true;
        this.h.result(finals, interim);
      };
      r.onerror = e => {
        const err = e.error;
        if (err === 'not-allowed' || err === 'service-not-allowed') { this.want = false; this.h.error(this.sessions ? 'interrupted' : 'denied'); }
        else if (err === 'audio-capture') { this.want = false; this.h.error('nomic'); }
        else if (err === 'language-not-supported') { this.want = false; this.h.error('lang'); }
        else if (err === 'network') { this.netErr = (this.netErr || 0) + 1; if (this.netErr > 2) { this.want = false; this.h.error(this.sessions ? 'interrupted-net' : 'network'); } }
      };
      r.onend = () => {
        this.h.state('idle');
        if (!this.want) return;
        const short = Date.now() - this.opened < 1200 && !this.gotResult;
        this.fails = short ? this.fails + 1 : 0;
        if (this.fails > 6) { this.want = false; this.h.error('unstable'); return; }
        setTimeout(() => { if (this.want) { this.h.restart(); this._open(); } }, this.fails ? 350 : 40);
      };
      this.rec = r; this.opened = Date.now(); this.gotResult = false;
      try { r.start(); } catch (e) { this.want = false; this.h.error('start'); }
    }
    stop() { this.want = false; try { if (this.rec) this.rec.stop(); } catch (e) { /* ignore */ } }
  }

  // ------------------------------------------------------------------ recitation controller
  const ST = QC.ST;
  /** the index that finds a place in the whole Quran is built once, in small steps while the phone is idle */
  function warmTracker() {
    try {
      const t = Rec.ensureTracker();
      const later = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 30));
      t.buildIndexAsync(later, 3000);
    } catch (e) { /* built on demand */ }
  }
  const Rec = {
    active: false, tracker: null, speech: null, mode: 'follow', marksShown: false, endG: null, startedAt: 0, wake: null,
    lastPaint: new Map(), userScrollUntil: 0, hideOn: false, unit: null,
    ensureTracker() {
      if (!this.tracker) {
        this.tracker = new QC.Tracker(D.Q, { strictness: Store.data.settings.strict });
        this.tracker.on('update', () => this.schedulePaint());
        this.tracker.on('jump', e => { toast('Du liest jetzt ' + S(surahOf(D.Q.words[e.to].v)).tr + ' ' + ref(D.Q.words[e.to].v)); this.updateBar(); });
        this.tracker.on('found', e => { if (!e.here) toast('Gefunden: ' + S(surahOf(D.Q.words[e.to].v)).tr + ' ' + ref(D.Q.words[e.to].v)); this.updateBar(); });
        this.tracker.on('searching', () => this.updateBar());
        // memorising: failed attempts, hints, and going on again
        this.tracker.on('attempt', () => this.onAttempt());
        this.tracker.on('hint', e => this.showHint(e));
        this.tracker.on('progress', () => { this.hideHint(); this.updateBar(); });
      }
      this.tracker.opts.strictness = Store.data.settings.strict;
      return this.tracker;
    },
    startFromView() {
      if (!this.preflight()) return;
      const v = Reader.firstVisibleVerse();
      this.start({ v, mode: 'follow', search: true });
    },
    preflight() {
      if (IS_PREVIEW) { Help.previewMic(); return false; }
      if (!SR) { Help.noSpeech(); return false; }
      return true;
    },
    /** opts: {v | g, mode: follow|test, endV, unit:{type:'page'|'surah', n}} */
    async start(opts) {
      if (!this.preflight()) return;
      if (this.active) this.stop('restart', true);
      const g0 = opts.g != null ? opts.g : D.Q.verseStart[opts.v];
      const t = this.ensureTracker();
      this.mode = opts.mode || 'follow';
      this.hideOn = this.mode === 'test';
      this.endG = opts.endV != null ? D.Q.verseStart[opts.endV + 1] - 1 : null;
      // reading: follow the reciter anywhere. Memorisation test: stay in the tested passage, a slip elsewhere is a mistake
      const limits = this.mode !== 'test' ? {} : this.endG != null ? { bounds: [g0, this.endG] } : { stay: true };
      t.reset(g0, Object.assign({ search: !!opts.search, strict: this.hideOn, help: this.helpOpts() }, limits));
      warmTracker();
      this.unit = opts.unit || null;
      this.active = true; this.marksShown = false; this.startedAt = Date.now(); this.lastPaint.clear();
      this.heardText = ''; this.paused = false;
      // the click that started us is the user gesture the microphone needs, so start listening first
      this.speech = this.makeSpeech();
      this.speech.start();
      $('#rec-resume').hidden = true; $('#recbar').classList.remove('paused');
      showTab('read', true);
      const s = surahOf(D.Q.words[g0].v);
      if (s !== Reader.surah || !Reader.words.size) await Reader.render(s, { g: g0, block: 'top' });
      else Reader.focus({ g: g0 });
      Reader.root.classList.add('reciting');
      Reader.root.classList.toggle('marks', !!Store.data.settings.live);
      Reader.root.classList.toggle('hide', this.hideOn);
      $('#fab').hidden = true; $('#recbar').hidden = false;
      $('#rec-hide').setAttribute('aria-pressed', String(this.hideOn));
      $('#rec-hide').innerHTML = this.hideOn ? ICON.eyeOff : ICON.eye;
      $('#rec-hide').setAttribute('aria-label', this.hideOn ? 'Text zeigen' : 'Text verdecken');
      this.hideHint(); this.syncHelpUI();
      this.paint(true);
      this.updateBar();
      if (opts.search && (Store.data.findHints || 0) < 3) {
        Store.data.findHints = (Store.data.findHints || 0) + 1; Store.save();
        toast('Lies einfach los. Ich erkenne die Sure selbst, auch wenn du woanders anfängst.', 4200);
      }
      try { if (navigator.wakeLock) this.wake = await navigator.wakeLock.request('screen'); } catch (e) { this.wake = null; }
    },
    onError(code) {
      if (code === 'interrupted' || code === 'interrupted-net') { this.pause(code); return; }
      this.stop('error', true);
      Help.speechError(code);
    },
    makeSpeech() {
      const t = this.tracker;
      return new Speech({
        result: (finals, interim) => { this.heardText = (finals.join(' ') + ' ' + interim).trim(); t.feed(finals, interim); this.updateBar(); },
        state: s => { $('#recbar').dataset.state = s; },
        restart: () => t.newSession(),
        error: code => this.onError(code),
      });
    },
    pause(reason) {
      if (!this.active || this.paused) return;
      this.paused = true;
      if (this.speech) this.speech.stop();
      this.tracker.newSession();
      $('#recbar').dataset.state = 'idle';
      $('#rec-resume').hidden = false; $('#recbar').classList.add('paused');
      this.updateBar();
      if (reason === 'interrupted-net') toast('Keine Verbindung zur Spracherkennung. Tippe auf Weiter, sobald du wieder online bist.', 4200);
      else if (reason !== 'hidden') toast('Die Spracherkennung wurde unterbrochen. Tippe auf Weiter.', 3600);
    },
    resume() {
      if (!this.active || !this.paused) return;
      this.paused = false;
      $('#rec-resume').hidden = true; $('#recbar').classList.remove('paused');
      this.speech = this.makeSpeech();
      this.speech.start();
      this.updateBar();
    },
    toggleHide() {
      this.hideOn = !this.hideOn;
      Reader.root.classList.toggle('hide', this.hideOn);
      const b = $('#rec-hide');
      b.setAttribute('aria-pressed', String(this.hideOn)); b.innerHTML = this.hideOn ? ICON.eyeOff : ICON.eye;
      b.setAttribute('aria-label', this.hideOn ? 'Text zeigen' : 'Text verdecken');
      if (this.tracker) this.tracker.setStrict(this.hideOn);   // hidden text: wrong verses are counted, not followed
      this.hideHint(); this.syncHelpUI();
      this.paint(true);
    },
    helpOpts() { const st = Store.data.settings; return { on: st.hints !== false, tries: st.tries || 3 }; },
    /** settings changed while reciting */
    applyHelp() {
      if (this.tracker) this.tracker.setHelp(this.helpOpts());
      if (Store.data.settings.hints === false) this.hideHint();
      this.syncHelpUI(); this.updateBar();
    },
    syncHelpUI() {
      const strict = this.active && this.hideOn;
      $('#recbar').classList.toggle('strict', strict);
      $('#rec-help').hidden = !(strict && Store.data.settings.hints !== false);
    },
    onAttempt() {
      this.updateBar();
      const bar = $('#recbar .recbar-in');
      bar.classList.remove('miss'); void bar.offsetWidth; bar.classList.add('miss');
    },
    showHint(e) {
      const box = $('#rec-hint'), txt = $('#rec-hint-t');
      txt.classList.toggle('row', e.kind === 'word');
      if (e.kind === 'diag') txt.innerHTML = esc(diagText(e.fail)) + '<small>Versuch es noch einmal.</small>';
      else {
        const ws = (e.words && e.words.length ? e.words : [e.g]).map(g => esc(D.Q.words[g].t)).join(' ');
        txt.innerHTML = `<span>${e.words && e.words.length > 1 ? 'Die nächsten Wörter' : 'Das nächste Wort'}</span><span class="q">${ws}</span>`;
      }
      box.hidden = false;
      box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
      this.updateBar();
    },
    hideHint() { const b = $('#rec-hint'); if (b) b.hidden = true; },
    moveTo(g) { this.tracker.moveTo(g); this.paint(true); toast('Weiter ab diesem Wort'); },
    schedulePaint() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => { this.raf = 0; this.paint(); });
    },
    paint(force) {
      const t = this.tracker;
      if (!t) return;
      const ptr = t.pointer;
      // follow the reciter into another surah once a word there has been heard (also backwards, e.g. an-Nas, then al-Falaq)
      if (this.active) {
        let last = t.lastHeard;
        for (const k of t.tentative.keys()) if (k > last) last = k;
        if (last >= 0 && last < D.Q.words.length) {
          const ps = surahOf(D.Q.words[last].v);
          if (ps !== Reader.surah) { Reader.render(ps, { g: last }); return; }
        }
      }
      // the basmala above the surah: shown as recited once it was heard
      const bs = Reader.root.querySelector('.basmala');
      if (bs) bs.classList.toggle('heard', !!(t.basmHeard && t.basmHeard.has(+bs.dataset.bs)));
      // v: shown even with hidden text (recited, shown as a hint, or just being heard); hn: shown as a hint
      const rev = t.revealed;
      const vAny = new Set(), vOpen = new Set(), pAny = new Set(), pOpen = new Set();
      for (const [g, w] of Reader.words) {
        let c = 'w';
        const s = t.status[g];
        if (s) c += ' s' + s; else if (rev && rev.has(g)) c += ' hn'; else if (t.tentative.has(g)) c += ' tt';
        const vis = c !== 'w';
        if (vis) c += ' v';
        const isCur = this.active && g === ptr && t.mode === 'track';
        if (isCur) c += ' cur';
        if (force || w._c !== c) { w.className = c; w._c = c; }
        const v = D.Q.words[g].v, p = D.pageOf[v];
        if (vis || isCur) { vAny.add(v); pAny.add(p); }
        if (!s) { vOpen.add(v); pOpen.add(p); }
      }
      // with hidden text, verse numbers, translations and pages appear only when they are reached
      for (const [v, m] of Reader.markers) m.classList.toggle('done', !vOpen.has(v));
      if (Reader.vblocks) for (const [v, b] of Reader.vblocks) { b.classList.toggle('started', vAny.has(v)); b.classList.toggle('done', !vOpen.has(v)); }
      if (Reader.pageByNo) for (const [p, el] of Reader.pageByNo) { el.classList.toggle('unseen', !pAny.has(p)); el.classList.toggle('open', pOpen.has(p)); }
      if (this.active) {
        this.updateBar();
        this.autoScroll(ptr);
        if (this.endG != null && ptr > this.endG) this.stop('done');
        // reading: after an-Nas the reciter may go on with another surah (Juz Amma is often recited backwards), so keep listening
        else if (ptr >= D.Q.words.length && this.mode === 'test') this.stop('done');
      }
    },
    autoScroll(ptr) {
      if (Date.now() < this.userScrollUntil) return;
      let g = ptr; const tent = this.tracker.tentative;
      for (const k of tent.keys()) if (k > g) g = k;
      const w = Reader.words.get(Math.min(g, D.Q.words.length - 1));
      if (!w) return;
      const r = w.getBoundingClientRect();
      const top = Reader.topbarBottom() + 10;
      const hb = $('#rec-hint');
      const limit = window.innerHeight - 190 - (hb && !hb.hidden ? hb.getBoundingClientRect().height + 8 : 0);   // keep the spot above the hint
      if (r.bottom > limit || r.top < top) {
        window.scrollBy({ top: r.top - Math.max(top + 30, window.innerHeight * 0.3), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    },
    updateBar() {
      const t = this.tracker; if (!t) return;
      const g = Math.min(t.pointer, D.Q.words.length - 1);
      const v = D.Q.words[g].v;
      const searching = t.mode === 'search';
      $('#rec-l1').textContent = searching ? 'Ich höre zu …' : (this.paused ? 'Pausiert bei ' : '') + S(surahOf(v)).tr + ' ' + ref(v);
      const l2 = $('#rec-l2');
      if (this.paused) { l2.className = 'l2'; l2.textContent = 'Tippe auf Weiter, um fortzufahren'; }
      else if (this.hideOn && !searching && t.strict && t.help.on && t.tries > 0) {
        const left = t.help.tries - t.tries;
        let dots = ''; for (let i = 0; i < t.help.tries; i++) dots += `<i class="${i < t.tries ? 'used' : ''}"></i>`;
        l2.className = 'l2'; l2.innerHTML = `<span class="tries" aria-hidden="true">${dots}</span>noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}`;
      }
      else if (searching && !(Store.data.settings.heard && this.heardText)) { l2.className = 'l2'; l2.textContent = 'Lies einfach los'; }
      else if (Store.data.settings.heard && this.heardText) {
        const words = this.heardText.split(/\s+/); l2.className = 'l2 heard'; l2.innerHTML = '<span>' + esc(words.slice(-5).join(' ')) + '</span>';
      } else { l2.className = 'l2'; l2.textContent = this.hideOn ? 'Lies auswendig' : 'Lies in deinem Tempo, ich folge dir'; }
    },
    stop(reason, silent) {
      if (!this.active) return;
      this.active = false; this.paused = false;
      $('#rec-resume').hidden = true; $('#recbar').classList.remove('paused');
      if (this.speech) this.speech.stop();
      if (this.wake) { try { this.wake.release(); } catch (e) { /* ignore */ } this.wake = null; }
      $('#recbar').hidden = true; $('#fab').hidden = App.tab !== 'read';
      this.hideHint(); $('#recbar').classList.remove('strict');
      Reader.root.classList.remove('hide');
      this.marksShown = true;
      Reader.root.classList.add('marks');
      this.paint(true);
      const sum = this.tracker.summary();
      if (silent || sum.words === 0) {
        if (!silent && reason === 'user') toast('Nichts erkannt. Lies etwas lauter oder näher am Handy.');
        if (sum.words === 0) this.clearMarks();
        return;
      }
      const rec = { d: today(), at: Date.now(), from: sum.from, to: sum.to, words: sum.words, ok: sum.counts.ok + sum.counts.corrected, mode: this.mode, secs: Math.round((Date.now() - this.startedAt) / 1000) };
      Store.data.sessions.push(rec); if (Store.data.sessions.length > 60) Store.data.sessions.splice(0, Store.data.sessions.length - 60);
      Store.save();
      if (this.mode === 'test') Hifz.reviewFromSession(this.tracker, sum);
      Summary.open(sum, rec);
    },
    clearMarks() {
      this.marksShown = false;
      Reader.root.classList.remove('reciting', 'marks', 'hide');
      if (this.tracker) this.tracker.reset(this.tracker.pointer);
      for (const w of Reader.words.values()) { w.className = 'w'; w._c = 'w'; }
    },
  };
  ['touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, () => { Rec.userScrollUntil = Date.now() + 2500; }, { passive: true }));

  // ------------------------------------------------------------------ recitation summary
  const LETTER_NAME = { 'ح': 'Ḥāʾ', 'ه': 'Hāʾ', 'خ': 'Ḫāʾ', 'ع': 'ʿAin', 'ء': 'Hamza', 'ا': 'Alif', 'ق': 'Qāf', 'ك': 'Kāf', 'غ': 'Ġain', 'ص': 'Ṣād', 'س': 'Sīn', 'ض': 'Ḍād', 'د': 'Dāl', 'ظ': 'Ẓāʾ', 'ط': 'Ṭāʾ', 'ت': 'Tāʾ', 'ذ': 'Ḏāl', 'ز': 'Zāy', 'ث': 'Ṯāʾ' };
  /** what went wrong while memorising, in a few words */
  function diagText(f) {
    const a = ayahOf(f.va);
    switch (f.kind) {
      case 'skip':
        if (f.mid) return f.n > 1 ? `Vers ${a} ist noch nicht zu Ende, und du hast ${f.n === 2 ? 'einen Vers' : (f.n - 1) + ' Verse'} übersprungen.` : `Vers ${a} ist noch nicht zu Ende.`;
        return f.n === 1 ? 'Du hast einen Vers übersprungen.' : `Du hast ${f.n} Verse übersprungen.`;
      case 'words': return `In Vers ${a} fehlen noch Wörter.`;
      case 'repeat': return `Du wiederholst Vers ${ayahOf(f.vp)}.`;
      case 'other': return `Das war ein ähnlicher Vers aus ${S(surahOf(f.vp)).tr} (${ref(f.vp)}).`;
      default: return 'Das ist nicht der nächste Vers.';
    }
  }
  function issueText(it) {
    const d = it.detail;
    switch (it.st) {
      case ST.MISSED: return ['Nicht gehört', 'Ausgelassen oder zu leise'];
      case ST.NEAR: return ['Anders gehört', 'Gehört: ' + it.heard];
      case ST.WRONG: return ['Anderes Wort', 'Gehört: ' + it.heard];
      case ST.LETTER: {
        const p = d && d.pairs && d.pairs[0];
        return ['Buchstabe', p ? `${p[0]} (${LETTER_NAME[p[0]] || ''}) klang wie ${p[1]} (${LETTER_NAME[p[1]] || ''})` : 'Gehört: ' + it.heard];
      }
      case ST.MADD: return d && d.madd === 'extra' ? ['Dehnung zu viel?', 'Gehört: ' + it.heard] : ['Dehnung fehlt?', 'Gehört: ' + it.heard];
      case ST.CORRECTED: return ['Selbst korrigiert', 'Beim zweiten Mal richtig'];
      case ST.HINT: return ['Mit Hinweis', 'Dieses Wort hat dir die App gezeigt'];
      default: return ['Hinweis', ''];
    }
  }
  const Summary = {
    open(sum, rec) {
      const pct = sum.words ? Math.round(100 * (sum.counts.ok + sum.counts.corrected) / sum.words) : 0;
      const vFrom = D.Q.words[sum.from].v, vTo = D.Q.words[sum.to].v;
      const mins = Math.floor(rec.secs / 60), secs = rec.secs % 60;
      const real = sum.issues.filter(i => i.st !== ST.CORRECTED);
      const body = el('<div></div>');
      let html = `<div class="score"><b class="num">${pct} %</b><span class="muted">${pct >= 98 ? 'sehr sauber gelesen' : pct >= 90 ? 'gut gelesen' : 'richtig erkannt'}</span></div>
        <p class="note" style="margin:6px 0 0">${esc(S(surahOf(vFrom)).tr)} ${ref(vFrom)} bis ${surahOf(vTo) !== surahOf(vFrom) ? esc(S(surahOf(vTo)).tr) + ' ' : ''}${ref(vTo)}, ${fmt(sum.words)} Wörter in ${mins ? mins + ' Min ' : ''}${secs} s</p>`;
      if (real.length) {
        html += `<div class="section-title">${real.length} ${real.length === 1 ? 'Stelle' : 'Stellen'} zum Anschauen</div><div id="sum-issues"></div>`;
      } else html += '<div class="panel" style="margin-top:16px">Keine Auffälligkeiten. Was die Spracherkennung gehört hat, passt zum Text.</div>';
      const corr = sum.issues.filter(i => i.st === ST.CORRECTED).length;
      if (corr) html += `<p class="tiny" style="margin-top:10px">${corr} ${corr === 1 ? 'Wort hast du' : 'Wörter hast du'} selbst korrigiert.</p>`;
      html += `<div class="row" style="margin-top:18px">${real.length ? '<button class="btn grow" id="sum-again">Stellen üben</button>' : ''}<button class="btn grow" id="sum-mem">Als gelernt markieren</button></div>
        <button class="btn primary block" id="sum-done" style="margin-top:10px">Fertig</button>
        <button class="btn ghost block" id="sum-clear" style="margin-top:4px">Markierungen im Text entfernen</button>
        <p class="tiny" style="margin-top:12px">Die Spracherkennung prüft, welche Wörter sie hört. Die genaue Länge einer Dehnung und feine Aussprache kann sie nicht messen; nutze dafür die Tajweed-Farben.</p>`;
      body.innerHTML = html;
      const list = $('#sum-issues', body);
      if (list) {
        let ih = '';
        for (const it of real.slice(0, 80)) {
          const [a, b] = issueText(it);
          ih += `<button class="issue" data-g="${it.g}"><span class="tag t${it.st}"></span><span class="iw">${esc(D.Q.words[it.g].t)}</span><span class="it"><b>${esc(a)}</b><span>${esc(b)}</span></span><span class="tiny">${ref(D.Q.words[it.g].v)}</span></button>`;
        }
        list.innerHTML = ih;
        list.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) { sh.close(); Reader.open(D.Q.words[+b.dataset.g].v, { g: +b.dataset.g, flash: true, block: 'center' }); } });
      }
      const sh = openSheet({ title: Rec.mode === 'test' ? 'Prüfung beendet' : 'Rezitation beendet', body });
      const again = $('#sum-again', body);
      if (again) again.addEventListener('click', () => { const g = real[0].g; sh.close(); Rec.start({ v: D.Q.words[g].v, mode: Rec.mode }); });
      $('#sum-mem', body).addEventListener('click', e => {
        const vs = []; for (let v = vFrom; v <= vTo; v++) vs.push(v);
        Hifz.setVerses(vs, true); e.target.disabled = true; e.target.textContent = `${vs.length} ${vs.length === 1 ? 'Vers' : 'Verse'} markiert`;
      });
      $('#sum-done', body).addEventListener('click', () => sh.close());
      $('#sum-clear', body).addEventListener('click', () => { Rec.clearMarks(); sh.close(); });
    },
  };

  // ------------------------------------------------------------------ help texts
  const Help = {
    previewMic() {
      const body = el(`<div>
        <p class="note">Hier in Claude darf keine Seite das Mikrofon benutzen. Lesen, Hifz und Wörter funktionieren trotzdem.</p>
        <p class="note">Für die Rezitation installierst du MyHifz einmal als App auf deinem Handy. Danach hört sie dir zu, auch offline beim Lesen.</p>
        <div class="row" style="margin-top:14px"><button class="btn primary grow" id="hp-guide">So installierst du MyHifz</button></div></div>`);
      const sh = openSheet({ title: 'Mikrofon in der Vorschau gesperrt', body });
      $('#hp-guide', body).addEventListener('click', () => { sh.close(); Settings.open('install'); });
    },
    noSpeech() {
      openSheet({ title: 'Keine Spracherkennung', body: el(`<div><p class="note">Dieser Browser bietet keine Spracherkennung an. Öffne MyHifz auf dem iPhone in Safari oder auf Android in Chrome.</p>
        <p class="note">Auf dem iPhone muss unter Einstellungen, Siri, die Diktierfunktion eingeschaltet sein.</p></div>`) });
    },
    speechError(code) {
      const T = {
        denied: ['Mikrofon blockiert', 'Erlaube den Mikrofonzugriff für diese Seite in den Browser-Einstellungen und tippe dann wieder auf Rezitieren.'],
        nomic: ['Kein Mikrofon gefunden', 'Prüfe, ob ein anderes Programm das Mikrofon benutzt, und versuche es erneut.'],
        network: ['Keine Verbindung', 'Die Spracherkennung deines Browsers braucht eine Internetverbindung. Prüfe dein Netz und starte erneut.'],
        lang: ['Arabisch nicht verfügbar', 'Dein Gerät bietet keine arabische Spracherkennung an. Auf dem iPhone hilft es, unter Einstellungen, Allgemein, Tastatur eine arabische Tastatur hinzuzufügen.'],
        unstable: ['Spracherkennung bricht ab', 'Die Erkennung startet immer wieder neu. Schließe andere Apps, die das Mikrofon nutzen, und versuche es noch einmal.'],
        start: ['Start nicht möglich', 'Die Spracherkennung ließ sich nicht starten. Lade die Seite neu und versuche es erneut.'],
        unsupported: ['Keine Spracherkennung', 'Öffne MyHifz auf dem iPhone in Safari oder auf Android in Chrome.'],
      }[code] || ['Spracherkennung gestoppt', 'Bitte starte die Rezitation erneut.'];
      openSheet({ title: T[0], body: el(`<div><p class="note">${esc(T[1])}</p></div>`) });
    },
  };

  // ------------------------------------------------------------------ hifz
  const INTERVALS = [1, 3, 7, 14, 30, 60];
  const Hifz = {
    seg: 's',
    pageStats(p) { const [a, b] = pageRange(p); let m = 0; for (let v = a; v <= b; v++) m += memHas(v); return { m, n: b - a + 1, a, b }; },
    setVerses(vs, on) {
      const pagesTouched = new Set();
      for (const v of vs) { memSet(v, on); pagesTouched.add(D.pageOf[v]); Reader.updateMem(v); }
      memStore();
      const d = today();
      for (const p of pagesTouched) {
        const st = this.pageStats(p);
        const sched = Store.data.pages[p];
        if (st.m === st.n && !sched) Store.data.pages[p] = { r: d, i: 1 };
        else if (st.m === 0 && sched) delete Store.data.pages[p];
      }
      Store.save();
      updateBadge();
      if (App.tab === 'hifz') this.render();
    },
    due() {
      const d = today(), out = [];
      for (const k in Store.data.pages) { const s = Store.data.pages[k]; if (d >= s.r + s.i) out.push({ p: +k, over: d - (s.r + s.i) }); }
      out.sort((a, b) => b.over - a.over || a.p - b.p);
      return out;
    },
    review(p, quality) {
      const s = Store.data.pages[p] || { r: today(), i: 1 };
      let idx = Math.max(0, INTERVALS.indexOf(s.i));
      if (quality >= 0.95) idx = Math.min(INTERVALS.length - 1, idx + 1);
      else if (quality < 0.85) idx = 0;
      Store.data.pages[p] = { r: today(), i: INTERVALS[idx], q: Math.round(quality * 100) };
      Store.save(); updateBadge();
    },
    reviewFromSession(t, sum) {
      if (sum.from < 0) return;
      const vA = D.Q.words[sum.from].v, vB = D.Q.words[sum.to].v;
      const done = [];
      for (let p = D.pageOf[vA]; p <= D.pageOf[vB]; p++) {
        const [a, b] = pageRange(p);
        if (a < vA || b > vB) continue;               // page not fully recited
        const ga = D.Q.verseStart[a], gb = D.Q.verseStart[b + 1];
        let ok = 0; for (let g = ga; g < gb; g++) if (t.status[g] === ST.OK || t.status[g] === ST.CORRECTED) ok++;
        const q = ok / (gb - ga);
        if (Store.data.pages[p] || this.pageStats(p).m) { this.review(p, q); done.push(p); }
      }
      if (done.length) toast(done.length === 1 ? `Seite ${done[0]} als wiederholt eingetragen` : `${done.length} Seiten als wiederholt eingetragen`);
    },
    stats() {
      let verses = 0; for (let v = 0; v < TOTAL_VERSES; v++) verses += memHas(v);
      let pages = 0; for (let p = 1; p <= 604; p++) { const s = this.pageStats(p); if (s.m === s.n) pages++; }
      let surahs = 0; for (const s of D.quran.surahs) { let m = 0; for (let v = s.start; v < s.start + s.ayahs; v++) m += memHas(v); if (m === s.ayahs) surahs++; }
      let juz = 0; for (let j = 1; j <= 30; j++) { const [a, b] = juzRange(j); let all = true; for (let v = a; v <= b; v++) if (!memHas(v)) { all = false; break; } if (all) juz++; }
      return { verses, pages, surahs, juz };
    },
    render() {
      const v = $('#v-hifz');
      const st = this.stats();
      const due = this.due();
      const pct = (100 * st.verses / TOTAL_VERSES);
      let html = `<header class="topbar"><h1>Hifz</h1><button class="icon-btn" data-settings aria-label="Einstellungen">${ICON.gear}</button></header>
        <section class="hero"><div class="big num">${fmt(st.verses)} <small>von ${fmt(TOTAL_VERSES)} Versen auswendig</small></div>
        <div class="stats"><div class="stat"><b>${st.pages}</b><span>von 604 Seiten</span></div><div class="stat"><b>${st.surahs}</b><span>von 114 Suren</span></div><div class="stat"><b>${st.juz}</b><span>von 30 Juz</span></div></div></section>`;
      html += `<div class="section-title">Heute wiederholen <small>${due.length ? due.length + (due.length === 1 ? ' Seite fällig' : ' Seiten fällig') : ''}</small></div>`;
      if (due.length) {
        html += '<div class="due-card">';
        for (const d of due.slice(0, 6)) {
          const [a, b] = pageRange(d.p);
          html += `<div class="li"><span class="main"><span class="a">Seite ${d.p}</span><span class="b">${esc(S(surahOf(a)).tr)} ${ref(a)} bis ${ref(b)}${d.over ? `, seit ${d.over} ${d.over === 1 ? 'Tag' : 'Tagen'} fällig` : ''}</span></span><button class="btn small" data-test-page="${d.p}">${ICON.eyeOff}<span>Prüfen</span></button></div>`;
        }
        if (due.length > 6) html += `<p class="tiny" style="padding:8px 2px">Und ${due.length - 6} weitere. Die Kacheln mit Punkt im Mosaik sind fällig.</p>`;
        html += '</div>';
      } else {
        html += `<div class="panel note">${st.verses ? 'Heute ist nichts fällig. Gelernte Seiten kommen nach 1, 3, 7, 14, 30 und 60 Tagen wieder, je nachdem wie sicher du sie liest.' : 'Markiere Verse, die du auswendig kannst. Komplett gelernte Seiten plant MyHifz dann automatisch zur Wiederholung ein.'}</div>`;
      }
      html += `<div class="section-title">Alle 604 Seiten <small>eine Reihe pro Juz</small></div><div class="mosaic" id="mosaic">`;
      const here = D.pageOf[Store.data.pos.v || 0];
      const dueSet = new Set(due.map(d => d.p));
      for (let j = 1; j <= 30; j++) {
        const [va, vb] = juzRange(j);
        const pa = D.pageOf[va], pb = D.pageOf[vb];
        html += `<div class="mrow"><span class="jl">${j}</span><div class="tiles">`;
        for (let p = pa; p <= pb; p++) {
          if (p === pa && j > 1 && D.pageOf[juzRange(j - 1)[1]] === p) continue; // shared page drawn in the earlier row
          const s = this.pageStats(p);
          const c = s.m === 0 ? '' : s.m === s.n ? ' full' : (s.m / s.n < 0.5 ? ' p1' : ' p2');
          html += `<button class="tile${c}${dueSet.has(p) ? ' due' : ''}${p === here ? ' here' : ''}" data-page="${p}" aria-label="Seite ${p}: ${s.m} von ${s.n} Versen"></button>`;
        }
        html += '</div></div>';
      }
      html += `</div><div class="legend"><span><i class="tile"></i>offen</span><span><i class="tile p2"></i>teilweise</span><span><i class="tile full"></i>gelernt</span><span><i class="tile full due"></i>fällig</span><span><i class="tile here"></i>zuletzt gelesen</span></div>`;
      html += `<div class="section-title">Nach Suren</div><div class="list" id="hifz-surahs"></div>`;
      v.innerHTML = html;
      let sh = '';
      for (const s of D.quran.surahs) {
        let m = 0; for (let x = s.start; x < s.start + s.ayahs; x++) m += memHas(x);
        sh += `<button class="li" data-surah="${s.n}"><span class="no num">${s.n}</span><span class="main"><span class="a">${esc(s.tr)}</span><span class="b">${m ? `${m} von ${s.ayahs} Versen` : `${s.ayahs} Verse`}</span></span><span class="meter"><i style="width:${Math.round(100 * m / s.ayahs)}%"></i></span><span class="ar">${esc(s.ar)}</span></button>`;
      }
      $('#hifz-surahs', v).innerHTML = sh;
      v.onclick = e => {
        const t = e.target;
        if (t.closest('[data-settings]')) return Settings.open();
        const tp = t.closest('[data-test-page]'); if (tp) { const p = +tp.dataset.testPage; const [a, b] = pageRange(p); return Rec.start({ v: a, endV: b, mode: 'test', unit: { type: 'page', n: p } }); }
        const tile = t.closest('.tile[data-page]'); if (tile) return this.pageSheet(+tile.dataset.page);
        const su = t.closest('[data-surah]'); if (su) return this.surahSheet(+su.dataset.surah);
      };
      void pct;
    },
    chipsSheet({ title, verses, label, extra }) {
      const body = el('<div></div>');
      const count = () => verses.reduce((s, v) => s + memHas(v), 0);
      body.innerHTML = `<p class="note" id="cs-count"></p>
        <div class="row" style="margin:10px 0"><button class="btn small" id="cs-all">Alle markieren</button><button class="btn small" id="cs-none">Keine</button><button class="btn small" id="cs-range" aria-pressed="false">Bereich wählen</button></div>
        <p class="tiny" id="cs-hint" hidden>Tippe auf den ersten und den letzten Vers des Bereichs.</p>
        <div class="chips" id="cs-chips"></div>
        <div class="row" style="margin-top:16px"><button class="btn grow" id="cs-read">${ICON.read}<span>Lesen</span></button><button class="btn primary grow" id="cs-test">${ICON.eyeOff}<span>Prüfen</span></button></div>
        ${extra || ''}`;
      const sh = openSheet({ title, body });
      const chips = $('#cs-chips', body);
      const draw = () => {
        chips.innerHTML = verses.map(v => `<button class="vchip" data-v="${v}" aria-pressed="${!!memHas(v)}">${label(v)}</button>`).join('');
        $('#cs-count', body).textContent = `${count()} von ${verses.length} Versen auswendig. Tippe auf einen Vers, um ihn zu markieren.`;
      };
      let rangeMode = false, rangeStart = null;
      chips.addEventListener('click', e => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        const v = +b.dataset.v;
        if (rangeMode) {
          if (rangeStart == null) { rangeStart = v; b.style.outline = '2px solid var(--cobalt)'; return; }
          const a = Math.min(rangeStart, v), z = Math.max(rangeStart, v);
          const on = !memHas(rangeStart);
          Hifz.setVerses(verses.filter(x => x >= a && x <= z), on);
          rangeStart = null; rangeMode = false; $('#cs-range', body).setAttribute('aria-pressed', 'false'); $('#cs-hint', body).hidden = true;
        } else Hifz.setVerses([v], !memHas(v));
        draw();
      });
      $('#cs-all', body).addEventListener('click', () => { Hifz.setVerses(verses, true); draw(); });
      $('#cs-none', body).addEventListener('click', () => { Hifz.setVerses(verses, false); draw(); });
      $('#cs-range', body).addEventListener('click', e => { rangeMode = !rangeMode; rangeStart = null; e.currentTarget.setAttribute('aria-pressed', String(rangeMode)); $('#cs-hint', body).hidden = !rangeMode; draw(); });
      $('#cs-read', body).addEventListener('click', () => { sh.close(); Reader.open(verses[0]); });
      $('#cs-test', body).addEventListener('click', () => { sh.close(); Rec.start({ v: verses[0], endV: verses[verses.length - 1], mode: 'test' }); });
      draw();
      return { sh, body };
    },
    pageSheet(p) {
      const [a, b] = pageRange(p); const vs = []; for (let v = a; v <= b; v++) vs.push(v);
      const sched = Store.data.pages[p];
      const extra = sched ? `<div class="panel" style="margin-top:14px"><div class="row"><span class="grow note">Zuletzt wiederholt ${sched.r === today() ? 'heute' : 'vor ' + (today() - sched.r) + ' Tagen'}. Nächste Wiederholung ${sched.r + sched.i <= today() ? 'jetzt fällig' : 'in ' + (sched.r + sched.i - today()) + ' Tagen'}.</span></div><button class="btn small" id="ps-done" style="margin-top:10px">Heute wiederholt</button></div>` : '';
      const { sh, body } = this.chipsSheet({ title: `Seite ${p}`, verses: vs, label: v => ref(v), extra });
      const done = $('#ps-done', body);
      if (done) done.addEventListener('click', () => { this.review(p, 1); sh.close(); toast(`Seite ${p} als wiederholt eingetragen`); if (App.tab === 'hifz') this.render(); });
      const t = $('#cs-test', body);
      t.replaceWith(t.cloneNode(true));
      $('#cs-test', body).addEventListener('click', () => { sh.close(); Rec.start({ v: a, endV: b, mode: 'test', unit: { type: 'page', n: p } }); });
    },
    surahSheet(n) {
      const s = S(n); const vs = []; for (let v = s.start; v < s.start + s.ayahs; v++) vs.push(v);
      const { sh, body } = this.chipsSheet({ title: `${s.tr}, ${s.de}`, verses: vs, label: v => ayahOf(v), extra: `<button class="btn ghost block" id="cs-words" style="margin-top:8px">${ICON.words}<span>Wörter und Test zu dieser Sure</span></button>` });
      $('#cs-words', body).addEventListener('click', () => { sh.close(); Words.surahSheet(n); });
    },
  };
  function updateBadge() {
    const b = $('#due-badge'); if (!b || !D.quran) return;
    const n = Hifz.due().length;
    b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n);
  }

  // ------------------------------------------------------------------ vocabulary (spaced repetition)
  const Vocab = {
    state(lid) { return Store.data.vocab[lid]; },
    queue(lid) { if (!Store.data.vocab[lid] && Store.data.queue.indexOf(lid) < 0) { Store.data.queue.push(lid); Store.save(); } },
    status(lid) { const s = Store.data.vocab[lid]; if (!s) return Store.data.queue.indexOf(lid) >= 0 ? 'queued' : 'new'; return s.i >= 7 ? 'known' : 'learn'; },
    dueList() { const d = today(), out = []; for (const k in Store.data.vocab) { const s = Store.data.vocab[k]; if (s.d <= d) out.push(+k); } out.sort((a, b) => Store.data.vocab[a].d - Store.data.vocab[b].d); return out; },
    introducedToday() { const d = today(); let n = 0; for (const k in Store.data.vocab) if (Store.data.vocab[k].a === d) n++; return n; },
    newCandidates(n) {
      const out = [];
      for (const lid of Store.data.queue) { if (out.length >= n) break; if (!Store.data.vocab[lid] && D.lex.lemmas[lid] && D.lex.lemmas[lid][4]) out.push(lid); }
      for (const lid of LEX.order) { if (out.length >= n) break; if (!Store.data.vocab[lid] && out.indexOf(lid) < 0) out.push(lid); }
      return out;
    },
    grade(lid, r) {
      // r: 0 again, 1 hard, 2 good, 3 easy
      const d = today();
      let s = Store.data.vocab[lid];
      if (!s) { s = { i: 0, e: 2.5, n: 0, l: 0, a: d, d }; Store.data.vocab[lid] = s; const qi = Store.data.queue.indexOf(lid); if (qi >= 0) Store.data.queue.splice(qi, 1); }
      if (r === 0) { s.l++; s.e = Math.max(1.3, s.e - 0.2); s.i = 0; s.d = d; }
      else {
        if (s.n === 0 || s.i === 0) s.i = r === 3 ? 4 : r === 2 ? 1 : 1;
        else if (r === 1) { s.i = Math.max(1, Math.round(s.i * 1.2)); s.e = Math.max(1.3, s.e - 0.15); }
        else if (r === 2) s.i = Math.max(s.i + 1, Math.round(s.i * s.e));
        else { s.i = Math.max(s.i + 2, Math.round(s.i * s.e * 1.3)); s.e += 0.15; }
        s.n++; s.d = d + s.i;
      }
      Store.save();
      return s;
    },
    preview(lid) {
      const s = Store.data.vocab[lid];
      const f = n => n < 1 ? 'gleich' : n === 1 ? '1 Tag' : n < 31 ? n + ' Tage' : Math.round(n / 30) + ' Mon.';
      if (!s || s.n === 0 || s.i === 0) return ['gleich', '1 Tag', '1 Tag', '4 Tage'];
      return ['gleich', f(Math.max(1, Math.round(s.i * 1.2))), f(Math.max(s.i + 1, Math.round(s.i * s.e))), f(Math.max(s.i + 2, Math.round(s.i * s.e * 1.3)))];
    },
    coverage() {
      let k = 0, l = 0;
      for (const key in Store.data.vocab) { const s = Store.data.vocab[key]; const lem = D.lex.lemmas[key]; if (!lem) continue; if (s.i >= 7) k += lem[3]; else l += lem[3]; }
      return { known: k / LEX.total, learning: l / LEX.total };
    },
    example(lid) {
      const occ = LEX.occ.get(lid) || [];
      if (!occ.length) return null;
      let best = occ[0], bl = 1e9;
      for (const g of occ.slice(0, 400)) { const L = D.quran.verses[D.Q.words[g].v].length; if (L < bl && L > 25) { bl = L; best = g; } }
      return best;
    },
  };

  const Words = {
    tab: 'top', shown: 120, term: '',
    async render() {
      const v = $('#v-words');
      if (!D.lex) {
        v.innerHTML = `<header class="topbar"><h1>Wörter</h1></header><div class="empty">Wortschatz wird geladen …</div>`;
        try { await ensure('lex'); } catch (e) { v.innerHTML = '<header class="topbar"><h1>Wörter</h1></header><div class="empty">Der Wortschatz konnte nicht geladen werden. Prüfe die Verbindung und öffne den Bereich erneut.</div>'; return; }
        if (App.tab !== 'words') return;
      }
      const cov = Vocab.coverage();
      const due = Vocab.dueList().length;
      const newN = Math.max(0, Store.data.settings.newPerDay - Vocab.introducedToday());
      let known = 0, learning = 0; for (const k in Store.data.vocab) { if (Store.data.vocab[k].i >= 7) known++; else learning++; }
      v.innerHTML = `<header class="topbar"><h1>Wörter</h1><button class="icon-btn" data-settings aria-label="Einstellungen">${ICON.gear}</button></header>
        <section class="hero"><div class="big num">${Math.round(cov.known * 100)} % <small>des Korantextes verstehst du schon</small></div>
          <div class="coverage"><div class="cov-bar" aria-hidden="true"><i class="k" style="width:${cov.known * 100}%"></i><i class="l" style="width:${cov.learning * 100}%"></i></div>
          <p class="tiny" style="margin-top:6px">${known} Wörter sicher, ${learning} in Arbeit. Die 100 häufigsten Wörter machen schon ${Math.round(100 * LEX.order.slice(0, 100).reduce((x, id) => x + D.lex.lemmas[id][3], 0) / LEX.total)} % aller Wörter im Koran aus.</p></div></section>
        <button class="btn primary block" id="w-learn" style="margin-top:14px">${due || newN ? `Lernen: ${due} fällig, ${Math.min(newN, LEX.order.length)} neu` : 'Für heute alles gelernt'}</button>
        <button class="btn block" id="w-surah" style="margin-top:8px">${ICON.words}<span>Wörter und Test pro Sure</span></button>
        <div class="seg" style="margin-top:20px" role="group"><button data-t="top" aria-pressed="${this.tab === 'top'}">Häufigste</button><button data-t="mine" aria-pressed="${this.tab === 'mine'}">Mein Wortschatz</button></div>
        <div class="row" style="margin-top:10px"><input class="field grow" id="w-q" type="search" placeholder="Deutsch oder Arabisch suchen" value="${esc(this.term)}" autocomplete="off"></div>
        <div class="list" id="w-list" style="margin-top:6px"></div>`;
      $('#w-learn', v).addEventListener('click', () => Cards.start());
      $('#w-surah', v).addEventListener('click', () => this.surahPicker());
      $('[data-settings]', v).addEventListener('click', () => Settings.open());
      $$('[data-t]', v).forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.t; this.shown = 120; this.render(); }));
      const q = $('#w-q', v);
      q.addEventListener('input', debounce(() => { this.term = q.value; this.shown = 120; this.drawList(); }, 150));
      $('#w-list', v).addEventListener('click', e => { const b = e.target.closest('[data-lid]'); if (b) LemmaSheet.open(+b.dataset.lid); const m = e.target.closest('#w-more'); if (m) { this.shown += 200; this.drawList(); } });
      this.drawList();
    },
    drawList() {
      const list = $('#w-list');
      if (!list) return;
      const term = this.term.trim().toLowerCase();
      const tsk = term ? QC.skeleton(term) : '';
      let ids = this.tab === 'mine' ? Object.keys(Store.data.vocab).map(Number).concat(Store.data.queue.filter(x => !Store.data.vocab[x])) : LEX.order;
      if (this.tab === 'mine') ids.sort((a, b) => D.lex.lemmas[b][3] - D.lex.lemmas[a][3]);
      if (term) ids = ids.filter(id => { const l = D.lex.lemmas[id]; return l && ((l[4] || '').toLowerCase().indexOf(term) >= 0 || (tsk && QC.skeleton(l[0]).indexOf(tsk) >= 0)); });
      if (!ids.length) { list.innerHTML = `<div class="empty">${this.tab === 'mine' ? 'Noch keine Wörter. Starte eine Lernrunde oder tippe beim Lesen auf ein Wort.' : 'Nichts gefunden.'}</div>`; return; }
      const label = { new: ['neu', 'new'], queued: ['vorgemerkt', 'new'], learn: ['in Arbeit', 'learn'], known: ['sicher', 'known'] };
      let html = '';
      for (const id of ids.slice(0, this.shown)) {
        const l = D.lex.lemmas[id]; if (!l) continue;
        const st = Vocab.status(id);
        html += `<button class="li lemma-row" data-lid="${id}"><span class="ar q">${esc(l[0])}</span><span class="main"><span class="a">${esc(l[4] || 'ohne Kurzbedeutung')}</span><span class="b">${posDE(l)}, ${fmt(l[3])}-mal</span></span><span class="pill ${label[st][1]}">${label[st][0]}</span></button>`;
      }
      if (ids.length > this.shown) html += `<button class="btn ghost block" id="w-more">Weitere ${Math.min(200, ids.length - this.shown)} anzeigen</button>`;
      list.innerHTML = html;
    },
    surahPicker() {
      const body = el('<div class="picker"></div>');
      body.innerHTML = `<div class="pk-head"><label class="pk-search">${ICON.search}<input id="sp-q" type="search" placeholder="Sure suchen" autocomplete="off" spellcheck="false"></label></div><div class="list" id="sp-list"></div>`;
      const sh = openSheet({ title: 'Wörter pro Sure', body, full: true });
      const list = $('#sp-list', body), q = $('#sp-q', body);
      const draw = () => {
        list.innerHTML = findSurahs(q.value).map(n => {
          const su = S(n), L = surahLemmas(n);
          let k = 0; for (const id of L.ids) if (Vocab.status(id) === 'known') k++;
          const t = (Store.data.tests || {})[n];
          return `<button class="pk-row" data-s="${n}"><span class="sbadge"><b>${n}</b></span><span class="main"><span class="a">${esc(su.tr)}</span><span class="b">${L.ids.length} Wörter, ${k} sicher</span>${k ? `<span class="pk-mem"><i style="width:${Math.round(100 * k / L.ids.length)}%"></i></span>` : ''}</span>${t ? `<span class="pill ${t.last >= 90 ? 'known' : t.last >= 60 ? 'learn' : 'new'}">${t.last} %</span>` : ''}<span class="ar">${esc(su.ar)}</span></button>`;
        }).join('') || '<div class="empty">Keine Sure gefunden.</div>';
      };
      q.addEventListener('input', draw);
      list.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; sh.close(); this.surahSheet(+b.dataset.s); });
      draw();
    },
    async surahSheet(n) {
      try { await ensure('lex'); } catch (e) { toast('Wortschatz konnte nicht geladen werden.'); return; }
      const su = S(n), L = surahLemmas(n);
      const body = el('<div></div>');
      const sh = openSheet({ title: `Wörter: ${su.tr}`, body, full: true, onClose: () => { if (App.tab === 'words') Words.render(); } });
      const draw = () => {
        let k = 0, l = 0; for (const id of L.ids) { const st = Vocab.status(id); if (st === 'known') k++; else if (st === 'learn') l++; }
        const t = (Store.data.tests || {})[n];
        const label = { new: ['neu', 'new'], queued: ['vorgemerkt', 'new'], learn: ['in Arbeit', 'learn'], known: ['sicher', 'known'] };
        body.innerHTML = `<p class="note">${L.ids.length} verschiedene Wörter mit Bedeutung in ${esc(su.tr)} (${esc(su.de)}). ${k} kannst du sicher, ${l} sind in Arbeit.</p>
          <div class="cov-bar" style="margin-top:8px" aria-hidden="true"><i class="k" style="width:${L.ids.length ? 100 * k / L.ids.length : 0}%"></i><i class="l" style="width:${L.ids.length ? 100 * l / L.ids.length : 0}%"></i></div>
          ${t ? `<p class="tiny" style="margin-top:8px">Letzter Test: ${t.last} % richtig, bester: ${t.best} %${t.at === today() ? ', heute' : ''}.</p>` : '<p class="tiny" style="margin-top:8px">Noch kein Test gemacht.</p>'}
          <div class="row" style="margin-top:14px"><button class="btn primary grow" id="sv-learn">${ICON.words}<span>Lernen</span></button><button class="btn grow" id="sv-test" ${L.ids.length < 2 ? 'disabled' : ''}>Test machen</button></div>
          <div class="section-title">Alle Wörter <small>nach Häufigkeit im Koran</small></div>
          <div class="list">${L.ids.map(id => { const lm = D.lex.lemmas[id]; const st = Vocab.status(id); return `<button class="li lemma-row" data-lid="${id}"><span class="ar q">${esc(lm[0])}</span><span class="main"><span class="a">${esc(lm[4])}</span><span class="b">${L.counts.get(id)}-mal in dieser Sure</span></span><span class="pill ${label[st][1]}">${label[st][0]}</span></button>`; }).join('')}</div>`;
        $('#sv-learn', body).addEventListener('click', () => Cards.start({ pool: L.ids, newMax: 12, title: `Lernen: ${su.tr}`, onDone: draw }));
        $('#sv-test', body).addEventListener('click', () => Quiz.open(n, draw));
      };
      body.addEventListener('click', e => { const b = e.target.closest('[data-lid]'); if (b) LemmaSheet.open(+b.dataset.lid); });
      draw();
      void sh;
    },
  };

  // distinct glossed words of a surah, most frequent in the Quran first
  const SURAH_LEX = new Map();
  function surahLemmas(n) {
    if (SURAH_LEX.has(n)) return SURAH_LEX.get(n);
    const su = S(n), counts = new Map(), first = new Map();
    for (let g = D.Q.verseStart[su.start]; g < D.Q.verseStart[su.start + su.ayahs]; g++) {
      const lid = LEX.main[g];
      if (lid < 0 || !D.lex.lemmas[lid] || !D.lex.lemmas[lid][4]) continue;
      counts.set(lid, (counts.get(lid) || 0) + 1);
      if (!first.has(lid)) first.set(lid, g);
    }
    const ids = [...counts.keys()].sort((x, y) => D.lex.lemmas[y][3] - D.lex.lemmas[x][3]);
    const r = { ids, counts, first };
    SURAH_LEX.set(n, r);
    return r;
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const firstGloss = g => String(g || '').split(/[,;]/)[0].replace(/\(.*?\)/g, '').trim().toLowerCase();

  // ------------------------------------------------------------------ vocabulary test per surah
  const Quiz = {
    open(n, onDone) {
      const su = S(n), L = surahLemmas(n);
      const body = el('<div class="card-stage"></div>');
      const sh = openSheet({ title: `Test: ${su.tr}`, body, full: true, onClose: () => { if (onDone) onDone(); } });
      let dir = 'ar', count = Math.min(10, L.ids.length);
      const setup = () => {
        const N = L.ids.length;
        body.innerHTML = `<div class="flashcard" style="justify-content:flex-start;padding-top:18px">
            <p class="note" style="max-width:30rem">Prüfe, ob du die Bedeutung der Wörter aus ${esc(su.tr)} kennst. Falsch beantwortete Wörter kommen danach in deine Lernrunde.</p>
            <div class="setting col" style="width:100%;max-width:30rem;text-align:start"><div class="txt"><b>Richtung</b></div>
              <div class="seg" id="qz-dir"><button data-v="ar" aria-pressed="true">Arabisch zu Deutsch</button><button data-v="de" aria-pressed="false">Deutsch zu Arabisch</button></div></div>
            <div class="setting col" style="width:100%;max-width:30rem;text-align:start"><div class="txt"><b>Fragen</b></div>
              <div class="seg" id="qz-n">${[10, 20].filter(x => x < N).map(x => `<button data-v="${x}" aria-pressed="${x === count}">${x}</button>`).join('')}<button data-v="${N}" aria-pressed="${count === N}">Alle ${N}</button></div></div>
          </div>
          <button class="btn primary block" id="qz-go">Test starten</button>`;
        const seg = (id, fn) => $$('#' + id + ' button', body).forEach(b => b.addEventListener('click', () => { $$('#' + id + ' button', body).forEach(x => x.setAttribute('aria-pressed', String(x === b))); fn(b.dataset.v); }));
        seg('qz-dir', v => { dir = v; });
        seg('qz-n', v => { count = +v; });
        $('#qz-go', body).addEventListener('click', () => run());
      };
      const run = () => {
        // learn-worthy words first: unknown ones, then the rest, shuffled within each group
        const fresh = L.ids.filter(id => Vocab.status(id) !== 'known'), known = L.ids.filter(id => Vocab.status(id) === 'known');
        const items = shuffle(fresh).concat(shuffle(known)).slice(0, count);
        const qs = shuffle(items).map(lid => ({ lid, opts: shuffle([lid].concat(this.distractors(lid, L.ids, dir))) }));
        let i = 0, right = 0;
        const wrong = [];
        const ask = () => {
          if (i >= qs.length) return finish();
          const q = qs[i], lm = D.lex.lemmas[q.lid];
          const g = L.first.get(q.lid);
          const prompt = dir === 'ar'
            ? `<div class="fa">${esc(D.Q.words[g].t)}</div><div class="root">${esc(su.tr)} ${ref(D.Q.words[g].v)}${D.Q.words[g].t.replace(/[ً-ٰٟۖ-ۭ]/g, '') !== lm[0].replace(/[ً-ٰٟۖ-ۭ]/g, '') ? ', Grundform <bdi class="q">' + esc(lm[0]) + '</bdi>' : ''}</div>`
            : `<div class="fde" style="font-size:28px">${esc(lm[4])}</div><div class="root">${posDE(lm)}</div>`;
          body.innerHTML = `<div class="progress-line"><i style="width:${Math.round(100 * i / qs.length)}%"></i></div>
            <div class="tiny" style="text-align:center;margin-top:8px">Frage ${i + 1} von ${qs.length}</div>
            <div class="flashcard qz-q">${prompt}</div>
            <div class="qz-opts${dir === 'de' ? ' two' : ''}">${q.opts.map(id => { const o = D.lex.lemmas[id]; return dir === 'ar' ? `<button class="qz-opt" data-id="${id}">${esc(o[4])}</button>` : `<button class="qz-opt ar-opt" data-id="${id}"><span class="q">${esc(o[0])}</span></button>`; }).join('')}</div>
            <div id="qz-next" style="margin-top:12px" hidden><button class="btn primary block">Weiter</button></div>`;
          const opts = $('.qz-opts', body);
          opts.addEventListener('click', e => {
            const b = e.target.closest('[data-id]'); if (!b || opts.dataset.done) return;
            opts.dataset.done = '1';
            const ok = +b.dataset.id === q.lid;
            $$('.qz-opt', opts).forEach(x => { if (+x.dataset.id === q.lid) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); else x.classList.add('dim'); });
            if (ok) { right++; setTimeout(() => { i++; ask(); }, 700); }
            else { wrong.push(q.lid); $('#qz-next', body).hidden = false; $('#qz-next button', body).addEventListener('click', () => { i++; ask(); }); }
          });
        };
        const finish = () => {
          const pct = Math.round(100 * right / qs.length);
          const tests = Store.data.tests || (Store.data.tests = {});
          const prev = tests[n];
          tests[n] = { last: pct, best: Math.max(pct, prev ? prev.best : 0), at: today(), n: qs.length };
          const d = today();
          for (const lid of wrong) { const st = Store.data.vocab[lid]; if (st) { st.d = Math.min(st.d, d); } else Vocab.queue(lid); }
          Store.save();
          body.innerHTML = `<div class="flashcard" style="justify-content:flex-start;padding-top:24px">
              <div class="score" style="justify-content:center"><b class="num">${pct} %</b></div>
              <p class="note">${right} von ${qs.length} richtig${prev ? `, vorher ${prev.last} %` : ''}.</p>
              ${wrong.length ? `<div class="section-title" style="align-self:stretch">Zum Wiederholen</div><div class="list" style="align-self:stretch">${wrong.map(id => { const o = D.lex.lemmas[id]; return `<div class="li lemma-row"><span class="ar q">${esc(o[0])}</span><span class="main"><span class="a">${esc(o[4])}</span></span></div>`; }).join('')}</div>` : '<p class="note">Alles richtig. Masha’Allah!</p>'}
            </div>
            <div class="row">${wrong.length ? '<button class="btn primary grow" id="qz-learn">Fehler jetzt lernen</button>' : ''}<button class="btn grow" id="qz-again">Neuer Test</button><button class="btn grow" id="qz-done">Fertig</button></div>`;
          const lb = $('#qz-learn', body);
          if (lb) lb.addEventListener('click', () => { sh.close(); Cards.start({ pool: wrong, newMax: wrong.length, title: `Fehler aus ${su.tr}` }); });
          $('#qz-again', body).addEventListener('click', () => setup());
          $('#qz-done', body).addEventListener('click', () => sh.close());
        };
        ask();
      };
      setup();
    },
    distractors(lid, pool, dir) {
      const lm = D.lex.lemmas[lid], g0 = firstGloss(lm[4]);
      const seen = new Set([g0]), seenAr = new Set([lm[0]]);
      const ok = id => {
        const o = D.lex.lemmas[id];
        if (!o || !o[4] || id === lid) return false;
        if (dir === 'ar' ? seen.has(firstGloss(o[4])) : seenAr.has(o[0])) return false;
        return true;
      };
      const take = (list, out, want, samePos) => {
        for (const id of list) {
          if (out.length >= want) break;
          if (!ok(id) || out.indexOf(id) >= 0) continue;
          if (samePos && D.lex.lemmas[id][2] !== lm[2]) continue;
          out.push(id); seen.add(firstGloss(D.lex.lemmas[id][4])); seenAr.add(D.lex.lemmas[id][0]);
        }
      };
      const out = [];
      const local = shuffle(pool), global = shuffle(LEX.order.slice(0, 900));
      take(local, out, 3, true);
      take(global, out, 3, true);
      take(local, out, 3, false);
      take(global, out, 3, false);
      return out;
    },
  };

  function exampleHTML(lid) {
    const g = Vocab.example(lid);
    if (g == null) return '';
    const w = D.Q.words[g], v = w.v;
    let ar = '';
    for (let x = D.Q.verseStart[v]; x < D.Q.verseStart[v + 1]; x++) ar += (x === g ? '<mark>' + esc(D.Q.words[x].t) + '</mark>' : esc(D.Q.words[x].t)) + ' ';
    return `<div class="q" style="line-height:2">${ar}<span class="an">${arNum(ayahOf(v))}</span></div><p class="note" data-tr="${v}" style="direction:ltr">${D.de ? esc(D.de[v]) : ''}</p><p class="tiny">${esc(S(surahOf(v)).tr)} ${ref(v)}</p>`;
  }
  const LemmaSheet = {
    async open(lid) {
      const l = D.lex.lemmas[lid];
      const body = el('<div></div>');
      const occ = LEX.occ.get(lid) || [];
      body.innerHTML = `<div class="word-big">${esc(l[0])}</div><p class="gloss">${esc(l[4] || 'ohne Kurzbedeutung')}</p><p class="gloss-sub">${posDE(l)}${l[1] ? ', Wurzel <bdi class="q">' + esc(l[1].split('').join(' ')) + '</bdi>' : ''}, ${fmt(l[3])}-mal im Koran</p>
        <div class="section-title">Beispiel</div><div id="ls-ex">${exampleHTML(lid)}</div>
        <div class="section-title">Stellen <small>${fmt(occ.length)}</small></div><div class="list" id="ls-occ"></div>
        <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ls-learn"></button></div>`;
      const occList = $('#ls-occ', body);
      occList.innerHTML = occ.slice(0, 12).map(g => { const v = D.Q.words[g].v; return `<button class="li" data-g="${g}"><span class="main"><span class="a">${esc(S(surahOf(v)).tr)} ${ref(v)}</span></span><span class="q" style="font-size:22px">${esc(D.Q.words[g].t)}</span></button>`; }).join('');
      const sh = openSheet({ title: 'Wort', body });
      occList.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; const g = +b.dataset.g; while (sheets.length) sheets[sheets.length - 1].close(); Reader.open(D.Q.words[g].v, { g, flash: true, block: 'center' }); });
      const btn = $('#ls-learn', body);
      const st = Vocab.status(lid);
      if (!l[4]) btn.remove();
      else if (st === 'new') { btn.textContent = 'Zum Lernen vormerken'; btn.addEventListener('click', () => { Vocab.queue(lid); btn.textContent = 'Vorgemerkt'; btn.disabled = true; Words.drawList(); }); }
      else { btn.textContent = st === 'queued' ? 'Vorgemerkt' : 'Im Wortschatz'; btn.disabled = true; }
      if (!D.de) ensure('de').then(() => { const p = $('[data-tr]', body); if (p) p.textContent = D.de[+p.dataset.tr]; }).catch(() => {});
      void sh;
    },
  };

  const Cards = {
    /** opts.pool: only these words (e.g. one surah); opts.newMax: new words in this round */
    async start(opts) {
      opts = opts || {};
      await ensure('lex');
      ensure('de').catch(() => {});
      let queue;
      if (opts.pool) {
        const pool = new Set(opts.pool);
        const due = Vocab.dueList().filter(id => pool.has(id));
        const fresh = opts.pool.filter(id => !Store.data.vocab[id] && due.indexOf(id) < 0).slice(0, opts.newMax || 12);
        queue = due.concat(fresh);
        if (!queue.length) queue = shuffle(opts.pool).slice(0, Math.min(10, opts.pool.length));   // everything learned: a short review round
      } else {
        const due = Vocab.dueList();
        const newN = Math.max(0, Store.data.settings.newPerDay - Vocab.introducedToday());
        queue = due.concat(Vocab.newCandidates(newN));
      }
      if (!queue.length) { toast('Für heute ist alles gelernt'); return; }
      const total = queue.length;
      let done = 0;
      const body = el('<div class="card-stage"></div>');
      const sh = openSheet({ title: opts.title || 'Lernen', body, full: true, onClose: () => { if (opts.onDone) opts.onDone(); if (App.tab === 'words') Words.render(); } });
      const next = () => {
        if (!queue.length) {
          body.innerHTML = `<div class="flashcard"><div class="fde">Geschafft</div><p class="note">${done} Karten gelernt. Morgen geht es weiter.</p><button class="btn primary" id="c-close" style="margin-top:18px">Fertig</button></div>`;
          $('#c-close', body).addEventListener('click', () => sh.close());
          return;
        }
        const lid = queue[0];
        const l = D.lex.lemmas[lid];
        const isNew = !Store.data.vocab[lid];
        body.innerHTML = `<div class="progress-line"><i style="width:${Math.round(100 * done / Math.max(total, done + queue.length))}%"></i></div>
          <div class="flashcard"><span class="pill ${isNew ? 'new' : 'learn'}">${isNew ? 'neues Wort' : 'Wiederholung'}</span>
            <div class="fa">${esc(l[0])}</div>
            <div class="root">${posDE(l)}${l[1] ? ', Wurzel <bdi class="q">' + esc(l[1].split('').join(' ')) + '</bdi>' : ''}, ${fmt(l[3])}-mal im Koran</div>
            <div id="c-back" hidden><div class="fde">${esc(l[4])}</div><div class="ex">${exampleHTML(lid)}</div></div>
          </div>
          <div id="c-front-actions"><button class="btn primary block" id="c-show">Bedeutung zeigen</button></div>
          <div id="c-rate" class="rate" hidden></div>`;
        const pv = Vocab.preview(lid);
        $('#c-rate', body).innerHTML = ['Nochmal', 'Schwer', 'Gut', 'Leicht'].map((t, i) => `<button class="btn" data-r="${i}"><span>${t}</span><small>${pv[i]}</small></button>`).join('');
        $('#c-show', body).addEventListener('click', () => {
          $('#c-back', body).hidden = false; $('#c-front-actions', body).hidden = true; $('#c-rate', body).hidden = false;
          const p = $('[data-tr]', body); if (p && D.de) p.textContent = D.de[+p.dataset.tr];
        });
        $('#c-rate', body).addEventListener('click', e => {
          const b = e.target.closest('[data-r]'); if (!b) return;
          const r = +b.dataset.r;
          Vocab.grade(lid, r);
          queue.shift();
          if (r === 0) queue.splice(Math.min(queue.length, 3), 0, lid); else done++;
          next();
        });
      };
      next();
    },
  };

  // ------------------------------------------------------------------ settings, backup, install
  const Settings = {
    open(section) {
      const st = Store.data.settings;
      const body = el('<div></div>');
      body.innerHTML = `
        <div class="section-title" style="margin-top:4px">Rezitation</div>
        <div class="setting col"><div class="txt"><b>Wie genau soll ich prüfen?</b><span id="s-strict-desc"></span></div>
          <div class="seg" id="s-strict"><button data-v="0">Locker</button><button data-v="1">Normal</button><button data-v="2">Streng</button></div></div>
        <label class="setting"><span class="txt"><b>Hinweise schon beim Lesen zeigen</b><span>Aus: Markierungen erst am Ende</span></span><input type="checkbox" class="switch" id="s-live" ${st.live ? 'checked' : ''}></label>
        <label class="setting"><span class="txt"><b>Gehörtes anzeigen</b><span>Die letzten erkannten Wörter in der Leiste</span></span><input type="checkbox" class="switch" id="s-heard" ${st.heard ? 'checked' : ''}></label>
        <p class="tiny" style="margin:8px 0 0">Tipp: Lies in normaler Lautstärke mit dem Handy vor dir. Tippe beim Rezitieren auf ein Wort, wenn die App an einer anderen Stelle weitermachen soll. Ertönt auf Android bei jedem Neustart der Erkennung ein kurzer Ton, stelle die Medienlautstärke leiser.</p>
        <div class="section-title">Auswendig prüfen <small>bei verdecktem Text</small></div>
        <label class="setting"><span class="txt"><b>Hilfen</b><span>Liest du einen falschen Vers, zählt die App deine Versuche. Danach sagt sie, was passiert ist, und zeigt dann Wort für Wort, wie es weitergeht.</span></span><input type="checkbox" class="switch" id="s-hints" ${st.hints !== false ? 'checked' : ''}></label>
        <div class="setting col" id="s-tries-row" ${st.hints === false ? 'hidden' : ''}><div class="txt"><b>Versuche bis zum Hinweis</b></div><div class="seg" id="s-tries"><button data-v="2">2</button><button data-v="3">3</button><button data-v="5">5</button></div></div>
        <div class="section-title">Darstellung</div>
        <div class="setting col"><div class="txt"><b>Erscheinungsbild</b></div><div class="seg" id="s-theme"><button data-v="system">System</button><button data-v="light">Hell</button><button data-v="dark">Dunkel</button></div></div>
        <div class="section-title">Wörter</div>
        <div class="setting col"><div class="txt"><b>Neue Wörter pro Tag</b></div><div class="seg" id="s-new"><button data-v="5">5</button><button data-v="10">10</button><button data-v="15">15</button><button data-v="20">20</button></div></div>
        <div class="section-title">Daten und Sicherheit</div>
        <p class="note">Dein Fortschritt wird nur auf diesem Gerät gespeichert. Es gibt kein Konto und keinen Server. Beim Rezitieren wertet die Spracherkennung deines Browsers die Stimme aus (Chrome: Google, Safari: Apple); MyHifz speichert keine Aufnahmen.${Store.ok ? '' : ' <b>Achtung: Speichern ist in diesem Browser blockiert, Fortschritt geht beim Schließen verloren.</b>'}</p>
        <div class="row" style="margin-top:10px"><button class="btn grow" id="s-export">${ICON.copy}<span>Sicherung kopieren</span></button><button class="btn grow" id="s-import">Sicherung einfügen</button></div>
        <div id="s-io" hidden style="margin-top:10px"><textarea class="field" id="s-io-text" placeholder="Sicherungscode hier einfügen"></textarea><div class="row" style="margin-top:8px"><button class="btn primary grow" id="s-io-apply">Übernehmen</button></div><p class="tiny" id="s-io-msg"></p></div>
        <button class="btn danger block" id="s-reset" style="margin-top:10px">Fortschritt zurücksetzen</button>
        <div class="section-title" id="install">Als App installieren</div>
        <ol class="steps">
          <li>Öffne <b>${esc(IS_PREVIEW || !/^https?:$/.test(location.protocol) ? 'moeruc.github.io/Hifz' : (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, ''))}</b> auf dem Handy.</li>
          <li>Android: Chrome, Menü, App installieren. iPhone: Safari, Teilen, Zum Home-Bildschirm.</li>
          <li>Fortschritt von einem anderen Gerät oder einer älteren Installation übernimmst du mit Sicherung kopieren und dort mit Sicherung einfügen.</li>
        </ol>
        <div class="section-title">Version</div>
        <p class="tiny">MyHifz ${APP_VERSION}. Neue Versionen lädt die installierte App beim Öffnen selbst; dein Fortschritt bleibt erhalten, solange die Adresse gleich bleibt.</p>
        <div class="section-title">Quellen</div>
        <p class="tiny" style="line-height:1.6">Korantext und Schrift: King Fahd Glorious Quran Printing Complex (KFGQPC), Hafs ʿan ʿĀṣim, Madina-Mushaf, über Quranpedia.net. Seiten- und Juz-Einteilung: Madina-Mushaf (604 Seiten). Deutsche Übersetzung: Frank Bubenheim und Nadeem Elyas, QuranEnc.com Version 1.1.4. Wortanalyse: Quranic Arabic Corpus (Kais Dukes), überarbeitet von furqan.co. Tajweed-Regeln: cpfair/quran-tajweed (CC BY 4.0) auf Basis des Tanzil-Texts. Deutsche Kurzbedeutungen: für MyHifz erstellt, an Bubenheim und Elyas orientiert, ohne Gewähr.</p>`;
      const sh = openSheet({ title: 'Einstellungen', body });
      const segSel = (id, val, fn) => { const s = $(id, body); $$('button', s).forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === String(val))); b.addEventListener('click', () => { $$('button', s).forEach(x => x.setAttribute('aria-pressed', String(x === b))); fn(b.dataset.v); }); }); };
      const strictDesc = ['Nur deutliche Fehler: ausgelassene und falsche Wörter.', 'Dazu fehlende Dehnungen und Wortabweichungen. Empfohlen.', 'Jede Abweichung, die die Erkennung hört.'];
      $('#s-strict-desc', body).textContent = strictDesc[st.strict];
      segSel('#s-strict', st.strict, v => { st.strict = +v; $('#s-strict-desc', body).textContent = strictDesc[st.strict]; Store.save(); if (Rec.tracker) Rec.tracker.opts.strictness = st.strict; });
      segSel('#s-theme', st.theme, v => { st.theme = v; Store.save(); applyTheme(); });
      segSel('#s-new', st.newPerDay, v => { st.newPerDay = +v; Store.save(); });
      segSel('#s-tries', st.tries || 3, v => { st.tries = +v; Store.save(); Rec.applyHelp(); });
      $('#s-hints', body).addEventListener('change', e => { st.hints = e.target.checked; Store.save(); $('#s-tries-row', body).hidden = !st.hints; Rec.applyHelp(); });
      $('#s-live', body).addEventListener('change', e => { st.live = e.target.checked; Store.save(); if (Rec.active) Reader.root.classList.toggle('marks', st.live); });
      $('#s-heard', body).addEventListener('change', e => { st.heard = e.target.checked; Store.save(); });
      $('#s-export', body).addEventListener('click', () => { const code = 'RAHLE1:' + btoa(unescape(encodeURIComponent(JSON.stringify(Store.data)))); copyText(code); $('#s-io', body).hidden = false; $('#s-io-text', body).value = code; $('#s-io-msg', body).textContent = 'Bewahre diesen Code auf oder füge ihn in der installierten App ein.'; });
      $('#s-import', body).addEventListener('click', () => { $('#s-io', body).hidden = false; $('#s-io-text', body).value = ''; $('#s-io-text', body).focus(); });
      $('#s-io-apply', body).addEventListener('click', () => {
        const msg = $('#s-io-msg', body);
        try {
          let raw = $('#s-io-text', body).value.trim();
          if (raw.startsWith('RAHLE1:')) raw = decodeURIComponent(escape(atob(raw.slice(7))));
          const d = JSON.parse(raw);
          if (!d || d.v !== 1) throw new Error('version');
          Store.data = Object.assign(defaults(), d, { settings: Object.assign({}, DEFAULT_SETTINGS, d.settings || {}) });
          Store.save(); memLoad(); applyTheme(); updateBadge();
          msg.textContent = 'Übernommen.'; toast('Sicherung übernommen');
          Reader.render(surahOf(Store.data.pos.v || 0), { v: Store.data.pos.v || 0 });
        } catch (e) { msg.textContent = 'Das ist kein gültiger Sicherungscode. Kopiere ihn vollständig, beginnend mit RAHLE1.'; }
      });
      const reset = $('#s-reset', body);
      reset.addEventListener('click', () => {
        if (reset.dataset.armed) {
          const keep = Store.data.settings; Store.data = defaults(); Store.data.settings = keep; Store.save(); memLoad(); updateBadge();
          reset.textContent = 'Zurückgesetzt'; reset.disabled = true; Reader.render(Reader.surah);
        } else { reset.dataset.armed = '1'; reset.textContent = 'Wirklich alles löschen? Nochmal tippen'; setTimeout(() => { if (!reset.disabled) { delete reset.dataset.armed; reset.textContent = 'Fortschritt zurücksetzen'; } }, 4000); }
      });
      if (section) setTimeout(() => { const t = $('#' + section, body); if (t) t.scrollIntoView({ block: 'start' }); }, 120);
      void sh;
    },
  };

  // ------------------------------------------------------------------ boot
  async function boot() {
    Store.load(); memLoad(); applyTheme();
    try { await loadCore(); }
    catch (e) { $('#splash').innerHTML = '<div><p>Der Korantext konnte nicht geladen werden.</p><p class="tiny">Prüfe die Verbindung und lade die Seite neu.</p></div>'; return; }
    buildFrame();
    Reader.init();
    const pos = Math.min(TOTAL_VERSES - 1, Math.max(0, (Store.data.pos && Store.data.pos.v) || 0));
    const hashTab = { '#hifz': 'hifz', '#woerter': 'words', '#lesen': 'read' }[location.hash];
    await Reader.render(surahOf(pos), pos ? { v: pos } : null);
    showTab(hashTab || Store.data.tab || 'read', true);
    updateBadge();
    // warm up lazily used data after first paint
    setTimeout(() => { if (Store.data.settings.tajweed) ensure('tj').catch(() => {}); }, 1500);
    setTimeout(warmTracker, 2500);
    if ('serviceWorker' in navigator && !IS_PREVIEW && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      // a new upload of the app replaces the old one by itself; show the new version right away when it is safe
      const hadController = !!navigator.serviceWorker.controller;
      const bootAt = Date.now();
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        if (!Rec.active && !sheets.length && Date.now() - bootAt < 20000) { reloading = true; location.reload(); }
        else toast('Neue Version von MyHifz ist installiert. Sie startet beim nächsten Öffnen.', 4200);
      });
      navigator.serviceWorker.register('sw.js').then(reg => { try { reg.update(); } catch (e) { /* offline */ } }).catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(r => { if (r) r.update().catch(() => {}); }).catch(() => {});
      });
    }
  }
  window.RahleDebug = { D, Store, Rec, Reader, Hifz, Vocab, LEX };
  boot();
})();
