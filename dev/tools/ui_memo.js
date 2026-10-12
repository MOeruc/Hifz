// UI check: memorising with hidden text. Nothing of the unrecited text shows; a skipped verse is not followed;
// attempts, then what happened, then the next word; the summary marks the word recited with help.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, url, out, theme] = process.argv;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// a scripted recogniser: phrases come one per session, the next one only when window.__go is raised
function fakeSR() {
  window.__queue = []; window.__busy = false;
  class FakeSR {
    constructor() { this.results = []; this.stopped = false; }
    start() { setTimeout(() => { this.onstart && this.onstart(); this.wait(); }, 30); }
    stop() { this.stopped = true; setTimeout(() => this.onend && this.onend(), 10); }
    abort() { this.stop(); }
    wait() {
      if (this.stopped) return;
      if (!window.__queue.length) { setTimeout(() => this.wait(), 60); return; }
      const words = window.__queue.shift().split(' ');
      window.__busy = true;
      let k = 0;
      const emit = (t, f) => { const x = [{ transcript: t, confidence: 0.9 }]; x.isFinal = f; this.onresult && this.onresult({ results: [x], resultIndex: 0 }); };
      const step = () => {
        if (this.stopped) return;
        k++;
        const t = words.slice(0, k).join(' ');
        if (k < words.length) { emit(t, false); setTimeout(step, 40); }
        else { emit(t, true); setTimeout(() => { window.__busy = false; this.onend && this.onend(); }, 80); }   // one phrase per session
      };
      step();
    }
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme === 'dark' ? 'dark' : 'light' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404|fonts\.g/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(fakeSR);
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForSelector('.w'); await p.waitForTimeout(500);
  const V = {
    1: 'تبارك الذي بيده الملك وهو على كل شيء قدير',
    2: 'الذي خلق الموت والحياة ليبلوكم أيكم أحسن عملا وهو العزيز الغفور',
    3: 'الذي خلق سبع سماوات طباقا ما ترى في خلق الرحمن من تفاوت فارجع البصر هل ترى من فطور',
    4: 'ثم ارجع البصر كرتين ينقلب إليك البصر خاسئا وهو حسير',
  };
  const say = async text => { await p.evaluate(t => window.__queue.push(t), text); await p.waitForTimeout(150); await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 8000 }); await p.waitForTimeout(350); };
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });
  const state = () => p.evaluate(() => {
    const t = RahleDebug.Rec.tracker, D = RahleDebug.D;
    const visible = [...document.querySelectorAll('#reader .w')].filter(w => getComputedStyle(w).display !== 'none' && w.getBoundingClientRect().width > 3).length;
    const boxes = [...document.querySelectorAll('#reader .w')].filter(w => getComputedStyle(w).display !== 'none' && !w.classList.contains('v') && !w.classList.contains('cur')).length;
    const markers = [...document.querySelectorAll('#reader .an')].filter(m => getComputedStyle(m).display !== 'none').length;
    const v = D.Q.words[Math.min(t.pointer, D.Q.words.length - 1)].v;
    return { ptr: D.Q.verseSurah[v] + ':' + D.Q.verseAyah[v] + '#' + D.Q.words[t.pointer].k, tries: t.tries, level: t.level, visible, boxes, markers,
      l2: document.querySelector('#rec-l2').textContent, hint: document.querySelector('#rec-hint').hidden ? '' : document.querySelector('#rec-hint-t').textContent,
      help: !document.querySelector('#rec-help').hidden, strict: document.querySelector('#recbar').classList.contains('strict') };
  });
  // a memorisation test of al-Mulk 1-5, as from the Hifz tab
  await p.evaluate(() => { const D = RahleDebug.D; const s = D.quran.surahs[66]; RahleDebug.Rec.start({ v: s.start, endV: s.start + 4, mode: 'test' }); });
  await p.waitForTimeout(800);
  const log = [];
  log.push(['start', await state()]); await shot('m1-start');
  await say(V[1]); await say(V[2]);
  log.push(['after 1-2', await state()]); await shot('m2-recited');
  await say(V[4]);
  log.push(['skip once', await state()]); await shot('m3-attempt');
  await say(V[4]); await say(V[4]);
  log.push(['skip 3x', await state()]); await shot('m4-diag');
  await say(V[4]); await say(V[4]); await say(V[4]);
  log.push(['skip 6x', await state()]); await shot('m5-word');
  await say(V[3]);
  log.push(['verse 3', await state()]); await shot('m6-after');
  await p.click('#rec-help'); await p.waitForTimeout(300);
  log.push(['help button', await state()]); await shot('m7-help');
  await say(V[4]);
  log.push(['verse 4', await state()]);
  await p.click('#rec-hide'); await p.waitForTimeout(300);
  log.push(['text shown', await state()]); await shot('m8-shown');
  await p.click('#rec-stop'); await p.waitForTimeout(700);
  await shot('m9-summary');
  const sum = await p.evaluate(() => [...document.querySelectorAll('.issue .it b')].map(x => x.textContent));
  for (const [k, v] of log) console.log(k.padEnd(12), JSON.stringify(v));
  console.log('summary issues', JSON.stringify(sum));
  // settings: the new section
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('#settings-btn'); await p.waitForTimeout(500);
  const sec = await p.$('#s-hints');
  await (await p.$('#s-hints')).scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await shot('m10-settings');
  console.log('settings section', !!sec);
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
