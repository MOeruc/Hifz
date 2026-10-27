// UI check of every Mushaf page as the browser draws it: nothing swapped, nothing missing, nothing on top of something
// else. For each of the 604 pages, in the page fonts and in the HAFS text font (no page fonts):
//   words      all words of the page, each once, in reading order (data-g from the page's first word on)
//   order      on every line the words, verse markers and hizb signs stand right to left in reading order and do not
//              overlap; the line does not run out of its box
//   glyphs     inside a word of several glyphs (لَّوۡمَا, a sajda sign ۩, a pause sign drawn over the word) every glyph
//              stands at or left of the one before it, and a glyph without width starts where its word starts
//   markers    every verse marker follows the last word of its verse and carries its number; every verse ends with one
//   lines      the kinds of the lines (surah header with its surah, basmala, text) as in mushaf.json
// Run: node ui_order.js http://127.0.0.1:8765 QCF4_DIR [glyphs|text|both] [first-last | p,p,p] [spread]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [,, base, qcfDir, modeArg, which, spreadArg] = process.argv;
const modes = !modeArg || modeArg === 'both' ? ['glyphs', 'text'] : [modeArg];
let pages = [];
if (!which || which === 'all') for (let p = 1; p <= 604; p++) pages.push(p);
else if (which.includes('-')) { const [a, b] = which.split('-').map(Number); for (let p = a; p <= b; p++) pages.push(p); }
else pages = which.split(',').map(Number);
const spread = spreadArg === 'spread';

async function run(mode) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const vp = spread ? { width: 932, height: 430 } : { width: 390, height: 844 };
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('https://cdn.jsdelivr.net/**', route => {
    if (mode === 'text') return route.abort();
    const name = route.request().url().split('/').pop();
    return route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(qcfDir + '/fonts-woff2/' + name) });
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/index.html');
  await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(2000);
  const totals = { pages: 0, lines: 0, words: 0, markers: 0, multi: 0 };
  const bad = [];
  for (const pg of pages) {
    await p.evaluate(n => RahleDebug.Mushaf.go(n), pg);
    await p.waitForFunction(([n, mode]) => {
      const a = document.querySelector(`.mp[data-page="${n}"] .mp-lines`);
      if (!a || document.fonts.status !== 'loaded') return false;
      return mode === 'text' ? a.classList.contains('uni') : !a.classList.contains('uni');
    }, [pg, mode], { timeout: 20000 });
    const r = await p.evaluate(n => {
      const { D } = RahleDebug, Q = D.Q, P = D.mushaf.pages[n - 1];
      const art = document.querySelector(`.mp[data-page="${n}"]`);
      const box = art.querySelector('.mp-lines');
      const glyphs = !box.classList.contains('uni');
      const out = { lines: 0, words: 0, markers: 0, multi: 0, bad: [] };
      const fail = m => { if (out.bad.length < 8) out.bad.push(m); };
      // the kinds of the lines
      const want = P.l.map(L => L[0] === 'h' ? 'h' + L[1] : L[0] === 'b' ? 'b' : 't');
      const got = [...art.querySelectorAll('.ml')].map(el => el.classList.contains('hd') ? 'h' + el.dataset.sh : el.classList.contains('bs') ? 'b' : 't');
      if (want.join() !== got.join()) fail('lines ' + got.join() + ' instead of ' + want.join());
      // the words: each once, in order
      const gs = [...art.querySelectorAll('.ml.t .w')].map(w => +w.dataset.g);
      const end = n < 604 ? D.mushaf.pages[n].g : Q.words.length;
      if (gs.length !== end - P.g || gs.some((g, i) => g !== P.g + i)) fail(`words ${gs[0]}..${gs[gs.length - 1]} (${gs.length}) instead of ${P.g}..${end - 1}`);
      out.words = gs.length;
      let lastV = -1;
      for (const ln of art.querySelectorAll('.ml.t')) {
        out.lines++;
        const lr = ln.getBoundingClientRect();
        const kids = [...ln.children];
        let prev = null, prevEl = null;
        for (const el of kids) {
          const rc = el.getBoundingClientRect();
          if (prev && rc.right > prev.left + 0.6) fail(`line ${out.lines}: ${el.className} ${el.dataset.g || el.dataset.v || ''} stands right of / on ${prevEl.className} ${prevEl.dataset.g || prevEl.dataset.v || ''} (${rc.right.toFixed(1)} > ${prev.left.toFixed(1)})`);
          if (rc.right > lr.right + 0.6 || rc.left < lr.left - 0.6) fail(`line ${out.lines}: ${el.className} ${el.dataset.g || el.dataset.v || ''} outside the line (${rc.left.toFixed(1)}..${rc.right.toFixed(1)} of ${lr.left.toFixed(1)}..${lr.right.toFixed(1)})`);
          // verse markers: after the last word of their verse
          if (el.classList.contains('an')) {
            out.markers++;
            const v = +el.dataset.v, pw = prevEl && prevEl.classList.contains('w') ? Q.words[+prevEl.dataset.g] : null;
            if (!pw || pw.v !== v || Q.verseStart[v + 1] !== +prevEl.dataset.g + 1) fail(`marker of verse ${v} not after its last word`);
            if (v <= lastV) fail(`marker ${v} after marker ${lastV}`);
            lastV = v;
          }
          // the glyphs inside a word
          if (glyphs && el.classList.contains('w')) {
            const t = el.firstChild;
            if (t && t.nodeType === 3 && t.length > 1) {
              out.multi++;
              const rects = [];
              for (let i = 0; i < t.length; i++) { const rg = document.createRange(); rg.setStart(t, i); rg.setEnd(t, i + 1); const c = rg.getBoundingClientRect(); rects.push(c); }
              for (let i = 1; i < rects.length; i++) {
                if (rects[i].right > rects[i - 1].right + 0.6) fail(`word ${el.dataset.g}: glyph ${i + 1} right of glyph ${i}`);
                if (rects[i].width < 0.6 && Math.abs(rects[i].left - rects[i - 1].left) > 0.6) fail(`word ${el.dataset.g}: sign ${i + 1} not at its word`);
              }
            }
          }
          prev = rc; prevEl = el;
        }
      }
      // every verse that ends on this page has its marker
      const ends = new Set(gs.filter(g => Q.verseStart[Q.words[g].v + 1] === g + 1).map(g => Q.words[g].v));
      const marks = new Set([...art.querySelectorAll('.an')].map(m => +m.dataset.v));
      for (const v of ends) if (!marks.has(v)) fail('verse ' + v + ' ends without a marker');
      return out;
    }, pg);
    totals.pages++; totals.lines += r.lines; totals.words += r.words; totals.markers += r.markers; totals.multi += r.multi;
    for (const x of r.bad) bad.push(`page ${pg}: ${x}`);
  }
  console.log(`${mode}${spread ? ', two pages' : ''}: ${totals.pages} pages, ${totals.lines} lines, ${totals.words} words, ${totals.markers} verse markers, ${totals.multi} words of several glyphs; ${bad.length} problems${errs.length ? '; page errors: ' + errs.join(' | ') : ''}`);
  for (const x of bad.slice(0, 30)) console.log('  ' + x);
  await b.close();
  return !bad.length && !errs.length;
}

(async () => {
  let ok = true;
  for (const m of modes) ok = (await run(m)) && ok;
  console.log(ok ? 'ok   all' : 'FAIL');
})();
