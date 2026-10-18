// UI check: reciting across Mushaf pages with a recogniser that behaves like Chrome on Android: a new session after
// every verse, the first word of a session often lost, interim text growing word by word. The page in view must only
// ever turn forward, no verse start may be reported as not heard, and the isti'adha and basmala are named in the bar.
// Run: node ui_turns.js http://127.0.0.1:8765 OUT_DIR QCF4_DIR
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [,, base, out, qcfDir] = process.argv;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(out, { recursive: true });

function fakeSR() {
  window.__queue = []; window.__busy = false; window.__clip = 0.8; window.__n = 0; window.__seed = 7;
  const rnd = () => (window.__seed = (window.__seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  class FakeSR {
    constructor() { this.stopped = false; }
    start() { this.t = setTimeout(() => { this.began = Date.now(); this.onstart && this.onstart(); this.wait(); }, 250); }   // a phone needs a moment
    stop() { this.stopped = true; window.__busy = false; clearTimeout(this.t); setTimeout(() => this.onend && this.onend(), 10); }
    abort() { this.stop(); }
    wait() {
      if (this.stopped) return;
      if (!window.__queue.length) { this.t = setTimeout(() => this.wait(), 50); return; }
      // the reciter takes his time: he begins only so long after the recogniser listens
      if (window.__delay && Date.now() - this.began < window.__delay) { this.t = setTimeout(() => this.wait(), 50); return; }
      let words = window.__queue.shift().split(' ');
      // said before this session listened: lost
      if (window.__n++ > 0 && words.length > 1 && rnd() < window.__clip) words = words.slice(1);
      window.__busy = true;
      let k = 0;
      const emit = (t, f) => { const x = [{ transcript: t, confidence: 0.9 }]; x.isFinal = f; this.onresult && this.onresult({ results: [x], resultIndex: 0 }); };
      const step = () => {
        if (this.stopped) return;
        k++;
        if (k < words.length) { emit(words.slice(0, k).join(' '), false); this.t = setTimeout(step, 35); }
        else { emit(words.join(' '), true); this.t = setTimeout(() => { window.__busy = false; this.onend && this.onend(); }, 60); }
      };
      step();
    }
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  let fails = 0;
  const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
  async function context(opts) {
    const ctx = await b.newContext(Object.assign({ deviceScaleFactor: 2, serviceWorkers: 'block' }, opts));
    await ctx.route('https://cdn.jsdelivr.net/**', route => {
      const name = route.request().url().split('/').pop();
      return route.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(qcfDir + '/fonts-woff2/' + name) });
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404|fonts\.g|Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
    await p.addInitScript(fakeSR);
    await p.goto(base + '/index.html');
    await p.waitForSelector('.mushaf .mp');
    await p.waitForTimeout(800);
    return { ctx, p };
  }
  // the verses of a surah as the recogniser would write them (plain letters, no marks)
  const verses = (p, s, a1, a2) => p.evaluate(([s, a1, a2]) => {
    const D = RahleDebug.D, out = [];
    for (let a = a1; a <= a2; a++) {
      const v = D.quran.surahs[s - 1].start + a - 1;
      out.push(D.quran.verses[v].replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim());
    }
    return out;
  }, [s, a1, a2]);
  // watch the page in view while reciting: every turn back is noted
  // watch the page in view while reciting (where the slides really are, not what the app thinks): every turn back
  // is noted, and every time the page in view is not the one with the word being recited for more than a moment
  const watch = p => p.evaluate(() => {
    window.__pages = []; window.__back = []; window.__off = [];
    const r = document.querySelector('#reader'), M = RahleDebug.Mushaf;
    let last = -1, offSince = 0, offTold = false;
    const shown = () => {
      const rr = r.getBoundingClientRect(), mid = rr.left + rr.width / 2;
      let best = -1, bd = Infinity;
      const c = Math.max(0, M.cur);
      for (let k = Math.max(0, c - 4); k <= Math.min(M.slides.length - 1, c + 4); k++) {
        const b = M.slides[k].getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };
    window.__watch = setInterval(() => {
      const i = shown();
      const t = RahleDebug.Rec.tracker, D = RahleDebug.D;
      if (i !== last) {
        const sp = M.pagesOf(i)[0];
        window.__pages.push(sp);
        if (last >= 0 && i < last && !(t && t.spot)) window.__back.push(M.pagesOf(last)[0] + '>' + sp);
        last = i;
      }
      if (t && t.mode === 'track' && RahleDebug.Rec.active) {
        let g = t.pointer;
        for (const k of t.tentative.keys()) if (k > g) g = k;
        const want = M.slideOf(M.pageOfWord(Math.min(g, D.Q.words.length - 1)));
        if (want !== i) {
          if (!offSince) offSince = Date.now();
          if (!offTold && Date.now() - offSince > 1500) { offTold = true; window.__off.push('shows ' + M.pagesOf(i)[0] + ', recited on ' + M.pagesOf(want)[0] + ' (app: ' + M.pagesOf(M.cur)[0] + ')'); }
        } else { offSince = 0; offTold = false; }
      }
    }, 50);
  });
  const recite = async (p, list) => {
    for (const x of list) await p.evaluate(t => window.__queue.push(t), x);
    await p.waitForTimeout(300);
    try { await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 60000 }); }
    catch (e) {
      console.log('   stuck:', JSON.stringify(await p.evaluate(() => ({ q: window.__queue.length, busy: window.__busy, active: RahleDebug.Rec.active, paused: RahleDebug.Rec.paused, want: RahleDebug.Rec.speech && RahleDebug.Rec.speech.want, log: RahleDebug.RecLog.lines.slice(-12) }))));
      throw e;
    }
    await p.waitForTimeout(500);
  };
  const result = p => p.evaluate(() => {
    clearInterval(window.__watch);
    const t = RahleDebug.Rec.tracker, D = RahleDebug.D, Q = D.Q;
    const r = t.ranges.length ? [t.ranges[0][0], t.ranges[t.ranges.length - 1][1]] : [0, -1];
    let startMiss = 0, otherMiss = 0;
    for (let g = r[0]; g <= r[1]; g++) {
      if (t.status[g] !== 2 && t.status[g] !== 0) continue;
      if (g === Q.verseStart[Q.words[g].v]) startMiss++; else otherMiss++;
    }
    return { pages: window.__pages, back: window.__back, off: window.__off, startMiss, otherMiss, clips: t.clips.size, ptr: t.pointer, log: RahleDebug.RecLog.lines.length };
  });

  // 1. upright phone, following Ya-Sin 1-40 over several pages
  {
    const { ctx, p } = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[35].start, mode: 'follow' }); });
    await p.waitForTimeout(600);
    await watch(p);
    await recite(p, await verses(p, 36, 1, 40));
    const r = await result(p);
    console.log('   pages in view', r.pages.join(' '), '| said before listening:', r.clips);
    check(r.back.length === 0, 'follow, upright: the page only turns forward' + (r.back.length ? ' (back: ' + r.back.join(', ') + ')' : ''));
    check(r.off.length === 0, 'follow, upright: the page in view is always the recited one' + (r.off.length ? ' (' + r.off.join('; ') + ')' : ''));
    check(r.startMiss === 0, 'follow, upright: no verse start reported as not heard (' + r.startMiss + ', elsewhere ' + r.otherMiss + ')');
    check(r.log > 50, 'recognition log written (' + r.log + ' lines)');
    await p.screenshot({ path: out + '/turns-follow.png' });
    await p.evaluate(() => RahleDebug.Rec.stop('user', true));
    await ctx.close();
  }
  // 2. memorising with hidden text (the gate), al-Mulk 1-30
  {
    const { ctx, p } = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await p.evaluate(() => { const D = RahleDebug.D; const s = D.quran.surahs[66]; RahleDebug.Rec.start({ v: s.start, endV: s.start + 29, mode: 'test' }); });
    await p.waitForTimeout(600);
    await watch(p);
    await recite(p, await verses(p, 67, 1, 30));
    const said = await p.evaluate(() => ({ hint: !document.querySelector('#rec-hint').hidden, text: document.querySelector('#rec-hint-t').textContent }));
    const r = await result(p);
    console.log('   pages in view', r.pages.join(' '), '| said before listening:', r.clips, '| card:', said.hint ? said.text : '-');
    check(r.back.length === 0, 'hidden text: the page only turns forward' + (r.back.length ? ' (back: ' + r.back.join(', ') + ')' : ''));
    check(r.startMiss === 0 && !said.hint, 'hidden text: the app never stopped at a verse start (' + r.startMiss + ')');
    await p.evaluate(() => RahleDebug.Rec.stop('user', true));
    await ctx.close();
  }
  // 3. two pages lying across, following al-Kahf 1-30
  {
    const { ctx, p } = await context({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
    await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[17].start, mode: 'follow' }); });
    await p.waitForTimeout(600);
    await watch(p);
    await recite(p, await verses(p, 18, 1, 30));
    const r = await result(p);
    console.log('   pages in view', r.pages.join(' '));
    check(r.back.length === 0, 'two pages: the spread only turns forward' + (r.back.length ? ' (back: ' + r.back.join(', ') + ')' : ''));
    check(r.off.length === 0, 'two pages: the spread in view is always the recited one' + (r.off.length ? ' (' + r.off.join('; ') + ')' : ''));
    check(r.startMiss === 0, 'two pages: no verse start reported as not heard (' + r.startMiss + ')');
    await p.evaluate(() => RahleDebug.Rec.stop('user', true));
    await ctx.close();
  }
  // 4. tapping the microphone on al-Baqara, then isti'adha and basmala, then al-Mulk: named in the bar, the page stays
  {
    const { ctx, p } = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await p.evaluate(() => RahleDebug.Mushaf.go(8, false, true));
    await p.waitForTimeout(500);
    await p.evaluate(() => RahleDebug.Rec.startFromView());
    await p.waitForTimeout(600);
    await watch(p);
    await p.evaluate(() => window.__queue.push('أعوذ بالله من الشيطان الرجيم'));
    await p.waitForTimeout(250);
    await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 8000 });
    await p.waitForTimeout(150);
    const l2a = await p.evaluate(() => document.querySelector('#rec-l2').textContent);
    await p.evaluate(() => window.__queue.push('بسم الله الرحمن الرحيم'));
    await p.waitForTimeout(250);
    await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 8000 });
    await p.waitForTimeout(150);
    const l2b = await p.evaluate(() => document.querySelector('#rec-l2').textContent);
    await p.screenshot({ path: out + '/turns-basmala.png' });
    const before = await p.evaluate(() => window.__pages.slice());
    check(/Isti'adha gehört/.test(l2a), 'isti\'adha named in the bar: ' + l2a);
    check(/Basmala gehört/.test(l2b), 'basmala named in the bar: ' + l2b);
    check(before.length <= 1, 'the page stays while isti\'adha and basmala are said (' + before.join(' ') + ')');
    await recite(p, await verses(p, 67, 1, 4));
    const st = await p.evaluate(() => ({ l1: document.querySelector('#rec-l1').textContent, page: RahleDebug.Mushaf.page(), bs: RahleDebug.Rec.tracker.basmHeard.has(67) }));
    check(/Al-Mulk|Mulk/.test(st.l1) && st.page === 562, 'then al-Mulk is found and turned to: ' + st.l1 + ', page ' + st.page);
    check(st.bs, 'the basmala of al-Mulk counts as recited');
    await p.screenshot({ path: out + '/turns-mulk.png' });
    // the log can be copied
    const log = await p.evaluate(() => RahleDebug.RecLog.text());
    fs.writeFileSync(out + '/reclog.txt', log);
    check(/phrase isti/.test(log) && /phrase basm/.test(log) && /found 67:1/.test(log), 'the log names isti\'adha, basmala and the place found');
    await p.evaluate(() => RahleDebug.Rec.stop('user', true));
    await ctx.close();
  }
  // 6./7. a phone whose screen is not a whole number of CSS pixels wide (1080 px at 2.625: 411.43 px), far into the
  //    Mushaf: swiped by hand to al-Mulk, then recited from there; upright and lying across (two pages)
  for (const [vw, vh, frac, name] of [[412, 870, 411.43, 'upright'], [915, 412, 914.29, 'two pages']]) {
    const { ctx, p } = await context({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
    await p.addStyleTag({ content: `#reader.mushaf { flex: none !important; width: ${frac}px !important; }` });
    await p.evaluate(() => { window.__clip = 0.8; RahleDebug.Mushaf.relayout(); RahleDebug.Mushaf.go(560, false, true); });
    await p.waitForTimeout(400);
    // a swipe by hand to the next page (or spread), as the reader does it
    await p.evaluate(() => { const r = document.querySelector('#reader'); r.scrollBy({ left: -r.getBoundingClientRect().width * 0.6, behavior: 'auto' }); });
    await p.waitForTimeout(900);
    const at = await p.evaluate(() => ({ app: RahleDebug.Mushaf.page() }));
    await p.evaluate(() => RahleDebug.Rec.startFromView());
    await p.waitForTimeout(600);
    await watch(p);
    await recite(p, ['أعوذ بالله من الشيطان الرجيم', 'بسم الله الرحمن الرحيم'].concat(await verses(p, 67, 1, 30)));
    const r = await result(p);
    console.log('   ' + name + ', 411.43 px wide: swiped to page ' + at.app + ', pages in view ' + r.pages.join(' '));
    check(r.off.length === 0, name + ', fractional width: the page in view is always the recited one' + (r.off.length ? ' (' + r.off.join('; ') + ')' : ''));
    check(r.back.length === 0, name + ', fractional width: the page only turns forward' + (r.back.length ? ' (back: ' + r.back.join(', ') + ')' : ''));
    await p.screenshot({ path: out + '/turns-frac-' + (name === 'upright' ? 'up' : 'spread') + '.png' });
    await p.evaluate(() => RahleDebug.Rec.stop('user', true));
    await ctx.close();
  }
  // 5. memorising, a long pause before each verse (the recogniser listens long before), the first word of 67:2 really
  //    left out: that is told, it was not lost by the recogniser
  {
    const { ctx, p } = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await p.evaluate(() => { window.__clip = 0; window.__delay = 2000; const D = RahleDebug.D; const s = D.quran.surahs[66]; RahleDebug.Rec.start({ v: s.start, endV: s.start + 3, mode: 'test' }); });
    await p.waitForTimeout(600);
    const vs = await verses(p, 67, 1, 2);
    vs[1] = vs[1].split(' ').slice(1).join(' ');
    await recite(p, vs);
    const said = await p.evaluate(() => ({ hint: !document.querySelector('#rec-hint').hidden, text: document.querySelector('#rec-hint-t').textContent, log: RahleDebug.RecLog.lines.filter(l => /listened long|say /.test(l)) }));
    check(said.hint && /nicht ganz gehört|fehlt/.test(said.text), 'a first word really left out (after a long pause) is still told: ' + (said.hint ? said.text : '-') + ' | ' + said.log.join(' / '));
    await p.evaluate(() => RahleDebug.Rec.stop('user', true));
    await ctx.close();
  }
  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' check(s) failed' : 'all turn checks ok');
  process.exitCode = fails ? 1 : 0;
})();
