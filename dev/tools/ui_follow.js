// UI check: the reader follows the reciter into another surah, also backwards, and shows the basmala as recited.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, url, out] = process.argv;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function fakeSR({ phrases, delay }) {
  window.__pi = 0;
  class FakeSR {
    constructor() { this.results = []; this.stopped = false; }
    start() { setTimeout(() => { this.onstart && this.onstart(); setTimeout(() => this.run(0), window.__pi === 0 ? delay : 0); }, 30); }
    stop() { this.stopped = true; setTimeout(() => this.onend && this.onend(), 10); }
    abort() { this.stop(); }
    emit() {
      const list = this.results.map(r => { const x = [{ transcript: r.t, confidence: 0.9 }]; x.isFinal = r.f; return x; });
      this.onresult && this.onresult({ results: list, resultIndex: 0 });
    }
    run(n) {
      if (this.stopped) return;
      if (window.__pi >= phrases.length || n >= 2) { setTimeout(() => { if (!this.stopped) this.onend && this.onend(); }, 60); return; }
      const words = phrases[window.__pi++].split(' ');
      let k = 0;
      const step = () => {
        if (this.stopped) return;
        k++;
        const t = words.slice(0, k).join(' ');
        const last = this.results[this.results.length - 1];
        if (k < words.length) { if (last && !last.f) last.t = t; else this.results.push({ t, f: false }); this.emit(); setTimeout(step, 70); }
        else { if (last && !last.f) { last.t = t; last.f = true; } else this.results.push({ t, f: true }); this.emit(); setTimeout(() => this.run(n + 1), 150); }
      };
      step();
    }
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const phrases = ['أعوذ بالله من الشيطان الرجيم', 'بسم الله الرحمن الرحيم', 'قل أعوذ برب الناس', 'ملك الناس', 'إله الناس', 'من شر الوسواس الخناس', 'الذي يوسوس في صدور الناس', 'من الجنة والناس',
    'بسم الله الرحمن الرحيم', 'قل أعوذ برب الفلق', 'من شر ما خلق', 'ومن شر غاسق إذا وقب'];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404|fonts\.g/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(fakeSR, { phrases, delay: 900 });
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForSelector('.w'); await p.waitForTimeout(600);
  const toasts = [];
  await p.exposeFunction('__toast', t => toasts.push(t));
  await p.evaluate(() => { new MutationObserver(() => { const t = document.querySelector('#toast'); if (t && !t.hidden) window.__toast(t.textContent); }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }); });
  await p.click('#fab');
  const seen = [];
  for (let i = 0; i < 90; i++) {
    await p.waitForTimeout(250);
    const s = await p.evaluate(() => RahleDebug.Reader.surah);
    if (seen[seen.length - 1] !== s) seen.push(s);
    if (i === 14) await p.screenshot({ path: out + '/f1-nas.png' });
  }
  await p.screenshot({ path: out + '/f2-falaq.png' });
  const st = await p.evaluate(() => ({ surah: RahleDebug.Reader.surah, basmHeard: !!document.querySelector('.basmala.heard'), mode: RahleDebug.Rec.tracker.mode, last: RahleDebug.Rec.tracker.lastHeard }));
  console.log('follow', JSON.stringify({ seen, st, toasts: [...new Set(toasts)] }));
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
