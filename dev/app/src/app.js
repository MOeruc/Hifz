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
    // an ear: reciting without any text, the app only listens
    ear: '<svg class="i" viewBox="0 0 24 24"><path d="M7 9.5a5.5 5.5 0 0 1 11 0c0 2.4-1.3 3.6-2.4 4.6-.9.8-1.6 1.5-1.6 2.9a3 3 0 0 1-5.6 1.5"/><path d="M10 9.8a2.5 2.5 0 0 1 5 0c0 1.2-.9 1.7-1.6 2.3"/></svg>',
    skip: '<svg class="i" viewBox="0 0 24 24"><path d="M5.5 6.5l7 5.5-7 5.5zM12.5 6.5l7 5.5-7 5.5z"/></svg>',
    check: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    trash: '<svg class="i" viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V5.3c0-.7.5-1.3 1.2-1.3h2.6c.7 0 1.2.6 1.2 1.3V7M6.5 7l.8 11.5c.1 1.1.9 2 2 2h5.4c1.1 0 1.9-.9 2-2L17.5 7"/></svg>',
    download: '<svg class="i" viewBox="0 0 24 24"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>',
    // a leaf of a calendar with a tick: today's work
    today: '<svg class="i" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8.6 14.7l2.2 2.2 4.6-4.6"/></svg>',
    plus: '<svg class="i" viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></svg>',
    minus: '<svg class="i" viewBox="0 0 24 24"><path d="M5.5 12h13"/></svg>',
  };

  // ------------------------------------------------------------------ storage
  const KEY = 'rahle.v1';
  // sv: settings version. 2: the Mushaf pages are the default view, and only words left out count as mistakes
  const DEFAULT_SETTINGS = { sv: 2, theme: 'system', qsize: 27, tajweed: false, layout: 'mushaf', spread: true, translation: true, strict: 0, live: true, heard: true, newPerDay: 10, vret: 0.9, hints: true, tries: 3, intro: true, engine: 'web' };
  // plan: the hifz plan (hifzplan.js), md: the day every verse was learnt (verses known from before have none),
  // pst: today's list of pages to recite again and the round of the manzil
  function defaults() {
    return { v: 1, mem: '', pages: {}, sessions: [], vocab: {}, queue: [], tests: {}, recent: [], settings: Object.assign({}, DEFAULT_SETTINGS), pos: { v: 0 }, tab: 'read', plan: null, md: {}, pst: {} };
  }
  const Store = {
    data: defaults(),
    ok: true,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.v === 1) {
            const old = d.settings || {};
            if (!(old.sv >= 2)) {
              // the old defaults become the new ones: Mushaf pages instead of running text, and the speech recognition is
              // not good enough to judge more than whole words left out (a chosen "verse by verse" or strictness stays)
              if (!old.layout || old.layout === 'flow') old.layout = 'mushaf';
              if (old.strict == null || old.strict === 1) old.strict = 0;
              old.sv = 2;
            }
            this.data = Object.assign(defaults(), d, { settings: Object.assign({}, DEFAULT_SETTINGS, old) });
          }
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
  const D = { quran: null, Q: null, pageOf: null, juzOf: null, pageStart: null, juzStart: null, de: null, tj: null, lex: null, wd: null, mushaf: null, pending: {} };
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
    const files = { de: ['de.json'], tj: ['tajweed.json'], lex: ['lex.json', 'words.json'], mushaf: ['mushaf.json'] }[key];
    D.pending[key] = Promise.all(files.map(getJSON)).then(res => {
      if (key === 'de') D.de = res[0].verses;
      if (key === 'tj') D.tj = res[0];
      if (key === 'lex') { D.lex = res[0]; D.wd = res[1].words; buildLexIndex(); Vocab.migrate(); }
      if (key === 'mushaf') D.mushaf = res[0];
      return D[key];
    }).catch(err => { D.pending[key] = null; throw err; });
    return D.pending[key];
  }
  const surahOf = v => D.Q.verseSurah[v];
  const ayahOf = v => D.Q.verseAyah[v];
  const S = n => D.quran.surahs[n - 1];
  const vIndex = (s, a) => S(s).start + a - 1;
  const ref = v => surahOf(v) + ':' + ayahOf(v);
  /** a word as surah:ayah#word (for the recognition log) */
  const gref = g => { if (g == null || g < 0) return '-'; const n = D.Q.words.length; if (g >= n) return 'end'; const v = D.Q.words[g].v; return ref(v) + '#' + (g - D.Q.verseStart[v] + 1); };
  const pageRange = p => [D.pageStart[p - 1], p < 604 ? D.pageStart[p] - 1 : TOTAL_VERSES - 1];
  const juzRange = j => [D.juzStart[j - 1], j < 30 ? D.juzStart[j] - 1 : TOTAL_VERSES - 1];
  /** the basmala above surah s as text (HAFS font). Before at-Tin and al-Qadr the surah ends in a ب with sukun
   *  (94:8 فَٱرۡغَب, 96:19 وَٱقۡتَرِب): read on into the basmala, the two ب are one, so the Madina Mushaf writes بِّسۡمِ */
  const basmalaText = s => (s === 95 || s === 97 ? 'بّ' : 'ب') + D.quran.verses[0].slice(1);

  // ------------------------------------------------------------------ lexicon
  const LEX = { main: null, occ: null, order: null, total: 0, byRoot: null, family: null, alt: new Map() };
  /** the meaning of word id at word g of the Quran: worded for its verse where the lexicon has that (Angesicht for the
   *  وَجۡه of Allah), else the meaning of the word */
  const glossOf = (id, g) => (g != null && g >= 0 && LEX.main && LEX.main[g] === id && LEX.alt.get(g)) || (D.lex.lemmas[id] && D.lex.lemmas[id][4]) || '';
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
    // meanings worded for single verses: "surah:ayah:word" -> meaning
    LEX.alt = new Map();
    for (const r of Object.keys(D.lex.alt || {})) {
      const [s, a, k] = r.split(':').map(Number);
      if (!(s >= 1 && s <= 114) || !(a >= 1 && a <= S(s).ayahs)) continue;
      const v = vIndex(s, a), g = D.Q.verseStart[v] + k - 1;
      if (k >= 1 && g < D.Q.verseStart[v + 1]) LEX.alt.set(g, D.lex.alt[r]);
    }
    LEX.order = [];
    LEX.byRoot = new Map();
    D.lex.lemmas.forEach((l, i) => {
      if (l && l[4]) LEX.order.push(i);
      if (l && l[1]) { let a = LEX.byRoot.get(l[1]); if (!a) { a = []; LEX.byRoot.set(l[1], a); } a.push(i); }
    });
    LEX.order.sort((a, b) => D.lex.lemmas[b][3] - D.lex.lemmas[a][3]);
    LEX.total = D.lex.lemmas.reduce((s, l) => s + (l ? l[3] : 0), 0);
    // forms learnt on their own (ذَٰلِكَ, تِلۡكَ, ٱلَّتِي ...) belong to one family: not two of them new on the same day
    const formBase = new Map();
    for (const old in (D.lex.moved || {})) for (const id of D.lex.moved[old]) formBase.set(id, +old);
    LEX.family = id => { const l = D.lex.lemmas[id]; if (!l) return null; if (l[1]) return 'r:' + l[1]; if (formBase.has(id)) return 'f:' + formBase.get(id); return l[2] === 'PRON' ? 'pron' : null; };
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
    if (t.indexOf('DET') >= 0) return 'der, die, das';
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
    const dark = t === 'dark' || (t !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', dark ? '#13110D' : '#F5EEDC');
    Orn.apply();
  }
  // the ornaments follow the system's appearance when it changes
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme()); } catch (e) { /* old browsers */ }

  // ------------------------------------------------------------------ layout
  const App = { tab: 'read', scroll: { today: 0, read: 0, hifz: 0, words: 0 } };
  const TABS = ['today', 'read', 'hifz', 'words'];
  const TAB_HASH = { today: 'heute', read: 'lesen', hifz: 'hifz', words: 'woerter' };
  function buildFrame() {
    const app = $('#app');
    app.innerHTML = `
      <main class="view" id="v-today" aria-label="Heute" hidden></main>
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
        <button class="tab" role="tab" data-tab="today">${ICON.today}<span>Heute</span><span class="badge" id="due-badge" hidden></span></button>
        <button class="tab" role="tab" data-tab="read">${ICON.read}<span>Lesen</span></button>
        <button class="tab" role="tab" data-tab="hifz">${ICON.hifz}<span>Hifz</span></button>
        <button class="tab" role="tab" data-tab="words">${ICON.words}<span>Wörter</span></button>
      </div></nav>`;
    $$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('#fab').addEventListener('click', () => Rec.startFromView());
    $('#rec-stop').addEventListener('click', () => Rec.stop('user'));
    $('#rec-hide').addEventListener('click', () => Rec.toggleHide());
    $('#rec-help').addEventListener('click', () => { if (Rec.tracker) Rec.tracker.requestHint(); });
    $('#rec-hint-x').addEventListener('click', () => Rec.hideHint());
    $('#rec-resume').addEventListener('click', () => Rec.resume());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Rec.active && !Rec.paused) Rec.pause('hidden');
      // back after a while (perhaps the next day): today's work anew
      if (!document.hidden && D.quran && !Rec.active) { updateBadge(); if (App.tab === 'today' && !sheets.length) Today.render(); }
    });
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  function onScroll() {
    const tb = $('.view:not([hidden]) .topbar');
    if (tb) tb.classList.toggle('scrolled', window.scrollY > 4);
    if (App.tab === 'read') Reader.onScroll();
  }
  function showTab(tab, noScroll) {
    if (!TABS.includes(tab)) tab = 'read';
    App.scroll[App.tab] = window.scrollY;
    App.tab = tab; Store.data.tab = tab; Store.save();
    $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    for (const t of TABS) $('#v-' + t).hidden = tab !== t;
    $('#fab').hidden = tab !== 'read' || Rec.active || Capture.active;
    if (tab === 'today') Today.render();
    if (tab === 'hifz') Hifz.render();
    if (tab === 'words') Words.render();
    // the pages are measured when they can be seen
    if (tab === 'read' && Mushaf.on && (!Mushaf.size || Mushaf.size.W !== Mushaf.root.clientWidth || Mushaf.size.H !== Mushaf.root.clientHeight)) Mushaf.relayout();
    if (!noScroll) window.scrollTo(0, App.scroll[tab] || 0);
    try { history.replaceState(null, '', '#' + TAB_HASH[tab]); } catch (e) { /* sandboxed */ }
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
          <button class="rec-top" id="rec-top" aria-label="Rezitieren">${ICON.mic}<span>Rezitieren</span></button>
          <button class="icon-btn" id="display-btn" aria-label="Darstellung">${ICON.type}</button>
          <button class="icon-btn" id="settings-btn" aria-label="Einstellungen">${ICON.gear}</button>
        </header>
        <div class="reader" id="reader"></div>`;
      this.root = $('#reader');
      Mushaf.init(this.root);
      Turn.init();
      $('#nav-btn').addEventListener('click', () => Nav.open());
      $('#display-btn').addEventListener('click', () => Display.open());
      $('#rec-top').addEventListener('click', () => Rec.startFromView());
      $('#settings-btn').addEventListener('click', () => Settings.open());
      this.root.addEventListener('click', e => this.onClick(e));
    },
    classes() {
      const s = Store.data.settings;
      this.root.classList.toggle('tajweed', !!(s.tajweed && D.tj));
      // how much the marks show: 0 only words left out, 1 also other words, 2 every difference the recogniser hears
      for (let k = 0; k <= 2; k++) this.root.classList.toggle('lv' + k, (s.strict || 0) === k);
    },
    async render(s, focus) {
      // focus: {v, g, flash, block}
      this.surah = s;
      const st = Store.data.settings;
      if (st.layout === 'mushaf') {
        // the pages of the Madina Mushaf (running text if the layout data cannot be loaded)
        if (!D.mushaf) { try { await ensure('mushaf'); } catch (e) { toast('Die Mushaf-Seiten konnten nicht geladen werden. Fließtext wird gezeigt.'); } }
        if (D.mushaf) {
          if (st.tajweed && !D.tj) { try { await ensure('tj'); } catch (e) { /* without colours */ } }
          Mushaf.enter();
          this.classes();
          Mushaf.show(focus && (focus.g != null || focus.v != null) ? focus : { v: S(s).start });
          const rec = (Store.data.recent || []).filter(x => x !== s); rec.unshift(s); Store.data.recent = rec.slice(0, 8); Store.save();
          return;
        }
      }
      Mushaf.leave();
      if (st.tajweed && !D.tj) { try { await ensure('tj'); } catch (e) { toast('Tajweed-Daten konnten nicht geladen werden.'); } }
      if (st.layout === 'verse' && st.translation && !D.de) { try { await ensure('de'); } catch (e) { /* render without */ } }
      const tajweed = !!(st.tajweed && D.tj);
      const sur = S(s);
      const v0 = sur.start, v1 = sur.start + sur.ayahs - 1;
      let html = `<div class="surah-head"><div class="cartouche"><div class="inner"><div class="name-ar">سورة ${esc(sur.ar)}</div></div></div>
        <div class="name-de">${esc(sur.tr)}, ${esc(sur.de)}</div>
        <div class="surah-meta">Sure ${s}, ${fmt(sur.ayahs)} Verse, ${sur.type === 'm' ? 'mekkanisch' : 'medinensisch'}</div>
        <button class="btn small ghost head-link" data-vocab="${s}">${ICON.words}<span>Die Wörter dieser Sure lernen</span></button></div>`;
      if (s !== 1 && s !== 9) html += `<div class="basmala" data-bs="${s}">${esc(basmalaText(s))}</div>`;
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
      if (this.paged) { Mushaf.show({ v, g, flash }); return; }
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
      if (this.paged || s !== this.surah || !this.words.size) return this.render(s, o);
      this.focus(o);
      return Promise.resolve();
    },
    firstVisibleVerse() {
      if (this.paged) return Mushaf.firstVerse();
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
      if (Reader.paged || !Reader.pageEls.length || App.tab !== 'read') return;
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
      if (vb) { Words.openSurah(+vb.dataset.vocab); return; }
      const an = e.target.closest('.an');
      if (an) { VerseSheet.open(+an.dataset.v); return; }
      const sh = e.target.closest('[data-sh]');
      if (sh && !Rec.active) { Hifz.surahSheet(+sh.dataset.sh); return; }
      const w = e.target.closest('.w');
      if (w) {
        const g = +w.dataset.g;
        if (Rec.active) { Rec.moveTo(g); return; }
        WordSheet.open(g);
        return;
      }
      // the margin of a mushaf page (not a word, a verse marker or a surah's name): the bars hide or come back
      if (this.paged && !Rec.active && e.target.closest('.slide')) Mushaf.immersive();
    },
    updateMem(v) { const m = this.markers.get(v); if (m) m.classList.toggle('mem', !!memHas(v)); },
  };

  // ------------------------------------------------------------------ mushaf: the pages of the Madina Mushaf
  // The lines of every page come from quran-qcf4 (mushaf.json, made by tools/build_mushaf.py). The page fonts of the
  // King Fahd Complex (QCF4, Madina Mushaf 1441 H) are not part of MyHifz: they are loaded from that repository through
  // jsDelivr when a page is shown, and the service worker keeps them. Without them (offline the first time, or with
  // tajweed colours) the same lines are set in the HAFS font.
  const QCF = {
    base: 'https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@5130511027e769f0a8f4eeb7f00f46bde3788d60/fonts-woff2/',
    ok: new Set(), pending: new Map(), failed: 0,
    /** 0: the font of the surah and juz headers, 1-47: the page fonts */
    fam(n) { return n === 0 ? 'QCF4_QBSML' : 'QCF4_Hafs_' + String(n).padStart(2, '0'); },
    has(n) { return this.ok.has(n); },
    count: 48,
    url(n) { const fam = this.fam(n); return this.base + fam + (n === 0 ? '' : '_W') + '.woff2'; },
    /** how many of the fonts the service worker keeps */
    async cached() {
      try { if (!window.caches) return 0; const c = await caches.open('qcf4-fonts-1'); return (await c.keys()).length; } catch (e) { return 0; }
    },
    /** fetch every font once (the service worker keeps them), a few at a time */
    async prefetchAll(progress) {
      const all = []; for (let n = 0; n <= 47; n++) all.push(n);
      let done = 0, failed = 0;
      const one = async n => {
        try { const r = await fetch(this.url(n), { mode: 'cors' }); if (!r.ok) throw new Error(r.status); await r.arrayBuffer(); } catch (e) { failed++; }
        done++; if (progress) progress(done, all.length);
      };
      const queue = all.slice();
      await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length) await one(queue.shift()); }));
      return !failed;
    },
    load(n) {
      if (this.ok.has(n)) return Promise.resolve(true);
      if (this.pending.has(n)) return this.pending.get(n);
      const fam = this.fam(n);
      const pr = new FontFace(fam, `url(${this.url(n)})`).load()
        .then(ff => { document.fonts.add(ff); this.ok.add(n); this.pending.delete(n); return true; })
        .catch(() => { this.pending.delete(n); this.failed = Date.now(); return false; });
      this.pending.set(n, pr);
      return pr;
    },
  };
  // The ornaments of the printed page, as SVG in the colours of the theme (CSS variables cannot reach into a data URI):
  // --orn-frame the frame around the 15 lines (a band of gilded lozenges between two rules, rosettes in the corners;
  // 9-slice for border-image, 30 units a cell), --orn-open the richer frame of the first two pages, --orn-band the
  // lozenges alone, for the field of a surah cartouche
  const Orn = {
    star(cx, cy, r1, r2, n) {
      let d = '';
      for (let i = 0; i < 2 * n; i++) { const r = i % 2 ? r2 : r1, a = Math.PI * i / n - Math.PI / 2; d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2); }
      return d + 'Z';
    },
    url(w, h, body) { return 'url("data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`) + '")'; },
    lozenges(c) {
      return `<path d="M15 5.4L25.2 15L15 24.6L4.8 15Z" fill="${c.gold}" stroke="${c.line}" stroke-width=".7"/><path d="M15 10.4L19.6 15L15 19.6L10.4 15Z" fill="${c.pale}"/>`
        + `<circle cx="15" cy="15" r="1.7" fill="${c.green}"/><circle cy="15" r="2.3" fill="${c.gold}"/><circle cx="30" cy="15" r="2.3" fill="${c.gold}"/>`;
    },
    rosettes(c) {
      return `<path d="${this.star(15, 15, 9.6, 5, 8)}" fill="${c.gold}" stroke="${c.line}" stroke-width=".7"/><circle cx="15" cy="15" r="3.2" fill="${c.pale}"/><circle cx="15" cy="15" r="1.6" fill="${c.green}"/>`
        + `<path d="M0 10.6L4.4 15L0 19.4Z M30 10.6L25.6 15L30 19.4Z" fill="${c.gold}" stroke="${c.line}" stroke-width=".6"/>`;
    },
    frame(c, motif, rich) {
      const edge = `<rect width="30" height="1.6" fill="${c.line}"/><rect y="3.2" width="30" height="23.6" fill="${c.pale}"/><rect y="28.4" width="30" height="1.6" fill="${c.line}"/>` + motif;
      const corner = `<path d="M0 0H30V30H0Z M1.6 1.6V28.4H28.4V1.6Z" fill="${c.line}" fill-rule="evenodd"/><rect x="3.2" y="3.2" width="23.6" height="23.6" fill="${c.pale}"/>`
        + (rich ? `<circle cx="15" cy="15" r="10.8" fill="${c.green}"/>` : '')
        + `<path d="${this.star(15, 15, rich ? 10.6 : 10.2, rich ? 6.2 : 5.1, 8)}" fill="${c.gold}" stroke="${c.line}" stroke-width=".7"/><circle cx="15" cy="15" r="3" fill="${c.page}"/><circle cx="15" cy="15" r="1.4" fill="${c.green}"/>`;
      const g = (t, b) => `<g transform="${t}">${b}</g>`;
      return this.url(90, 90, g('translate(0 0)', corner) + g('translate(90 0) scale(-1 1)', corner) + g('translate(0 90) scale(1 -1)', corner) + g('translate(90 90) scale(-1 -1)', corner)
        + g('translate(30 0)', edge) + g('translate(30 90) scale(1 -1)', edge) + g('matrix(0 1 1 0 0 30)', edge) + g('matrix(0 1 -1 0 90 30)', edge));
    },
    apply() {
      const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
      const c = { line: v('--gold-line'), gold: v('--gold'), pale: v('--gold-pale'), page: v('--page'), green: v('--frame-2') };
      if (!c.gold) return;
      const key = JSON.stringify(c);
      if (key === this.key) return;
      this.key = key;
      const root = document.documentElement.style;
      root.setProperty('--orn-frame', this.frame(c, this.lozenges(c), false));
      root.setProperty('--orn-open', this.frame(c, this.rosettes(c), true));
      root.setProperty('--orn-band', this.url(30, 30, this.lozenges(c)));
    },
  };
  const Mushaf = {
    root: null, on: false, spread: false, slides: [], cur: -1, rendered: new Map(), size: null, settleT: 0,
    init(root) {
      this.root = root;
      root.addEventListener('scroll', () => this.onScroll(), { passive: true });
      if ('onscrollend' in window) root.addEventListener('scrollend', () => this.settle());
      window.addEventListener('resize', debounce(() => { if (this.on && App.tab === 'read') this.relayout(); }, 150));
      document.addEventListener('keydown', e => {
        if (!this.on || App.tab !== 'read' || sheets.length || (e.target && e.target.closest && e.target.closest('input, textarea'))) return;
        if (e.key === 'ArrowLeft' || e.key === 'PageDown') { e.preventDefault(); this.step(1); }        // the book opens to the left
        if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); this.step(-1); }
      });
    },
    enter() {
      if (this.on) return;
      this.on = true; Reader.paged = true;
      $('#v-read').classList.add('paged');
      document.body.classList.add('paged');
      document.body.classList.toggle('immersive', !!Store.data.settings.immersive);
      this.root.classList.add('mushaf');
      Orn.apply();
      if (!Store.data.tipBars) { Store.data.tipBars = 1; Store.save(); setTimeout(() => { if (this.on && App.tab === 'read') toast('Tippe auf den Rand der Seite, um die Leisten aus- oder einzublenden.', 4200); }, 1800); }
      Reader.words.clear(); Reader.markers.clear(); Reader.pageEls = []; Reader.pageByNo = null; Reader.vblocks = null;
      this.build();
    },
    leave() {
      if (!this.on) return;
      this.on = false; Reader.paged = false;
      $('#v-read').classList.remove('paged');
      document.body.classList.remove('mic-top', 'paged', 'immersive');
      this.root.classList.remove('mushaf', 'spread', 'tall', 'edge');
      this.root.innerHTML = ''; this.slides = []; this.rendered.clear(); this.cur = -1;
      Reader.words.clear(); Reader.markers.clear();
    },
    /** two pages side by side when the screen lies across (and it is wide enough) */
    wantSpread() { return Store.data.settings.spread !== false && window.innerWidth > window.innerHeight && window.innerWidth >= 600; },
    build() {
      this.spread = this.wantSpread();
      this.root.classList.toggle('spread', this.spread);
      const n = this.spread ? 302 : 604;
      let html = '';
      for (let i = 0; i < n; i++) html += `<div class="slide" data-i="${i}"></div>`;
      this.root.innerHTML = html;
      this.slides = Array.from(this.root.children);
      this.rendered.clear(); this.cur = -1;
      Reader.words.clear(); Reader.markers.clear();
      this.measure();
    },
    /** page size from the screen. The whole page (or both pages, lying across) is in view, as large as the screen allows;
     *  where that would be too small to read (a phone lying across) the page is as wide as the screen and read further down.
     *  A phone held upright: the paper fills the screen with narrow margins, and the record button sits in the last row
     *  of the page, beside the page number, so the page has the whole height. Otherwise (a tablet upright) the record
     *  button stays below the page if there is room for it, else it moves into the top bar. */
    measure() {
      const W = this.root.clientWidth, H = this.root.clientHeight;
      if (!W || !H) return false;
      const upright = !this.spread && H > W;
      const edge = upright && W < 600;                     // a phone held upright: the paper of the page fills the screen
      // type size per page width: a full line is 89 % of the page on a phone, 85 % elsewhere (the rest: margins, frame)
      const k = (edge ? 0.89 : 0.85) / D.mushaf.em / 1.01;
      const vK = edge ? 0.104 : 0.126;                     // height of the margins and the frame, per page width
      const n = this.spread ? 2 : 1, padV = edge ? 0 : this.spread ? 20 : 14, padH = edge ? 0 : this.spread ? 24 : 14;
      const wFit = Math.min((W - padH) / n, this.spread ? 640 : 720);
      // page height: 15 lines and the line above and below them (17.15 lines), margins and frame
      const pwFor = (h, lhK) => (h - 2) / (17.15 * lhK * k + vK);
      const fabH = 66, idle = !Rec.active && !Capture.active;
      let pw = Math.min(wFit, pwFor(H - padV, 1.6)), topRec = !upright;
      if (upright && !edge && idle) {
        const pwFab = Math.min(wFit, pwFor(H - padV - fabH, 1.6));
        if (pwFab >= pw - 4) pw = pwFab; else topRec = true;
      }
      const tall = pw < Math.min(this.spread ? 300 : 280, wFit);
      if (tall) pw = wFit;
      pw = Math.max(200, Math.floor(pw));
      const fs = k * pw;
      const foot = edge && !tall && idle;                  // the record button in the page's last row
      const fabRoom = upright && !topRec && idle && !foot ? fabH : 0;
      let lh = 1.6 * fs;
      // room to spare: the lines a little further apart, as on the printed page (the rest is margin)
      if (!tall) lh = Math.max(lh, Math.min((edge ? 1.95 : 1.85) * fs, (H - padV - fabRoom - 2 - vK * pw) / 17.15));
      this.size = { pw, fs, lh, W, H };
      this.root.classList.toggle('tall', tall);
      this.root.classList.toggle('edge', edge && !tall);
      document.body.classList.toggle('mic-top', topRec);
      document.body.classList.toggle('fab-foot', foot);
      if (foot) {
        // the page stands in the middle of the height: the middle of its last row, from the bottom of the screen
        const pageH = 17.15 * lh + vK * pw, below = Math.max(0, (H - pageH) / 2);
        const fh = Math.round(Math.min(48, Math.max(38, 1.05 * lh - 2)));
        document.body.style.setProperty('--fab-h', fh + 'px');
        document.body.style.setProperty('--fab-bottom', Math.max(4, Math.round(below + 0.01 * pw + 0.525 * lh - fh / 2)) + 'px');
        document.body.classList.toggle('fab-round', W < 380);   // too narrow for the word beside the page number
      } else document.body.classList.remove('fab-round');
      this.root.style.setProperty('--pw', pw + 'px');
      this.root.style.setProperty('--fs', fs.toFixed(2) + 'px');
      this.root.style.setProperty('--lh', lh.toFixed(2) + 'px');
      this.root.style.setProperty('--band', Math.max(5, Math.round(pw * (edge ? 0.024 : 0.026))) + 'px');
      this.root.style.setProperty('--fab-room', fabRoom + 'px');
      return true;
    },
    /** reading like a PDF: the bars hide (a tap on the margin of the page), and come back the same way */
    immersive(on) {
      if (on == null) on = !document.body.classList.contains('immersive');
      document.body.classList.toggle('immersive', on);
      Store.data.settings.immersive = on; Store.save();
      this.relayout();
    },
    relayout() {
      if (!this.on) return;
      const p = this.pendingSlide != null ? this.pagesOf(this.pendingSlide)[0] : this.page();
      this.pendingSlide = null;
      if (this.wantSpread() !== this.spread) this.build();
      else { this.measure(); for (const i of [...this.rendered.keys()]) this.redraw(i); }
      this.go(p, false, true);
    },
    slideOf(p) { return this.spread ? (p - 1) >> 1 : p - 1; },
    pagesOf(i) { return this.spread ? [2 * i + 1, 2 * i + 2] : [i + 1]; },
    /** the first page of the slide in view (the right one of two) */
    page() { return this.cur >= 0 ? this.pagesOf(this.cur)[0] : D.pageOf[(Store.data.pos && Store.data.pos.v) || 0] || 1; },
    /** the verse the reader is at: the one turned to (a surah may begin in the middle of a page), else the top of the page */
    firstVerse() { return this.focus ? this.focus.v : D.Q.words[D.mushaf.pages[this.page() - 1].g].v; },
    step(d) { const i = Math.max(0, Math.min(this.slides.length - 1, this.cur + d)); this.goSlide(i, true); },
    go(p, smooth, force) { this.goSlide(this.slideOf(Math.max(1, Math.min(604, p))), smooth, force); },
    goSlide(i, smooth, force) {
      if (!this.size && !this.measure()) { this.pendingSlide = i; return; }
      i = Math.max(0, Math.min(this.slides.length - 1, i));
      // turning more than one page happens at once (a long smooth scroll would pass every page on the way)
      if (Math.abs(i - this.cur) > 1) smooth = false;
      // a page turned by the app: the pages passed on the way do not count, only where it ends
      this.target = smooth ? i : null; this.targetUntil = Date.now() + 900;
      // to exactly where the slide lies (right to left: the first page is on the right, scrollLeft runs negative).
      // Not page number times clientWidth: a phone's screen is rarely a whole number of CSS pixels wide (1080 px at
      // 2.625 is 411.43 px), clientWidth is rounded, and the error grew with every page: from page 480 on the app
      // showed the page before the one it meant
      const s = this.slides[i];
      const left = s ? this.root.scrollLeft + s.getBoundingClientRect().left - this.root.getBoundingClientRect().left : -i * this.slideW();
      this.root.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
      if (!smooth || force) this.onSlide(i, true);
      // while reciting: the log says if the page in view is not the one meant (it should never be)
      if (Rec.active) { clearTimeout(this.checkT); this.checkT = setTimeout(() => { const v = this.shownSlide(); if (v !== i && this.cur === i) RecLog.add('page shown', this.pagesOf(v)[0] + ' instead of ' + this.pagesOf(i)[0]); }, 1200); }
    },
    /** the width of a slide, exactly (not rounded like clientWidth) */
    slideW() { return this.root.getBoundingClientRect().width || this.root.clientWidth || 1; },
    /** the slide in view: from the scroll position, checked against where it and its neighbours really are */
    shownSlide() {
      const n = this.slides.length;
      if (!n) return 0;
      const r = this.root.getBoundingClientRect(), mid = r.left + r.width / 2;
      const i = Math.max(0, Math.min(n - 1, Math.round(Math.abs(this.root.scrollLeft) / (r.width || 1))));
      let best = i, bd = Infinity;
      for (let k = Math.max(0, i - 1); k <= Math.min(n - 1, i + 1); k++) {
        const b = this.slides[k].getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    },
    /** show a word or verse: turn to its page, light it up */
    show({ v, g, flash }) {
      if (!this.on) return;
      if (App.tab !== 'read') showTab('read', true);
      const gi = g != null ? g : D.Q.verseStart[v];
      const p = this.pageOfWord(gi);
      this.focus = { v: D.Q.words[gi].v, p };
      this.go(p, false, true);
      if (flash) requestAnimationFrame(() => { const el = Reader.words.get(gi); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); this.into(el); } });
    },
    pageOfWord(g) {
      const P = D.mushaf.pages;
      let lo = 0, hi = P.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (P[mid].g <= g) lo = mid; else hi = mid - 1; }
      return lo + 1;
    },
    /** while reciting: the page with this word must be in view (turn to it; scroll down to its line in two-page view) */
    reveal(g) {
      if (!this.on || g == null || g < 0) return;
      g = Math.min(g, D.Q.words.length - 1);
      const p = this.pageOfWord(g);
      const i = this.slideOf(p);
      // the title names the surah being recited (several surahs can share a page)
      const v = D.Q.words[g].v;
      const was = this.focus ? this.focus.v : -1;
      this.focus = { v, p };
      if (i !== this.cur) { this.goSlide(i, !matchMedia('(prefers-reduced-motion: reduce)').matches, true); return; }
      if (surahOf(was) !== surahOf(v) || D.juzOf[was] !== D.juzOf[v]) this.title(i);
      const el = Reader.words.get(g);
      if (el) this.into(el);
    },
    /** a slide taller than the screen (two pages lying across): bring the line into view */
    into(el) {
      const slide = el.closest('.slide');
      if (!slide || slide.scrollHeight <= slide.clientHeight + 4) return;
      const r = el.getBoundingClientRect(), s = slide.getBoundingClientRect();
      if (r.top < s.top + 20 || r.bottom > s.bottom - 30) slide.scrollBy({ top: r.top - s.top - s.height * 0.35, behavior: 'smooth' });
    },
    onScroll() {
      if (!this.on || !this.size) return;
      const i = this.shownSlide();
      if (this.target != null) { if (i !== this.target && Date.now() < this.targetUntil) return; this.target = null; }
      if (i !== this.cur) this.onSlide(i, false);
      clearTimeout(this.settleT); this.settleT = setTimeout(() => this.settle(), 140);
    },
    settle() { if (this.on) this.renderAround(this.cur); },
    onSlide(i, now) {
      i = Math.max(0, Math.min(this.slides.length - 1, i));
      const changed = i !== this.cur;
      this.cur = i;
      if (now) this.renderAround(i);
      else { this.renderSlide(i); }              // the page coming into view is drawn at once, its neighbours when it settles
      if (!changed && !now) return;
      const ps = this.pagesOf(i);
      if (this.focus && (!now || ps.indexOf(this.focus.p) < 0)) this.focus = null;
      this.title(i);
    },
    /** the title shows the surah turned to (or recited), or else the one at the top of the right page */
    title(i) {
      const p = this.pagesOf(i)[0], P = D.mushaf.pages[p - 1];
      const v = this.focus ? this.focus.v : D.Q.words[P.g].v, s = surahOf(v);
      Reader.surah = s;
      $('#nav-t1').textContent = S(s).tr;
      $('#nav-no').innerHTML = '<b>' + s + '</b>';
      $('#nav-t2').textContent = (this.spread && p < 604 ? `Seite ${p} und ${p + 1}` : `Seite ${p}`) + `, Juz ${D.juzOf[v]}`;
      if (!Rec.active) { Store.data.pos = { v }; Store.save(); }
    },
    renderAround(i) {
      for (let k = i - 1; k <= i + 1; k++) this.renderSlide(k);
      for (const k of [...this.rendered.keys()]) if (Math.abs(k - i) > 3) this.unrender(k);
      if (Rec.active || Rec.marksShown) Rec.paint(true);
    },
    renderSlide(i) {
      if (i < 0 || i >= this.slides.length || this.rendered.has(i)) return;
      const ps = this.pagesOf(i).filter(p => p <= 604);
      const el = this.slides[i];
      el.innerHTML = ps.map(p => this.pageHTML(p)).join('');
      this.rendered.set(i, true);
      for (const w of el.querySelectorAll('.w')) Reader.words.set(+w.dataset.g, w);
      for (const m of el.querySelectorAll('.an')) Reader.markers.set(+m.dataset.v, m);
      this.fit(el);
      if (Rec.active || Rec.marksShown) Rec.paint(true);
      // the page fonts come from the web the first time: draw the page again once they are there
      if (this.wantGlyphs()) {
        const need = [0, 1].concat(ps.map(p => D.mushaf.pages[p - 1].f)).filter((n, k, a) => a.indexOf(n) === k && !QCF.has(n));
        if (need.length && Date.now() - QCF.failed > 30000) Promise.all(need.map(n => QCF.load(n))).then(oks => { if (oks.some(Boolean) && this.rendered.has(i)) this.redraw(i); });
      }
    },
    unrender(i) {
      const el = this.slides[i];
      if (el) {
        for (const w of el.querySelectorAll('.w')) if (Reader.words.get(+w.dataset.g) === w) Reader.words.delete(+w.dataset.g);
        for (const m of el.querySelectorAll('.an')) if (Reader.markers.get(+m.dataset.v) === m) Reader.markers.delete(+m.dataset.v);
        el.innerHTML = '';
      }
      this.rendered.delete(i);
    },
    redrawAll() { if (this.on) { Reader.classes(); for (const i of [...this.rendered.keys()]) this.redraw(i); } },
    redraw(i) {
      const el = this.slides[i], top = el ? el.scrollTop : 0;
      this.unrender(i); this.renderSlide(i);
      if (el) el.scrollTop = top;
    },
    /** the calligraphy of the page fonts, unless tajweed colours are wanted (they need the HAFS font) */
    wantGlyphs() { return !(Store.data.settings.tajweed && D.tj); },
    pageHTML(p) {
      const P = D.mushaf.pages[p - 1];
      const glyphs = this.wantGlyphs() && QCF.has(P.f);
      const tj = !!(Store.data.settings.tajweed && D.tj);
      const v0 = D.Q.words[P.g].v, s0 = surahOf(v0), j = D.juzOf[v0];
      const hdr = QCF.has(0);
      let g = P.g, lines = '', head = '', sNext = s0;
      for (const L of P.l) {
        if (L[0] === 'h') {
          sNext = L[1];
          // (the first two pages: the surah's name above the panel with the text)
          if (p <= 2) { head += `<div class="ml hd" data-sh="${L[1]}"><span class="sbox"><span class="sn${hdr ? '' : ' txt'}">${hdr ? String.fromCharCode(0xF100 + L[1] - 1) : 'سورة ' + esc(S(L[1]).ar)}</span></span></div>`; continue; }
          lines += `<div class="ml hd" data-sh="${L[1]}"><span class="sbox"><span class="sn${hdr ? '' : ' txt'}">${hdr ? String.fromCharCode(0xF100 + L[1] - 1) : 'سورة ' + esc(S(L[1]).ar)}</span></span></div>`;
          continue;
        }
        if (L[0] === 'b') {
          lines += `<div class="ml bs"><span class="basmala${QCF.has(1) && !tj ? ' qg' : ''}" data-bs="${sNext}">${QCF.has(1) && !tj ? String.fromCharCode(L[1]) : esc(basmalaText(sNext))}</span></div>`;
          continue;
        }
        const chars = L[0], kinds = L[1];
        let line = '', open = false;
        for (let k = 0; k < kinds.length; k++) {
          const t = kinds[k], ch = chars[k];
          if (t === 'w') {
            if (open) line += '</span>';
            line += `<span class="w" data-g="${g}">${glyphs ? ch : wordHTML(g, tj)}`;
            open = true; g++;
          } else if (t === 'x' || t === 's' || t === 'm') {
            // the rest of the word, its sajda sign, or a sign drawn over it (pause sign, the line over a sajda);
            // the HAFS text has them all in the word
            if (glyphs) line = open || !line.endsWith('</span>') ? line + ch : line.slice(0, -7) + ch + '</span>';
          } else {
            if (open) { line += '</span>'; open = false; }
            if (t === 'e') { const v = D.Q.words[g - 1].v; line += `<span class="an${memHas(v) ? ' mem' : ''}" data-v="${v}" role="button" aria-label="Vers ${ayahOf(v)}">${glyphs ? ch : arNum(ayahOf(v))}</span>`; }
            else line += `<span class="hz" aria-label="Viertel-Hizb">${glyphs ? ch : '۞'}</span>`;
          }
        }
        if (open) line += '</span>';
        lines += `<div class="ml t${L[2] ? ' c' : ''}">${line}</div>`;
      }
      // the first two pages: the surah's name and its text in an illuminated panel that fills the page
      if (p <= 2) lines = '<div class="op">' + head + lines + '</div>';
      const side = p % 2 ? ' right' : ' left';
      return `<article class="mp${p <= 2 ? ' opening' : ''}${side}" data-page="${p}">
        <div class="mp-top"><span class="mt-juz${hdr ? '' : ' txt'}">${hdr ? String.fromCharCode(0xF1D8 + j - 1) : 'الجزء ' + arNum(j)}</span><span class="mt-sura${hdr ? '' : ' txt'}">${hdr ? String.fromCharCode(0xF100 + s0 - 1) : 'سورة ' + esc(S(s0).ar)}</span></div>
        <div class="mp-box"><div class="mp-lines${glyphs ? '' : ' uni'}"${glyphs ? ` style="font-family:${QCF.fam(P.f)}"` : ''}>${lines}</div></div>
        <div class="mp-foot"><span class="mp-no"><b>${arNum(p)}</b></span></div></article>`;
    },
    /** a line wider than the page is set a little smaller; in the HAFS font, a short line a little larger.
     *  (measured as the sum of its words: a centred line that overflows does so on both sides, which scrollWidth hides) */
    fit(el) {
      for (const box of el.querySelectorAll('.mp-lines')) {
        const uni = box.classList.contains('uni');
        for (const ln of box.querySelectorAll('.ml.t')) {
          ln.style.fontSize = '';
          const cw = ln.getBoundingClientRect().width, kids = ln.children;      // (fractional: clientWidth is rounded)
          if (!cw || !kids.length) continue;
          let w = 0;
          for (const c of kids) w += c.getBoundingClientRect().width;
          const centred = ln.classList.contains('c');
          if (centred && kids.length > 1) w += (parseFloat(getComputedStyle(ln).columnGap) || 0) * (kids.length - 1);
          if (w > cw - 0.25) ln.style.fontSize = (100 * (cw - 0.5) / w * 0.995).toFixed(2) + '%';
          else if (uni && !centred && w < cw * 0.9) ln.style.fontSize = (100 * Math.min(1.12, cw * 0.97 / w)).toFixed(1) + '%';
        }
      }
    },
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
          <span class="main"><span class="a"><span class="nm">${esc(su.tr)}</span><i class="lead" aria-hidden="true"></i><span class="pg" aria-label="Seite ${D.pageOf[su.start]}">${D.pageOf[su.start]}</span></span><span class="b">${extra || `${esc(su.de)}, ${su.ayahs} Verse`}</span>${m ? `<span class="pk-mem"><i style="width:${Math.round(100 * m / su.ayahs)}%"></i></span>` : ''}</span>
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

  // ------------------------------------------------------------------ two pages when the screen does not turn
  // An installed app keeps the orientation it was installed with until the phone updates it (MyHifz was upright-only
  // at first), and many phones have rotation locked. Held across while the screen stays upright, the app offers the
  // two pages anyway: full screen, turned across (Screen Orientation API). Held upright again, all is as before.
  // (Not on the iPhone: there neither full screen nor turning is open to a web page.)
  const Turn = {
    forced: false, side: 0, since: 0, last: 0, el: null, hideT: 0, offered: false, ignored: 0,
    able() { return !!(document.fullscreenEnabled && screen.orientation && typeof screen.orientation.lock === 'function'); },
    init() {
      if (!this.able()) return;
      this.el = el(`<button class="turn-offer" id="turn-offer" hidden>${ICON.read}<span>Doppelseite öffnen</span></button>`);
      document.body.appendChild(this.el);
      this.el.addEventListener('click', () => this.open());
      window.addEventListener('devicemotion', e => this.motion(e), { passive: true });
      document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && this.forced) this.release(); });
    },
    /** the phone's position from gravity: 1 lying across, -1 upright, 0 flat or in between (a few times a second) */
    motion(e) {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null) return;
      const now = Date.now();
      if (now - this.last < 200) return;
      this.last = now;
      const x = Math.abs(a.x), y = Math.abs(a.y);
      const side = x > 6.5 && x > 1.6 * y ? 1 : y > 6.5 && y > 1.6 * x ? -1 : 0;
      if (side !== this.side) { this.side = side; this.since = now; this.dir = a.x; if (side !== 1) this.hide(false); return; }
      if (now - this.since < 700) return;
      const upright = window.innerHeight > window.innerWidth;
      if (side === 1 && upright && !this.forced && !this.offered && this.ignored < 2 && Mushaf.on && App.tab === 'read' &&
          !sheets.length && Store.data.settings.spread !== false && !document.fullscreenElement) this.offer();
      if (side === 1 && this.forced) this.seenAcross = true;
      // upright again (once it was held across: opened from the menu, the phone may still be upright for a moment)
      if (side === -1 && this.forced && this.seenAcross && now - this.forcedAt > 1500) this.release();
    },
    /** the button, turned so it reads straight for the phone held across */
    offer() {
      this.offered = true;
      this.el.style.setProperty('--turn', this.dir < 0 ? '-90deg' : '90deg');
      this.el.hidden = false;
      clearTimeout(this.hideT);
      this.hideT = setTimeout(() => this.hide(true), 7000);
    },
    hide(ignored) {
      clearTimeout(this.hideT);
      if (this.el && !this.el.hidden && ignored) this.ignored++;      // not wanted twice: no more offers until next time
      if (this.el) this.el.hidden = true;
      if (this.side !== 1) this.offered = false;
    },
    async open() {
      this.hide(false); this.offered = true;
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        await screen.orientation.lock('landscape');
        this.forced = true; this.forcedAt = Date.now(); this.seenAcross = this.side === 1;
      } catch (e) {
        try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (x) { /* ignore */ }
        toast('Die App kann sich hier nicht selbst drehen. Schalte die automatische Drehung des Handys ein.', 4200);
      }
    },
    async release() {
      this.forced = false;
      try { screen.orientation.unlock(); } catch (e) { /* ignore */ }
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) { /* ignore */ }
    },
  };

  // ------------------------------------------------------------------ display options
  const Display = {
    open() {
      const st = Store.data.settings;
      const body = el('<div></div>');
      const LDESC = { mushaf: 'Die Seiten des Madina-Mushaf mit seinen 15 Zeilen, Seite für Seite zum Umblättern.', flow: 'Der Text einer Sure am Stück, in der Größe, die du einstellst.', verse: 'Jeder Vers für sich, auf Wunsch mit Übersetzung.' };
      body.innerHTML = `
        <div class="setting col"><div class="txt"><b>Ansicht</b><span id="d-ldesc">${LDESC[st.layout] || ''}</span></div>
          <div class="seg"><button data-l="mushaf" aria-pressed="${st.layout === 'mushaf'}">Mushaf-Seiten</button><button data-l="flow" aria-pressed="${st.layout === 'flow'}">Fließtext</button><button data-l="verse" aria-pressed="${st.layout === 'verse'}">Vers für Vers</button></div></div>
        <div class="setting col" data-only="mushaf">
          <label class="sub"><span class="txt"><b>Doppelseite im Querformat</b><span>Hältst du das Handy quer, liegen zwei Seiten nebeneinander wie in einem aufgeschlagenen Mushaf${Turn.able() ? '. Dreht sich die App nicht mit, bietet sie die Doppelseite selbst an.' : ''}</span></span><input type="checkbox" class="switch" id="d-spread" ${st.spread !== false ? 'checked' : ''}></label>
          ${Turn.able() ? '<button class="btn" id="d-turn" style="align-self:flex-start">' + ICON.read + '<span>Doppelseite jetzt öffnen</span></button>' : ''}</div>
        <div class="setting col" data-only="mushaf"><div class="txt"><b>Seiten ohne Internet</b><span id="d-off-t">Die Schrift der Mushaf-Seiten lädt die App beim ersten Anzeigen einer Seite. Lade sie einmal ganz, dann sind alle 604 Seiten auch offline da (etwa 36 MB).</span></div>
          <button class="btn" id="d-off">Alle Seiten laden</button></div>
        <div class="setting col" data-only="flow verse"><div class="txt"><b>Schriftgröße</b></div>
          <div class="row"><span class="tiny">klein</span><input class="grow" id="d-size" type="range" min="20" max="40" step="1" value="${st.qsize}"><span class="tiny">groß</span></div>
          <div class="q" id="d-sample" style="text-align:center;font-size:${st.qsize}px;line-height:2">ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ ٢</div></div>
        <label class="setting" data-only="verse"><span class="txt"><b>Deutsche Übersetzung</b><span>Unter jedem Vers, nach Bubenheim und Elyas</span></span><input type="checkbox" class="switch" id="d-tr" ${st.translation ? 'checked' : ''}></label>
        <label class="setting"><span class="txt"><b>Tajweed-Farben</b><span id="d-tj-t"></span></span><input type="checkbox" class="switch" id="d-tj" ${st.tajweed ? 'checked' : ''}></label>
        <div id="d-legend" ${st.tajweed ? '' : 'hidden'}>${Display.legendHTML()}</div>`;
      const sync = () => {
        for (const x of $$('[data-only]', body)) x.hidden = !x.dataset.only.split(' ').includes(st.layout);
        $('#d-ldesc', body).textContent = LDESC[st.layout] || '';
        $('#d-tj-t', body).textContent = 'Zeigt Dehnungen, Ghunna und weitere Regeln' + (st.layout === 'mushaf' ? '. Auf den Mushaf-Seiten steht der Text dann in der Schrift der App, denn die Seitenschrift hat keine Farben.' : '');
      };
      sync();
      const sh = openSheet({ title: 'Darstellung', body });
      const size = $('#d-size', body);
      size.addEventListener('input', () => { st.qsize = +size.value; $('#d-sample', body).style.fontSize = st.qsize + 'px'; applyTheme(); });
      size.addEventListener('change', () => Store.save());
      const rerender = () => Reader.render(Reader.surah, { v: Reader.firstVisibleVerse() });
      $$('[data-l]', body).forEach(b => b.addEventListener('click', () => {
        if (st.layout === b.dataset.l) return;
        const v = Reader.firstVisibleVerse();
        st.layout = b.dataset.l; Store.save();
        $$('[data-l]', body).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        sync();
        Reader.render(surahOf(v), { v });
      }));
      $('#d-spread', body).addEventListener('change', e => { st.spread = e.target.checked; Store.save(); if (Mushaf.on) Mushaf.relayout(); });
      const turn = $('#d-turn', body);
      if (turn) turn.addEventListener('click', () => { if (st.spread === false) { st.spread = true; Store.save(); $('#d-spread', body).checked = true; } sh.close(); Turn.open(); });
      $('#d-tr', body).addEventListener('change', e => { st.translation = e.target.checked; Store.save(); if (st.layout === 'verse') rerender(); });
      $('#d-tj', body).addEventListener('change', async e => {
        st.tajweed = e.target.checked; Store.save();
        $('#d-legend', body).hidden = !st.tajweed;
        if (Mushaf.on) { if (st.tajweed && !D.tj) { try { await ensure('tj'); } catch (err) { /* without colours */ } } Mushaf.redrawAll(); }
        else rerender();
      });
      // all page fonts at once, for reading without internet
      const off = $('#d-off', body), offT = $('#d-off-t', body);
      const showDone = () => { off.disabled = true; off.textContent = 'Alle Seiten sind offline da'; };
      QCF.cached().then(n => { if (n >= QCF.count) showDone(); });
      off.addEventListener('click', async () => {
        if (!navigator.onLine) { toast('Dafür braucht es einmal Internet.'); return; }
        off.disabled = true;
        const ok = await QCF.prefetchAll((k, n) => { if (!sh.closed) off.textContent = `Wird geladen … ${k} von ${n}`; });
        if (sh.closed) return;
        if (ok) { showDone(); toast('Alle Mushaf-Seiten sind jetzt offline verfügbar.'); }
        else { off.disabled = false; off.textContent = 'Nochmal versuchen'; offT.textContent = 'Nicht alles konnte geladen werden. Prüfe die Verbindung und versuch es nochmal.'; }
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
      if (lemma && lemma[4]) html += `<p class="gloss">${esc(glossOf(main.lid, g))}</p>`;
      else if (main && main.pos === 'P' && main.tags.indexOf('INL') >= 0) html += '<p class="gloss">Einzelbuchstaben</p><p class="gloss-sub">Die Bedeutung dieser Buchstaben kennt Allah.</p>';
      else html += '<p class="gloss" style="color:var(--ink-2)">Keine Kurzbedeutung</p>';
      if (main) html += `<p class="gloss-sub">${esc(grammarDE(main))}</p>`;
      if (segs.length > 1) html += WordCard.parts(g, main ? main.lid : -1);
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
      const n = surahOf(w.v), c = lemma && lemma[4] ? Vocab.card(main.lid) : null;
      if (c) html += `<p class="ls-state">Gelernt · ${c.due <= today() ? 'heute fällig' : 'nächste Wiederholung ' + inDays(c.due - today())}</p>`;
      html += '<div class="row" style="margin-top:18px">';
      if (lemma && lemma[4] && !c) html += `<button class="btn grow" id="ws-learn" ${Vocab.queued(main.lid) ? 'disabled' : ''}>${Vocab.queued(main.lid) ? 'Vorgemerkt' : 'Wort lernen'}</button>`;
      html += `<button class="btn primary grow" id="ws-recite">${ICON.mic}<span>Ab hier lesen</span></button></div>`;
      if (lemma && lemma[4]) html += `<button class="btn ghost block" id="ws-surah" style="margin-top:6px">${ICON.words}<span>Alle Wörter von ${esc(S(n).tr)}</span></button>`;
      $('.empty', body).remove();
      body.insertAdjacentHTML('beforeend', html);
      const lb = $('#ws-learn', body);
      if (lb) lb.addEventListener('click', () => { Vocab.queue(main.lid); lb.textContent = 'Vorgemerkt'; lb.disabled = true; toast(`Kommt beim Lernen von ${S(n).tr} als Nächstes`); });
      const sb = $('#ws-surah', body);
      if (sb) sb.addEventListener('click', () => Words.openSurah(n));
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
        <div class="row cs-go" style="margin-top:12px"><button class="btn primary grow" id="vs-rec">${ICON.mic}<span>Rezitieren</span></button><button class="btn grow" id="vs-test">${ICON.eyeOff}<span>Prüfen</span></button><button class="btn grow" id="vs-blind">${ICON.ear}<span>Blind</span></button></div>
        <button class="btn ghost block" id="vs-copy" style="margin-top:6px">${ICON.copy}<span>Arabischen Text kopieren</span></button>`;
      const sh = openSheet({ title: `${S(surahOf(v)).tr} ${ref(v)}`, body });
      $('#vs-mem', body).addEventListener('change', e => { Hifz.setVerses([v], e.target.checked); });
      $('#vs-rec', body).addEventListener('click', () => { sh.close(); Rec.start({ v, mode: 'follow' }); });
      $('#vs-test', body).addEventListener('click', () => { sh.close(); Rec.start({ v, mode: 'test' }); });
      $('#vs-blind', body).addEventListener('click', () => { sh.close(); Rec.start({ v, mode: 'test', blind: true }); });
      $('#vs-copy', body).addEventListener('click', () => copyText(D.quran.verses[v] + ' (' + ref(v) + ')'));
      if (!D.de) { try { await ensure('de'); const d = $('#vs-de', body); if (d) d.textContent = D.de[v]; } catch (e) { const d = $('#vs-de', body); if (d) d.textContent = 'Übersetzung konnte nicht geladen werden.'; } }
    },
  };

  // ------------------------------------------------------------------ speech recognition
  // contextual biasing (the words expected next) where the browser supports it; Chrome refuses it for its cloud
  // recognition with 'phrases-not-supported', then it is left off for this run
  const PHRASES = { off: !SR || !('phrases' in SR.prototype) || typeof window.SpeechRecognitionPhrase !== 'function' };
  /** what the recogniser sent and what the app made of it, during the last recitation: the user can copy it
      (settings) and send it when the recognition goes wrong. Only on this device; kept for the last recitation. */
  const RecLog = {
    KEY: 'rahle.reclog', MAX: 1500, lines: [], t0: 0,
    begin(info) {
      this.lines = []; this.t0 = Date.now();
      this.add('start', info + ' | ' + new Date().toISOString() + ' | ' + navigator.userAgent);
    },
    add(kind, text) {
      if (!this.t0) return;
      const s = ((Date.now() - this.t0) / 1000).toFixed(2).padStart(7) + ' ' + kind + (text ? ' ' + text : '');
      this.lines.push(s.length > 420 ? s.slice(0, 420) + '…' : s);
      if (this.lines.length > this.MAX) this.lines.splice(0, this.lines.length - this.MAX);
      clearTimeout(this.saveT); this.saveT = setTimeout(() => this.save(), 1500);
    },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.lines)); } catch (e) { /* storage full or blocked */ } },
    text() {
      let lines = this.lines;
      if (!lines.length) { try { lines = JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { lines = []; } }
      return lines.length ? 'MyHifz ' + APP_VERSION + ' Erkennungsprotokoll\n' + lines.join('\n') : '';
    },
  };
  class Speech {
    constructor(h) { this.h = h; this.want = false; this.fails = 0; this.rec = null; }
    start() { this.want = true; this.fails = 0; this._open(); }
    log(kind, text) { if (this.h.log) this.h.log(kind, text); }
    /** again: a new session after the last one ended (not the first one) */
    _open(again) {
      let r;
      try { r = new SR(); } catch (e) { this.want = false; this.h.error('unsupported'); return; }
      r.lang = 'ar-SA'; r.continuous = true; r.interimResults = true;
      // several guesses for each final result: the one that fits the expected text is taken (n-best)
      r.maxAlternatives = 4;
      this.withPhrases = false;
      if (!PHRASES.off && this.h.phrases) {
        try {
          const list = this.h.phrases();
          if (list && list.length) { r.phrases = list.map(p => new window.SpeechRecognitionPhrase(p, 3)); this.withPhrases = true; }
        } catch (e) { PHRASES.off = true; }
      }
      const picked = [];                                   // the alternative chosen for each final result of this session
      this.last = null;                                    // the session's latest result: its final texts and the interim text
      r.onstart = () => { this.sessions = (this.sessions || 0) + 1; this.listenAt = Date.now(); this.log('listen', 'after ' + (Date.now() - this.opened) + ' ms'); this.h.state('listening'); };
      r.onaudiostart = () => { this.listenAt = Date.now(); this.log('audio'); };
      r.onspeechstart = () => { this.log('speech'); this.h.state('speech'); };
      r.onspeechend = () => { this.log('speech-end'); this.h.state('listening'); };
      r.onresult = e => {
        const finals = []; let interim = '';
        const seen = [];                                   // for the log: what changed in this event
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          if (i >= e.resultIndex) seen.push((res.isFinal ? 'F' : 'i') + i + (res.length > 1 ? '/' + res.length : '') + ':' + (res[0] ? res[0].transcript : ''));
          if (!res.isFinal) { interim += (res[0] ? res[0].transcript : '') + ' '; continue; }
          if (picked[i] == null) {
            picked[i] = 0;
            if (res.length > 1 && this.h.pick) {
              const alts = []; for (let k = 0; k < res.length; k++) alts.push(res[k].transcript);
              try { picked[i] = this.h.pick(alts, finals.slice()) || 0; } catch (err) { picked[i] = 0; }
              if (picked[i]) seen.push('took alternative ' + picked[i] + ': ' + alts[picked[i]]);
            }
          }
          const alt = res[picked[i]] || res[0];
          finals.push(alt ? alt.transcript : '');
        }
        this.log('result', e.results.length + ' | ' + seen.join(' | '));
        // the first words of this session came long after it began listening: the reciter began after it, so nothing
        // was lost at the start (a word missing there was not said)
        if (!this.gotResult && this.listenAt && Date.now() - this.listenAt > 1600 && this.h.late) this.h.late();
        this.gotResult = true; this.capFails = 0;
        this.last = { finals, interim: interim.trim() };
        this.h.result(finals, interim);
      };
      r.onerror = e => {
        const err = e.error;
        this.log('error', err);
        if (err === 'phrases-not-supported' || (this.withPhrases && !this.gotResult && err !== 'no-speech' && err !== 'aborted' && err !== 'not-allowed')) { PHRASES.off = true; this.retry = true; return; }
        if (err === 'not-allowed' || err === 'service-not-allowed') { this.want = false; this.h.error(this.sessions ? 'interrupted' : 'denied'); }
        else if (err === 'audio-capture') {
          // right after starting again the microphone may still be busy: try again, give up only if it stays so
          if (again && (this.capFails = (this.capFails || 0) + 1) <= 3) return;
          this.want = false; this.h.error('nomic');
        }
        else if (err === 'language-not-supported') { this.want = false; this.h.error('lang'); }
        else if (err === 'network') { this.netErr = (this.netErr || 0) + 1; if (this.netErr > 2) { this.want = false; this.h.error(this.sessions ? 'interrupted-net' : 'network'); } }
      };
      r.onend = () => {
        this.log('end', 'after ' + ((Date.now() - this.opened) / 1000).toFixed(1) + ' s' + (this.gotResult ? '' : ', nothing heard'));
        this.h.state('idle');
        // the session ended before its last words were made final (Chrome on Android often does this after a pause):
        // they were heard all the same, so they count as said
        if (this.want) this.flush();
        if (!this.want) return;
        if (this.retry) { this.retry = false; setTimeout(() => { if (this.want) this._open(); }, 40); return; }   // again, without phrases
        const short = Date.now() - this.opened < 1200 && !this.gotResult;
        this.fails = short ? this.fails + 1 : 0;
        if (this.fails > 6) { this.want = false; this.h.error('unstable'); return; }
        // Android ends the session at every pause, and the reciter goes on right away: listen again at once (not even
        // after the page has been drawn), every moment of delay loses the first word. Only after several sessions
        // that heard nothing, wait a little.
        if (this.fails < 3) { this.h.restart(); this._open(true); return; }
        setTimeout(() => { if (this.want) { this.h.restart(); this._open(true); } }, 300);
      };
      this.rec = r; this.opened = Date.now(); this.gotResult = false; this.listenAt = 0;
      this.log('open');
      try { r.start(); this.startFails = 0; }
      catch (e) {
        this.log('error', 'start: ' + e.message);
        // starting again right after the end may come too soon for the microphone: try again shortly
        if (again && (this.startFails = (this.startFails || 0) + 1) <= 3) { setTimeout(() => { if (this.want) this._open(true); }, 200 * this.startFails); return; }
        this.want = false; this.h.error('start');
      }
    }
    stop() { this.want = false; try { if (this.rec) this.rec.stop(); } catch (e) { /* ignore */ } }
    /** words still in the interim text (not made final yet) count as said: at the end of a session, a pause, or the end */
    flush() {
      const l = this.last;
      if (!l || !l.interim) return;
      this.last = null;
      this.log('flush', 'interim taken as said: ' + l.interim);
      try { this.h.result(l.finals.concat([l.interim]), ''); } catch (e) { /* ignore */ }
    }
  }

  // ------------------------------------------------------------------ the recogniser on the phone
  // A Quran model in the app itself (asr/: Quran Lab's streaming phoneme recogniser zipformer_p-arabic v3.1, int8,
  // run by onnxruntime-web in a worker) instead of the browser's speech recognition: the microphone stays open for
  // the whole recitation (no sessions, no lost first word), nothing leaves the phone, it works offline once loaded.
  // The worker hears phonetic units; QC.PhonDecoder turns them into the words of the text for the Tracker.
  const ASR = {
    ready: null, worker: null, decoder: null, info: null, listeners: new Set(),
    supported() { return !!(window.Worker && window.WebAssembly && window.AudioWorkletNode && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
    /** loads it once per start of the app (from the offline cache after the first time); onProgress(loaded, total) */
    load(onProgress) {
      if (onProgress) this.listeners.add(onProgress);
      if (this.ready) return this.ready;
      this.ready = (async () => {
        const t0 = Date.now();
        const [words, tokTxt] = await Promise.all([
          fetch('asr/model/words.json').then(r => { if (!r.ok) throw new Error('words ' + r.status); return r.json(); }),
          fetch('asr/model/tokens.txt').then(r => { if (!r.ok) throw new Error('tokens ' + r.status); return r.text(); }),
        ]);
        const tokens = [];
        for (const ln of tokTxt.split('\n')) { const i = ln.lastIndexOf(' '); if (i > 0) tokens[+ln.slice(i + 1)] = ln.slice(0, i); }
        const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
        this.decoder = new QC.PhonDecoder(D.Q, { units: b64(words.units), count: b64(words.count) }, tokens);
        const w = new Worker('asr/worker.js', { type: 'module' });
        await new Promise((res, rej) => {
          w.onmessage = e => {
            const m = e.data;
            if (m.type === 'progress') for (const fn of this.listeners) { try { fn(m.loaded, m.total); } catch (err) { /* ignore */ } }
            else if (m.type === 'ready') { this.info = Object.assign({ total: Date.now() - t0 }, m); res(); }
            else if (m.type === 'error') rej(new Error(m.message));
          };
          w.onerror = e => rej(new Error(e.message || 'worker'));
          w.postMessage({ type: 'init', config: new URL('asr/model/model.json', location.href).href, threads: 1 });
        });
        this.worker = w;
        Store.data.asrLoaded = 1; Store.save();
        return this;
      })();
      this.ready.catch(() => { this.ready = null; if (this.worker) { this.worker.terminate(); this.worker = null; } }).finally(() => this.listeners.clear());
      return this.ready;
    },
  };
  /** the same handlers as Speech: result(finals, interim), state, log, error */
  class ModelSpeech {
    constructor(h, tracker) { this.h = h; this.t = tracker; this.want = false; this.finals = []; this.quiet = 0; this.inter = ''; }
    log(k, x) { if (this.h.log) this.h.log(k, x); }
    async start() {
      this.want = true;
      if (!ASR.supported()) { this.want = false; this.h.error('unsupported-model'); return; }
      this.h.state('loading');
      try { await ASR.load(); } catch (e) { this.log('error', 'model: ' + e.message); this.want = false; this.h.error('model'); return; }
      if (!this.want) return;
      this.log('model', 'ready in ' + ASR.info.total + ' ms (session ' + ASR.info.ms + ' ms)');
      ASR.decoder.reset(this.t.mode === 'search' ? -1 : this.t.pointer);
      ASR.worker.onmessage = e => this.onWorker(e.data);
      ASR.worker.postMessage({ type: 'reset' });
      try {
        this.mic = await Mic.open({
          frames: f => { if (this.want) ASR.worker.postMessage({ type: 'audio', pcm: f }, [f.buffer]); },
          level: l => this.level(l),
          ended: () => { if (this.want) { this.want = false; this.h.error('nomic'); } },
        });
      } catch (e) { this.want = false; this.h.error(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'nomic'); return; }
      if (!this.want) { this.mic.close(); return; }
      this.log('listen', 'microphone open, ' + this.mic.rate + ' Hz' + (this.mic.worklet ? '' : ', no worklet'));
      this.h.state('listening');
    }
    onWorker(m) {
      if (m.type === 'units') {
        if (m.units.length) { ASR.decoder.push(m.units); this.quiet = 0; this.log('units', m.units.map(u => u.u + (u.p < 0.6 ? '?' : '')).join(' ') + ' (' + m.ms + ' ms' + (m.behind ? ', ' + m.behind + ' behind' : '') + ')'); }
        else this.quiet += m.frames;
        // how much of the time the model needs (1 = just in real time): a phone that cannot keep up is told so once
        const load = m.ms / (m.frames * 40);
        this.load = this.load == null ? load : 0.9 * this.load + 0.1 * load;
        this.calls = (this.calls || 0) + 1;
        if (this.calls % 60 === 0) this.log('speed', 'model needs ' + Math.round(this.load * 100) + ' % of real time');
        if (this.calls > 12 && this.load > 0.95 && !ASR.slowTold) { ASR.slowTold = true; this.log('speed', 'too slow: ' + Math.round(this.load * 100) + ' %'); toast('Dein Handy kommt mit der Erkennung kaum hinterher. Schließe andere Apps, oder nimm in den Einstellungen wieder die Erkennung des Browsers.', 6000); }
        this.decode(this.quiet >= 24);          // about a second without a sound: the words said so far are complete
      } else if (m.type === 'ended') this.decode(true);
      else if (m.type === 'error') { this.log('error', m.message); if (this.want) { this.want = false; this.h.error('model'); } }
    }
    decode(force) {
      const t = this.t;
      const r = ASR.decoder.step(t.pointer, t.mode === 'search', force);
      if (r.text) {
        this.finals.push(r.text);
        this.log('words', (r.phrase ? r.phrase + ': ' : '') + (r.jump ? 'elsewhere: ' : '') + r.text);
      }
      if (r.text || r.interim !== this.inter) { this.inter = r.interim; this.h.result(this.finals.slice(), r.interim); }
      // the session's text is started anew between verses, so it does not grow without end
      if (this.finals.length > 24 && !r.interim) { t.rollSession(); this.finals = []; }
    }
    level({ rms }) {
      const sp = 20 * Math.log10(Math.max(rms, 1e-6)) > -45;
      if (sp !== this.sp) { this.sp = sp; if (this.want) this.h.state(sp ? 'speech' : 'listening'); }
    }
    /** what is complete counts (a pause, the end) */
    flush() { if (ASR.decoder) this.decode(true); }
    stop() {
      this.want = false;
      if (this.mic) { this.mic.close(); this.mic = null; }
      if (ASR.worker) ASR.worker.postMessage({ type: 'end' });
      this.h.state('idle');
    }
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
        this.tracker.on('jump', e => { RecLog.add('jump', gref(e.to)); toast('Du liest jetzt ' + S(surahOf(D.Q.words[e.to].v)).tr + ' ' + ref(D.Q.words[e.to].v)); this.updateBar(); });
        this.tracker.on('found', e => { RecLog.add('found', gref(e.to) + (e.here ? ' (in view)' : '')); this.phrase = null; if (!e.here) toast('Gefunden: ' + S(surahOf(D.Q.words[e.to].v)).tr + ' ' + ref(D.Q.words[e.to].v)); this.updateBar(); });
        this.tracker.on('searching', e => { RecLog.add('searching', (e.words || 0) + ' words' + (e.basmala ? ', after basmala' : '') + (e.ambiguous ? ', ambiguous' : '')); this.updateBar(); });
        // the isti'adha or basmala was heard: said so in the bar (no place is looked for because of it)
        this.tracker.on('phrase', e => { RecLog.add('phrase', e.name); this.phrase = { name: e.name, at: Date.now() }; this.updateBar(); clearTimeout(this.phraseT); this.phraseT = setTimeout(() => this.updateBar(), 6100); });
        this.tracker.on('clip', e => RecLog.add('clip', gref(e.g) + ' (said before the recogniser listened)'));
        this.tracker.on('verse', () => { if (this.phrase) { this.phrase = null; this.updateBar(); } });
        // memorising: failed attempts, hints, the gate (a word not heard), verses done, and going on again
        this.tracker.on('attempt', e => { RecLog.add('attempt', e.tries + ' ' + e.kind); this.onAttempt(e); });
        this.tracker.on('hint', e => { RecLog.add('hint', e.kind + (e.g != null ? ' ' + gref(e.g) : '')); this.showHint(e); });
        this.tracker.on('say', e => { RecLog.add('say', e.type + ' ' + gref(e.g)); this.onSay(e); });
        this.tracker.on('verseDone', e => { if (this.blind) Blind.verseDone(e); });
        this.tracker.on('progress', () => { if (this.blind) Blind.progress(); else this.hideHint(); this.updateBar(); });
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
      if (!SR && !this.onPhone()) { Help.noSpeech(); return false; }
      return true;
    },
    /** opts: {v | g, mode: follow|test, endV, blind, unit:{type:'page'|'surah', n}} */
    async start(opts) {
      if (!this.preflight()) return;
      if (this.active) this.stop('restart', true);
      const g0 = opts.g != null ? opts.g : D.Q.verseStart[opts.v];
      const t = this.ensureTracker();
      this.mode = opts.mode || 'follow';
      this.blind = this.mode === 'test' && !!opts.blind;
      this.hideOn = this.mode === 'test';
      // a test never runs into the next surah: without an end it goes to the end of this surah
      let endV = opts.endV;
      if (this.mode === 'test' && endV == null) { const s = S(surahOf(D.Q.words[g0].v)); endV = s.start + s.ayahs - 1; }
      this.endG = endV != null ? D.Q.verseStart[endV + 1] - 1 : null;
      this.range = { g0, v0: D.Q.words[g0].v, v1: endV != null ? endV : null };
      // reading: follow the reciter anywhere. Memorisation test: stay in the tested passage, a slip elsewhere is a mistake
      const limits = this.mode !== 'test' ? {} : { bounds: [g0, this.endG] };
      t.reset(g0, Object.assign({ search: !!opts.search, strict: this.hideOn, help: this.helpOpts() }, limits));
      this.shown = null;
      RecLog.begin(`${this.mode}${this.hideOn ? ' hidden' : ''}${opts.search ? ' search' : ''} from ${gref(g0)}${this.endG != null ? ' to ' + gref(this.endG) : ''}, strictness ${Store.data.settings.strict || 0}, ${Reader.paged ? 'pages' + (Mushaf.spread ? ' (two)' : '') : 'text'}`);
      this.phrase = null;
      warmTracker();
      this.unit = opts.unit || null;
      this.active = true; this.marksShown = false; this.startedAt = Date.now(); this.lastPaint.clear();
      this.heardText = ''; this.paused = false;
      // the click that started us is the user gesture the microphone needs, so start listening first
      this.speech = this.makeSpeech();
      this.speech.start();
      $('#rec-resume').hidden = true; $('#recbar').classList.remove('paused');
      if (this.blind) {
        // no text at all: only the teacher card
        Blind.open();
        try { if (navigator.wakeLock) this.wake = await navigator.wakeLock.request('screen'); } catch (e) { this.wake = null; }
        return;
      }
      showTab('read', true);
      const s = surahOf(D.Q.words[g0].v);
      if (s !== Reader.surah || !Reader.words.size) await Reader.render(s, { g: g0, block: 'top' });
      else Reader.focus({ g: g0 });
      Reader.root.classList.add('reciting');
      Reader.root.classList.toggle('marks', !!Store.data.settings.live);
      Reader.root.classList.toggle('hide', this.hideOn);
      $('#fab').hidden = true; $('#recbar').hidden = false;
      document.body.classList.add('rec-on');
      if (Reader.paged) Mushaf.relayout();
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
    /** the recogniser on the phone, when chosen in the settings and possible here */
    onPhone() { return Store.data.settings.engine === 'phone' && ASR.supported(); },
    makeSpeech() {
      const t = this.tracker;
      const h = {
        result: (finals, interim) => {
          this.heardText = (finals.join(' ') + ' ' + interim).trim();
          const p0 = t.pointer, m0 = t.mode;
          t.feed(finals, interim);
          if (t.pointer !== p0 || t.mode !== m0) RecLog.add('at', (t.mode === 'search' ? 'searching ' : '') + gref(t.pointer));
          this.updateBar();
        },
        state: s => { this.loading = s === 'loading'; $('#recbar').dataset.state = s; if (this.blind) Blind.mic(s === 'loading' ? 'idle' : s); this.updateBar(); },
        restart: () => { t.newSession(); RecLog.add('session', 'new, at ' + gref(t.pointer)); },
        late: () => { if (t.fresh >= 0) RecLog.add('session', 'listened long before the first word'); t.heardFromStart(); },
        log: (k, x) => RecLog.add(k, x),
        error: code => this.onError(code),
        // n-best: the guess that fits the expected words; and those words, to bias the recogniser where it can be
        pick: (alts, prev) => t.pick(alts, prev),
        phrases: () => (t.mode === 'track' ? t.phrasesAt(Math.min(t.pointer, D.Q.words.length - 1), 24) : []),
      };
      return this.onPhone() ? new ModelSpeech(h, t) : new Speech(h);
    },
    pause(reason) {
      if (!this.active || this.paused) return;
      RecLog.add('pause', reason || '');
      if (this.speech) this.speech.flush();
      this.paused = true;
      if (this.speech) this.speech.stop();
      this.tracker.newSession();
      $('#recbar').dataset.state = 'idle';
      $('#rec-resume').hidden = false; $('#recbar').classList.add('paused');
      if (this.blind) Blind.paused(true);
      this.updateBar();
      if (reason === 'interrupted-net') toast('Keine Verbindung zur Spracherkennung. Tippe auf Weiter, sobald du wieder online bist.', 4200);
      else if (reason !== 'hidden' && reason !== 'user') toast('Die Spracherkennung wurde unterbrochen. Tippe auf Weiter.', 3600);
    },
    resume() {
      if (!this.active || !this.paused) return;
      this.paused = false;
      $('#rec-resume').hidden = true; $('#recbar').classList.remove('paused');
      if (this.blind) Blind.paused(false);
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
    onAttempt(e) {
      if (this.blind) { Blind.attempt(e); return; }
      this.updateBar();
      const bar = $('#recbar .recbar-in');
      bar.classList.remove('miss'); void bar.offsetWidth; bar.classList.add('miss');
    },
    showHint(e) {
      if (this.blind) { Blind.hint(e); return; }
      if (e.kind === 'verse') { this.hideHint(); this.paint(true); return; }    // the verse is shown in the text itself
      const T = hintText(e);
      this.card({ tone: 'hint', msg: T.msg, ar: T.ar, skip: true });
    },
    /** the gate stopped at a word (or let one through), with hidden text: said in the card above the bar */
    onSay(e) {
      if (this.blind) { Blind.say(e); return; }
      if (e.type === 'where') return;                       // the caret shows where it goes on
      const T = sayText(e);
      this.card({ tone: T.tone, msg: T.msg + (T.small ? `<small>${T.small}</small>` : ''), ar: T.ar });
      if (e.type === 'accept') { clearTimeout(this.cardTimer); this.cardTimer = setTimeout(() => this.hideHint(), 3500); }
    },
    card({ tone, msg, ar, row, skip }) {
      clearTimeout(this.cardTimer);
      const box = $('#rec-hint'), txt = $('#rec-hint-t');
      box.dataset.tone = tone || 'hint';
      txt.classList.toggle('row', !!row);
      txt.innerHTML = (row ? `<span>${msg}</span><span class="q">${esc(ar || '')}</span>` : msg + (ar ? `<span class="q">${esc(ar)}</span>` : ''))
        + (skip ? '<button class="linkish" id="rec-skip">Ganzen Vers zeigen</button>' : '');
      const sk = $('#rec-skip', txt);
      if (sk) sk.addEventListener('click', () => { if (this.tracker) this.tracker.skipVerse(); });
      box.hidden = false;
      box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
      this.updateBar();
    },
    hideHint() { clearTimeout(this.cardTimer); const b = $('#rec-hint'); if (b) b.hidden = true; },
    moveTo(g) { RecLog.add('moved by hand', gref(g)); this.tracker.moveTo(g); this.paint(true); toast('Weiter ab diesem Wort'); },
    schedulePaint() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => { this.raf = 0; this.paint(); });
    },
    paint(force) {
      const t = this.tracker;
      if (!t) return;
      const ptr = t.pointer;
      if (this.blind) {
        if (!this.active) return;
        Blind.paint();
        if (this.endG != null && ptr > this.endG) this.stop('done');
        return;
      }
      // follow the reciter into another surah once a word there has been heard (also backwards, e.g. an-Nas, then al-Falaq);
      // on the pages: turn to the page (see autoScroll)
      if (this.active && !Reader.paged) {
        let last = t.lastHeard;
        for (const k of t.tentative.keys()) if (k > last) last = k;
        if (last >= 0 && last < D.Q.words.length) {
          const ps = surahOf(D.Q.words[last].v);
          if (ps !== Reader.surah) { Reader.render(ps, { g: last }); return; }
        }
      }
      // the basmala above a surah: shown as recited once it was heard
      for (const bs of Reader.root.querySelectorAll('.basmala[data-bs]')) bs.classList.toggle('heard', !!(t.basmHeard && t.basmHeard.has(+bs.dataset.bs)));
      // v: shown even with hidden text (recited, shown as a hint, or just being heard); hn: shown as a hint
      const rev = t.revealed;
      // memorising a passage: the text around it on the page stays readable (faint), only the passage is covered
      const bd = this.hideOn && this.active && t.bounds;
      const vAny = new Set(), vOpen = new Set(), pAny = new Set(), pOpen = new Set();
      for (const [g, w] of Reader.words) {
        let c = 'w';
        const s = t.status[g];
        if (s) c += ' s' + s; else if (rev && rev.has(g)) c += ' hn'; else if (t.tentative.has(g)) c += ' tt';
        const vis = c !== 'w';
        if (vis) c += ' v';
        else if (bd && (g < bd[0] || g > bd[1])) c += ' ctx';
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
      // on the pages: the page with the word that comes next is turned to (also backwards)
      if (Reader.paged) {
        const N = D.Q.words.length, gg = Math.min(g, N - 1);
        const slide = x => Mushaf.slideOf(Mushaf.pageOfWord(Math.min(x, N - 1)));
        // turned on by words still in the interim text: back only when the reciter goes back (a jump, the word it
        // stopped at), not when the interim text is replaced by the final one
        if (this.shown && slide(gg) < slide(this.shown.g) && ptr >= this.shown.ptr) return;
        if (!this.shown || slide(gg) !== slide(this.shown.g)) RecLog.add('page', Mushaf.pageOfWord(gg) + ' for ' + gref(gg));
        this.shown = { g: gg, ptr };
        Mushaf.reveal(gg);
        return;
      }
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
      if (this.blind) { Blind.update(); return; }
      const g = Math.min(t.pointer, D.Q.words.length - 1);
      const v = D.Q.words[g].v;
      const searching = t.mode === 'search';
      $('#rec-l1').textContent = searching ? 'Ich höre zu …' : (this.paused ? 'Pausiert bei ' : '') + S(surahOf(v)).tr + ' ' + ref(v);
      const l2 = $('#rec-l2');
      if (this.paused) { l2.className = 'l2'; l2.textContent = 'Tippe auf Weiter, um fortzufahren'; }
      else if (this.loading) { l2.className = 'l2'; l2.textContent = 'Die Erkennung auf dem Handy startet …'; }
      else if (this.hideOn && !searching && t.strict && t.help.on && t.tries > 0) {
        const left = t.help.tries - t.tries;
        let dots = ''; for (let i = 0; i < t.help.tries; i++) dots += `<i class="${i < t.tries ? 'used' : ''}"></i>`;
        l2.className = 'l2'; l2.innerHTML = `<span class="tries" aria-hidden="true">${dots}</span>noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}`;
      }
      else if (this.phrase && Date.now() - this.phrase.at < 6000) {
        // the isti'adha or basmala was heard: said so, the place stays as it is
        const name = { isti: 'Isti\'adha', basm: 'Basmala', end: 'Ṣadaqa-llāhu-l-ʿaẓīm' }[this.phrase.name] || '';
        l2.className = 'l2 phrase';
        l2.innerHTML = ICON.check + `<span>${name} gehört</span>`;
      }
      else if (searching && !(Store.data.settings.heard && this.heardText)) { l2.className = 'l2'; l2.textContent = 'Lies einfach los'; }
      else if (Store.data.settings.heard && this.heardText) {
        const words = this.heardText.split(/\s+/); l2.className = 'l2 heard'; l2.innerHTML = '<span>' + esc(words.slice(-5).join(' ')) + '</span>';
      } else { l2.className = 'l2'; l2.textContent = this.hideOn ? 'Lies auswendig' : 'Lies in deinem Tempo, ich folge dir'; }
    },
    stop(reason, silent) {
      if (!this.active) return;
      RecLog.add('stop', reason + ', at ' + gref(this.tracker ? this.tracker.pointer : -1));
      // the last words may still be in the interim text when the reciter ends: they count
      if (reason === 'user' && this.speech && !this.paused) this.speech.flush();
      this.active = false; this.paused = false;
      $('#rec-resume').hidden = true; $('#recbar').classList.remove('paused');
      if (this.speech) this.speech.stop();
      if (this.wake) { try { this.wake.release(); } catch (e) { /* ignore */ } this.wake = null; }
      if (this.blind) {
        Blind.close();
        const sum = this.tracker.summary();
        if (silent) return;
        if (!sum.words) { if (reason === 'user') toast('Nichts erkannt. Lies etwas lauter oder näher am Handy.'); return; }
        const rec = { d: today(), at: Date.now(), from: sum.from, to: sum.to, words: sum.words, ok: sum.words - sum.issues.filter(i => isIssue(i.st)).length, mode: 'blind', secs: Math.round((Date.now() - this.startedAt) / 1000) };
        Store.data.sessions.push(rec); if (Store.data.sessions.length > 60) Store.data.sessions.splice(0, Store.data.sessions.length - 60);
        Store.save();
        Hifz.reviewFromSession(this.tracker, sum);
        Blind.summary(sum, rec, reason === 'done');
        return;
      }
      $('#recbar').hidden = true; $('#fab').hidden = App.tab !== 'read';
      document.body.classList.remove('rec-on');
      if (Reader.paged) Mushaf.relayout();
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
      const rec = { d: today(), at: Date.now(), from: sum.from, to: sum.to, words: sum.words, ok: sum.words - sum.issues.filter(i => isIssue(i.st)).length, mode: this.mode, secs: Math.round((Date.now() - this.startedAt) / 1000) };
      Store.data.sessions.push(rec); if (Store.data.sessions.length > 60) Store.data.sessions.splice(0, Store.data.sessions.length - 60);
      Store.save();
      if (this.mode === 'test') Hifz.reviewFromSession(this.tracker, sum);
      Summary.open(sum, rec, reason === 'done');
    },
    clearMarks() {
      this.marksShown = false;
      Reader.root.classList.remove('reciting', 'marks', 'hide');
      if (this.tracker) this.tracker.reset(this.tracker.pointer);
      for (const w of Reader.words.values()) { w.className = 'w'; w._c = 'w'; }
    },
  };
  ['touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, () => { Rec.userScrollUntil = Date.now() + 2500; }, { passive: true }));

  // ------------------------------------------------------------------ microphone and own recordings
  // For a recogniser that runs on the phone itself: the microphone stays open for the whole recitation (no sessions and
  // restarts as with the browser's recognition), as plain sound: no noise suppression (it takes a long madd for a hum and
  // swallows it), no echo cancellation, no automatic gain. Recordings to test and train that recogniser use the same sound.
  const MIC_AUDIO = { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  /** runs in the audio thread: the sound as 16 kHz mono in blocks of 100 ms, and its level 20 times a second. Where the
      audio context cannot run at 16 kHz (Firefox), it is resampled here with a windowed sinc (Blackman, cut just below 8 kHz). */
  const CAP_WORKLET = `
class MyHifzCapture extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.out = p.rate || 16000;
    this.block = p.block || 1600;
    this.buf = new Float32Array(this.block);
    this.n = 0;
    this.r = sampleRate / this.out;
    this.lvN = Math.round(sampleRate / 20);
    this.lvS = 0; this.lvP = 0; this.lvC = 0;
    this.tab = null;
    if (Math.abs(this.r - 1) > 1e-6) {
      const fc = 0.5 * Math.min(1, 1 / this.r) * 0.92;
      const W = Math.ceil(16 * Math.max(1, this.r)), OS = 64, T = W * OS + 2;
      const tab = new Float32Array(T);
      for (let i = 0; i < T; i++) {
        const x = i / OS;
        if (x >= W) { tab[i] = 0; continue; }
        const s = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
        tab[i] = s * (0.42 + 0.5 * Math.cos(Math.PI * x / W) + 0.08 * Math.cos(2 * Math.PI * x / W));
      }
      this.W = W; this.OS = OS; this.tab = tab;
      this.h = new Float32Array(2 * W + 4096);
      this.hn = W;
      this.t = W;
    }
  }
  emit(x) {
    this.buf[this.n++] = x;
    if (this.n === this.block) {
      this.port.postMessage({ pcm: this.buf }, [this.buf.buffer]);
      this.buf = new Float32Array(this.block);
      this.n = 0;
    }
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const L = ch.length;
    for (let i = 0; i < L; i++) {
      const x = ch[i];
      this.lvS += x * x;
      const a = x < 0 ? -x : x;
      if (a > this.lvP) this.lvP = a;
    }
    this.lvC += L;
    if (this.lvC >= this.lvN) {
      this.port.postMessage({ rms: Math.sqrt(this.lvS / this.lvC), peak: this.lvP });
      this.lvS = 0; this.lvP = 0; this.lvC = 0;
    }
    if (!this.tab) { for (let i = 0; i < L; i++) this.emit(ch[i]); return true; }
    const W = this.W, OS = this.OS, tab = this.tab;
    if (this.hn + L > this.h.length) { const g = new Float32Array(this.hn + L + 1024); g.set(this.h.subarray(0, this.hn)); this.h = g; }
    const h = this.h;
    h.set(ch, this.hn);
    this.hn += L;
    for (;;) {
      const t = this.t, i1 = Math.floor(t + W);
      if (i1 >= this.hn) break;
      let acc = 0;
      for (let i = Math.ceil(t - W); i <= i1; i++) {
        const d = (t > i ? t - i : i - t) * OS, k = d | 0;
        acc += h[i] * (tab[k] + (tab[k + 1] - tab[k]) * (d - k));
      }
      this.emit(acc);
      this.t += this.r;
    }
    const k0 = Math.floor(this.t - W) - 1;
    if (k0 > 0) { h.copyWithin(0, k0, this.hn); this.hn -= k0; this.t -= k0; }
    return true;
  }
}
registerProcessor('myhifz-capture', MyHifzCapture);
`;
  const Mic = {
    /** opens the microphone. frames(Float32Array): 16 kHz mono, 100 ms each; level({rms, peak}) 20 times a second;
        ended(): the microphone went away (another app took it). native: the worklet resamples (for the tests). */
    async open({ frames, level, ended, native } = {}) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('no microphone'), { name: 'NotSupportedError' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_AUDIO });
      const AC = window.AudioContext || window.webkitAudioContext;
      let g = null;
      if (AC && window.AudioWorkletNode) {
        const url = URL.createObjectURL(new Blob([CAP_WORKLET], { type: 'application/javascript' }));
        const build = async rate => {
          const ctx = rate ? new AC({ sampleRate: rate, latencyHint: 'interactive' }) : new AC({ latencyHint: 'interactive' });
          try {
            await ctx.audioWorklet.addModule(url);
            const src = ctx.createMediaStreamSource(stream);       // Firefox refuses a stream at another rate than the context
            const node = new AudioWorkletNode(ctx, 'myhifz-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { rate: 16000, block: 1600 } });
            src.connect(node); node.connect(ctx.destination);      // pulled by the graph; it writes no sound, nothing is heard
            if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* it runs with the next tap */ } }
            return { ctx, src, node };
          } catch (e) { try { ctx.close(); } catch (e2) { /* ignore */ } throw e; }
        };
        try {
          if (!native) { try { g = await build(16000); } catch (e) { g = null; } }
          if (!g) g = await build(0);
        } catch (e) { g = null; }                                  // without Web Audio: recording works, without level and frames
        URL.revokeObjectURL(url);
      }
      if (g) g.node.port.onmessage = e => { const d = e.data; if (d.pcm) { if (frames) frames(d.pcm); } else if (d.rms != null && level) level(d); };
      const track = stream.getAudioTracks()[0];
      let closed = false;
      if (track) track.addEventListener('ended', () => { if (!closed && ended) ended(); });
      return {
        stream, rate: g ? g.ctx.sampleRate : 0, worklet: !!g,
        settings: track && track.getSettings ? track.getSettings() : {},
        close() {
          if (closed) return;
          closed = true;
          for (const t of stream.getTracks()) t.stop();
          if (g) { try { g.src.disconnect(); g.node.disconnect(); } catch (e) { /* ignore */ } try { g.ctx.close(); } catch (e) { /* ignore */ } }
        },
      };
    },
  };

  /** own recordings in IndexedDB on this device ('meta' for the list, 'blob' for the sound) until the user downloads them */
  const RecStore = {
    db: null,
    open() {
      if (!this.db) {
        this.db = new Promise((res, rej) => {
          if (!window.indexedDB) { rej(new Error('no IndexedDB')); return; }
          const r = indexedDB.open('myhifz-rec', 1);
          r.onupgradeneeded = () => {
            const d = r.result;
            if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id', autoIncrement: true });
            if (!d.objectStoreNames.contains('blob')) d.createObjectStore('blob');
          };
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
          r.onblocked = () => rej(new Error('blocked'));
        });
        this.db.catch(() => { this.db = null; });
      }
      return this.db;
    },
    async req(stores, mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const tx = db.transaction(stores, mode);
        const out = {};
        tx.oncomplete = () => res(out.v);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error || new Error('aborted'));
        fn(tx, out);
      });
    },
    /** the sound is kept as an ArrayBuffer: every browser can store that */
    add(meta, buf) {
      return this.req(['meta', 'blob'], 'readwrite', (tx, out) => {
        const r = tx.objectStore('meta').add(meta);
        r.onsuccess = () => { out.v = r.result; tx.objectStore('blob').put(buf, r.result); };
      });
    },
    list() {
      return this.req(['meta'], 'readonly', (tx, out) => {
        const r = tx.objectStore('meta').getAll();
        r.onsuccess = () => { out.v = (r.result || []).sort((a, b) => a.at - b.at); };
      });
    },
    sound(id) {
      return this.req(['blob'], 'readonly', (tx, out) => { const r = tx.objectStore('blob').get(id); r.onsuccess = () => { out.v = r.result; }; });
    },
    remove(id) {
      return this.req(['meta', 'blob'], 'readwrite', tx => { tx.objectStore('meta').delete(id); tx.objectStore('blob').delete(id); });
    },
  };

  /** a zip file without compression (the sound is compressed already): files [{name, data: Uint8Array}] */
  function zipStore(files) {
    if (!zipStore.crcT) {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
      zipStore.crcT = t;
    }
    const T = zipStore.crcT;
    const crc = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = T[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const now = new Date();
    const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const enc = new TextEncoder();
    const parts = [], central = [];
    let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, c = crc(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dtime, true); lh.setUint16(12, ddate, true); lh.setUint32(14, c, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
      cd.setUint16(12, dtime, true); cd.setUint16(14, ddate, true); cd.setUint32(16, c, true);
      cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, name.length, true);
      cd.setUint32(42, off, true);
      central.push(cd.buffer, name);
      off += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, x) => s + x.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
  }

  const fmtDur = secs => { const s = Math.max(0, Math.round(secs)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const REC_KIND = { normal: 'normal', slow: 'langsam, lange Dehnungen', fast: 'zügig', errors: 'mit Fehlern' };
  /** "al-Mulk 1–10", "al-Mulk 30 – al-Qalam 5" */
  function spanName(a, b) {
    const sa = surahOf(a), sb = surahOf(b);
    if (a === b) return S(sa).tr + ' ' + ayahOf(a);
    return sa === sb ? `${S(sa).tr} ${ayahOf(a)}–${ayahOf(b)}` : `${S(sa).tr} ${ayahOf(a)} – ${S(sb).tr} ${ayahOf(b)}`;
  }

  /** recording one's own recitation (for the recogniser on the phone: a test set in one's own voice, later its training).
      Started from the settings at the verse in view; while it runs, the pages can be turned as usual. */
  const Capture = {
    active: false, paused: false, starting: false,
    async start() {
      if (this.active || this.starting) return;
      if (Rec.active) { toast('Beende zuerst die Rezitation.'); return; }
      if (IS_PREVIEW) { Help.previewMic(); return; }
      if (!window.MediaRecorder || !navigator.mediaDevices) { this.error('unsupported'); return; }
      this.starting = true;
      while (sheets.length) sheets[sheets.length - 1].close();
      if (App.tab !== 'read') showTab('read', true);
      const v0 = Reader.firstVisibleVerse();
      let mic;
      try { mic = await Mic.open({ level: l => this.level(l), ended: () => { if (this.active) { toast('Das Mikrofon wurde unterbrochen.'); this.finish(); } } }); }
      catch (e) { this.starting = false; this.error(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : e && e.name === 'NotSupportedError' ? 'unsupported' : 'nomic'); return; }
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
      let rec;
      try { rec = new MediaRecorder(mic.stream, Object.assign({ audioBitsPerSecond: 48000 }, mime ? { mimeType: mime } : {})); rec.start(1000); }
      catch (e) { mic.close(); this.starting = false; this.error('unsupported'); return; }
      this.chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      Object.assign(this, { active: true, starting: false, paused: false, mic, rec, mime: rec.mimeType || mime, v0, ran: 0, runFrom: Date.now(), hotAt: 0, armed: 0 });
      const b = this.bar();
      $('#cap-from', b).textContent = 'ab ' + S(surahOf(v0)).tr + ' ' + ayahOf(v0);
      b.classList.remove('paused'); $('#cap-resume', b).hidden = true; b.dataset.state = 'listening';
      b.hidden = false;
      $('#fab').hidden = true;
      document.body.classList.add('rec-on');
      if (Reader.paged) Mushaf.relayout();
      this.tick(); clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 500);
      try { if (navigator.wakeLock) this.wake = await navigator.wakeLock.request('screen'); } catch (e) { this.wake = null; }
    },
    bar() {
      let b = $('#capbar');
      if (b) return b;
      b = el(`<div class="recbar capbar" id="capbar" hidden data-state="idle"><div class="recbar-in">
        <span class="rec-dot" aria-hidden="true"></span>
        <div class="rec-info"><div class="l1" id="cap-l1">Aufnahme</div><div class="l2"><span class="cap-meter" aria-hidden="true"><i></i></span><span id="cap-from"></span></div></div>
        <button class="icon-btn" id="cap-x" aria-label="Aufnahme verwerfen">${ICON.close}</button>
        <button class="btn primary small" id="cap-resume" hidden>${ICON.mic}<span>Weiter</span></button>
        <button class="btn stop" id="cap-done">${ICON.stop}<span>Fertig</span></button></div></div>`);
      ($('#app') || document.body).appendChild(b);
      $('#cap-done', b).addEventListener('click', () => this.finish());
      $('#cap-resume', b).addEventListener('click', () => this.resume());
      $('#cap-x', b).addEventListener('click', () => {
        if (Date.now() - this.armed < 3000) { this.discard(); return; }
        this.armed = Date.now(); toast('Nochmal tippen, um die Aufnahme zu verwerfen');
      });
      return b;
    },
    secs() { return (this.ran + (this.active && !this.paused ? Date.now() - this.runFrom : 0)) / 1000; },
    tick() {
      if (!this.active) return;
      $('#cap-l1').textContent = (this.paused ? 'Pausiert · ' : 'Aufnahme · ') + fmtDur(this.secs());
    },
    level({ rms, peak }) {
      if (!this.active || this.paused) return;
      const db = 20 * Math.log10(Math.max(rms, 1e-6));
      const b = $('#capbar'); if (!b) return;
      const m = $('.cap-meter', b);
      m.firstElementChild.style.width = Math.max(0, Math.min(100, (db + 60) / 60 * 100)).toFixed(0) + '%';
      if (peak > 0.98) this.hotAt = Date.now();
      m.classList.toggle('hot', Date.now() - this.hotAt < 1500);           // too loud: the sound clips
      b.dataset.state = db > -45 ? 'speech' : 'listening';
    },
    pause() {
      if (!this.active || this.paused) return;
      try { this.rec.pause(); } catch (e) { /* ignore */ }
      this.ran += Date.now() - this.runFrom; this.paused = true;
      const b = $('#capbar'); b.classList.add('paused'); $('#cap-resume', b).hidden = false; b.dataset.state = 'idle';
      this.tick();
    },
    resume() {
      if (!this.active || !this.paused) return;
      try { this.rec.resume(); } catch (e) { /* ignore */ }
      this.runFrom = Date.now(); this.paused = false;
      const b = $('#capbar'); b.classList.remove('paused'); $('#cap-resume', b).hidden = true; b.dataset.state = 'listening';
      this.tick();
    },
    /** the recorder's last data, then the microphone closed */
    async stopAll() {
      const rec = this.rec, mic = this.mic;
      const secs = this.secs();
      await new Promise(res => {
        let done = false;
        const fin = () => { if (!done) { done = true; res(); } };
        rec.onstop = fin;
        try { if (rec.state !== 'inactive') rec.stop(); else fin(); } catch (e) { fin(); }
        setTimeout(fin, 3000);
      });
      mic.close();
      this.end();
      return secs;
    },
    end() {
      this.active = false; this.paused = false;
      clearInterval(this.timer);
      const b = $('#capbar'); if (b) b.hidden = true;
      document.body.classList.remove('rec-on');
      $('#fab').hidden = App.tab !== 'read' || Rec.active;
      if (this.wake) { try { this.wake.release(); } catch (e) { /* ignore */ } this.wake = null; }
      if (Reader.paged) Mushaf.relayout();
    },
    async discard() {
      if (!this.active) return;
      await this.stopAll();
      this.chunks = [];
      toast('Aufnahme verworfen');
    },
    async finish() {
      if (!this.active || this.finishing) return;
      this.finishing = true;
      const v1 = this.lastVisibleVerse(this.v0);
      const secs = await this.stopAll();
      this.finishing = false;
      const blob = new Blob(this.chunks, { type: (this.mime || 'audio/webm').split(';')[0] });
      this.chunks = [];
      if (secs < 1 || blob.size < 1000) { toast('Die Aufnahme war zu kurz.'); return; }
      this.saveSheet({ blob, secs, v0: this.v0, v1, mic: this.mic });
    },
    /** the last verse whose end mark is in view: where the reciter probably stopped */
    lastVisibleVerse(min) {
      const top = Reader.topbarBottom ? Reader.topbarBottom() : 0, bottom = window.innerHeight - 70;
      let last = -1;
      for (const [v, m] of Reader.markers) {
        const r = m.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        if (r.right < 0 || r.left > window.innerWidth || r.bottom < top || r.top > bottom) continue;
        if (v > last) last = v;
      }
      return Math.max(min, last);
    },
    saveSheet({ blob, secs, v0, v1, mic }) {
      const N = TOTAL_VERSES;
      const opts = (a, b, sel) => { let h = ''; for (let v = a; v <= b; v++) h += `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(S(surahOf(v)).tr + ' ' + ayahOf(v))}</option>`; return h; };
      const body = el('<div></div>');
      body.innerHTML = `
        <p class="note" style="margin:0 0 4px">${fmtDur(secs)} aufgenommen. Was hast du gelesen?</p>
        <div class="setting col"><div class="txt"><b>Von</b></div><select class="field" id="cs-from">${opts(Math.max(0, v0 - 30), Math.min(N - 1, v0 + 300), v0)}</select></div>
        <div class="setting col"><div class="txt"><b>Bis</b></div><select class="field" id="cs-to">${opts(Math.max(0, v0 - 30), Math.min(N - 1, v0 + 400), v1)}</select></div>
        <div class="setting col"><div class="txt"><b>Wie hast du gelesen?</b></div>
          <div class="seg" id="cs-kind"><button data-v="normal">Normal</button><button data-v="slow">Langsam</button><button data-v="fast">Zügig</button><button data-v="errors">Mit Fehlern</button></div></div>
        <div class="setting col" id="cs-note-row" hidden><div class="txt"><b>Welche Fehler?</b><span>Zum Beispiel: Vers 5 ausgelassen, in Vers 8 ein Wort vertauscht</span></div>
          <input class="field" id="cs-note" maxlength="300" autocomplete="off"></div>
        <div class="row" style="margin-top:14px"><button class="btn grow" id="cs-drop">Verwerfen</button><button class="btn primary grow" id="cs-save">Speichern</button></div>`;
      let kind = 'normal', handled = false;
      const seg = $('#cs-kind', body);
      $$('button', seg).forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.v === kind));
        b.addEventListener('click', () => {
          kind = b.dataset.v;
          $$('button', seg).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          $('#cs-note-row', body).hidden = kind !== 'errors';
        });
      });
      const save = async () => {
        if (handled) return;
        handled = true;
        let a = +$('#cs-from', body).value, b = +$('#cs-to', body).value;
        if (b < a) [a, b] = [b, a];
        const meta = {
          at: Date.now(), from: a, to: b, fromRef: ref(a), toRef: ref(b), secs: Math.round(secs * 10) / 10, kind,
          note: ($('#cs-note', body).value || '').trim(), mime: blob.type, size: blob.size,
          rate: mic ? mic.rate : 0, mic: mic ? mic.settings : {}, app: APP_VERSION, ua: navigator.userAgent,
        };
        try {
          await RecStore.add(meta, await blob.arrayBuffer());
          toast('Gespeichert: ' + spanName(a, b) + ', ' + fmtDur(secs));
          try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* ignore */ }
        } catch (e) { toast('Die Aufnahme ließ sich nicht speichern. Ist der Speicher voll?', 4200); }
        Recordings.changed();
      };
      // closed without choosing: kept rather than lost (it can be deleted in the list)
      const sh = openSheet({ title: 'Aufnahme speichern', body, onClose: () => { if (!handled) save(); } });
      $('#cs-save', body).addEventListener('click', () => { save(); sh.close(); });
      $('#cs-drop', body).addEventListener('click', () => { handled = true; sh.close(); toast('Aufnahme verworfen'); });
    },
    error(code) {
      const T = {
        denied: ['Mikrofon blockiert', 'Erlaube den Mikrofonzugriff für diese Seite in den Browser-Einstellungen und starte die Aufnahme dann noch einmal.'],
        nomic: ['Kein Mikrofon gefunden', 'Prüfe, ob ein anderes Programm das Mikrofon benutzt, und versuche es erneut.'],
        unsupported: ['Aufnehmen nicht möglich', 'Dieser Browser kann nicht aufnehmen. Öffne MyHifz auf Android in Chrome oder auf dem iPhone in Safari.'],
      }[code] || ['Aufnahme gestoppt', 'Bitte starte die Aufnahme erneut.'];
      openSheet({ title: T[0], body: el(`<div><p class="note">${esc(T[1])}</p></div>`) });
    },
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && Capture.active) Capture.pause(); });

  /** the list of own recordings: listen, delete, download all as one zip file */
  const Recordings = {
    sheet: null,
    changed() { if (this.sheet && !this.sheet.closed && this.draw) this.draw(); },
    async summary() {
      const list = await RecStore.list();
      return { n: list.length, secs: list.reduce((s, m) => s + (m.secs || 0), 0), size: list.reduce((s, m) => s + (m.size || 0), 0), list };
    },
    open() {
      const body = el('<div class="recs"></div>');
      const sh = openSheet({ title: 'Eigene Aufnahmen', body, onClose: () => { this.stopPlay(); this.sheet = null; } });
      this.sheet = sh;
      const v = Reader.firstVisibleVerse();
      body.innerHTML = `
        <p class="note" style="margin-top:0">Für die neue Erkennung, die direkt auf dem Handy laufen wird. An deinen Aufnahmen wird geprüft, wie gut sie dich versteht; später lernt sie damit deine Stimme. Die Aufnahmen bleiben auf diesem Gerät, bis du sie herunterlädst.</p>
        <p class="tiny">Gut sind zusammen 10 bis 20 Minuten aus verschiedenen Suren: so wie du sonst liest, einmal langsam mit langen Dehnungen, einmal zügig und einmal mit absichtlichen Fehlern, etwa einem ausgelassenen Wort oder einem verwechselten Vers. Halte das Handy wie beim Rezitieren.</p>
        <button class="btn primary block" id="rc-new" style="margin-top:6px">${ICON.mic}<span>Aufnahme ab ${esc(S(surahOf(v)).tr + ' ' + ayahOf(v))}</span></button>
        <div class="section-title" id="rc-title">Aufnahmen</div>
        <div id="rc-list"><p class="tiny">Lädt …</p></div>
        <div id="rc-foot" hidden>
          <button class="btn block" id="rc-zip" style="margin-top:14px">${ICON.download}<span>Alle herunterladen</span></button>
          <p class="tiny" style="margin:8px 0 0">Eine ZIP-Datei mit allen Aufnahmen und einer Liste, was jede enthält. Sie landet bei deinen Downloads.</p>
        </div>`;
      $('#rc-new', body).addEventListener('click', () => Capture.start());
      $('#rc-zip', body).addEventListener('click', () => this.download());
      this.draw = async () => {
        let sum;
        try { sum = await this.summary(); }
        catch (e) { $('#rc-list', body).innerHTML = '<p class="tiny">Aufnahmen können in diesem Browser nicht gespeichert werden.</p>'; $('#rc-new', body).disabled = true; return; }
        this.list = sum.list;
        $('#rc-title', body).innerHTML = `Aufnahmen${sum.n ? ` <small>${sum.n} · ${fmtDur(sum.secs)} Min.</small>` : ''}`;
        $('#rc-foot', body).hidden = !sum.n;
        $('#rc-zip span', body).textContent = `Alle herunterladen (${sum.size < 1048576 ? Math.ceil(sum.size / 1024) + ' KB' : (sum.size / 1048576).toFixed(1).replace('.', ',') + ' MB'})`;
        if (!sum.n) { $('#rc-list', body).innerHTML = '<p class="tiny">Noch keine Aufnahmen.</p>'; return; }
        $('#rc-list', body).innerHTML = sum.list.slice().reverse().map(m => {
          const d = new Date(m.at);
          const when = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          return `<div class="setting rc-item" data-id="${m.id}"><div class="txt"><b>${esc(spanName(m.from, m.to))}</b><span>${fmtDur(m.secs)} · ${esc(REC_KIND[m.kind] || m.kind)} · ${when}${m.note ? ' · ' + esc(m.note) : ''}</span></div>
            <button class="icon-btn" data-play aria-label="Anhören">${ICON.play}</button><button class="icon-btn rc-del" data-del aria-label="Löschen">${ICON.trash}</button></div>`;
        }).join('');
        $$('.rc-item', body).forEach(row => {
          const id = +row.dataset.id;
          $('[data-play]', row).addEventListener('click', e => this.play(id, e.currentTarget));
          $('[data-del]', row).addEventListener('click', async e => {
            const btn = e.currentTarget;
            if (btn.dataset.armed && Date.now() - +btn.dataset.armed < 3000) {
              this.stopPlay();
              try { await RecStore.remove(id); } catch (err) { /* ignore */ }
              this.draw();
            } else { btn.dataset.armed = Date.now(); btn.classList.add('armed'); toast('Nochmal tippen, um die Aufnahme zu löschen'); setTimeout(() => btn.classList.remove('armed'), 3000); }
          });
        });
      };
      this.draw();
    },
    async play(id, btn) {
      const same = this.playing && this.playing.id === id;
      this.stopPlay();
      if (same) return;
      const m = (this.list || []).find(x => x.id === id);
      const buf = await RecStore.sound(id);
      if (!buf || !m) return;
      const url = URL.createObjectURL(new Blob([buf], { type: m.mime || 'audio/webm' }));
      const a = new Audio(url);
      this.playing = { id, a, url, btn };
      btn.innerHTML = ICON.stop; btn.setAttribute('aria-label', 'Anhalten');
      a.addEventListener('ended', () => this.stopPlay());
      a.play().catch(() => { this.stopPlay(); toast('Abspielen nicht möglich'); });
    },
    stopPlay() {
      const p = this.playing;
      if (!p) return;
      this.playing = null;
      try { p.a.pause(); } catch (e) { /* ignore */ }
      URL.revokeObjectURL(p.url);
      if (p.btn) { p.btn.innerHTML = ICON.play; p.btn.setAttribute('aria-label', 'Anhören'); }
    },
    async download() {
      const btn = this.sheet && $('#rc-zip', this.sheet.body);
      if (btn) btn.disabled = true;
      try {
        const list = await RecStore.list();
        const files = [], items = [];
        let i = 0;
        for (const m of list) {
          const buf = await RecStore.sound(m.id);
          if (!buf) continue;
          const ext = /ogg/.test(m.mime) ? 'ogg' : /mp4|aac/.test(m.mime) ? 'm4a' : 'webm';
          const name = `${String(++i).padStart(3, '0')}_${m.fromRef.replace(':', '-')}_bis_${m.toRef.replace(':', '-')}_${m.kind}.${ext}`;
          files.push({ name, data: new Uint8Array(buf) });
          items.push(Object.assign({ file: name, surahFrom: S(surahOf(m.from)).tr, surahTo: S(surahOf(m.to)).tr }, m));
        }
        const manifest = { app: 'MyHifz', version: APP_VERSION, made: new Date().toISOString(), note: 'from/to: verse index 0..6235 (Hafs); fromRef/toRef: surah:ayah', recordings: items };
        files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) });
        const blob = zipStore(files);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'myhifz-aufnahmen-' + new Date().toISOString().slice(0, 10) + '.zip';
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 10000);
        toast('Download gestartet');
      } catch (e) { toast('Herunterladen ging nicht.'); }
      if (btn) btn.disabled = false;
    },
  };

  // ------------------------------------------------------------------ recitation summary
  const LETTER_NAME = { 'ح': 'Ḥāʾ', 'ه': 'Hāʾ', 'خ': 'Ḫāʾ', 'ع': 'ʿAin', 'ء': 'Hamza', 'ا': 'Alif', 'ق': 'Qāf', 'ك': 'Kāf', 'غ': 'Ġain', 'ص': 'Ṣād', 'س': 'Sīn', 'ض': 'Ḍād', 'د': 'Dāl', 'ظ': 'Ẓāʾ', 'ط': 'Ṭāʾ', 'ت': 'Tāʾ', 'ذ': 'Ḏāl', 'ز': 'Zāy', 'ث': 'Ṯāʾ' };
  /** what went wrong while memorising, in a few words */
  function diagText(f) {
    const a = ayahOf(f.va);
    switch (f.kind) {
      case 'skip':
        if (f.mid) return f.n > 1 ? `Vers ${a} ist noch nicht zu Ende, und du hast ${f.n === 2 ? 'einen Vers' : (f.n - 1) + ' Verse'} übersprungen.` : `Vers ${a} ist noch nicht zu Ende.`;
        return f.n === 1 ? `Du hast Vers ${a} übersprungen.` : `Du hast ${f.n} Verse übersprungen, es geht mit Vers ${a} weiter.`;
      case 'order': return `Reihenfolge vertauscht: Nach Vers ${ayahOf(f.swap)} kommt Vers ${a}.`;
      case 'words': return `In Vers ${a} fehlen noch Wörter.`;
      case 'repeat': return `Du wiederholst Vers ${ayahOf(f.vp)}. Weiter geht es mit Vers ${a}.`;
      case 'other': return `Du verwechselst das mit ${S(surahOf(f.vp)).tr}, Vers ${ayahOf(f.vp)}. Hier geht es anders weiter.`;
      default: return 'Das ist nicht der nächste Vers.';
    }
  }

  // ------------------------------------------------------------------ the teacher: what the app says while memorising
  // (Arabic inside German sentences: a mushaf word, or what the recogniser heard, each isolated for the text direction)
  const wq = g => `<span class="qw" dir="rtl">${esc(D.Q.words[g].t)}</span>`;
  const hq = s => `<span class="qh" dir="rtl">${esc(s)}</span>`;
  /** right after a failed attempt: what happened, in a few words (the other surah is named only with the hint) */
  function attemptText(f) {
    if (!f) return 'Das ist nicht der nächste Vers.';
    const a = ayahOf(f.va);
    switch (f.kind) {
      case 'other': return `Das passt nicht zu Vers ${a}.`;
      case 'unclear': return `Das habe ich nicht erkannt. Lies Vers ${a} noch einmal.`;
      default: return diagText(f);
    }
  }
  /** the gate stopped at a word, read on past it, or let it through */
  function sayText(e) {
    const a = ayahOf(D.Q.words[e.g].v);
    const again = e.from != null && e.from < e.g ? `Lies ab ${wq(e.from)} nochmal.` : `Lies Vers ${a} nochmal von vorn.`;
    switch (e.type) {
      case 'unheard': return { tone: 'warn', msg: `Das habe ich nicht ganz gehört. ${again}` };
      case 'misheard': return { tone: 'warn', msg: `Ein Wort klang anders. ${again}` };
      case 'open': return { tone: 'warn', msg: `Vers ${a} ist noch nicht vollständig. ${again}` };
      case 'missing': return { tone: 'err', msg: e.g > D.Q.verseStart[D.Q.words[e.g].v] ? `Hier lässt du ein Wort aus, nach ${wq(e.g - 1)}:` : `Am Anfang von Vers ${a} fehlt ein Wort:`, ar: D.Q.words[e.g].t };
      case 'wrong': return { tone: 'err', msg: `Du sagst ${hq(e.heard)}, richtig ist:`, ar: D.Q.words[e.g].t };
      case 'accept': return { tone: 'info', msg: `${wq(e.g)} höre ich nicht sicher. Es geht weiter.` };
      case 'where': return { tone: 'idle', msg: `Du warst bei ${wq(e.from)}. Lies weiter.` };
      default: return { tone: 'idle', msg: '' };
    }
  }
  /** help: where to start again (and what went wrong), or the next words */
  function hintText(e) {
    if (e.kind === 'runup') {
      const d = e.fail && e.fail.kind !== 'unclear' ? esc(diagText(e.fail)) + ' ' : '';
      if (!e.words.length) return { msg: d + 'Versuch es noch einmal.', ar: '' };
      return { msg: d + 'Setz hier nochmal an:', ar: e.words.map(g => D.Q.words[g].t).join(' ') };
    }
    if (e.kind === 'verse') return { msg: `Vers ${ayahOf(e.v)} mit Hilfe:`, ar: D.quran.verses[e.v] };
    const ws = e.words && e.words.length ? e.words : [e.g];
    return { msg: ws.length > 1 ? 'Die nächsten Wörter:' : 'Das nächste Wort:', ar: ws.map(g => D.Q.words[g].t).join(' ') };
  }
  /** what counts as a mistake at the chosen strictness. 0 (the default): only words left out, and words the app had to
   *  show; the recogniser is not good enough to judge more. 1: also words heard as another word. 2: every difference */
  function isIssue(st) {
    const k = Store.data.settings.strict || 0;
    if (st === ST.OK || st === ST.CORRECTED) return false;
    if (st === ST.WRONG) return k >= 1;
    if (st === ST.NEAR || st === ST.LETTER || st === ST.MADD) return k >= 2;
    return true;
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
  /** after a finished test: the next surah or page, started only when the reciter wants it */
  function nextTest(unit, v1, blind) {
    // today's reviews: the next passage not recited yet
    if (unit && unit.type === 'review') {
      const nb = Today.nextBlock();
      return nb ? { label: `Weiter: ${spanLabel(nb.a, nb.z)}`, go: () => Rec.start({ v: nb.a, endV: nb.z, mode: 'test', blind, unit: { type: 'review' } }) } : null;
    }
    if (unit && unit.type === 'learn') return null;
    if (unit && unit.type === 'page') {
      if (unit.n >= 604) return null;
      const [a, b] = pageRange(unit.n + 1);
      return { label: `Weiter mit Seite ${unit.n + 1}`, go: () => Rec.start({ v: a, endV: b, mode: 'test', blind, unit: { type: 'page', n: unit.n + 1 } }) };
    }
    const s = surahOf(v1);
    if (v1 !== S(s).start + S(s).ayahs - 1 || s >= 114) return null;
    return { label: `Weiter mit ${S(s + 1).tr}`, go: () => Rec.start({ v: S(s + 1).start, mode: 'test', blind }) };
  }
  const Summary = {
    open(sum, rec, done) {
      const real = sum.issues.filter(i => isIssue(i.st));
      const pct = sum.words ? Math.round(100 * (sum.words - real.length) / sum.words) : 0;
      const vFrom = D.Q.words[sum.from].v, vTo = D.Q.words[sum.to].v;
      const mins = Math.floor(rec.secs / 60), secs = rec.secs % 60;
      const body = el('<div></div>');
      let html = `<div class="score"><b class="num">${pct} %</b><span class="muted">${(Store.data.settings.strict || 0) ? (pct >= 98 ? 'sehr sauber gelesen' : pct >= 90 ? 'gut gelesen' : 'richtig erkannt') : 'der Wörter gehört'}</span></div>
        <p class="note" style="margin:6px 0 0">${esc(S(surahOf(vFrom)).tr)} ${ref(vFrom)} bis ${surahOf(vTo) !== surahOf(vFrom) ? esc(S(surahOf(vTo)).tr) + ' ' : ''}${ref(vTo)}, ${fmt(sum.words)} Wörter in ${mins ? mins + ' Min ' : ''}${secs} s</p>`;
      if (real.length) {
        html += `<div class="section-title">${real.length} ${real.length === 1 ? 'Stelle' : 'Stellen'} zum Anschauen</div><div id="sum-issues"></div>`;
      } else html += `<div class="panel" style="margin-top:16px">${(Store.data.settings.strict || 0) ? 'Keine Auffälligkeiten. Was die Spracherkennung gehört hat, passt zum Text.' : 'Kein Wort ausgelassen. Alle Wörter sind da.'}</div>`;
      const corr = (Store.data.settings.strict || 0) ? sum.issues.filter(i => i.st === ST.CORRECTED).length : 0;
      if (corr) html += `<p class="tiny" style="margin-top:10px">${corr} ${corr === 1 ? 'Wort hast du' : 'Wörter hast du'} selbst korrigiert.</p>`;
      const next = Rec.mode === 'test' && done && Rec.range ? nextTest(Rec.unit, Rec.range.v1, false) : null;
      html += `<div class="row" style="margin-top:18px">${real.length ? '<button class="btn grow" id="sum-again">Stellen üben</button>' : ''}<button class="btn grow" id="sum-mem">Als gelernt markieren</button></div>
        ${next ? `<button class="btn block" id="sum-next" style="margin-top:10px"><span>${esc(next.label)}</span>${ICON.right}</button>` : ''}
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
      // a test started from the dashboard goes back there
      const back = Rec.unit && (Rec.unit.type === 'review' || Rec.unit.type === 'learn');
      $('#sum-done', body).addEventListener('click', () => { sh.close(); if (back) showTab('today'); });
      $('#sum-clear', body).addEventListener('click', () => { Rec.clearMarks(); sh.close(); });
      const nx = $('#sum-next', body); if (nx) nx.addEventListener('click', () => { sh.close(); Rec.clearMarks(); next.go(); });
    },
  };

  // ------------------------------------------------------------------ blind test: no text at all, only a teacher who listens
  const Blind = {
    el: null,
    build() {
      if (this.el) return;
      const b = el(`<section class="blind" id="blind" hidden aria-label="Blindtest">
        <header class="bl-top">
          <button class="icon-btn" id="bl-close" aria-label="Blindtest beenden">${ICON.close}</button>
          <div class="bl-title"><b id="bl-name"></b><span id="bl-sub"></span></div>
          <button class="bl-mic" id="bl-mic" data-state="idle" aria-label="Pause"><span class="dot"></span><span class="pp">${ICON.play}</span></button>
        </header>
        <div class="bl-band" id="bl-band" aria-hidden="true"></div>
        <div class="bl-stage">
          <div class="bl-verse"><span class="bl-vl">Vers</span><span class="bl-rosette"><b id="bl-an" class="num"></b></span><span class="bl-of" id="bl-of"></span></div>
          <div class="bl-card" id="bl-card" data-tone="idle" role="status" aria-live="polite">
            <div class="bl-msg" id="bl-msg"></div>
            <div class="bl-ar q" id="bl-ar" dir="rtl" hidden></div>
            <div class="bl-small" id="bl-small" hidden></div>
            <div class="bl-tries" id="bl-tries" hidden></div>
          </div>
          <div class="bl-heard q" id="bl-heard" dir="rtl" aria-hidden="true"></div>
        </div>
        <footer class="bl-bar">
          <button class="btn" id="bl-hint">${ICON.bulb}<span>Nächstes Wort</span></button>
          <button class="btn" id="bl-skip">${ICON.skip}<span>Überspringen</span></button>
        </footer>
      </section>`);
      document.body.appendChild(b);
      this.el = b;
      $('#bl-close', b).addEventListener('click', () => Rec.stop('user'));
      $('#bl-hint', b).addEventListener('click', () => { if (Rec.tracker) Rec.tracker.requestHint(); });
      $('#bl-skip', b).addEventListener('click', () => { if (Rec.tracker) { Rec.tracker.skipVerse(); Rec.paint(); } });
      $('#bl-mic', b).addEventListener('click', () => { if (Rec.paused) Rec.resume(); else Rec.pause('user'); });
    },
    open() {
      this.build();
      const r = Rec.range, b = this.el;
      this.v0 = r.v0; this.v1 = r.v1; this.n = r.v1 - r.v0 + 1;
      this.st = new Uint8Array(this.n);                   // per verse: 0 open, 1 right, 2 with help, 3 not quite right
      this.cur = -1; this.tone = 'idle';
      const s1 = surahOf(this.v0), s2 = surahOf(this.v1);
      $('#bl-name', b).textContent = s1 === s2 ? S(s1).tr : `${S(s1).tr} bis ${S(s2).tr}`;
      $('#bl-sub', b).textContent = 'Blindtest, ' + (Rec.unit && Rec.unit.type === 'page' ? `Seite ${Rec.unit.n}, ` : '') + `${ref(this.v0)} bis ${s1 === s2 ? ayahOf(this.v1) : ref(this.v1)}`;
      // the band: a piece for every verse; a long passage as one bar
      const band = $('#bl-band', b);
      this.seg = this.n <= 60;
      band.className = 'bl-band' + (this.seg ? '' : ' bar');
      band.innerHTML = this.seg ? '<i></i>'.repeat(this.n) : '<i class="fill"></i><i class="mark"></i>';
      const first = ayahOf(this.v0) === 1;
      const before = !first ? 'Die Isti\'adha darfst du vorher sprechen.' : s1 === 1 ? 'Die Isti\'adha darfst du vorher sprechen. Die Basmala ist hier Vers 1.'
        : s1 === 9 ? 'Die Isti\'adha darfst du vorher sprechen. At-Tauba beginnt ohne Basmala.' : 'Isti\'adha und Basmala darfst du vorher sprechen.';
      this.set({ tone: 'idle', msg: `Lies Vers ${ayahOf(this.v0)} auswendig. Ich höre zu.`, small: before });
      b.hidden = false;
      document.documentElement.classList.add('blind-on');
      this.paused(false); this.paint(); this.update();
    },
    close() {
      if (!this.el) return;
      this.el.hidden = true;
      document.documentElement.classList.remove('blind-on');
    },
    /** the card: tone (idle, ok, warn, err, hint, info), the sentence, Arabic words, a small line */
    set({ tone, msg, ar, small }) {
      const b = this.el;
      this.tone = tone || 'idle';
      const card = $('#bl-card', b);
      card.dataset.tone = this.tone;
      $('#bl-msg', b).innerHTML = msg || '';
      const a = $('#bl-ar', b); a.hidden = !ar; a.textContent = ar || '';
      const s = $('#bl-small', b); s.hidden = !small; s.innerHTML = small || '';
      card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      this.update();
    },
    paint() {
      const t = Rec.tracker; if (!t || !this.el) return;
      const g = Math.min(t.pointer, D.Q.words.length - 1);
      const v = Math.max(this.v0, Math.min(this.v1, D.Q.words[g].v));
      const i = v - this.v0, b = this.el;
      if (i !== this.cur) {
        this.cur = i;
        $('#bl-an', b).textContent = ayahOf(v);
        $('#bl-of', b).textContent = `${i + 1} von ${this.n}`;
        const ro = $('.bl-rosette', b); ro.classList.remove('turn'); void ro.offsetWidth; ro.classList.add('turn');
      }
      const band = $('#bl-band', b);
      if (this.seg) {
        const kids = band.children;
        for (let k = 0; k < this.n; k++) { const c = ['', 'ok', 'help', 'bad'][this.st[k]] + (k === i && t.pointer <= Rec.endG ? ' cur' : ''); if (kids[k].className !== c) kids[k].className = c; }
      } else {
        let done = 0; for (let k = 0; k < this.n; k++) if (this.st[k]) done++;
        band.firstChild.style.width = (100 * done / this.n) + '%';
        band.lastChild.style.insetInlineStart = (100 * i / this.n) + '%';
      }
    },
    /** the heard words, attempts left, which buttons make sense */
    update() {
      const t = Rec.tracker; if (!t || !this.el) return;
      const b = this.el, st = Store.data.settings;
      const words = (Rec.heardText || '').split(/\s+/).filter(Boolean);
      $('#bl-heard', b).textContent = st.heard && !Rec.paused ? words.slice(-6).join(' ') : '';
      const tr = $('#bl-tries', b);
      if (t.tries > 0 && t.help.on) {
        let dots = ''; for (let k = 0; k < t.help.tries; k++) dots += `<i class="${k < t.tries ? 'used' : ''}"></i>`;
        const left = t.help.tries - t.tries;
        tr.innerHTML = `<span class="tries" aria-hidden="true">${dots}</span>noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'} bis zur Hilfe`;
        tr.hidden = false;
      } else tr.hidden = true;
      const open = Rec.active && !Rec.paused && t.pointer <= Rec.endG;
      $('#bl-hint', b).disabled = !open; $('#bl-skip', b).disabled = !open;
    },
    mic(s) { if (this.el) $('#bl-mic', this.el).dataset.state = Rec.paused ? 'paused' : s; },
    paused(on) {
      if (!this.el) return;
      const m = $('#bl-mic', this.el);
      m.dataset.state = on ? 'paused' : 'idle';
      m.setAttribute('aria-label', on ? 'Weiter' : 'Pause');
      if (on) this.set({ tone: 'info', msg: 'Pausiert.', small: 'Tippe oben rechts auf Weiter, wenn du weiterlesen willst.' });
      else if (this.tone === 'info' && $('#bl-msg', this.el).textContent === 'Pausiert.') this.set({ tone: 'idle', msg: 'Ich höre wieder zu.' });
      this.update();
    },
    verseDone(e) {
      const i = e.v - this.v0;
      if (i < 0 || i >= this.n) return;
      // at the chosen strictness: words left out (and, if wanted, words heard as another word); how a word sounded only at strict
      const hard = e.issues.filter(x => (x.st === ST.MISSED || x.st === ST.WRONG) && isIssue(x.st));
      const soft = e.issues.filter(x => (x.st === ST.NEAR || x.st === ST.LETTER || x.st === ST.MADD) && isIssue(x.st));
      this.st[i] = e.help ? 2 : hard.length ? 3 : 1;
      const a = ayahOf(e.v), next = e.v < this.v1 ? `Weiter mit Vers ${a + 1}.` : '';
      if (e.help) this.set({ tone: 'hint', msg: `Vers ${a} mit Hilfe.`, small: next });
      else if (hard.length) this.set({ tone: 'warn', msg: `Vers ${a}: ${hard.map(x => wq(x.g)).join(' ')} habe ich nicht sicher gehört.`, small: next });
      else if (soft.length) this.set({ tone: 'ok', msg: `${ICON.check} Vers ${a} richtig.`, small: `Bei ${soft.slice(0, 3).map(x => wq(x.g)).join(' ')} klang es etwas anders. ${next}` });
      else this.set({ tone: 'ok', msg: `${ICON.check} Vers ${a} richtig.`, small: next });
      this.paint();
    },
    attempt(e) {
      this.set({ tone: 'err', msg: esc(attemptText(e.fail)) });
      const card = $('#bl-card', this.el); card.classList.remove('miss'); void card.offsetWidth; card.classList.add('miss');
    },
    hint(e) {
      const T = hintText(e);
      this.set({ tone: 'hint', msg: T.msg, ar: T.ar, small: e.kind === 'verse' && e.v < this.v1 ? `Weiter mit Vers ${ayahOf(e.v) + 1}.` : '' });
    },
    say(e) {
      // after a pause in the middle of a verse: where the reciter was, unless something more important is shown
      if (e.type === 'where' && (Rec.paused || (this.tone !== 'idle' && this.tone !== 'ok') || Rec.tracker.tries)) return;
      const T = sayText(e);
      this.set({ tone: T.tone, msg: T.msg, ar: T.ar, small: T.small });
    },
    /** going on after failed attempts or a hint */
    progress() { if (this.tone === 'err') this.set({ tone: 'idle', msg: 'Gut, weiter so.' }); this.update(); },

    summary(sum, rec, done) {
      const t = Rec.tracker, n = this.n, st = this.st;
      let ok = 0, help = 0, bad = 0;
      for (let k = 0; k < n; k++) { if (st[k] === 1) ok++; else if (st[k] === 2) help++; else if (st[k] === 3) bad++; }
      const reached = ok + help + bad;
      const mins = Math.floor(rec.secs / 60), secs = rec.secs % 60;
      // per verse: what was not quite right (words shown, not heard, heard as another word, sounding different)
      const byVerse = new Map();
      for (const it of sum.issues) {
        if (!isIssue(it.st)) continue;
        const v = D.Q.words[it.g].v;
        if (v < this.v0 || v > this.v1) continue;
        if (!byVerse.has(v)) byVerse.set(v, []);
        byVerse.get(v).push(it);
      }
      const verseRow = (v, list) => {
        const hint = list.filter(i => i.st === ST.HINT), miss = list.filter(i => i.st === ST.MISSED), wrong = list.filter(i => i.st === ST.WRONG);
        const soft = list.filter(i => i.st === ST.NEAR || i.st === ST.LETTER || i.st === ST.MADD);
        const len = D.Q.verseStart[v + 1] - D.Q.verseStart[v];
        const parts = [];
        if (hint.length) parts.push(hint.length === len ? 'übersprungen, mit Hilfe' : hint.length === 1 ? '1 Wort mit Hilfe' : `${hint.length} Wörter mit Hilfe`);
        if (miss.length) parts.push(`${miss.length === 1 ? '1 Wort' : miss.length + ' Wörter'} nicht gehört`);
        if (wrong.length) parts.push(`statt ${wrong.slice(0, 2).map(i => '„' + (i.heard || '?') + '“').join(', ')} gehört`);
        if (soft.length) parts.push(`${soft.length === 1 ? '1 Wort klang' : soft.length + ' Wörter klangen'} anders`);
        const worst = wrong.length ? ST.WRONG : miss.length ? ST.MISSED : hint.length ? ST.HINT : soft[0].st;
        const w = (wrong[0] || miss[0] || soft[0] || hint[0]).g;
        return `<button class="issue" data-g="${w}"><span class="tag t${worst}"></span><span class="iw">${esc(D.Q.words[w].t)}</span><span class="it"><b>Vers ${ayahOf(v)}</b><span>${esc(parts.join(', '))}</span></span><span class="tiny">${ref(v)}</span></button>`;
      };
      const body = el('<div></div>');
      const parts = [];
      if (help) parts.push(`${help} mit Hilfe`);
      if (bad) parts.push(`${bad} mit unsicheren Wörtern`);
      if (reached < n) parts.push(`${n - reached} nicht erreicht`);
      let html = `<div class="score"><b class="num">${ok === n ? n : ok}</b><span class="muted">${ok === n ? (n === 1 ? 'Vers, fehlerfrei und ohne Hilfe' : 'Verse, alle fehlerfrei und ohne Hilfe') : `von ${n} ${n === 1 ? 'Vers' : 'Versen'} fehlerfrei und ohne Hilfe`}</span></div>
        <p class="note" style="margin:6px 0 0">${parts.length ? parts.join(', ') + '. ' : ''}${mins ? mins + ' Min ' : ''}${secs} s</p>
        <div class="bl-chips" id="bs-chips">`;
      for (let k = 0; k < n; k++) html += `<button class="bl-chip ${['open', 'ok', 'help', 'bad'][st[k]]}" data-v="${this.v0 + k}" aria-label="Vers ${ayahOf(this.v0 + k)}: ${['nicht erreicht', 'richtig', 'mit Hilfe', 'unsicher'][st[k]]}">${ayahOf(this.v0 + k)}</button>`;
      html += '</div>';
      if (byVerse.size) html += `<div class="section-title">${byVerse.size} ${byVerse.size === 1 ? 'Vers' : 'Verse'} zum Anschauen</div><div id="bs-issues"></div>`;
      // continue only when the reciter wants to: the next surah or page
      const unit = Rec.unit, nt = done ? nextTest(unit, this.v1, true) : null;
      const nextLabel = nt ? nt.label : '', nextGo = nt ? nt.go : null;
      html += `<div class="row" style="margin-top:18px"><button class="btn grow" id="bs-again">Nochmal</button>${ok === n ? '<button class="btn grow" id="bs-mem">Als gelernt markieren</button>' : ''}</div>
        ${nextGo ? `<button class="btn block" id="bs-next" style="margin-top:10px"><span>${esc(nextLabel)}</span>${ICON.right}</button>` : ''}
        <button class="btn primary block" id="bs-done" style="margin-top:10px">Fertig</button>
        <p class="tiny" style="margin-top:12px">Die Spracherkennung prüft, welche Wörter sie hört. Harakat und Tajweed kann sie nicht sicher beurteilen.</p>`;
      body.innerHTML = html;
      const list = $('#bs-issues', body);
      if (list) {
        let ih = '';
        for (const [v, l] of byVerse) ih += verseRow(v, l);
        list.innerHTML = ih;
        list.addEventListener('click', e => { const x = e.target.closest('[data-g]'); if (x) { sh.close(); showTab('read'); Reader.open(D.Q.words[+x.dataset.g].v, { g: +x.dataset.g, flash: true, block: 'center' }); } });
      }
      $('#bs-chips', body).addEventListener('click', e => { const x = e.target.closest('[data-v]'); if (x) { sh.close(); showTab('read'); Reader.open(+x.dataset.v, { flash: true, block: 'center' }); } });
      const sh = openSheet({ title: done ? 'Blindtest geschafft' : 'Blindtest beendet', body });
      const range = { v: this.v0, endV: this.v1, unit };
      $('#bs-again', body).addEventListener('click', () => { sh.close(); Rec.start({ v: range.v, endV: range.endV, mode: 'test', blind: true, unit: range.unit }); });
      const nx = $('#bs-next', body); if (nx) nx.addEventListener('click', () => { sh.close(); nextGo(); });
      const mem = $('#bs-mem', body);
      if (mem) mem.addEventListener('click', () => { const vs = []; for (let v = range.v; v <= range.endV; v++) vs.push(v); Hifz.setVerses(vs, true); mem.disabled = true; mem.textContent = `${vs.length} ${vs.length === 1 ? 'Vers' : 'Verse'} markiert`; });
      $('#bs-done', body).addEventListener('click', () => sh.close());
      void t;
    },
  };

  /** choosing what to recite blind: a surah (the learnt ones first) or a page */
  const BlindPick = {
    open(mode) {
      const body = el(`<div class="picker">
        <div class="pk-head">
          <div class="seg" role="group" aria-label="Was aufsagen?"><button data-m="s" aria-pressed="true">Sure</button><button data-m="p" aria-pressed="false">Seite</button></div>
          <label class="pk-search" id="bp-search">${ICON.search}<input id="bp-q" type="search" placeholder="Name oder Nummer" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        </div>
        <div id="bp-list" class="list"></div></div>`);
      const sh = openSheet({ title: 'Blindtest', body, full: true });
      const list = $('#bp-list', body), q = $('#bp-q', body);
      let m = mode || 's';
      const row = n => {
        const su = S(n), k = surahMem(su);
        return `<button class="pk-row" data-s="${n}"><span class="sbadge${k === su.ayahs ? ' on' : ''}"><b>${n}</b></span>
          <span class="main"><span class="a">${esc(su.tr)}</span><span class="b">${k ? `${k} von ${su.ayahs} Versen gelernt` : `${su.ayahs} Verse`}</span>${k ? `<span class="pk-mem"><i style="width:${Math.round(100 * k / su.ayahs)}%"></i></span>` : ''}</span>
          <span class="ar">${esc(su.ar)}</span></button>`;
      };
      const draw = () => {
        $$('.seg button', body).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.m === m)));
        $('#bp-search', body).hidden = m !== 's';
        if (m === 's') {
          const term = q.value.trim();
          if (term) { list.innerHTML = findSurahs(term).map(row).join('') || '<div class="empty">Keine Sure gefunden.</div>'; return; }
          const learnt = [], rest = [];
          for (const su of D.quran.surahs) (surahMem(su) ? learnt : rest).push(su.n);
          list.innerHTML = (learnt.length ? `<div class="section-title" style="margin-top:6px">Deine Suren</div>${learnt.map(row).join('')}<div class="section-title">Alle anderen</div>` : '') + rest.map(row).join('');
        } else {
          const cur = D.pageOf[(Store.data.pos && Store.data.pos.v) || 0] || 1;
          list.innerHTML = `<div class="pk-page">
            <div class="pk-page-num"><button class="icon-btn" data-step="-1" aria-label="Seite zurück">${ICON.left}</button><output id="bp-p" class="num">${cur}</output><button class="icon-btn" data-step="1" aria-label="Seite vor">${ICON.right}</button></div>
            <input type="range" id="bp-range" min="1" max="604" value="${cur}" aria-label="Seite wählen">
            <p class="note" id="bp-info" style="text-align:center;margin:6px 0 14px"></p>
            <button class="btn primary block" id="bp-go">${ICON.ear}<span></span></button></div>`;
          const rng = $('#bp-range', list), out = $('#bp-p', list);
          const upd = () => { const p = +rng.value; out.textContent = p; const [a, b] = pageRange(p); $('#bp-info', list).textContent = `${S(surahOf(a)).tr} ${ref(a)} bis ${surahOf(b) !== surahOf(a) ? S(surahOf(b)).tr + ' ' : ''}${ref(b)}`; $('#bp-go span', list).textContent = `Seite ${p} blind aufsagen`; };
          rng.addEventListener('input', upd);
          $$('[data-step]', list).forEach(bt => bt.addEventListener('click', () => { rng.value = Math.max(1, Math.min(604, +rng.value + +bt.dataset.step)); upd(); }));
          $('#bp-go', list).addEventListener('click', () => { const p = +rng.value, [a, b] = pageRange(p); sh.close(); Rec.start({ v: a, endV: b, mode: 'test', blind: true, unit: { type: 'page', n: p } }); });
          upd();
        }
      };
      $$('.seg button', body).forEach(b => b.addEventListener('click', () => { m = b.dataset.m; draw(); }));
      q.addEventListener('input', draw);
      list.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; const su = S(+b.dataset.s); sh.close(); Rec.start({ v: su.start, mode: 'test', blind: true }); });
      draw();
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
        model: ['Erkennung auf dem Handy startet nicht', 'Das Modell ließ sich nicht laden. Beim ersten Mal braucht es eine Verbindung (etwa 90 MB, am besten im WLAN). Versuche es noch einmal, oder nimm wieder die Erkennung des Browsers.'],
        'unsupported-model': ['Erkennung auf dem Handy geht hier nicht', 'Dieser Browser kann das Modell nicht ausführen. Nimm die Erkennung des Browsers, oder öffne MyHifz in einem aktuellen Chrome oder Safari.'],
      }[code] || ['Spracherkennung gestoppt', 'Bitte starte die Rezitation erneut.'];
      const back = code === 'model' || code === 'unsupported-model';
      const body = el(`<div><p class="note">${esc(T[1])}</p>${back ? '<div class="row" style="margin-top:14px"><button class="btn grow" id="se-web">Erkennung des Browsers nehmen</button></div>' : ''}</div>`);
      const sh = openSheet({ title: T[0], body });
      if (back) $('#se-web', body).addEventListener('click', () => { Store.data.settings.engine = 'web'; Store.save(); sh.close(); toast('Die Erkennung des Browsers ist eingestellt.'); });
    },
  };

  // ------------------------------------------------------------------ hifz
  // What to recite again and when is decided by the plan (hifzplan.js, below: Plan); a page is reviewed as the verses of
  // it that are memorised.
  const Hifz = {
    seg: 's',
    pageStats(p) { const [a, b] = pageRange(p); let m = 0; for (let v = a; v <= b; v++) m += memHas(v); return { m, n: b - a + 1, a, b }; },
    /** mark verses as memorised or not. Newly memorised verses are learnt today (they count for the week and come
     *  again tomorrow); opts.old: known from before (no day, they come into the reviews one after another; verses
     *  marked as learnt by mistake become known from before) */
    setVerses(vs, on, opts) {
      const old = !!(opts && opts.old), d = today(), md = Store.data.md, plan = Plan.cur();
      const learnt = new Set();
      for (const v of vs) {
        const was = !!memHas(v);
        memSet(v, on); Reader.updateMem(v);
        if (!on || old) delete md[v];
        else if (!was) { md[v] = d; learnt.add(D.pageOf[v]); }
      }
      memStore();
      for (const p of learnt) Store.data.pages[p] = PL.learnt(Store.data.pages[p], d, plan);
      Plan.ensure();
      Store.save();
      updateBadge();
      if (App.tab === 'hifz') this.render();
      if (App.tab === 'today') Today.render();
    },
    /** pages still to recite today */
    due() { return Plan.openPages().map(p => ({ p })); },
    /** page p recited with quality 0..1 (share of its words there, or the learner's own rating) */
    review(p, quality) { Plan.review(p, quality); Store.save(); updateBadge(); },
    /** after a test: every page whose memorised verses were recited (most of them) counts as reviewed, with the share of
     *  their words that were there */
    reviewFromSession(t, sum) {
      if (sum.from < 0) return;
      const vA = D.Q.words[sum.from].v, vB = D.Q.words[sum.to].v;
      const done = [];
      for (let p = D.pageOf[vA]; p <= D.pageOf[vB]; p++) {
        const [a, b] = pageRange(p);
        let all = 0, said = 0, ok = 0;
        for (let v = a; v <= b; v++) {
          if (!memHas(v)) continue;
          const ga = D.Q.verseStart[v], gb = D.Q.verseStart[v + 1];
          all += gb - ga;
          for (let g = Math.max(ga, sum.from); g < Math.min(gb, sum.to + 1); g++) { said++; if (!isIssue(t.status[g])) ok++; }
        }
        if (!all || said < 0.6 * all) continue;       // the memorised part of the page not recited
        this.review(p, ok / said); done.push(p);
      }
      if (done.length) toast(done.length === 1 ? `Seite ${done[0]} als wiederholt eingetragen` : `${done.length} Seiten als wiederholt eingetragen`);
      if (App.tab === 'today') Today.render();
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
      html += `<button class="bl-entry" id="h-blind"><span class="ic">${ICON.ear}</span><span class="txt"><b>Blindtest</b><span>Ganz ohne Text aufsagen. Die App hört zu und sagt dir nach jedem Vers, ob er stimmt.</span></span>${ICON.right}</button>`;
      // what is due today is on the dashboard (Heute); here only the way there
      const plan = Plan.get();
      html += `<button class="vs-due h-today" data-today><span class="txt"><b>${due.length ? `Heute ${due.length} ${due.length === 1 ? 'Seite' : 'Seiten'} wiederholen` : st.verses ? 'Heute ist nichts mehr zu wiederholen' : 'Noch nichts eingetragen'}</b><span>${plan ? `${esc(MODEL[plan.model].name)} · ${num1(plan.weekly)} ${plan.weekly === 1 ? 'Seite' : 'Seiten'} pro Woche` : 'Lernplan einrichten: Wochenziel und Lernmodell'}</span></span>${ICON.right}</button>`;
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
        if (t.closest('#h-blind')) return BlindPick.open();
        if (t.closest('[data-today]')) { showTab('today'); if (!Store.data.plan) PlanSetup.open(); return; }
        const tile = t.closest('.tile[data-page]'); if (tile) return this.pageSheet(+tile.dataset.page);
        const su = t.closest('[data-surah]'); if (su) return this.surahSheet(+su.dataset.surah);
      };
      void pct;
    },
    chipsSheet({ title, verses, label, extra }) {
      const body = el('<div></div>');
      const count = () => verses.reduce((s, v) => s + memHas(v), 0);
      // what is marked now: learnt now (counts for the week, comes again tomorrow) or known from before
      let kind = 'new';
      const kindDesc = { new: 'Neu gelernt: zählt für dein Wochenziel und kommt schon morgen zur Wiederholung.', old: 'Kann ich schon länger: zählt nicht fürs Wochenziel; die Seiten kommen nach und nach in die Wiederholung.' };
      body.innerHTML = `<div class="seg cs-kind" id="cs-kind" role="group" aria-label="Was du markierst"><button data-k="new" aria-pressed="true">Neu gelernt</button><button data-k="old" aria-pressed="false">Kann ich schon länger</button></div>
        <p class="tiny" id="cs-kind-d" style="margin:6px 0 10px">${kindDesc.new}</p>
        <p class="note" id="cs-count"></p>
        <div class="row" style="margin:10px 0"><button class="btn small" id="cs-all">Alle markieren</button><button class="btn small" id="cs-none">Keine</button><button class="btn small" id="cs-range" aria-pressed="false">Bereich wählen</button></div>
        <p class="tiny" id="cs-hint" hidden>Tippe auf den ersten und den letzten Vers des Bereichs.</p>
        <div class="chips" id="cs-chips"></div>
        <div class="row cs-go" style="margin-top:16px"><button class="btn grow" id="cs-read">${ICON.read}<span>Lesen</span></button><button class="btn grow" id="cs-test">${ICON.eyeOff}<span>Prüfen</span></button><button class="btn primary grow" id="cs-blind">${ICON.ear}<span>Blindtest</span></button></div>
        <p class="tiny" style="margin:8px 0 0">Prüfen: Der Text ist verdeckt und erscheint, während du liest. Blindtest: ganz ohne Text, die App sagt dir nach jedem Vers, ob er stimmt.</p>
        ${extra || ''}`;
      const sh = openSheet({ title, body });
      const chips = $('#cs-chips', body);
      const draw = () => {
        chips.innerHTML = verses.map(v => `<button class="vchip" data-v="${v}" aria-pressed="${!!memHas(v)}">${label(v)}</button>`).join('');
        $('#cs-count', body).textContent = `${count()} von ${verses.length} Versen auswendig. Tippe auf einen Vers, um ihn zu markieren.`;
      };
      let rangeMode = false, rangeStart = null;
      const opts = () => ({ old: kind === 'old' });
      $('#cs-kind', body).addEventListener('click', e => {
        const k = e.target.closest('[data-k]'); if (!k) return;
        kind = k.dataset.k;
        $$('#cs-kind button', body).forEach(x => x.setAttribute('aria-pressed', String(x === k)));
        $('#cs-kind-d', body).textContent = kindDesc[kind];
      });
      chips.addEventListener('click', e => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        const v = +b.dataset.v;
        if (rangeMode) {
          if (rangeStart == null) { rangeStart = v; b.style.outline = '2px solid var(--cobalt)'; return; }
          const a = Math.min(rangeStart, v), z = Math.max(rangeStart, v);
          const on = !memHas(rangeStart);
          Hifz.setVerses(verses.filter(x => x >= a && x <= z), on, opts());
          rangeStart = null; rangeMode = false; $('#cs-range', body).setAttribute('aria-pressed', 'false'); $('#cs-hint', body).hidden = true;
        } else Hifz.setVerses([v], !memHas(v), opts());
        draw();
      });
      $('#cs-all', body).addEventListener('click', () => { Hifz.setVerses(verses, true, opts()); draw(); });
      $('#cs-none', body).addEventListener('click', () => { Hifz.setVerses(verses, false); draw(); });
      $('#cs-range', body).addEventListener('click', e => { rangeMode = !rangeMode; rangeStart = null; e.currentTarget.setAttribute('aria-pressed', String(rangeMode)); $('#cs-hint', body).hidden = !rangeMode; draw(); });
      $('#cs-read', body).addEventListener('click', () => { sh.close(); Reader.open(verses[0]); });
      $('#cs-test', body).addEventListener('click', () => { sh.close(); Rec.start({ v: verses[0], endV: verses[verses.length - 1], mode: 'test' }); });
      $('#cs-blind', body).addEventListener('click', () => { sh.close(); Rec.start({ v: verses[0], endV: verses[verses.length - 1], mode: 'test', blind: true }); });
      draw();
      return { sh, body };
    },
    pageSheet(p) {
      const [a, b] = pageRange(p); const vs = []; for (let v = a; v <= b; v++) vs.push(v);
      const extra = this.pageStats(p).m ? `<div class="panel" style="margin-top:14px"><p class="note" style="margin:0">${esc(Plan.pageText(p))}</p><button class="btn small" id="ps-done" style="margin-top:10px">${ICON.check}<span>Heute wiederholt</span></button></div>` : '';
      const { sh, body } = this.chipsSheet({ title: `Seite ${p}`, verses: vs, label: v => ref(v), extra });
      const done = $('#ps-done', body);
      if (done) done.addEventListener('click', () => {
        const m = vs.filter(v => memHas(v));
        sh.close();
        if (m.length) RateSheet.open({ a: m[0], z: m[m.length - 1], pages: [p] });
      });
      for (const id of ['#cs-test', '#cs-blind']) { const t = $(id, body); t.replaceWith(t.cloneNode(true)); }
      $('#cs-test', body).addEventListener('click', () => { sh.close(); Rec.start({ v: a, endV: b, mode: 'test', unit: { type: 'page', n: p } }); });
      $('#cs-blind', body).addEventListener('click', () => { sh.close(); Rec.start({ v: a, endV: b, mode: 'test', blind: true, unit: { type: 'page', n: p } }); });
    },
    surahSheet(n) {
      const s = S(n); const vs = []; for (let v = s.start; v < s.start + s.ayahs; v++) vs.push(v);
      const { sh, body } = this.chipsSheet({ title: `${s.tr}, ${s.de}`, verses: vs, label: v => ayahOf(v), extra: `<button class="btn ghost block" id="cs-words" style="margin-top:8px">${ICON.words}<span>Die Wörter dieser Sure lernen</span></button>` });
      $('#cs-words', body).addEventListener('click', () => { sh.close(); Words.openSurah(n); });
    },
  };
  function updateBadge() {
    const b = $('#due-badge'); if (!b || !D.quran) return;
    const n = Hifz.due().length;
    b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n);
  }

  // ------------------------------------------------------------------ the plan: what to learn this week and today, what to recite again
  // The order of learning, the portion of a day, the week and the three models of reviewing are in hifzplan.js
  // (QuranPlan, with tests); here they meet what is stored, and the dashboard (Heute) shows them.
  const PL = window.QuranPlan;
  const MODEL = {
    ssm: { name: 'Sabaq · Sabqi · Manzil', short: 'Das Neue jeden Tag, alles andere in einer festen Runde. So arbeiten die Hifz-Schulen.' },
    fsrs: { name: 'Anpassend (FSRS)', short: 'Jede Seite dann, wenn sie zu verblassen droht. Spart Zeit; spätestens nach 30 Tagen kommt jede Seite wieder.' },
    leitner: { name: 'Feste Stufen', short: 'Jede Seite nach 1, 3, 7, 14 und 30 Tagen. Mit Fehlern bleibt die Stufe, vergessen beginnt von vorn.' },
  };
  const ORDER = {
    back: ['Von hinten', 'Sure für Sure vom Ende her: An-Nas, Al-Falaq, Al-Ikhlas … jede vom ersten Vers an.'],
    juz: ['Juz von hinten', 'Juz für Juz vom Ende her: Juz 30, dann Juz 29 ab Al-Mulk, Juz 28 … jeder in der Reihenfolge des Mushaf.'],
    front: ['Von vorne', 'In der Reihenfolge des Mushaf: Al-Fatiha, Al-Baqara, Al-ʿImran …'],
  };
  const SEC = { recent: 'Neu', weak: 'Festigen', manzil: 'Manzil', due: '' };
  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const WEEKLY = [0.5, 1, 1.5, 2, 3, 4, 5, 7, 10, 14, 20];
  /** pages as a number: one decimal below ten ("1,4"), whole numbers above */
  const num1 = x => String(x < 10 ? (x > 0 && x < 0.05 ? 0.1 : Math.round(x * 10) / 10) : Math.round(x)).replace('.', ',');
  const pagesWord = x => (Math.abs(x - 1) < 0.05 ? 'Seite' : 'Seiten');
  /** the size of a portion: lines below a page ("etwa 7 Zeilen"), else pages */
  function sizeText(x) {
    if (x < 0.95) { const l = Math.max(1, Math.round(x * 15)); return `etwa ${l} ${l === 1 ? 'Zeile' : 'Zeilen'}`; }
    return `${num1(x)} ${pagesWord(x)}`;
  }
  /** verses a..z in words: "Al-Mulk 1–15", "Al-Mulk", "An-Nabaʾ 1 – An-Naziʿat 46", "Al-Ikhlas – An-Nas" */
  function spanLabel(a, z) {
    const sa = surahOf(a), sz = surahOf(z), end = s => S(s).start + S(s).ayahs - 1;
    if (sa === sz) return a === S(sa).start && z === end(sa) ? S(sa).tr : `${S(sa).tr} ${ayahOf(a)}${a === z ? '' : '–' + ayahOf(z)}`;
    if (a === S(sa).start && z === end(sz)) return `${S(sa).tr} – ${S(sz).tr}`;
    return `${S(sa).tr} ${ayahOf(a)} – ${S(sz).tr} ${ayahOf(z)}`;
  }
  const runsLabel = runs => runs.map(r => spanLabel(r[0], r[1])).join(' · ');
  const pagesLabel = ps => ps.length === 1 ? `Seite ${ps[0]}` : `Seite ${ps[0]}–${ps[ps.length - 1]}`;
  /** "in etwa 3 Wochen", "in etwa 4 Monaten", "in etwa 2,5 Jahren" */
  function inWeeks(w) {
    if (w <= 1.25) return 'in etwa einer Woche';
    if (w < 10) return `in etwa ${Math.round(w)} Wochen`;
    if (w < 78) return `in etwa ${Math.round(w / 4.35)} Monaten`;
    return `in etwa ${String(Math.round(w / 5.2) / 10).replace('.', ',')} Jahren`;
  }

  const Plan = {
    _b: null,
    /** verses, pages and sizes of the mushaf, for the plan */
    b() { return this._b || (this._b = PL.book({ verseStart: D.Q.verseStart, pages: D.quran.pages, juz: D.quran.juz, surahs: D.quran.surahs })); },
    /** the plan the learner made, or null */
    get() { return Store.data.plan ? PL.normalize(Store.data.plan) : null; },
    /** the model in use; without a plan the fixed steps, as in earlier versions */
    cur() { return PL.normalize(Store.data.plan || { model: 'leitner' }); },
    /** every page with memorised verses has a record the model can work with (true: something changed) */
    ensure() {
      if (!Store.data.md) Store.data.md = {};
      if (!Store.data.pst) Store.data.pst = {};
      return PL.ensure(this.b(), memHas, Store.data.pages, this.cur(), today());
    },
    /** today's list of pages to recite again: made once a day (again: anew, after the plan was changed) */
    today(again) {
      this.ensure();
      const t = PL.today({ b: this.b(), has: memHas, pages: Store.data.pages, md: Store.data.md, plan: this.cur(), day: today(), state: Store.data.pst, again: !!again });
      if (t === Store.data.pst.today) Store.save();
      return t;
    },
    blocks(t) { return PL.blocks(this.b(), memHas, (t || this.today()).items); },
    done(p) { const r = Store.data.pages[p]; return !!r && r.t === today(); },
    openPages() { return this.today().items.map(x => x[0]).filter(p => !this.done(p)); },
    review(p, q) { Store.data.pages[p] = PL.review(Store.data.pages[p], q, today(), this.cur(), 'p' + p); },
    week() { const p = this.get(); return p ? PL.week(this.b(), Store.data.md, p, today()) : null; },
    portion(target) { const p = this.get() || this.cur(); return PL.nextPortion(this.b(), memHas, p.order, p.from, target); },
    /** the verses learnt today, as runs */
    learntToday() {
      const d = today(), vs = [];
      for (const k in Store.data.md) if (Store.data.md[k] === d && memHas(+k)) vs.push(+k);
      return PL.runs(vs.sort((a, b) => a - b));
    },
    isRecent(p) {
      const d = today(), w = this.cur().recent, [a, b] = pageRange(p);
      for (let v = a; v <= b; v++) { const x = Store.data.md[v]; if (x != null && x >= d - w && memHas(v)) return true; }
      return false;
    },
    /** what the record of page p says, in words */
    pageText(p) {
      const r = Store.data.pages[p], d = today(), plan = this.cur();
      const last = r && r.t != null ? `Zuletzt wiederholt ${r.t === d ? 'heute' : r.t === d - 1 ? 'gestern' : `vor ${d - r.t} Tagen`}${r.q != null ? ` (${r.q} %)` : ''}.` : 'Noch nicht wiederholt.';
      let next;
      if (this.today().items.some(x => x[0] === p) && !this.done(p)) next = 'Heute dran.';
      else if (plan.model === 'ssm') next = r && r.w ? 'Sitzt noch nicht sicher: kommt jeden Tag, bis sie wieder sitzt.' : this.isRecent(p) ? 'Neu gelernt: kommt jeden Tag.' : 'Kommt in der Manzil-Runde wieder.';
      else next = r && r.r != null ? `Nächste Wiederholung ${inDays(r.r + (r.i || 1) - d)}.` : '';
      return `${last} ${next}`.trim();
    },
    /** seconds a word takes this learner (from the recitations so far) */
    secsPerWord() {
      let w = 0, s = 0;
      for (const x of Store.data.sessions || []) if (x.words >= 30 && x.secs > 0) { w += x.words; s += x.secs; }
      return w >= 200 ? Math.min(2.5, Math.max(0.4, s / w)) : 1.2;
    },
    minutes(blocks) { let w = 0; for (const bl of blocks) w += D.Q.verseStart[bl.z + 1] - D.Q.verseStart[bl.a]; return Math.max(1, Math.round(w * this.secsPerWord() / 60)); },
  };

  /** the dashboard: the week's goal and today's portion, the pages to recite again, the words due, what is left */
  const Today = {
    undo: null, more: false, por: null, bl: [],
    render() {
      const v = $('#v-today');
      if (!v || !D.quran) return;
      const plan = Plan.get(), t = Plan.today();
      this.bl = Plan.blocks(t);
      const date = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
      v.innerHTML = `<header class="topbar"><div class="td-title"><h1>Heute</h1><span>${esc(date)}</span></div><button class="icon-btn" data-settings aria-label="Einstellungen">${ICON.gear}</button></header>
        ${plan ? this.weekHTML(plan, t) : this.setupHTML()}
        ${this.reviewHTML(t, plan)}
        ${this.wordsHTML()}
        ${plan ? this.restHTML(plan) : ''}
        <div class="td-foot">
          <button class="ps-row" data-plan><span class="txt"><small>Lernplan</small><b>${plan ? esc(MODEL[plan.model].name) : 'Noch nicht eingerichtet'}</b>${plan ? `<span>${num1(plan.weekly)} ${pagesWord(plan.weekly)} pro Woche · ${esc(ORDER[plan.order][0])}</span>` : ''}</span>${ICON.right}</button>
          <button class="btn ghost" data-why>${ICON.bulb}<span>Was die Forschung sagt</span></button>
        </div>`;
      v.onclick = e => this.click(e);
    },
    setupHTML() {
      return `<section class="td-card td-setup"><div class="td-k">Dein Lernplan</div>
        <p class="note">Leg fest, wie viel du pro Woche neu lernen willst und nach welchem Modell du wiederholst. Dann steht hier jeden Tag, was dran ist: das Neue und die Wiederholung.</p>
        <button class="btn primary block" data-plan>Lernplan einrichten</button></section>`;
    },
    weekHTML(plan, t) {
      const w = Plan.week(), wd = PL.weekday(today());
      const pct = Math.min(100, Math.round(100 * w.done / Math.max(0.01, w.goal)));
      let days = '';
      for (let k = 0; k < 7; k++) {
        const got = w.per[k];
        const cls = ['td-day', plan.days[k] ? 'on' : 'off', got > 0 ? (got >= 0.9 * w.usual ? 'full' : 'part') : '', k === wd ? 'now' : ''].filter(Boolean).join(' ');
        days += `<span class="${cls}"><i></i>${WEEKDAYS[k]}</span>`;
      }
      let nw;
      if (PL.open(Plan.b(), memHas, 0, TOTAL_VERSES - 1) < 1e-9) nw = '<p class="td-msg">Der ganze Koran ist eingetragen. Masha’Allah!</p>';
      else if (w.left > 0.03 || this.more) {
        const por = this.por = Plan.portion(w.left > 0.03 ? w.left : w.usual);
        nw = `<div class="td-k">Heute neu</div>
          <div class="td-portion">${esc(runsLabel(por.runs))}</div>
          <div class="td-sub">${sizeText(por.size)} · ${pagesLabel([...new Set(por.verses.map(x => D.pageOf[x]))])}</div>
          <div class="row td-acts"><button class="btn primary grow" data-learn>Lernen</button><button class="btn grow" data-learnt>${ICON.check}<span>Gelernt</span></button></div>`;
      } else {
        const done = Plan.learntToday(), rest = Math.max(0, w.goal - w.done);
        const msg = w.reached ? 'Wochenziel erreicht. Alhamdulillah!'
          : !w.learnDay ? (w.daysLeft ? `Heute ist kein Lerntag. Diese Woche noch ${sizeText(rest)}.` : `Heute ist kein Lerntag. Diese Woche fehlen noch ${sizeText(rest)}; am Montag beginnt eine neue.`)
            : 'Für heute geschafft.';
        nw = `<p class="td-msg">${esc(msg)}</p>${done.length ? `<p class="td-sub">Heute gelernt: ${esc(runsLabel(done))}</p>` : ''}
          <button class="btn ghost td-more" data-more>${w.learnDay || w.reached ? 'Trotzdem weiterlernen' : 'Trotzdem lernen'}</button>`;
      }
      if (this.undo && this.undo.d === today()) nw += `<p class="td-undo">Eingetragen: ${esc(this.undo.label)}. <button data-undo>Rückgängig</button></p>`;
      const weak = plan.model === 'ssm' ? t.items.filter(x => x[1] === 'weak').length : 0;
      if (weak >= 3) nw += `<p class="td-warn">${weak} Seiten sitzen nicht sicher. Ein Lehrer würde jetzt erst festigen und dann weiterlernen.</p>`;
      return `<section class="td-card">
          <div class="td-k">Diese Woche</div>
          <div class="td-goal"><b class="num">${num1(w.done)}</b><span>von ${num1(w.goal)} ${pagesWord(w.goal)} neu gelernt</span></div>
          <div class="progress-line td-bar" role="progressbar" aria-label="Wochenziel" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
          <div class="td-days">${days}</div>
          <div class="td-new">${nw}</div>
        </section>`;
    },
    reviewHTML(t, plan) {
      const bl = this.bl, ssm = (plan || Plan.cur()).model === 'ssm';
      const open = bl.filter(b => !b.pages.every(p => Plan.done(p)));
      const left = new Set(); for (const b of open) for (const p of b.pages) if (!Plan.done(p)) left.add(p);
      let html = `<div class="section-title">Wiederholen <small>${bl.length ? (open.length ? `${left.size} ${left.size === 1 ? 'Seite' : 'Seiten'} · etwa ${Plan.minutes(open)} Min.` : 'alles geschafft') : ''}</small></div>`;
      if (!bl.length) {
        let any = false; for (let x = 0; x < TOTAL_VERSES && !any; x++) any = !!memHas(x);
        return html + `<div class="panel note">${any ? 'Heute ist nichts zu wiederholen.' : 'Sobald du gelernte Verse einträgst, steht hier jeden Tag, was du wiederholst.'}</div>`;
      }
      html += '<div class="td-list">';
      bl.forEach((b, i) => {
        const done = b.pages.every(p => Plan.done(p));
        const tag = ssm && SEC[b.sec] ? `<i class="td-tag ${b.sec}">${SEC[b.sec]}</i> · ` : '';
        html += `<div class="td-row${done ? ' done' : ''}">
          <span class="main"><span class="a">${esc(spanLabel(b.a, b.z))}</span><span class="b">${tag}${pagesLabel(b.pages)}</span></span>
          ${done ? '' : `<button class="btn small" data-test="${i}">${ICON.eyeOff}<span>Prüfen</span></button>`}
          <button class="td-ok" data-ok="${i}" aria-pressed="${done}" aria-label="${done ? 'Wiederholt' : 'Als wiederholt eintragen'}">${ICON.check}</button></div>`;
      });
      html += '</div>';
      const notes = [];
      if (t.more) notes.push(`Dazu ${t.more} weitere fällige ${t.more === 1 ? 'Seite' : 'Seiten'}; sie kommen an den nächsten Tagen dran.`);
      if (ssm && t.roundOf) notes.push(`Manzil: Runde ${t.round}, ${t.roundDone} von ${t.roundOf} Seiten.`);
      if (notes.length) html += `<p class="tiny td-note">${notes.join(' ')}</p>`;
      return html;
    },
    wordsHTML() {
      const d = today();
      let n = 0;
      for (const id in Store.data.vocab) { const c = Store.data.vocab[id]; if (c && c.due <= d) n++; }
      return n ? `<button class="vs-due td-words" data-words><span class="txt"><b>${n} ${n === 1 ? 'Wort' : 'Wörter'} wiederholen</b><span>Koran-Wortschatz, jedes Wort in einem Vers seiner Sure</span></span>${ICON.right}</button>` : '';
    },
    restHTML(plan) {
      const b = Plan.b(), next = Plan.portion(0.001).verses[0];
      if (next == null) return '';
      const s = surahOf(next), j = D.juzOf[next], [ja, jb] = juzRange(j);
      const rs = PL.open(b, memHas, S(s).start, S(s).start + S(s).ayahs - 1), rj = PL.open(b, memHas, ja, jb), rq = PL.open(b, memHas, 0, TOTAL_VERSES - 1);
      const wk = x => inWeeks(x / plan.weekly);
      return `<div class="section-title">Noch vor dir</div>
        <div class="stats td-rest">
          <div class="stat"><b class="num">${num1(rs)}</b><span>${pagesWord(rs)} ${esc(S(s).tr)}</span></div>
          <div class="stat"><b class="num">${num1(rj)}</b><span>${pagesWord(rj)} Juz ${j}</span></div>
          <div class="stat"><b class="num">${num1(rq)}</b><span>${pagesWord(rq)} im ganzen Koran</span></div>
        </div>
        <p class="tiny td-note">Mit ${num1(plan.weekly)} ${pagesWord(plan.weekly)} pro Woche: ${esc(S(s).tr)} ${wk(rs)}, Juz ${j} ${wk(rj)}, der ganze Koran ${wk(rq)}.</p>`;
    },
    click(e) {
      const t = e.target;
      if (t.closest('[data-settings]')) return Settings.open();
      if (t.closest('[data-plan]')) return PlanSetup.open();
      if (t.closest('[data-why]')) return PlanInfo.open();
      if (t.closest('[data-more]')) { this.more = true; return this.render(); }
      if (t.closest('[data-learn]')) return LearnSheet.open(this.por);
      if (t.closest('[data-learnt]')) return this.learnt(this.por);
      if (t.closest('[data-undo]')) return this.undoLearnt();
      if (t.closest('[data-words]')) return ensure('lex').then(() => Learn.review()).catch(() => toast('Der Wortschatz konnte nicht geladen werden.'));
      const tb = t.closest('[data-test]');
      if (tb) { const b = this.bl[+tb.dataset.test]; if (b) Rec.start({ v: b.a, endV: b.z, mode: 'test', unit: { type: 'review' } }); return; }
      const ok = t.closest('[data-ok]');
      if (ok) { const b = this.bl[+ok.dataset.ok]; if (b) RateSheet.open(b); }
    },
    /** today's portion learnt: marked as memorised (with a way back, in case of a slip) */
    learnt(por) {
      if (!por || !por.verses.length) return;
      const label = runsLabel(por.runs), pages = {};
      for (const v of por.verses) { const p = D.pageOf[v]; if (!(p in pages)) pages[p] = Store.data.pages[p] ? JSON.parse(JSON.stringify(Store.data.pages[p])) : null; }
      this.undo = { d: today(), vs: por.verses.slice(), label, pages };
      this.more = false;
      Hifz.setVerses(por.verses, true);
      toast(`${label}: eingetragen`);
      if (App.tab !== 'today') this.render();
    },
    undoLearnt() {
      const u = this.undo; if (!u) return;
      this.undo = null;
      Hifz.setVerses(u.vs, false);
      for (const p in u.pages) if (u.pages[p]) Store.data.pages[p] = u.pages[p];
      Plan.ensure(); Store.save(); updateBadge(); this.render();
    },
    /** the next passage of today's list not recited yet (for "Weiter" after a test) */
    nextBlock() { return Plan.blocks().find(b => !b.pages.every(p => Plan.done(p))) || null; },
  };

  /** how to learn the new portion: in Sabaq/Sabqi/Manzil as in the hifz schools (the widespread 20-times method), in
   *  FSRS and the steps by recalling (Roediger & Karpicke 2006) spread over the day and before sleep (Gais u. a. 2006) */
  const LEARN_STEPS = {
    ssm: [
      ['Richtig lesen.', 'Hör den Abschnitt von einem Qari und lies mit Blick in den Mushaf mit, langsam und mit Tajweed. Was du jetzt falsch lernst, sitzt später genauso fest.'],
      ['Jeden Vers 20-mal.', 'Sag den ersten Vers 20-mal, bis er ohne Blick sitzt, dann den zweiten, dritten und vierten genauso, dann die vier zusammen 20-mal. So weiter in Vierergruppen; am Ende den ganzen Abschnitt 20-mal am Stück.'],
      ['Aufsagen wie beim Lehrer.', 'Sag den Abschnitt ohne Text auf. Prüfen verdeckt den Text und zeigt dir, was fehlt.'],
      ['Verbinden.', 'Bevor du morgen weiterlernst, sag zuerst diesen Abschnitt 20-mal auf. So hängen die Abschnitte aneinander.'],
    ],
    recall: [
      ['Richtig lesen.', 'Hör den Abschnitt von einem Qari und lies mit Blick in den Mushaf mit, langsam und mit Tajweed. Was du jetzt falsch lernst, sitzt später genauso fest.'],
      ['Lesen, dann abrufen.', 'Lies einen Vers zwei-, dreimal, dann sag ihn ohne Blick auf. Was fehlte, liest du nach und versuchst es noch einmal. Dann den nächsten Vers, danach beide zusammen.'],
      ['Ohne Text aufsagen.', 'Sag den ganzen Abschnitt auswendig auf. Prüfen verdeckt den Text und zeigt dir, was fehlt; gerade das Abrufen prägt ein.'],
      ['Über den Tag verteilt.', 'Sag ihn heute noch zwei-, dreimal auf, mit Pausen dazwischen, zuletzt vor dem Schlafen, und morgen früh als Erstes.'],
    ],
  };

  /** learning today's portion: how, and the ways to read, test and mark it */
  const LearnSheet = {
    open(por) {
      if (!por || !por.verses.length) return;
      const plan = Plan.get() || Plan.cur(), a = por.verses[0], z = por.verses[por.verses.length - 1];
      const after = {
        ssm: `Ab morgen sagst du den Abschnitt ${plan.recent} Tage lang täglich auf (Sabqi), danach kommt er in die Runde (Manzil).`,
        fsrs: 'Morgen kommt der Abschnitt zum ersten Mal zur Wiederholung; danach bestimmt FSRS die Abstände.',
        leitner: 'Der Abschnitt kommt nach 1, 3, 7, 14 und 30 Tagen wieder.',
      }[plan.model];
      const body = el('<div class="ln"></div>');
      body.innerHTML = `<div class="ln-head"><b>${esc(runsLabel(por.runs))}</b><span>${sizeText(por.size)} · ${pagesLabel([...new Set(por.verses.map(x => D.pageOf[x]))])}</span></div>
        <ol class="how-list ln-steps">${LEARN_STEPS[plan.model === 'ssm' ? 'ssm' : 'recall'].map(([t, x]) => `<li><b>${t}</b> ${x}</li>`).join('')}</ol>
        <p class="tiny ln-src">${plan.model === 'ssm' ? 'Nach der verbreiteten 20-Mal-Methode' : 'Nach der Forschung zum Abrufen und zum Schlaf'}, siehe „Was die Forschung sagt“.</p>
        <div class="row cs-go"><button class="btn grow" data-a="read">${ICON.read}<span>Lesen</span></button><button class="btn grow" data-a="test">${ICON.eyeOff}<span>Prüfen</span></button><button class="btn grow" data-a="blind">${ICON.ear}<span>Blindtest</span></button></div>
        <button class="btn primary block" data-a="done" style="margin-top:12px">${ICON.check}<span>Gelernt: eintragen</span></button>
        <p class="tiny" style="margin-top:10px">${esc(after)}</p>`;
      const sh = openSheet({ title: 'Heute lernen', body });
      body.addEventListener('click', e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        sh.close();
        if (b.dataset.a === 'read') Reader.open(a);
        if (b.dataset.a === 'test') Rec.start({ v: a, endV: z, mode: 'test', unit: { type: 'learn' } });
        if (b.dataset.a === 'blind') Rec.start({ v: a, endV: z, mode: 'test', blind: true, unit: { type: 'learn' } });
        if (b.dataset.a === 'done') Today.learnt(por);
      });
    },
  };

  /** recited without the app listening: the learner says how it went */
  const RateSheet = {
    open(bl) {
      const plan = Plan.cur(), p0 = bl.pages[0];
      const pv = plan.model === 'ssm' ? null : PL.preview(Store.data.pages[p0], today(), plan, 'p' + p0);
      const body = el('<div></div>');
      body.innerHTML = `<p class="note" style="margin:0 0 12px">${esc(pagesLabel(bl.pages))}. Wie lief es, als du es auswendig aufgesagt hast?</p>
        <div class="rate rate3">${[['Sicher', 1, 'r3'], ['Ein paar Fehler', 0.9, ''], ['Viel vergessen', 0.5, 'r1']].map(([x, q, c], k) => `<button class="btn ${c}" data-q="${q}"><span>${x}</span>${pv ? `<small>${inDays(pv[k])}</small>` : ''}</button>`).join('')}</div>
        <button class="btn ghost block" data-test style="margin-top:10px">${ICON.eyeOff}<span>Lieber von der App prüfen lassen</span></button>`;
      const sh = openSheet({ title: spanLabel(bl.a, bl.z), body });
      body.addEventListener('click', e => {
        const b = e.target.closest('[data-q]');
        if (b) {
          for (const p of bl.pages) Plan.review(p, +b.dataset.q);
          Store.save(); updateBadge(); sh.close();
          if (App.tab === 'today') Today.render();
          if (App.tab === 'hifz') Hifz.render();
          return;
        }
        if (e.target.closest('[data-test]')) { sh.close(); Rec.start({ v: bl.a, endV: bl.z, mode: 'test', unit: { type: 'review' } }); }
      });
    },
  };

  /** a surah to choose (where the plan goes on) */
  function pickSurah(title, cur, cb) {
    const body = el('<div class="picker"></div>');
    body.innerHTML = `<div class="pk-head"><label class="pk-search">${ICON.search}<input type="search" placeholder="Sure suchen" autocomplete="off" spellcheck="false"></label></div><div class="list"></div>`;
    const sh = openSheet({ title, body, full: true });
    const list = $('.list', body), q = $('input', body);
    const draw = () => {
      list.innerHTML = findSurahs(q.value).map(n => {
        const su = S(n), m = surahMem(su);
        return `<button class="pk-row${n === cur ? ' active' : ''}" data-s="${n}"><span class="sbadge${m === su.ayahs ? ' on' : ''}"><b>${n}</b></span><span class="main"><span class="a">${esc(su.tr)}</span><span class="b">${su.ayahs} Verse${m ? `, ${m === su.ayahs ? 'alle' : m} auswendig` : ''}</span></span><span class="ar">${esc(su.ar)}</span></button>`;
      }).join('') || '<div class="empty">Keine Sure gefunden.</div>';
    };
    q.addEventListener('input', draw);
    list.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; sh.close(); cb(+b.dataset.s); });
    draw();
  }

  /** what is known from before: whole surahs and juz (not counted for the week, reviewed one after another) */
  const KnownSheet = {
    open(after) {
      const body = el('<div class="ks"></div>');
      openSheet({ title: 'Was du schon kannst', body, full: true, onClose: () => { if (after) after(); } });
      let armed = null, armT = 0;
      const range = (a, b) => { const vs = []; for (let v = a; v <= b; v++) vs.push(v); return vs; };
      const surahVs = n => range(S(n).start, S(n).start + S(n).ayahs - 1);
      const juzVs = j => range(...juzRange(j));
      const state = vs => { let m = 0; for (const v of vs) m += memHas(v); return m === vs.length ? 'full' : m ? 'part' : ''; };
      const draw = () => {
        let html = `<p class="note" style="margin:0">Tippe an, was du schon auswendig kannst. Es zählt nicht fürs Wochenziel und kommt nach und nach in die Wiederholung. Einzelne Verse markierst du im Hifz-Bereich.</p>
          <div class="section-title">Ganze Juz</div><div class="chips ks-juz">`;
        for (let j = 30; j >= 1; j--) {
          const st = state(juzVs(j));
          html += `<button class="vchip${st === 'full' ? ' done' : st === 'part' ? ' part' : ''}" data-j="${j}" aria-label="Juz ${j}${st === 'full' ? ', auswendig' : st === 'part' ? ', teilweise' : ''}">${armed === 'j' + j ? 'weg?' : j}</button>`;
        }
        html += '</div><div class="section-title">Suren</div><div class="list">';
        for (let n = 114; n >= 1; n--) {
          const su = S(n), m = surahMem(su), full = m === su.ayahs;
          html += `<button class="pk-row ks-row" data-s="${n}"><span class="sbadge${full ? ' on' : ''}"><b>${n}</b></span><span class="main"><span class="a">${esc(su.tr)}</span><span class="b">${armed === 's' + n ? 'Nochmal tippen zum Austragen' : full ? 'auswendig' : m ? `${m} von ${su.ayahs} Versen` : `${su.ayahs} Verse`}</span></span><span class="ks-mark${full ? ' on' : ''}" aria-hidden="true">${full ? ICON.check : ''}</span></button>`;
        }
        body.innerHTML = html + '</div>';
      };
      body.addEventListener('click', e => {
        const js = e.target.closest('[data-j]'), ss = e.target.closest('[data-s]');
        if (!js && !ss) return;
        const key = js ? 'j' + js.dataset.j : 's' + ss.dataset.s, vs = js ? juzVs(+js.dataset.j) : surahVs(+ss.dataset.s);
        clearTimeout(armT);
        if (state(vs) === 'full') {
          // taking out what is memorised: only with a second tap
          if (armed !== key) { armed = key; armT = setTimeout(() => { armed = null; draw(); }, 3500); return draw(); }
          armed = null; Hifz.setVerses(vs, false);
        } else { armed = null; Hifz.setVerses(vs.filter(v => !memHas(v)), true, { old: true }); }
        draw();
      });
      draw();
    },
  };

  /** making or changing the plan: how much a week, on which days, in which order, and the model of reviewing */
  const PlanSetup = {
    open() {
      const first = !Store.data.plan;
      const dr = Object.assign({}, Plan.get() || PL.normalize({}));
      dr.days = dr.days.slice();
      const body = el('<div class="ps"></div>');
      const sh = openSheet({ title: first ? 'Lernplan einrichten' : 'Lernplan', body, full: true });
      const seg = (key, vals, label) => `<div class="seg" data-seg="${key}" role="group">${vals.map(x => `<button data-v="${x}" aria-pressed="${dr[key] === x}">${label(x)}</button>`).join('')}</div>`;
      const draw = () => {
        const b = Plan.b(), memP = PL.memPages(b, memHas).length;
        let memV = 0; for (let x = 0; x < TOTAL_VERSES; x++) memV += memHas(x);
        const next = PL.nextPortion(b, memHas, dr.order, dr.from, 0.001).verses[0];
        const nd = dr.days.filter(Boolean).length, rest = PL.open(b, memHas, 0, TOTAL_VERSES - 1), load = PL.ssmLoad(dr, memP);
        const wi = WEEKLY.indexOf(dr.weekly);
        const opt = {
          ssm: `<div class="ps-opt"><b>Neues jeden Tag</b><span>So viele Tage sagst du einen neu gelernten Abschnitt täglich auf (Sabqi).</span>${seg('recent', [7, 14, 30], x => x + ' Tage')}</div>
            <div class="ps-opt"><b>Runde für alles andere, in Tagen</b><span>In so vielen Tagen sagst du alle älteren Seiten einmal auf (Manzil).</span>${seg('cycle', [7, 10, 14, 20, 30], x => String(x))}</div>
            ${memP ? `<p class="tiny">Bei dir jetzt etwa ${load.recent} + ${load.manzil} Seiten am Tag; die Runde wächst mit dem, was du lernst.</p>` : ''}`,
          fsrs: `<div class="ps-opt"><b>Wie sicher?</b><span>So wahrscheinlich kannst du eine Seite noch, wenn sie wieder drankommt. Höher heißt öfter wiederholen.</span>${seg('retention', [0.9, 0.95, 0.97], x => Math.round(x * 100) + ' %')}</div>`,
          leitner: '<p class="tiny">Sicher aufgesagt: eine Stufe weiter (1, 3, 7, 14, 30 Tage). Mit Fehlern: dieselbe Stufe. Viel vergessen: zurück auf einen Tag.</p>',
        };
        const howNew = { ssm: 'Das Neue lernst du wie in den Hifz-Schulen: jeden Vers 20-mal, dann in Vierergruppen verbunden.', fsrs: 'Das Neue lernst du durch Abrufen: kurz lesen, dann auswendig aufsagen, über den Tag verteilt.', leitner: 'Das Neue lernst du durch Abrufen: kurz lesen, dann auswendig aufsagen, über den Tag verteilt.' };
        for (const m of PL.MODELS) opt[m] = `<p class="tiny ps-new">${howNew[m]}</p>` + opt[m];
        body.innerHTML = `
          <p class="note ps-intro">Wie viel du pro Woche neu lernst, in welcher Reihenfolge, und nach welchem Modell du wiederholst. Ändern kannst du alles jederzeit.</p>
          <div class="section-title">Wie viel pro Woche?</div>
          <div class="ps-step"><button class="icon-btn" data-step="-1" aria-label="Weniger"${wi === 0 ? ' disabled' : ''}>${ICON.minus}</button>
            <div class="ps-val"><b class="num">${num1(dr.weekly)}</b><span>${pagesWord(dr.weekly)} pro Woche</span></div>
            <button class="icon-btn" data-step="1" aria-label="Mehr"${wi === WEEKLY.length - 1 ? ' disabled' : ''}>${ICON.plus}</button></div>
          <p class="tiny ps-hint">${sizeText(PL.perDay(dr))} an jedem der ${nd} Lerntage.${rest > 0.01 ? ` Was dir noch fehlt (${num1(rest)} ${pagesWord(rest)}), hättest du so ${inWeeks(rest / dr.weekly)} gelernt.` : ''}${PL.perDay(dr) > 2.5 ? ' Mehr als ein Achtel Juz (2,5 Seiten) an einem Tag rät die 20-Mal-Methode nicht.' : ''}</p>
          <div class="section-title">Lerntage</div>
          <div class="ps-days" role="group" aria-label="Lerntage">${WEEKDAYS.map((x, k) => `<button class="vchip" data-day="${k}" aria-pressed="${!!dr.days[k]}">${x}</button>`).join('')}</div>
          <p class="tiny ps-hint">An den anderen Tagen nur wiederholen.</p>
          <div class="section-title">Reihenfolge</div>
          ${seg('order', PL.ORDERS, x => ORDER[x][0])}
          <p class="tiny ps-hint">${esc(ORDER[dr.order][1])}</p>
          <button class="ps-row" data-from><span class="txt"><small>Als Nächstes</small><b>${next != null ? `${esc(S(surahOf(next)).tr)} ${ayahOf(next)}` : 'Alles gelernt'}</b><span>Mit einer anderen Sure beginnen</span></span>${ICON.right}</button>
          <div class="section-title">Wie wiederholen?</div>
          ${PL.MODELS.map(m => `<div class="ps-model${dr.model === m ? ' on' : ''}"><button class="ps-mhead" data-model="${m}" aria-pressed="${dr.model === m}"><span class="ps-radio" aria-hidden="true"></span><span class="txt"><b>${esc(MODEL[m].name)}${m === 'ssm' ? ' <em>empfohlen</em>' : ''}</b><span>${esc(MODEL[m].short)}</span></span></button>${dr.model === m ? `<div class="ps-opts">${opt[m]}</div>` : ''}</div>`).join('')}
          <button class="btn ghost ps-why" data-why>${ICON.bulb}<span>Was die Forschung sagt</span></button>
          <div class="section-title">Was du schon kannst</div>
          <p class="note">${memV ? `${fmt(memV)} Verse auf ${memP} ${memP === 1 ? 'Seite' : 'Seiten'} sind eingetragen.` : 'Noch keine Verse eingetragen.'} Was du schon auswendig kannst, zählt nicht fürs Wochenziel und kommt nach und nach in die Wiederholung.</p>
          <button class="btn block" data-known>Gelernte Suren eintragen</button>
          <div class="ps-bar"><button class="btn primary block" data-save>${first ? 'Plan starten' : 'Speichern'}</button></div>`;
      };
      body.addEventListener('click', e => {
        const t = e.target;
        const st = t.closest('[data-step]');
        if (st) { const i = Math.max(0, WEEKLY.indexOf(dr.weekly)); dr.weekly = WEEKLY[Math.min(WEEKLY.length - 1, Math.max(0, i + +st.dataset.step))]; return draw(); }
        const dy = t.closest('[data-day]');
        if (dy) { const k = +dy.dataset.day; dr.days[k] = dr.days[k] ? 0 : 1; if (!dr.days.some(Boolean)) dr.days[k] = 1; return draw(); }
        const sg = t.closest('[data-seg] [data-v]');
        if (sg) { const key = sg.parentElement.dataset.seg; dr[key] = key === 'order' ? sg.dataset.v : +sg.dataset.v; return draw(); }
        const md = t.closest('[data-model]');
        if (md) { dr.model = md.dataset.model; return draw(); }
        if (t.closest('[data-from]')) return pickSurah('Mit welcher Sure weiter?', dr.from, n => { dr.from = n; draw(); });
        if (t.closest('[data-why]')) return PlanInfo.open();
        if (t.closest('[data-known]')) return KnownSheet.open(() => draw());
        if (t.closest('[data-save]')) {
          Store.data.plan = dr;
          Plan.today(true);
          Store.save(); updateBadge();
          sh.close();
          if (App.tab !== 'today') showTab('today'); else Today.render();
          toast(first ? 'Dein Lernplan steht. Bismillah!' : 'Lernplan gespeichert');
        }
      });
      draw();
    },
  };

  /** what the research says, the three models, which fits the Quran, and from the Quran and the Sunna */
  const PlanInfo = {
    open() {
      const body = el('<div class="how"></div>');
      const src = (t, u) => u ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : t;
      body.innerHTML = `<p class="note">Wie man am besten auswendig lernt, ist gut erforscht, meist mit Vokabeln und Texten. Für den Koran gibt es die Erfahrung aus Jahrhunderten Hifz-Unterricht, aber keine Studie, die Methoden direkt miteinander vergleicht. Die App setzt um, was belegt ist:</p>
        <ol class="how-list">
          <li><b>Aufsagen statt nur lesen.</b> Was du aus dem Gedächtnis abrufst, behältst du besser, als wenn du es noch einmal liest. Eine Woche nach dem Lernen eines Textes wussten Lernende nach viermal Lesen noch 40 %, nach dreimal Lesen und einmal Aufschreiben aus dem Gedächtnis 56 %, nach einmal Lesen und dreimal Aufschreiben 61 %. <span class="src">${src('Roediger & Karpicke 2006', 'https://doi.org/10.1111/j.1467-9280.2006.01693.x')}</span></li>
          <li><b>Verteilt statt am Stück.</b> Wiederholungen über Tage verteilt wirken stärker als dieselbe Zeit an einem Tag. Je länger etwas halten soll, desto größer dürfen die Abstände sein: für eine Woche ein bis drei Tage, für ein Jahr eher drei bis fünf Wochen. <span class="src">${src('Cepeda u. a. 2006', 'https://doi.org/10.1037/0033-2909.132.3.354')}; ${src('Cepeda u. a. 2008', 'https://doi.org/10.1111/j.1467-9280.2008.02209.x')}, über 1 350 Teilnehmende</span></li>
          <li><b>Wachsende oder gleiche Abstände?</b> Auf lange Sicht hat keine der beiden einen klaren Vorteil; in manchen Versuchen hielten gleiche Abstände sogar besser. Wachsende Abstände helfen, solange das Gelernte noch leicht verloren geht oder sich mit Ähnlichem vermischt. Darum kommt Neues in allen drei Modellen zuerst täglich oder nach kurzen Abständen. <span class="src">${src('Karpicke & Roediger 2007', 'https://doi.org/10.1037/0278-7393.33.4.704')}; ${src('Kang u. a. 2014', 'https://doi.org/10.3758/s13423-014-0636-z')}; ${src('Storm, Bjork & Storm 2010', 'https://doi.org/10.3758/MC.38.2.244')}</span></li>
          <li><b>Immer wieder richtig abrufen.</b> Was an mehreren Tagen jeweils bis zum fehlerfreien Abruf geübt wurde, hält am längsten. <span class="src">${src('Rawson & Dunlosky 2022', 'https://doi.org/10.1177/09637214221100484')}</span></li>
          <li><b>Darüber schlafen.</b> Wer innerhalb weniger Stunden nach dem Lernen schläft, erinnert sich besser. Darum das Neue abends noch einmal aufsagen. <span class="src">${src('Gais, Lucas & Born 2006', 'https://learnmem.cshlp.org/content/13/3/259.abstract')}</span></li>
        </ol>
        <div class="section-title">Die drei Modelle</div>
        <p class="note"><b>Sabaq · Sabqi · Manzil.</b> Der Tagesablauf der Hifz-Schulen: das Neue (Sabaq), das zuletzt Gelernte (Sabqi) und alles Ältere (Manzil). Neu Gelerntes sagst du ein bis vier Wochen lang jeden Tag auf, alles andere in einer festen Runde. Sitzt eine Seite nicht, kommt sie täglich, bis sie wieder sitzt; Lehrer halten in diesem Fall das Neue an, bis das Alte wieder fest ist. Vorteil: jede Seite kommt sicher dran, und die Arbeit eines Tages ist planbar. Nachteil: auch Seiten, die längst sitzen, kommen in jeder Runde. <span class="src">${src('Gent 2011', 'https://islamicacademy.ac.uk/journals/Journal-24%281%262%29/5B%20Gent%20pp.%2055-63.pdf')}, eine Hifz-Klasse in England</span></p>
        <p class="note"><b>Anpassend (FSRS).</b> Ein Gedächtnismodell schätzt für jede Seite, wann du sie mit der gewählten Sicherheit (90, 95 oder 97 %) gerade noch kannst, und holt sie dann. Was sitzt, kommt seltener, was wackelt, öfter. FSRS sagt das Vergessen in rund 700 Millionen Wiederholungen von 10 000 Anki-Nutzern besser voraus als ältere Verfahren; das sind aber Karteikarten, keine Koranseiten. Darum kommt jede Seite spätestens nach 30 Tagen wieder. <span class="src">${src('Open Spaced Repetition: SRS Benchmark', 'https://github.com/open-spaced-repetition/srs-benchmark')}</span></p>
        <p class="note"><b>Feste Stufen.</b> Das Prinzip der Lernkartei nach Leitner, mit festen Abständen von 1, 3, 7, 14 und 30 Tagen. Einfach und durchschaubar, aber für jede Seite gleich. <span class="src">Leitner 1972, So lernt man lernen</span></p>
        <p class="note"><b>Das Neue lernen.</b> Mit Sabaq · Sabqi · Manzil nach der in Hifz-Schulen verbreiteten 20-Mal-Methode: jeden Vers 20-mal, dann je vier Verse zusammen 20-mal, am Ende den ganzen Abschnitt; vor dem nächsten Abschnitt den letzten noch einmal 20-mal; nicht mehr als ein Achtel Juz am Tag. Mit FSRS und den festen Stufen durch Abrufen: einen Vers kurz lesen, dann ohne Blick aufsagen, nachlesen, was fehlte, über den Tag verteilt wiederholen. Beide lassen dich viel aus dem Gedächtnis aufsagen; das ist der Kern. <span class="src">${src('Die 20-Mal-Methode (arabisch)', 'https://kalemtayeb.com/safahat/item/47816')}</span></p>
        <div class="section-title">Was am besten passt</div>
        <p class="note">Für den Koran empfiehlt die App Sabaq · Sabqi · Manzil. Mit diesem Ablauf haben Generationen von Huffaz gelernt, und er passt zu dem, was die Forschung zeigt: Neues früh und oft, Älteres in gleichmäßigen Abständen, immer aus dem Gedächtnis. Keine Seite gerät aus dem Blick, weil ein Rechenmodell sie zu weit hinausschiebt. Wenn du schon viel kannst und wenig Zeit hast, spart FSRS Wiederholungen: In einer Simulation mit 2 Seiten pro Woche und Juz 30 als Vorwissen waren es nach einem halben Jahr etwa 6 statt 9 Seiten am Tag. Wichtiger als das Modell ist, jeden Tag dranzubleiben und auswendig aufzusagen, nicht nur zu lesen.</p>
        <div class="section-title">Aus Koran und Sunna</div>
        <p class="verse-ar">وَلَقَدۡ يَسَّرۡنَا ٱلۡقُرۡءَانَ لِلذِّكۡرِ فَهَلۡ مِن مُّدَّكِرٖ</p>
        <p class="note">„Und Wir haben den Qur’an ja leicht zum Bedenken gemacht. Aber gibt es jemanden, der bedenkt?“ (54:17, Übersetzung Bubenheim und Elyas)</p>
        <p class="note">Abu Musa al-Aschʿari berichtet, dass der Prophet (Allahs Segen und Heil auf ihm) sagte: „Pflegt den Koran (durch ständiges Wiederholen). Bei Dem, in Dessen Hand meine Seele ist, er entweicht leichter als Kamele aus ihren Fußfesseln.“ <span class="src">al-Buchari 5033, Muslim 791</span></p>
        <p class="note">ʿAbdullah ibn ʿAmr berichtet: Der Prophet (Allahs Segen und Heil auf ihm) sagte zu mir: „Lies den Koran (ganz) in einem Monat.“ Ich sagte: „Ich habe Kraft (für mehr).“ Bis er sagte: „Dann lies ihn in sieben (Tagen) und geh nicht darüber hinaus.“ <span class="src">al-Buchari 5054, auch bei Muslim 1159</span> Die Runden der App, 7 bis 30 Tage, bleiben in diesem Rahmen.</p>`;
      openSheet({ title: 'Was die Forschung sagt', body, full: true });
    },
  };

  // ------------------------------------------------------------------ vocabulary: learnt surah by surah
  // The scheduling, the words of a surah and the order of a session are in vocab.js (QuranVocab, with tests).
  const V = window.QuranVocab;
  const SURAH_IDX = new Map();
  /** the words of surah n to learn: items in order of appearance, their occurrences, the items of every verse */
  function surahIdx(n) {
    let x = SURAH_IDX.get(n);
    if (!x) {
      const su = S(n);
      x = V.surahIndex(D.Q.verseStart[su.start], D.Q.verseStart[su.start + su.ayahs],
        g => { const id = LEX.main[g]; return id >= 0 && D.lex.lemmas[id] && D.lex.lemmas[id][4] ? id : -1; }, g => D.Q.words[g].v);
      SURAH_IDX.set(n, x);
    }
    return x;
  }
  const firstSense = s => String(s || '').split(/[;,]/)[0].replace(/\s*\(.*?\)\s*/g, ' ').trim();
  /** the meaning of word id at word g in short, for chips and lists: the first meaning; a meaning worded for its verse or
   *  a word with two meanings keeps its brackets ("vergessen (hier: verlassen)", "Malik (Wächter der Hölle)") */
  const shortGloss = (id, g) => {
    const t = glossOf(id, g);
    const own = (g != null && g >= 0 && LEX.main[g] === id && LEX.alt.has(g)) || (D.lex.split && D.lex.split[id] != null);
    if (!own) return firstSense(t);
    let depth = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++; else if (t[i] === ')') depth--; else if (t[i] === ',' && !depth) return t.slice(0, i).trim();
    }
    return t.trim();
  };
  const stripMarks = s => String(s).replace(/[ً-ٰٟۖ-ۭـ]/g, '');
  /** "in 3 Tagen" */
  function inDays(d) {
    if (d <= 0) return 'heute';
    if (d === 1) return 'morgen';
    if (d < 14) return `in ${d} Tagen`;
    if (d < 60) return `in ${Math.round(d / 7)} Wochen`;
    if (d < 365) return `in ${Math.round(d / 30.4)} Monaten`;
    const y = Math.round(d / 36.5) / 10;
    return `in ${String(y).replace('.', ',')} ${y === 1 ? 'Jahr' : 'Jahren'}`;
  }

  const Vocab = {
    card(id) { return Store.data.vocab[id]; },
    status(id) { return V.status(Store.data.vocab[id]); },
    queued(id) { return Store.data.queue.indexOf(id) >= 0; },
    queue(id) { if (!Store.data.vocab[id] && !this.queued(id)) { Store.data.queue.push(id); Store.save(); } },
    /** an answer: g 1 not recalled .. 4 easy; n the surah it was practised in */
    grade(id, g, n) {
      const day = today();
      const c = V.review(Store.data.vocab[id], g, day, id, { retention: Store.data.settings.vret || 0.9 });
      if (n) c.c[n] = day;
      Store.data.vocab[id] = c;
      const qi = Store.data.queue.indexOf(id); if (qi >= 0) Store.data.queue.splice(qi, 1);
      Store.save();
      return c;
    },
    introducedToday() { const d = today(); let k = 0; for (const id in Store.data.vocab) if (Store.data.vocab[id].a === d) k++; return k; },
    newLimit() { return Math.max(0, (Store.data.settings.newPerDay || 10) - this.introducedToday()); },
    plan(n, newLimit) {
      return V.plan(surahIdx(n), Store.data.vocab, { day: today(), n, newLimit: newLimit == null ? this.newLimit() : newLimit, againLimit: 12, queued: Store.data.queue, family: LEX.family });
    },
    dueAll() { const d = today(), out = []; for (const id in Store.data.vocab) if (Store.data.vocab[id].due <= d && D.lex.lemmas[id]) out.push(+id); return out; },
    /** the surah a word is practised in outside a surah session: where it was practised last, else where it first occurs */
    contextSurah(id) {
      const c = Store.data.vocab[id], occ = LEX.occ.get(id) || [];
      const has = n => surahIdx(n).occ.has(id);
      const learnt = Object.keys((c && c.c) || {}).map(Number).filter(has).sort((a, b) => c.c[b] - c.c[a]);
      return learnt[0] || (occ.length ? surahOf(D.Q.words[occ[0]].v) : 1);
    },
    stats(n) {
      const x = surahIdx(n), d = today();
      const st = { total: x.items.length, new: 0, learn: 0, known: 0, due: 0, here: 0 };
      for (const id of x.items) {
        const c = Store.data.vocab[id];
        st[V.status(c)]++;
        if (c && c.due <= d) st.due++;
        if (c && c.c && c.c[n] != null) st.here++;
      }
      st.verses = V.verseProgress(x, Store.data.vocab);
      return st;
    },
    /** the share of all words of the Quran whose word is learnt */
    coverage() {
      let l = 0, k = 0;
      for (const id in Store.data.vocab) { const lem = D.lex.lemmas[id]; if (!lem) continue; if (V.status(Store.data.vocab[id]) === 'known') k += lem[3]; else l += lem[3]; }
      return { known: k / LEX.total, learning: l / LEX.total, words: Object.keys(Store.data.vocab).length };
    },
    homeSurah() {
      const n = Store.data.vs || (Store.data.pos && Store.data.pos.v != null ? surahOf(Store.data.pos.v) : 1);
      return n >= 1 && n <= 114 ? n : 1;
    },
    /** cards of earlier versions: the old scheduler, lemmas that are now learnt as separate forms (ذا -> ذَٰلِكَ, تِلۡكَ ...)
     *  and lemmas with a second meaning learnt on its own */
    migrate() {
      const vs = Store.data.vocab, day = today();
      let changed = false;
      for (const id of Object.keys(vs)) if (vs[id] && vs[id].s == null) { vs[id] = V.migrate(vs[id], day); changed = true; }
      const moved = D.lex.moved || {};
      for (const old of Object.keys(moved)) {
        if (vs[old]) { for (const id of moved[old]) if (!vs[id]) vs[id] = Object.assign({}, vs[old], { c: Object.assign({}, vs[old].c) }); delete vs[old]; changed = true; }
        const qi = Store.data.queue.indexOf(+old); if (qi >= 0) { Store.data.queue.splice(qi, 1, ...moved[old]); changed = true; }
      }
      // a lemma learnt as two words now (مَٰلِك "Herrscher" and Malik, the angel of 43:77): progress of a surah with only the new one moves
      if (V.migrateSplit(vs, D.lex.split || {}, (n, id) => n >= 1 && n <= 114 && surahIdx(n).occ.has(id))) changed = true;
      if (changed) Store.save();
    },
  };

  /** a word of the Quran as a learning card: the word, its verse (or the part of it around the word), its parts */
  const WordCard = {
    excerpt(g, max) {
      max = max || 24;
      const v = D.Q.words[g].v, a = D.Q.verseStart[v], b = D.Q.verseStart[v + 1];
      let s = a, e = b;
      if (b - a > max) { s = Math.max(a, g - Math.floor(max / 2)); e = Math.min(b, s + max); s = Math.max(a, e - max); }
      let html = s > a ? '… ' : '';
      for (let x = s; x < e; x++) html += (x === g ? `<mark>${esc(D.Q.words[x].t)}</mark>` : esc(D.Q.words[x].t)) + ' ';
      return html + (e < b ? '…' : `<span class="an">${arNum(ayahOf(v))}</span>`);
    },
    segs(g) { const w = D.Q.words[g]; const flat = D.wd[w.v] && D.wd[w.v][w.k]; return flat && flat.length ? segsOf(flat) : []; },
    /** the parts of the word with their meaning: وَ und | قَالُ sagen | وٓاْ sie */
    parts(g, id) {
      const w = D.Q.words[g];
      let segs = this.segs(g).map(x => Object.assign({}, x));
      // a demonstrative with its هَٰ and its pointing endings is one part, as it is learnt: ذَٰلِكَ, هَٰذَا, أُوْلَٰٓئِكَ
      const m = segs.findIndex(x => x.main);
      if (m >= 0 && segs[m].tags.indexOf('DEM') >= 0) {
        let a = m, b = m;
        if (a > 0 && segs[a - 1].tags.indexOf('ATT') >= 0) a--;
        while (b + 1 < segs.length && (segs[b + 1].tags.indexOf('DIST') >= 0 || segs[b + 1].tags.indexOf('ADDR') >= 0)) b++;
        segs = segs.slice(0, a).concat([Object.assign({}, segs[m], { start: segs[a].start, end: segs[b].end })], segs.slice(b + 1));
      }
      if (segs.length < 2) return '';
      const lem = D.lex.lemmas[id];
      let html = '<div class="parts">';
      for (const s of segs) {
        const txt = w.t.slice(s.start, s.end);
        if (!stripMarks(txt)) continue;
        // a second word inside the written word (مِمَّا: مِن + مَا) shows its own meaning
        const own = !s.main && s.lid >= 0 && D.lex.lemmas[s.lid] && s.tags.indexOf('PREF') < 0 && s.tags.indexOf('SUFF') < 0 ? firstSense(D.lex.lemmas[s.lid][4]) : '';
        const lab = s.main ? shortGloss(id, g) || 'Wortstamm' : own || affixDE(s, txt);
        html += `<div class="part${s.main ? ' stem' : ''}"><div class="pa">${esc(txt)}</div><div class="pd">${esc(lab)}</div></div>`;
      }
      return html + '</div>';
    },
    /** Verb, Perfekt, ... · Grundform قَالَ · Wurzel ق و ل */
    facts(g, id) {
      const lem = D.lex.lemmas[id], main = this.segs(g).find(s => s.main);
      const out = [];
      if (main) out.push(esc(grammarDE(main)));
      if (lem && stripMarks(lem[0]).replace(/^ـ/, '') !== stripMarks(D.Q.words[g].t)) out.push(`Grundform <bdi class="q">${esc(lem[0])}</bdi>`);
      if (lem && lem[1]) out.push(`Wurzel <bdi class="q root-l">${esc(lem[1].split('').join(' '))}</bdi>`);
      return out.join(' · ');
    },
    /** learnt words of the same root: they help to remember the new one */
    relatives(id) {
      const lem = D.lex.lemmas[id];
      if (!lem || !lem[1]) return '';
      const rel = (LEX.byRoot.get(lem[1]) || []).filter(x => x !== id && Store.data.vocab[x]).slice(0, 4);
      if (!rel.length) return '';
      return `<p class="lc-rel">Gleiche Wurzel, schon gelernt: ${rel.map(x => `<bdi class="q">${esc(D.lex.lemmas[x][0])}</bdi> ${esc(firstSense(D.lex.lemmas[x][4]))}`).join(', ')}</p>`;
    },
  };

  // ------------------------------------------------------------------ a learning session
  const Learn = {
    /** learn surah n: due words, words known from other surahs, new words. opts.newLimit overrides the daily limit */
    start(n, opts) {
      opts = opts || {};
      const p = Vocab.plan(n, opts.newLimit);
      if (!p.due.length && !p.again.length && !p.fresh.length) return this.nothing(n, p);
      p.due = p.due.slice(0, 50);                    // a long backlog in rounds of 50, the most forgotten first
      this.run({ n, plan: p, title: `Lernen · ${S(n).tr}` });
    },
    /** due words of all surahs, each in a verse of a surah where it was learnt */
    review(ids) {
      const d = today();
      ids = (ids || Vocab.dueAll()).slice();
      ids.sort((a, b) => V.retrievability(d - Vocab.card(a).last, Vocab.card(a).s) - V.retrievability(d - Vocab.card(b).last, Vocab.card(b).s));
      this.run({ n: 0, plan: { due: ids.slice(0, 80), again: [], fresh: [] }, title: 'Wiederholen' });
    },
    /** a free round when nothing is due: the words of the surah the learner is least sure of */
    practice(n) {
      const d = today(), x = surahIdx(n);
      const ids = x.items.filter(id => Vocab.card(id)).sort((a, b) => V.retrievability(d - Vocab.card(a).last, Vocab.card(a).s) - V.retrievability(d - Vocab.card(b).last, Vocab.card(b).s)).slice(0, 12);
      this.run({ n, plan: { due: ids, again: [], fresh: [] }, title: `Üben · ${S(n).tr}`, practice: true });
    },
    nothing(n, p) {
      const body = el('<div class="lc-empty"></div>');
      const x = surahIdx(n);
      const learnt = x.items.filter(id => Vocab.card(id));
      const next = learnt.reduce((m, id) => Math.min(m, Vocab.card(id).due), Infinity);
      let html;
      if (p.newLeft > 0) html = `<p class="note">Heute hast du schon ${Vocab.introducedToday()} neue Wörter gelernt (eingestellt: ${Store.data.settings.newPerDay} am Tag) und nichts ist fällig. Mehr neue Wörter auf einmal bedeuten in den nächsten Tagen auch mehr Wiederholungen.</p>
        <div class="row" style="margin-top:14px"><button class="btn primary grow" data-more>5 weitere neue Wörter</button></div>`;
      else html = `<p class="note">Alle ${x.items.length} Wörter von ${esc(S(n).tr)} hast du gelernt, und heute ist keines fällig.${isFinite(next) ? ` Die nächste Wiederholung kommt ${inDays(next - today())}.` : ''}</p>
        <div class="row" style="margin-top:14px"><button class="btn grow" data-practice>Trotzdem üben</button></div>`;
      body.innerHTML = html;
      const sh = openSheet({ title: S(n).tr, body });
      body.addEventListener('click', e => {
        if (e.target.closest('[data-more]')) { sh.close(); this.start(n, { newLimit: 5 }); }
        if (e.target.closest('[data-practice]')) { sh.close(); this.practice(n); }
      });
    },
    run({ n, plan, title, practice }) {
      const sess = new V.Session(plan);
      const body = el('<div class="card-stage lc-stage"></div>');
      const sh = openSheet({ title, body, full: true, onClose: () => { if (App.tab === 'words') Words.render(); } });
      const where = new Map();                       // word -> [surah, word index] shown for it in this session
      const learnt = [];                             // new words recalled in this session, for the summary
      const place = t => {
        let p = where.get(t.id);
        if (!p) {
          const sn = n || Vocab.contextSurah(t.id);
          const occ = surahIdx(sn).occ.get(t.id) || LEX.occ.get(t.id) || [];
          p = [sn, V.pickOccurrence(occ, Vocab.card(t.id))];
          where.set(t.id, p);
        }
        return p;
      };
      const label = t => {
        if (t.mode === 'intro') return ['Neues Wort', 'new'];
        if (t.retry) return ['Noch einmal', 'again'];
        if (t.kind === 'new') return ['Neu: weißt du es noch?', 'new'];
        if (t.kind === 'again') {
          const c = Vocab.card(t.id), from = Object.keys((c && c.c) || {}).map(Number).filter(x => x !== n).sort((a, b) => c.c[b] - c.c[a])[0];
          return [from ? `Bekannt aus ${S(from).tr}` : 'Schon gelernt', 'known'];
        }
        return [practice ? 'Üben' : 'Wiederholung', 'learn'];
      };
      const show = () => {
        const t = sess.next();
        if (!t) return finish();
        const [sn, g] = place(t);
        const lem = D.lex.lemmas[t.id], v = D.Q.words[g].v;
        const [lt, lc] = label(t);
        const pct = Math.round(100 * sess.done / Math.max(1, sess.total));
        body.innerHTML = `<div class="lc-top"><span class="pill ${lc}">${esc(lt)}</span><span class="lc-count num">${Math.min(sess.done + 1, sess.total)} / ${sess.total}</span></div>
          <div class="progress-line"><i style="width:${pct}%"></i></div>
          <div class="lc">
            <div class="lc-word q">${esc(D.Q.words[g].t)}</div>
            <div class="lc-verse q">${WordCard.excerpt(g)}</div>
            <div class="lc-ref">${esc(S(sn).tr)} ${ref(v)}</div>
            <div class="lc-back"${t.mode === 'intro' ? '' : ' hidden'}>
              <div class="lc-gloss">${esc(glossOf(t.id, g))}</div>
              <div class="lc-facts">${WordCard.facts(g, t.id)}</div>
              ${WordCard.parts(g, t.id)}
              ${WordCard.relatives(t.id)}
              <p class="lc-tr" data-tr="${v}">${D.de ? esc(D.de[v]) : ''}</p>
            </div>
          </div>
          <div class="lc-actions">${t.mode === 'intro'
            ? `<p class="lc-ask">Lies das Wort im Vers und präg dir die Bedeutung ein. Gleich fragt die App danach.</p>
               <div class="row"><button class="btn grow" data-a="known">Kenne ich schon</button><button class="btn primary grow" data-a="seen">Weiter</button></div>`
            : `<div class="lc-front"><p class="lc-ask">Was bedeutet das markierte Wort? Überleg zuerst selbst.</p><button class="btn primary block" data-a="show">Bedeutung zeigen</button></div>
               <div class="rate" hidden>${['Nicht gewusst', 'Schwer', 'Gewusst', 'Leicht'].map((x, i) => `<button class="btn r${i + 1}" data-g="${i + 1}"><span>${x}</span>${i ? '<small></small>' : ''}</button>`).join('')}</div>`}</div>`;
        if (!D.de) ensure('de').then(() => { const p = $('[data-tr]', body); if (p) p.textContent = D.de[+p.dataset.tr]; }).catch(() => {});
        const acts = $('.lc-actions', body), shownAt = Date.now();
        acts.onclick = e => {
          if (Date.now() - shownAt < (navigator.webdriver ? 0 : 300)) return;    // a double tap would answer the next card
          const a = e.target.closest('[data-a]'), gb = e.target.closest('[data-g]');
          if (a && a.dataset.a === 'show') {
            $('.lc-back', body).hidden = false; $('.lc-front', body).hidden = true;
            const rate = $('.rate', body); rate.hidden = false;
            const pv = V.preview(Vocab.card(t.id), today(), t.id, { retention: Store.data.settings.vret || 0.9 });
            $$('[data-g]', rate).forEach((b, i) => { if (i) $('small', b).textContent = inDays(pv[i]); });
            $('.lc', body).scrollIntoView({ block: 'start' });
            return;
          }
          if (a && a.dataset.a === 'seen') { sess.answer(t, 'seen'); return show(); }
          if (a && a.dataset.a === 'known') { Vocab.grade(t.id, V.EASY, sn); sess.answer(t, 'known'); return show(); }
          if (gb) { const gr = +gb.dataset.g; Vocab.grade(t.id, gr, sn); sess.answer(t, gr); if (gr > 1 && t.kind === 'new') learnt.push([t.id, g]); return show(); }
        };
        sh.body.scrollTop = 0;
      };
      const finish = () => {
        const s = sess.stats;
        const parts = [];
        if (s.learnt) parts.push(`${s.learnt} ${s.learnt === 1 ? 'neues Wort' : 'neue Wörter'} gelernt`);
        if (s.known) parts.push(`${s.known} schon gekannt`);
        if (s.reviewed) parts.push(`${s.reviewed} wiederholt`);
        let more = '';
        if (n) {
          const st = Vocab.stats(n), p = Vocab.plan(n, 0);
          more = `<p class="lc-done-v">Von ${esc(S(n).tr)} kennst du jetzt <b>${st.learn + st.known}</b> von ${st.total} Wörtern und verstehst <b>${st.verses.understood}</b> von ${st.verses.total} Versen Wort für Wort.</p>`;
          const rest = p.due.length + p.again.length;
          if (rest) more += `<button class="btn block" data-cont style="margin-top:18px">Weiter: ${rest} ${rest === 1 ? 'Wort' : 'Wörter'} zum Wiederholen</button>`;
          else if (p.newLeft) more += `<button class="btn block" data-more style="margin-top:18px">5 weitere neue Wörter</button>`;
        }
        if (s.forgotten) parts.push(`${s.forgotten} nochmal geübt`);
        const chips = learnt.length ? `<div class="lc-learnt">${learnt.slice(0, 14).map(([id, g]) => `<span><bdi class="q">${esc(D.Q.words[g].t)}</bdi><small>${esc(shortGloss(id, g))}</small></span>`).join('')}</div>` : '';
        body.innerHTML = `<div class="lc-done"><div class="lc-done-t">Geschafft</div><p class="note">${parts.join(', ') || 'Fertig'}.</p>${chips}${more}
          <p class="tiny" style="margin-top:14px">Die Wörter kommen wieder, kurz bevor du sie vergessen würdest: erst nach wenigen Tagen, dann immer seltener.</p></div>
          <button class="btn primary block" data-done>Fertig</button>`;
        body.onclick = e => {
          if (e.target.closest('[data-done]')) sh.close();
          if (e.target.closest('[data-more]')) { sh.close(); this.start(n, { newLimit: 5 }); }
          if (e.target.closest('[data-cont]')) { sh.close(); this.start(n, { newLimit: 0 }); }
        };
      };
      show();
    },
  };

  // ------------------------------------------------------------------ the words view
  const Words = {
    filter: 'all', shown: 80, allVerses: false,
    async render() {
      const v = $('#v-words');
      if (!D.lex) {
        v.innerHTML = `<header class="topbar"><h1>Wörter</h1></header><div class="empty">Wortschatz wird geladen …</div>`;
        try { await ensure('lex'); } catch (e) { v.innerHTML = '<header class="topbar"><h1>Wörter</h1></header><div class="empty">Der Wortschatz konnte nicht geladen werden. Prüfe die Verbindung und öffne den Bereich erneut.</div>'; return; }
        if (App.tab !== 'words') return;
      }
      const n = Vocab.homeSurah(), su = S(n), st = Vocab.stats(n), p = Vocab.plan(n);
      const learnt = st.learn + st.known;
      const todo = [];
      if (p.due.length) todo.push(`${p.due.length} ${p.due.length === 1 ? 'Wiederholung' : 'Wiederholungen'}`);
      if (p.again.length) todo.push(`${p.again.length} aus anderen Suren`);
      if (p.fresh.length) todo.push(`${p.fresh.length} ${p.fresh.length === 1 ? 'neues Wort' : 'neue Wörter'}`);
      const elseDue = Vocab.dueAll().filter(id => !surahIdx(n).occ.has(id));
      const bySurah = new Map();
      for (const id of elseDue) { const s = Vocab.contextSurah(id); bySurah.set(s, (bySurah.get(s) || 0) + 1); }
      const cov = Vocab.coverage();
      const w = x => `${(100 * x / Math.max(1, st.total)).toFixed(2)}%`;
      v.innerHTML = `<header class="topbar"><h1>Wörter</h1><button class="icon-btn" data-settings aria-label="Einstellungen">${ICON.gear}</button></header>
        <section class="vs-card">
          <button class="vs-head" data-pick aria-label="Sure wechseln"><span class="vs-t"><b>${esc(su.tr)}</b><small>Sure ${n} · ${esc(su.de)} · ${su.ayahs} Verse</small></span><span class="vs-ar">${esc(su.ar)}</span></button>
          <div class="cov-bar vs-bar" aria-hidden="true"><i class="k" style="width:${w(st.known)}"></i><i class="l" style="width:${w(st.learn)}"></i></div>
          <div class="vs-nums"><span><b class="num">${learnt}</b> von ${st.total} Wörtern gelernt</span><span><b class="num">${st.verses.understood}</b> von ${st.verses.total} Versen verstanden</span></div>
          <button class="btn primary block vs-go" data-learn>${todo.length ? `<span>Lernen</span><small>${todo.join(' · ')}</small>` : `<span>${learnt === st.total ? 'Alles gelernt' : 'Für heute geschafft'}</span><small>${learnt === st.total ? 'Freie Übungsrunde' : 'Weitere neue Wörter'}</small>`}</button>
          <div class="row vs-more"><button class="btn grow" data-pick>Andere Sure</button><button class="btn grow" data-test ${st.total < 4 ? 'disabled' : ''}>Test</button></div>
        </section>
        ${elseDue.length ? `<button class="vs-due" data-review><span class="txt"><b>${elseDue.length} ${elseDue.length === 1 ? 'Wort' : 'Wörter'} aus anderen Suren fällig</b><span>${[...bySurah].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, k]) => `${esc(S(s).tr)} ${k}`).join(' · ')}${bySurah.size > 3 ? ' …' : ''}</span></span>${ICON.right}</button>` : ''}
        <div class="section-title">Verse <small>tippen: Wort für Wort</small></div>
        <div class="vs-verses">${st.verses.per.slice(0, this.allVerses ? 1e9 : 64).map(x => `<button class="vchip${x.none ? ' none' : x.done ? ' done' : x.learnt ? ' part' : ''}" data-v="${x.v}" aria-label="Vers ${ayahOf(x.v)}: ${x.none ? 'nur Einzelbuchstaben' : `${x.learnt} von ${x.total} Wörtern gelernt`}">${ayahOf(x.v)}</button>`).join('')}</div>
        ${st.verses.per.length > 64 && !this.allVerses ? `<button class="btn ghost block" data-allv>Alle ${st.verses.per.length} Verse zeigen</button>` : ''}
        <div class="section-title">Wörter der Sure <small>in der Reihenfolge der Sure</small></div>
        <div class="seg" role="group">${[['all', `Alle ${st.total}`], ['new', `Neu ${st.new}`], ['learnt', `Gelernt ${learnt}`]].map(([k, t]) => `<button data-f="${k}" aria-pressed="${this.filter === k}">${t}</button>`).join('')}</div>
        <div class="list" id="w-list" style="margin-top:6px"></div>
        <div class="vs-foot"><p class="tiny">Dein Wortschatz: ${fmt(cov.words)} ${cov.words === 1 ? 'Wort' : 'Wörter'}. Sie stehen für ${Math.round(100 * (cov.known + cov.learning))} % aller Wörter im Koran.</p>
          <button class="btn ghost" data-how>${ICON.bulb}<span>So lernst du hier</span></button></div>`;
      this.drawList(n);
      v.onclick = e => {
        const t = e.target;
        if (t.closest('[data-settings]')) return Settings.open();
        if (t.closest('[data-pick]')) return this.surahPicker();
        if (t.closest('[data-learn]')) return learnt === st.total && !todo.length ? Learn.practice(n) : Learn.start(n, todo.length ? null : { newLimit: 5 });
        if (t.closest('[data-review]')) return Learn.review(elseDue);
        if (t.closest('[data-test]')) return Quiz.open(n, () => this.render());
        if (t.closest('[data-how]')) return this.how();
        if (t.closest('[data-allv]')) { this.allVerses = true; return this.render(); }
        const vb = t.closest('.vchip[data-v]'); if (vb) return VerseWords.open(+vb.dataset.v);
        const f = t.closest('[data-f]'); if (f) { this.filter = f.dataset.f; this.shown = 80; $$('[data-f]', v).forEach(b => b.setAttribute('aria-pressed', String(b === f))); return this.drawList(n); }
        const r = t.closest('[data-lid]'); if (r) return LemmaSheet.open(+r.dataset.lid, n);
        if (t.closest('#w-more')) { this.shown += 200; return this.drawList(n); }
      };
    },
    rowStatus(id, n) {
      const c = Vocab.card(id);
      if (!c) return Vocab.queued(id) ? ['vorgemerkt', 'new'] : ['neu', 'new'];
      if (c.due <= today()) return ['fällig', 'due'];
      if (!(c.c && c.c[n] != null)) return ['bekannt', 'known'];
      return V.status(c) === 'known' ? ['sicher', 'known'] : ['in Arbeit', 'learn'];
    },
    drawList(n) {
      const list = $('#w-list'); if (!list) return;
      const x = surahIdx(n);
      let ids = x.items;
      if (this.filter === 'new') ids = ids.filter(id => !Vocab.card(id));
      if (this.filter === 'learnt') ids = ids.filter(id => Vocab.card(id));
      if (!ids.length) { list.innerHTML = `<div class="empty">${this.filter === 'new' ? 'Keine neuen Wörter mehr. Masha’Allah!' : 'Noch keine Wörter gelernt. Tippe auf Lernen.'}</div>`; return; }
      let html = '';
      for (const id of ids.slice(0, this.shown)) {
        const l = D.lex.lemmas[id], [lt, lc] = this.rowStatus(id, n), k = x.occ.get(id).length;
        html += `<button class="li lemma-row" data-lid="${id}"><span class="ar q">${esc(l[0])}</span><span class="main"><span class="a">${esc(glossOf(id, x.occ.get(id)[0]))}</span><span class="b">${k}× in der Sure · ${fmt(l[3])}× im Koran</span></span><span class="pill ${lc}">${lt}</span></button>`;
      }
      if (ids.length > this.shown) html += `<button class="btn ghost block" id="w-more">Weitere ${Math.min(200, ids.length - this.shown)} anzeigen</button>`;
      list.innerHTML = html;
    },
    surahPicker() {
      const body = el('<div class="picker"></div>');
      body.innerHTML = `<div class="pk-head"><label class="pk-search">${ICON.search}<input id="sp-q" type="search" placeholder="Sure suchen" autocomplete="off" spellcheck="false"></label></div><div class="list" id="sp-list"></div>`;
      const sh = openSheet({ title: 'Welche Sure lernst du?', body, full: true });
      const list = $('#sp-list', body), q = $('#sp-q', body), cur = Vocab.homeSurah();
      const draw = () => {
        list.innerHTML = findSurahs(q.value).map(n => {
          const su = S(n), x = surahIdx(n);
          let k = 0; for (const id of x.items) if (Vocab.card(id)) k++;
          return `<button class="pk-row${n === cur ? ' active' : ''}" data-s="${n}"><span class="sbadge"><b>${n}</b></span><span class="main"><span class="a">${esc(su.tr)}</span><span class="b">${x.items.length} Wörter${k ? `, ${k === x.items.length ? 'alle' : k} gelernt` : ''}</span>${k ? `<span class="pk-mem"><i style="width:${Math.round(100 * k / x.items.length)}%"></i></span>` : ''}</span><span class="ar">${esc(su.ar)}</span></button>`;
        }).join('') || '<div class="empty">Keine Sure gefunden.</div>';
      };
      q.addEventListener('input', draw);
      list.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; Store.data.vs = +b.dataset.s; Store.save(); this.filter = 'all'; this.allVerses = false; sh.close(); this.render(); window.scrollTo(0, 0); });
      draw();
    },
    /** open the words of surah n (from the reader or the hifz view) */
    openSurah(n) { Store.data.vs = n; Store.save(); this.filter = 'all'; while (sheets.length) sheets[sheets.length - 1].close(); App.scroll.words = 0; showTab('words'); },
    how() {
      const body = el('<div class="how"></div>');
      const src = (t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
      body.innerHTML = `<p class="note">Du lernst die Wörter einer Sure immer in ihren eigenen Versen. So hängt jedes Wort an einer Stelle, die du liest und auswendig lernst. Die App folgt dabei Methoden, deren Wirkung in Studien gut belegt ist:</p>
        <ol class="how-list">
          <li><b>Erst die Bedeutung, dann selbst abrufen.</b> Ein neues Wort siehst du einmal mit Bedeutung. Ein paar Karten später fragt die App danach: Du versuchst zuerst, dich selbst zu erinnern, bevor du die Antwort siehst. Sich zu erinnern prägt stärker ein als nochmal lesen. <span class="src">${src('Karpicke & Roediger 2008', 'https://doi.org/10.1126/science.1152408')}; ${src('Barcroft 2015', 'https://doi.org/10.1111/flan.12139')}: 51 % mehr Wörter mit Abruf statt Mitlesen</span></li>
          <li><b>Bis es sitzt, und dann an späteren Tagen wieder.</b> Was du nicht wusstest, kommt in derselben Runde nach ein paar Karten noch einmal, bis du es einmal weißt. Danach kommt es an späteren Tagen wieder. <span class="src">${src('Rawson & Dunlosky 2022', 'https://doi.org/10.1177/09637214221100484')}: eine Woche später 68 % der Vokabeln behalten, wenn sie an drei Tagen je einmal gewusst wurden, statt 26 % bei dreimal an einem Tag</span></li>
          <li><b>Wachsende Abstände.</b> Wann ein Wort wiederkommt, berechnet FSRS-6 (auch in Anki, geprüft an über 700 Millionen Wiederholungen von 10 000 Lernenden): dann, wenn du es mit 90 % Wahrscheinlichkeit noch weißt, also kurz bevor du es vergessen würdest. Was sitzt, kommt immer seltener. <span class="src">${src('Cepeda u. a. 2006', 'https://doi.org/10.1037/0033-2909.132.3.354')}; ${src('Ye, Su & Cao 2022', 'https://doi.org/10.1145/3534678.3539081')}</span></li>
          <li><b>Immer wieder andere Verse.</b> Kommt ein Wort in der Sure öfter vor, zeigt jede Wiederholung einen anderen Vers. Wörter, die du in einer anderen Sure gelernt hast, fragt die App in der neuen Sure noch einmal ab, im neuen Zusammenhang. <span class="src">${src('Pagán & Nation 2019', 'https://doi.org/10.1111/cogs.12705')}: Wörter aus verschiedenen Zusammenhängen werden besser gelernt</span></li>
          <li><b>Ähnliches nicht gleichzeitig.</b> Neue Wörter derselben Wurzel oder Familie (dieser, jener) kommen an verschiedenen Tagen; ähnliche Wörter zusammen gelernt stören sich gegenseitig. <span class="src">${src('Erten & Tekin 2008', 'https://doi.org/10.1016/j.system.2008.02.005')}</span></li>
          <li><b>Das Wort zerlegt.</b> Vorsilben (وَ und, بِ mit), Endungen (ـهُمۡ sie) und die Wurzel zeigt die Karte einzeln. Wer die Bausteine kennt, erkennt ein gelerntes Wort auch in anderer Form wieder.</li>
        </ol>
        <p class="tiny">Ehrlich bewerten hilft: „Schwer“ oder „Nicht gewusst“ holt das Wort früher zurück.</p>
        <p class="tiny">Jede Karte zeigt die Bedeutung, die das Wort in diesem Vers hat. Hat ein Wort im Koran zwei Bedeutungen, lernst du sie als zwei Wörter: مَٰلِكِ in 1:4 heißt „Herrscher“, Malik in 43:77 ist der Name des Wächters der Hölle. Bei Allahs Namen und Eigenschaften steht, was der Vers sagt, so wie Bubenheim und Elyas übersetzen, ohne Umdeutung und ohne Vergleich mit Geschöpfen. Bedeutungen: deutsche Kurzbedeutungen für MyHifz, an der Übersetzung von Bubenheim und Elyas orientiert, ohne Gewähr. Wortanalyse: Quranic Arabic Corpus.</p>`;
      openSheet({ title: 'So lernst du hier', body });
    },
  };

  /** a verse word for word: every word with its meaning */
  const VerseWords = {
    async open(v) {
      const n = surahOf(v);
      const body = el('<div></div>');
      const sh = openSheet({ title: `${S(n).tr} ${ref(v)}`, body, onClose: () => { if (App.tab === 'words') Words.render(); } });
      const draw = () => {
        let html = '<div class="ww">';
        for (let g = D.Q.verseStart[v]; g < D.Q.verseStart[v + 1]; g++) {
          const id = LEX.main[g], lem = id >= 0 ? D.lex.lemmas[id] : null, st = lem && lem[4] ? Vocab.status(id) : 'none';
          html += `<button class="ww-w ${st}" data-g="${g}"><span class="q">${esc(D.Q.words[g].t)}</span><span class="ww-g">${lem && lem[4] ? esc(shortGloss(id, g)) : '·'}</span></button>`;
        }
        html += `</div><p class="verse-de">${D.de ? esc(D.de[v]) : ''}</p><p class="tiny" style="margin:6px 0 0">Übersetzung: Bubenheim und Elyas. Unterstrichen: noch nicht gelernt.</p>
          <div class="row" style="margin-top:14px"><button class="btn grow" data-nav="-1" ${ayahOf(v) === 1 ? 'disabled' : ''}>${ICON.left}<span>Vers ${ayahOf(v) - 1 || ''}</span></button><button class="btn grow" data-nav="1" ${ayahOf(v) === S(n).ayahs ? 'disabled' : ''}><span>Vers ${ayahOf(v) + 1}</span>${ICON.right}</button></div>`;
        body.innerHTML = html;
      };
      if (!D.de) ensure('de').then(() => { if (!sh.closed) draw(); }).catch(() => {});
      draw();
      body.addEventListener('click', e => {
        const nb = e.target.closest('[data-nav]'); if (nb) { v += +nb.dataset.nav; sh.setTitle(`${S(n).tr} ${ref(v)}`); draw(); return; }
        const w = e.target.closest('[data-g]'); if (w && LEX.main[+w.dataset.g] >= 0) LemmaSheet.open(LEX.main[+w.dataset.g], n, +w.dataset.g);
      });
    },
  };

  // ------------------------------------------------------------------ test: the meanings of a surah's words, multiple choice
  const Quiz = {
    open(n, onDone) {
      const su = S(n), x = surahIdx(n);
      const body = el('<div class="card-stage"></div>');
      const sh = openSheet({ title: `Test · ${su.tr}`, body, full: true, onClose: () => { if (onDone) onDone(); } });
      let count = Math.min(10, x.items.length);
      const setup = () => {
        const N = x.items.length;
        body.innerHTML = `<div class="flashcard" style="justify-content:flex-start;padding-top:18px">
            <p class="note" style="max-width:30rem">Wie gut kennst du die Wörter von ${esc(su.tr)}? Jede Frage zeigt ein Wort in seinem Vers. Was du nicht weißt, holt die Lernrunde früher zurück.</p>
            <div class="setting col" style="width:100%;max-width:30rem;text-align:start"><div class="txt"><b>Fragen</b></div>
              <div class="seg" id="qz-n">${[10, 20].filter(k => k < N).map(k => `<button data-v="${k}" aria-pressed="${k === count}">${k}</button>`).join('')}<button data-v="${N}" aria-pressed="${count === N}">Alle ${N}</button></div></div>
          </div>
          <button class="btn primary block" id="qz-go">Test starten</button>`;
        $$('#qz-n button', body).forEach(b => b.addEventListener('click', () => { $$('#qz-n button', body).forEach(y => y.setAttribute('aria-pressed', String(y === b))); count = +b.dataset.v; }));
        $('#qz-go', body).addEventListener('click', run);
      };
      const run = () => {
        const learnt = x.items.filter(id => Vocab.card(id)), fresh = x.items.filter(id => !Vocab.card(id));
        const items = shuffle(learnt).concat(shuffle(fresh)).slice(0, count);
        const qs = shuffle(items).map(id => ({ id, g: x.occ.get(id)[Math.floor(Math.random() * x.occ.get(id).length)], opts: shuffle([id].concat(this.distractors(id, x.items))) }));
        let i = 0, right = 0;
        const wrong = [];
        const ask = () => {
          if (i >= qs.length) return finish();
          const q = qs[i];
          body.innerHTML = `<div class="progress-line"><i style="width:${Math.round(100 * i / qs.length)}%"></i></div>
            <div class="tiny" style="text-align:center;margin-top:8px">Frage ${i + 1} von ${qs.length}</div>
            <div class="lc qz-q"><div class="lc-word q">${esc(D.Q.words[q.g].t)}</div><div class="lc-verse q">${WordCard.excerpt(q.g, 16)}</div><div class="lc-ref">${esc(su.tr)} ${ref(D.Q.words[q.g].v)}</div></div>
            <div class="qz-opts">${q.opts.map(id => `<button class="qz-opt" data-id="${id}">${esc(glossOf(id, id === q.id ? q.g : (x.occ.get(id) || [-1])[0]))}</button>`).join('')}</div>
            <div id="qz-next" style="margin-top:12px" hidden><button class="btn primary block">Weiter</button></div>`;
          const opts = $('.qz-opts', body);
          opts.addEventListener('click', e => {
            const b = e.target.closest('[data-id]'); if (!b || opts.dataset.done) return;
            opts.dataset.done = '1';
            const ok = +b.dataset.id === q.id;
            $$('.qz-opt', opts).forEach(y => { if (+y.dataset.id === q.id) y.classList.add('right'); else if (y === b) y.classList.add('wrong'); else y.classList.add('dim'); });
            if (ok) { right++; setTimeout(() => { i++; ask(); }, 700); }
            else { wrong.push(q.id); $('#qz-next', body).hidden = false; $('#qz-next button', body).addEventListener('click', () => { i++; ask(); }); }
          });
        };
        const finish = () => {
          const pct = Math.round(100 * right / qs.length);
          const tests = Store.data.tests || (Store.data.tests = {});
          const prev = tests[n];
          tests[n] = { last: pct, best: Math.max(pct, prev ? prev.best : 0), at: today(), n: qs.length };
          const d = today();
          for (const id of wrong) { const c = Vocab.card(id); if (c) c.due = Math.min(c.due, d); else Vocab.queue(id); }
          Store.save();
          body.innerHTML = `<div class="flashcard" style="justify-content:flex-start;padding-top:24px">
              <div class="score" style="justify-content:center"><b class="num">${pct} %</b></div>
              <p class="note">${right} von ${qs.length} richtig${prev ? `, vorher ${prev.last} %` : ''}.</p>
              ${wrong.length ? `<div class="section-title" style="align-self:stretch">Zum Lernen <small>kommen in der nächsten Runde zuerst</small></div><div class="list" style="align-self:stretch">${wrong.map(id => { const o = D.lex.lemmas[id]; return `<div class="li lemma-row"><span class="ar q">${esc(o[0])}</span><span class="main"><span class="a">${esc(o[4])}</span></span></div>`; }).join('')}</div>` : '<p class="note">Alles richtig. Masha’Allah!</p>'}
            </div>
            <div class="row">${wrong.length ? '<button class="btn primary grow" id="qz-learn">Jetzt lernen</button>' : ''}<button class="btn grow" id="qz-again">Neuer Test</button><button class="btn grow" id="qz-done">Fertig</button></div>`;
          const lb = $('#qz-learn', body);
          if (lb) lb.addEventListener('click', () => { sh.close(); Learn.start(n); });
          $('#qz-again', body).addEventListener('click', setup);
          $('#qz-done', body).addEventListener('click', () => sh.close());
        };
        ask();
      };
      setup();
    },
    distractors(id, pool) {
      const lm = D.lex.lemmas[id], seen = new Set([firstSense(lm[4]).toLowerCase()]);
      const out = [];
      const take = (list, samePos) => {
        for (const o of list) {
          if (out.length >= 3) break;
          const ol = D.lex.lemmas[o];
          if (!ol || !ol[4] || o === id || out.indexOf(o) >= 0) continue;
          if (samePos && ol[2] !== lm[2]) continue;
          const k = firstSense(ol[4]).toLowerCase();
          if (seen.has(k)) continue;
          out.push(o); seen.add(k);
        }
      };
      const local = shuffle(pool), global = shuffle(LEX.order.slice(0, 900));
      take(local, true); take(global, true); take(local, false); take(global, false);
      return out;
    },
  };
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /** one word: meaning, form, root, where it occurs in the surah, its learning state */
  const LemmaSheet = {
    open(id, n, g0) {
      const l = D.lex.lemmas[id];
      if (!l) return;
      n = n || Vocab.homeSurah();
      const x = surahIdx(n), occ = x.occ.get(id) || [], all = LEX.occ.get(id) || [];
      const c = Vocab.card(id), d = today();
      const body = el('<div></div>');
      const learnt = c ? Object.keys(c.c || {}).map(Number).filter(s => s !== n) : [];
      let state = 'Noch nicht gelernt.';
      if (c) state = `${V.status(c) === 'known' ? 'Sicher' : 'In Arbeit'} · ${c.due <= d ? 'heute fällig' : 'nächste Wiederholung ' + inDays(c.due - d)} · ${c.n}-mal geübt`;
      const here = glossOf(id, g0 != null && g0 >= 0 ? g0 : occ[0]);
      body.innerHTML = `<div class="word-big">${esc(l[0])}</div><p class="gloss">${esc(here || 'ohne Kurzbedeutung')}</p>${here && l[4] && here !== l[4] ? `<p class="gloss-sub">Allgemein: ${esc(l[4])}</p>` : ''}
        <p class="gloss-sub">${posDE(l)}${l[1] ? ', Wurzel <bdi class="q">' + esc(l[1].split('').join(' ')) + '</bdi>' : ''}, ${fmt(l[3])}-mal im Koran</p>
        <p class="ls-state">${state}${learnt.length ? `<br><span class="tiny">Gelernt auch in: ${learnt.map(s => esc(S(s).tr)).join(', ')}</span>` : ''}</p>
        ${occ.length ? `<div class="section-title">In ${esc(S(n).tr)} <small>${occ.length === 1 ? 'einmal' : occ.length + '-mal'}</small></div><div class="list ls-occ">${occ.slice(0, 30).map(g => `<button class="li ls-v${g === g0 ? ' active' : ''}" data-g="${g}"><span class="main"><span class="q ls-q">${WordCard.excerpt(g, 14)}</span><span class="b">${ref(D.Q.words[g].v)}${WordCard.facts(g, id) ? ' · ' + WordCard.facts(g, id) : ''}</span></span></button>`).join('')}</div>` : ''}
        ${all.length > occ.length ? `<p class="tiny" style="margin-top:10px">Im ganzen Koran ${fmt(all.length)}-mal.</p>` : ''}
        <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ls-learn"></button></div>`;
      const sh = openSheet({ title: 'Wort', body });
      body.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; const g = +b.dataset.g; while (sheets.length) sheets[sheets.length - 1].close(); Reader.open(D.Q.words[g].v, { g, flash: true, block: 'center' }); });
      const btn = $('#ls-learn', body);
      if (!l[4]) btn.remove();
      else if (!c && !Vocab.queued(id)) { btn.textContent = 'Als Nächstes lernen'; btn.addEventListener('click', () => { Vocab.queue(id); btn.textContent = 'Vorgemerkt'; btn.disabled = true; }); }
      else if (!c) { btn.textContent = 'Vorgemerkt'; btn.disabled = true; }
      else btn.remove();
      void sh;
    },
  };

  // ------------------------------------------------------------------ settings, backup, install
  const Settings = {
    open(section) {
      const st = Store.data.settings;
      const body = el('<div></div>');
      body.innerHTML = `
        <div class="section-title" style="margin-top:4px">Lernplan</div>
        <button class="ps-row" id="s-plan"><span class="txt"><small>${Store.data.plan ? esc(MODEL[Plan.get().model].name) : 'Noch nicht eingerichtet'}</small><b>${Store.data.plan ? `${num1(Plan.get().weekly)} ${pagesWord(Plan.get().weekly)} pro Woche` : 'Lernplan einrichten'}</b><span>Wochenziel, Reihenfolge und Lernmodell</span></span>${ICON.right}</button>
        <div class="section-title">Rezitation</div>
        <div class="setting col"><div class="txt"><b>Spracherkennung</b><span id="s-engine-desc"></span></div>
          <div class="seg" id="s-engine"><button data-v="web">Browser</button><button data-v="phone">Auf dem Handy</button></div>
          <div class="asr-load" id="s-engine-load" hidden><div class="asr-bar"><i></i></div><span></span></div></div>
        <div class="setting col"><div class="txt"><b>Wie genau soll ich prüfen?</b><span id="s-strict-desc"></span></div>
          <div class="seg" id="s-strict"><button data-v="0">Ganze Wörter</button><button data-v="1">Genauer</button><button data-v="2">Streng</button></div></div>
        <label class="setting"><span class="txt"><b>Hinweise schon beim Lesen zeigen</b><span>Aus: Markierungen erst am Ende</span></span><input type="checkbox" class="switch" id="s-live" ${st.live ? 'checked' : ''}></label>
        <label class="setting"><span class="txt"><b>Gehörtes anzeigen</b><span>Die letzten erkannten Wörter in der Leiste</span></span><input type="checkbox" class="switch" id="s-heard" ${st.heard ? 'checked' : ''}></label>
        <p class="tiny" style="margin:8px 0 0">Tipp: Lies in normaler Lautstärke mit dem Handy vor dir. Tippe beim Rezitieren auf ein Wort, wenn die App an einer anderen Stelle weitermachen soll. Ertönt auf Android bei jedem Neustart der Erkennung ein kurzer Ton, stelle die Medienlautstärke leiser.</p>
        <div class="setting col"><div class="txt"><b>Erkennungsprotokoll</b><span>Hat die App etwas falsch erkannt? Das Protokoll der letzten Rezitation zeigt, was die Spracherkennung gehört hat und was die App daraus gemacht hat. Es bleibt auf dem Gerät, bis du es kopierst und mitschickst.</span></div>
          <button class="btn" id="s-reclog" style="align-self:flex-start">${ICON.copy}<span>Protokoll kopieren</span></button></div>
        <div class="setting col"><div class="txt"><b>Eigene Aufnahmen</b><span>Für die neue Erkennung, die direkt auf dem Handy laufen wird: Nimm deine Rezitation auf, damit sie an deiner Stimme geprüft und später damit trainiert werden kann.</span></div>
          <button class="btn" id="s-recs" style="align-self:flex-start">${ICON.mic}<span>Aufnahmen</span></button></div>
        <div class="section-title">Auswendig prüfen <small>verdeckter Text und Blindtest</small></div>
        <p class="tiny" style="margin:0 0 4px">Die App lässt dich erst weiter, wenn jedes Wort da ist. Hat sie ein Wort nicht gehört, bittet sie dich, ab einer Stelle nochmal zu lesen; beim zweiten Mal nennt sie das Wort.</p>
        <label class="setting"><span class="txt"><b>Hilfen</b><span>Liest du einen falschen Vers, zählt die App deine Versuche. Danach sagt sie, was passiert ist, und gibt dir die letzten Wörter davor zum Neuansetzen, dann Wort für Wort, wie es weitergeht.</span></span><input type="checkbox" class="switch" id="s-hints" ${st.hints !== false ? 'checked' : ''}></label>
        <div class="setting col" id="s-tries-row" ${st.hints === false ? 'hidden' : ''}><div class="txt"><b>Versuche bis zum Hinweis</b></div><div class="seg" id="s-tries"><button data-v="2">2</button><button data-v="3">3</button><button data-v="5">5</button></div></div>
        <div class="section-title">Darstellung</div>
        <div class="setting col"><div class="txt"><b>Erscheinungsbild</b></div><div class="seg" id="s-theme"><button data-v="system">System</button><button data-v="light">Hell</button><button data-v="dark">Dunkel</button></div></div>
        <label class="setting"><span class="txt"><b>Startanimation</b><span>Beim Öffnen schreibt sich eine Mushaf-Seite ins Herz</span></span><input type="checkbox" class="switch" id="s-intro" ${st.intro !== false ? 'checked' : ''}></label>
        <div class="section-title">Wörter</div>
        <div class="setting col"><div class="txt"><b>Neue Wörter pro Tag</b><span>Wie viele Wörter eine Lernrunde neu einführt. Die Wiederholungen plant die App selbst.</span></div><div class="seg" id="s-new"><button data-v="5">5</button><button data-v="10">10</button><button data-v="15">15</button><button data-v="20">20</button></div></div>
        <div class="setting col"><div class="txt"><b>Wie sicher sollen Wörter sitzen?</b><span>Ein Wort kommt wieder, wenn du es nur noch mit dieser Wahrscheinlichkeit weißt (FSRS). Höher heißt öfter wiederholen.</span></div><div class="seg" id="s-vret"><button data-v="0.85">85 %</button><button data-v="0.9">90 %</button><button data-v="0.95">95 %</button></div></div>
        <div class="section-title">Daten und Sicherheit</div>
        <p class="note">Dein Fortschritt wird nur auf diesem Gerät gespeichert. Es gibt kein Konto und keinen Server. Beim Rezitieren wertet die Spracherkennung deines Browsers die Stimme aus (Chrome: Google, Safari: Apple); MyHifz speichert davon nichts. Mit der Erkennung auf dem Handy bleibt die Stimme ganz auf dem Gerät. Eigene Aufnahmen (unter Rezitation) bleiben auf diesem Gerät, bis du sie selbst herunterlädst. Die Schrift der Mushaf-Seiten lädt die App beim ersten Anzeigen von cdn.jsdelivr.net.${Store.ok ? '' : ' <b>Achtung: Speichern ist in diesem Browser blockiert, Fortschritt geht beim Schließen verloren.</b>'}</p>
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
        <p class="tiny" style="line-height:1.6">Korantext und Schrift: King Fahd Glorious Quran Printing Complex (KFGQPC), Hafs ʿan ʿĀṣim, Madina-Mushaf, über Quranpedia.net, Zeichen für Zeichen geprüft gegen die aktuelle Ausgabe des Komplexes (Hafs v30, 2026). Seiten- und Juz-Einteilung: aus den Daten des Komplexes (604 Seiten). Mushaf-Seiten: Zeilen und Seitenschrift QCF4 des King Fahd Complex (Madina-Mushaf 1441 H, Kalligraphie ʿUṯmān Ṭāhā), über quran-qcf4 von Mohamad Hajj Rabee, Zeile für Zeile geprüft gegen das PDF der Ausgabe v30 und Wort für Wort gegen die Seitenschriften der Quranic Universal Library (QUL). Deutsche Übersetzung: Frank Bubenheim und Nadeem Elyas, QuranEnc.com Version 1.1.4. Wortanalyse: Quranic Arabic Corpus (Kais Dukes), überarbeitet von furqan.co. Tajweed-Regeln: cpfair/quran-tajweed (CC BY 4.0) auf Basis des Tanzil-Texts. Deutsche Kurzbedeutungen: für MyHifz erstellt, an Bubenheim und Elyas orientiert, ohne Gewähr. Wiederholungsplanung der Wörter: FSRS-6 von Open Spaced Repetition (MIT). Erkennung auf dem Handy: zipformer_p-arabic v3.1 von Quran Lab, unter der Quran-Lab No-Profit License 1.2 (kostenlos, nie gegen Bezahlung), Lautschrift nach quran-transcript (obadx), ausgeführt mit ONNX Runtime Web (Microsoft, MIT). Automatische Tajweed-Hinweise können falsch sein und ersetzen keinen qualifizierten Lehrer; was die App erkennt, ist kein religiöses Urteil über eine Rezitation.</p>`;
      const sh = openSheet({ title: 'Einstellungen', body });
      const segSel = (id, val, fn) => { const s = $(id, body); $$('button', s).forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === String(val))); b.addEventListener('click', () => { $$('button', s).forEach(x => x.setAttribute('aria-pressed', String(x === b))); fn(b.dataset.v); }); }); };
      const strictDesc = ['Die App meldet sich nur, wenn ein ganzes Wort fehlt, also ausgelassen oder nicht gesagt. Wie du ein Wort aussprichst, bewertet sie nicht. Empfohlen.',
        'Dazu Wörter, die die Erkennung als ein anderes Wort gehört hat. Sie verhört sich dabei manchmal, auch wenn du richtig liest.',
        'Jede Abweichung, die die Erkennung hört, auch einzelne Buchstaben und Dehnungen. Dafür ist sie oft nicht genau genug.'];
      $('#s-strict-desc', body).textContent = strictDesc[st.strict];
      // the recogniser: the browser's, or the Quran model on the phone (loaded once, then offline)
      const engDesc = {
        web: 'Die Erkennung deines Browsers (Chrome: Google, Safari: Apple). Braucht Internet und beginnt nach jeder Pause neu.',
        phone: 'Ein Quran-Modell direkt auf deinem Handy (Quran Lab): Es hört ohne Unterbrechung zu, auch offline, und keine Aufnahme verlässt das Gerät. Lädt einmal etwa 90 MB, am besten im WLAN. Neu und noch in Erprobung. Automatische Tajweed-Hinweise können falsch sein und ersetzen keinen Lehrer.',
      };
      const engLoad = $('#s-engine-load', body);
      const showEngine = () => { $('#s-engine-desc', body).textContent = engDesc[st.engine === 'phone' ? 'phone' : 'web']; };
      const loadModel = () => {
        engLoad.hidden = false;
        const bar = $('i', engLoad), txt = $('span', engLoad);
        const mb = x => Math.round(x / 1048576);
        txt.textContent = ASR.ready ? 'Startet …' : 'Lädt …';
        ASR.load((loaded, total) => { if (total) bar.style.width = Math.round(100 * loaded / total) + '%'; txt.textContent = total ? `Modell: ${mb(loaded)} von ${mb(total)} MB` : `Modell: ${mb(loaded)} MB`; })
          .then(() => { bar.style.width = '100%'; txt.textContent = `Bereit. Gestartet in ${(ASR.info.total / 1000).toFixed(1).replace('.', ',')} s.`; })
          .catch(err => {
            engLoad.hidden = true; st.engine = 'web'; Store.save(); showEngine();
            $$('#s-engine button', body).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === 'web')));
            RecLog.add('error', 'model: ' + (err && err.message));
            Help.speechError('model');
          });
      };
      segSel('#s-engine', st.engine === 'phone' ? 'phone' : 'web', v => {
        if (v === 'phone' && !ASR.supported()) { $$('#s-engine button', body).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === 'web'))); Help.speechError('unsupported-model'); return; }
        st.engine = v; Store.save(); showEngine();
        if (v === 'phone') loadModel(); else engLoad.hidden = true;
      });
      showEngine();
      if (st.engine === 'phone' && ASR.ready) loadModel();
      segSel('#s-strict', st.strict, v => { st.strict = +v; $('#s-strict-desc', body).textContent = strictDesc[st.strict]; Store.save(); if (Rec.tracker) Rec.tracker.opts.strictness = st.strict; Reader.classes(); });
      segSel('#s-theme', st.theme, v => { st.theme = v; Store.save(); applyTheme(); });
      segSel('#s-new', st.newPerDay, v => { st.newPerDay = +v; Store.save(); });
      segSel('#s-vret', st.vret || 0.9, v => { st.vret = +v; Store.save(); });
      $('#s-plan', body).addEventListener('click', () => { sh.close(); PlanSetup.open(); });
      segSel('#s-tries', st.tries || 3, v => { st.tries = +v; Store.save(); Rec.applyHelp(); });
      $('#s-hints', body).addEventListener('change', e => { st.hints = e.target.checked; Store.save(); $('#s-tries-row', body).hidden = !st.hints; Rec.applyHelp(); });
      $('#s-live', body).addEventListener('change', e => { st.live = e.target.checked; Store.save(); if (Rec.active) Reader.root.classList.toggle('marks', st.live); });
      $('#s-heard', body).addEventListener('change', e => { st.heard = e.target.checked; Store.save(); });
      $('#s-intro', body).addEventListener('change', e => { st.intro = e.target.checked; Store.save(); });
      $('#s-reclog', body).addEventListener('click', () => {
        const txt = RecLog.text();
        if (!txt) { toast('Noch kein Protokoll. Rezitiere zuerst etwas.'); return; }
        copyText(txt);
      });
      $('#s-recs', body).addEventListener('click', () => Recordings.open());
      Recordings.summary().then(r => { if (r.n) $('#s-recs span', body).textContent = `Aufnahmen (${r.n} · ${fmtDur(r.secs)} Min.)`; }).catch(() => {});
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
          memLoad(); Plan.ensure(); Store.save(); applyTheme(); updateBadge();
          if (D.lex) Vocab.migrate();                  // a backup of an older version: its word cards
          msg.textContent = 'Übernommen.'; toast('Sicherung übernommen');
          if (App.tab === 'today') Today.render(); if (App.tab === 'hifz') Hifz.render();
          Reader.render(surahOf(Store.data.pos.v || 0), { v: Store.data.pos.v || 0 });
        } catch (e) { msg.textContent = 'Das ist kein gültiger Sicherungscode. Kopiere ihn vollständig, beginnend mit RAHLE1.'; }
      });
      const reset = $('#s-reset', body);
      reset.addEventListener('click', () => {
        if (reset.dataset.armed) {
          // the settings and the plan stay; progress, the round and the days of learning go
          const keep = Store.data.settings, plan = Store.data.plan; Store.data = defaults(); Store.data.settings = keep; Store.data.plan = plan; Store.save(); memLoad(); updateBadge();
          reset.textContent = 'Zurückgesetzt'; reset.disabled = true; Reader.render(Reader.surah);
          if (App.tab === 'today') Today.render(); if (App.tab === 'hifz') Hifz.render();
        } else { reset.dataset.armed = '1'; reset.textContent = 'Wirklich alles löschen? Nochmal tippen'; setTimeout(() => { if (!reset.disabled) { delete reset.dataset.armed; reset.textContent = 'Fortschritt zurücksetzen'; } }, 4000); }
      });
      if (section) setTimeout(() => { const t = $('#' + section, body); if (t) t.scrollIntoView({ block: 'start' }); }, 120);
      void sh;
    },
  };

  // ------------------------------------------------------------------ start screen
  // The page starts writing itself in a small script in index.html; this closes the screen once the first page
  // stands, but not before the page in the heart is written (a tap closes it right away).
  const Splash = {
    hide() {
      const sp = document.getElementById('splash');
      if (!sp || sp.dataset.closing) return;
      sp.dataset.closing = '1';
      let timer = 0;
      const go = () => { clearTimeout(timer); if (!sp.isConnected) return; sp.classList.add('out'); setTimeout(() => sp.remove(), 460); };
      const wait = Math.max(0, (window.__spT0 || 0) + (+sp.dataset.min || 0) - Date.now());
      if (!wait) { go(); return; }
      timer = setTimeout(go, wait);
      sp.addEventListener('click', go, { once: true });
    },
    fail(title, text) {
      const sp = document.getElementById('splash');
      if (!sp) return;
      sp.classList.add('still');
      const m = $('#sp-msg', sp);
      if (m) { m.innerHTML = `<b>${esc(title)}</b><br>${esc(text)}`; m.classList.add('show'); }
    },
  };

  // ------------------------------------------------------------------ boot
  async function boot() {
    Store.load(); memLoad(); applyTheme();
    try { await loadCore(); }
    catch (e) { Splash.fail('Der Korantext konnte nicht geladen werden.', 'Prüfe die Verbindung und lade die Seite neu.'); return; }
    buildFrame();
    Reader.init();
    const pos = Math.min(TOTAL_VERSES - 1, Math.max(0, (Store.data.pos && Store.data.pos.v) || 0));
    const hashTab = TABS.find(t => '#' + TAB_HASH[t] === location.hash);
    await Reader.render(surahOf(pos), pos ? { v: pos } : null);
    // pages of earlier versions and pages memorised before any plan get their records (hifzplan.js)
    if (Plan.ensure()) Store.save();
    showTab(hashTab || Store.data.tab || 'read', true);
    updateBadge();
    Splash.hide();
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
        if (!Rec.active && !Capture.active && !sheets.length && Date.now() - bootAt < 20000) { reloading = true; location.reload(); }
        else toast('Neue Version von MyHifz ist installiert. Sie startet beim nächsten Öffnen.', 4200);
      });
      navigator.serviceWorker.register('sw.js').then(reg => { try { reg.update(); } catch (e) { /* offline */ } }).catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(r => { if (r) r.update().catch(() => {}); }).catch(() => {});
      });
    }
  }
  window.RahleDebug = { D, Store, Rec, Reader, Hifz, Plan, Today, PL, Vocab, LEX, glossOf, Words, Learn, Mushaf, QCF, RecLog, Turn, Mic, Capture, RecStore, Recordings, ASR };
  boot();
})();
