// UI check: the glyphs of a word on the Mushaf pages stand in the right order. A word of the page fonts can be several
// glyphs (لَّوۡ + مَا in 15:7, a sajda sign ۩, a pause sign without width that is drawn over the word): the fonts are made
// for right-to-left text, but their code points (Private Use Area) count as left-to-right characters, so without an
// override a browser sets them the wrong way round (15:7 read مَا لَّوۡ, pause signs stood over the word before).
// For every word with more than one glyph: each glyph must stand at or left of the one before it, and a glyph without
// width (a sign) must start where the word starts (its left edge, where the font draws it from).
// Run: node ui_glyphs.js http://127.0.0.1:8765 QCF4_DIR [first-last | p,p,p]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [,, base, qcfDir, which] = process.argv;
let pages = [];
if (!which) for (let p = 1; p <= 604; p++) pages.push(p);
else if (which.includes('-')) { const [a, b] = which.split('-').map(Number); for (let p = a; p <= b; p++) pages.push(p); }
else pages = which.split(',').map(Number);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('https://cdn.jsdelivr.net/**', route => {
    const name = route.request().url().split('/').pop();
    return route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(qcfDir + '/fonts-woff2/' + name) });
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/index.html');
  await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(2000);
  let words = 0, bad = [];
  for (const pg of pages) {
    await p.evaluate(n => RahleDebug.Mushaf.go(n), pg);
    // wait until the page is drawn in its page font
    await p.waitForFunction(n => { const a = document.querySelector(`.mp[data-page="${n}"] .mp-lines`); return a && !a.classList.contains('uni') && document.fonts.status === 'loaded'; }, pg, { timeout: 20000 });
    const r = await p.evaluate(n => {
      const out = { words: 0, bad: [] };
      for (const w of document.querySelectorAll(`.mp[data-page="${n}"] .mp-lines .w`)) {
        const t = w.firstChild;
        if (!t || t.nodeType !== 3 || t.length < 2) continue;
        out.words++;
        const rects = [];
        for (let i = 0; i < t.length; i++) { const rg = document.createRange(); rg.setStart(t, i); rg.setEnd(t, i + 1); const rc = rg.getBoundingClientRect(); rects.push([rc.left, rc.right, rc.width]); }
        let ok = true;
        for (let i = 1; i < rects.length; i++) {
          if (rects[i][1] > rects[i - 1][1] + 0.6) ok = false;                         // further right than the glyph before
          if (rects[i][2] < 0.6 && Math.abs(rects[i][0] - rects[i - 1][0]) > 0.6) ok = false; // a sign away from its word's start
        }
        if (!ok) out.bad.push(w.dataset.g + ': ' + rects.map(x => x.map(v => v.toFixed(1)).join('/')).join(' '));
      }
      return out;
    }, pg);
    words += r.words;
    for (const x of r.bad) bad.push(pg + ' ' + x);
  }
  console.log(`${pages.length} pages, ${words} words of several glyphs, ${bad.length} in the wrong order`);
  for (const x of bad.slice(0, 15)) console.log('  page ' + x);
  console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
  console.log(!bad.length && !errs.length ? 'ok   all' : 'FAIL');
  await b.close();
})();
