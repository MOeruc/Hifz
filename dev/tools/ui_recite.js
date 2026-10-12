// End-to-end recitation test with a scripted fake SpeechRecognition.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, url, out, mode] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(() => {
    // phrases: each phrase becomes interim word-by-word, then final; a session ends after 2 phrases
    window.__phrases = [
      'بسم الله الرحمن الرحيم', 'الهمد لله رب العالمين', 'الرحمن الرحيم مالك يوم الدين',
      'إياك نعبد وإياك نستعين', 'اهدنا الصراط المستقيم', 'صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين',
    ];
    window.__pi = 0; window.__log = [];
    class FakeSR {
      constructor() { this.results = []; this.stopped = false; }
      start() {
        setTimeout(() => { this.onstart && this.onstart(); this.run(0); }, 30);
      }
      stop() { this.stopped = true; setTimeout(() => this.onend && this.onend(), 10); }
      emit() {
        const list = this.results.map(r => { const x = [{ transcript: r.t, confidence: 0.9 }]; x.isFinal = r.f; return x; });
        this.onresult && this.onresult({ results: list, resultIndex: 0 });
      }
      run(n) {
        if (this.stopped) return;
        if (window.__pi >= window.__phrases.length || n >= 2) { setTimeout(() => { if (!this.stopped) this.onend && this.onend(); }, 60); return; }
        const words = window.__phrases[window.__pi++].split(' ');
        let k = 0;
        const step = () => {
          if (this.stopped) return;
          k++;
          const t = words.slice(0, k).join(' ');
          if (k < words.length) { this.results[this.results.length - 1] && !this.results[this.results.length - 1].f ? this.results[this.results.length - 1].t = t : this.results.push({ t, f: false }); this.emit(); setTimeout(step, 70); }
          else { const last = this.results[this.results.length - 1]; if (last && !last.f) { last.t = t; last.f = true; } else this.results.push({ t, f: true }); this.emit(); setTimeout(() => this.run(n + 1), 120); }
        };
        step();
      }
    }
    window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
  });
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForSelector('.w');
  await p.waitForTimeout(400);
  if (mode === 'test') {
    await p.click('.an[data-v="0"]'); await p.waitForTimeout(600);
    await p.click('#vs-test');
  } else {
    await p.click('#fab');
  }
  await p.waitForTimeout(1300);
  await p.screenshot({ path: out + '/r1-mid.png' });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: out + '/r2-late.png' });
  const state = await p.evaluate(() => { const t = RahleDebug.Rec.tracker; return { active: RahleDebug.Rec.active, pointer: t.pointer, st: Array.from(t.status.slice(0, 31)) }; });
  console.log('state', JSON.stringify(state));
  if (await p.$('#rec-stop:not([hidden])')) { try { await p.click('#rec-stop', { timeout: 2000 }); } catch (e) { } }
  await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/r3-summary.png' });
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
