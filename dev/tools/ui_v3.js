// UI check for update 3: surah picker, per-surah words + test, recitation that finds the surah.
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
  const mk = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: opts.dark ? 'dark' : 'light' });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404|fonts\.g/.test(m.text())) errors.push(m.text()); });
    if (opts.sr) await p.addInitScript(fakeSR, opts.sr);
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForSelector('.w');
    await p.waitForTimeout(500);
    return { ctx, p };
  };
  const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png` });

  // ---------------------------------------------------------------- picker
  {
    const { ctx, p } = await mk();
    await shot(p, 'a1-topbar');
    await p.click('#nav-btn'); await p.waitForTimeout(600);
    await shot(p, 'a2-picker');
    await p.fill('#pk-q', 'kehf'); await p.waitForTimeout(250);
    await shot(p, 'a3-search-kehf');
    const kehf = await p.$$eval('#pk-list .pk-row', r => r.map(x => x.dataset.s));
    await p.fill('#pk-q', '2:255'); await p.waitForTimeout(250);
    await shot(p, 'a4-search-verse');
    await p.fill('#pk-q', 'höhle'); await p.waitForTimeout(200);
    const hoehle = await p.$$eval('#pk-list .pk-row', r => r.map(x => x.dataset.s));
    await p.fill('#pk-q', 'الملك'); await p.waitForTimeout(200);
    const mulk = await p.$$eval('#pk-list .pk-row', r => r.map(x => x.dataset.s));
    await p.fill('#pk-q', ''); await p.waitForTimeout(200);
    await p.click('.pk-head .seg button[data-m="j"]'); await p.waitForTimeout(300);
    await shot(p, 'a5-juz');
    await p.click('.pk-head .seg button[data-m="p"]'); await p.waitForTimeout(300);
    await p.click('[data-step="1"]'); await p.click('[data-step="1"]');
    await shot(p, 'a6-page');
    await p.click('.pk-head .seg button[data-m="s"]'); await p.waitForTimeout(200);
    await p.fill('#pk-q', 'yasin'); await p.waitForTimeout(200);
    await p.press('#pk-q', 'Enter'); await p.waitForTimeout(900);
    const sur = await p.evaluate(() => RahleDebug.Reader.surah);
    await shot(p, 'a7-yasin');
    // reopen: recent chips + active row
    await p.click('#nav-btn'); await p.waitForTimeout(700);
    await shot(p, 'a8-picker-again');
    const chips = await p.$$eval('#pk-chips .chip', r => r.map(x => x.textContent));
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    console.log('picker', JSON.stringify({ kehf, hoehle, mulk, sur, chips }));

    // ---------------------------------------------------------------- words + test for this surah
    await p.evaluate(() => RahleDebug.Reader.render(112)); await p.waitForTimeout(300);
    await p.click('.head-link'); await p.waitForTimeout(900);
    await shot(p, 'b1-surahwords');
    await p.click('#sv-test'); await p.waitForTimeout(500);
    await shot(p, 'b2-test-setup');
    await p.click('#qz-go'); await p.waitForTimeout(400);
    await shot(p, 'b3-question');
    let q = 0, answered = [];
    for (; q < 40; q++) {
      const opts = await p.$$('.qz-opt');
      if (!opts.length) break;
      // answer wrong on the first question, then pick the right one (we peek at the answer key after a wrong pick)
      await opts[q === 0 ? 0 : Math.floor(Math.random() * opts.length)].click();
      await p.waitForTimeout(150);
      if (q === 0) await shot(p, 'b4-answered');
      const right = await p.$('.qz-opt.wrong');
      answered.push(right ? 'wrong' : 'right');
      if (right) { await p.click('#qz-next button'); } else await p.waitForTimeout(800);
      await p.waitForTimeout(150);
    }
    await p.waitForTimeout(300);
    await shot(p, 'b5-result');
    const tests = await p.evaluate(() => RahleDebug.Store.data.tests);
    const queue = await p.evaluate(() => RahleDebug.Store.data.queue.length);
    console.log('quiz', JSON.stringify({ answered, tests, queue }));
    const lb = await p.$('#qz-learn');
    if (lb) { await lb.click(); await p.waitForTimeout(700); await shot(p, 'b6-learn-mistakes'); await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
    // words tab entry + surah list
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.tab[data-tab="words"]').click());
    await p.waitForSelector('#w-surah'); await p.waitForTimeout(400);
    await shot(p, 'b7-words-tab');
    await p.click('#w-surah'); await p.waitForTimeout(700);
    await shot(p, 'b8-words-per-surah');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    // hifz mosaic with "last read" tile
    await p.evaluate(() => { RahleDebug.Store.data.pos = { v: 6230 }; });
    await p.evaluate(() => document.querySelector('.tab[data-tab="hifz"]').click()); await p.waitForTimeout(500);
    await p.evaluate(() => window.scrollTo(0, 260)); await p.waitForTimeout(200);
    await shot(p, 'c1-hifz');
    await ctx.close();
  }
  // ---------------------------------------------------------------- dark mode
  {
    const { ctx, p } = await mk({ dark: true });
    await shot(p, 'd1-dark-reader');
    await p.click('#nav-btn'); await p.waitForTimeout(600);
    await shot(p, 'd2-dark-picker');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.evaluate(() => RahleDebug.Reader.render(103)); await p.waitForTimeout(300);
    await p.click('.head-link'); await p.waitForTimeout(800);
    await p.click('#sv-test'); await p.waitForTimeout(400);
    await p.click('#qz-dir button[data-v="de"]');
    await p.click('#qz-go'); await p.waitForTimeout(400);
    await shot(p, 'd3-dark-question-de');
    await (await p.$$('.qz-opt'))[1].click(); await p.waitForTimeout(200);
    await shot(p, 'd4-dark-answered');
    await ctx.close();
  }
  // ---------------------------------------------------------------- recitation finds the surah
  {
    const phrases = ['يس والقرآن الحكيم', 'إنك لمن المرسلين على صراط مستقيم', 'تنزيل العزيز الرحيم', 'لتنذر قوما ما أنذر آباؤهم فهم غافلون', 'لقد حق القول على أكثرهم فهم لا يؤمنون'];
    const { ctx, p } = await mk({ sr: { phrases, delay: 1500 } });
    await p.evaluate(() => { RahleDebug.Reader.render(2); }); await p.waitForTimeout(300);
    // pretend we are not in the preview so the microphone flow runs
    const prev = await p.evaluate(() => typeof RahleDebug.IS_PREVIEW !== 'undefined' ? RahleDebug.IS_PREVIEW : 'n/a');
    await p.click('#fab'); await p.waitForTimeout(700);
    await shot(p, 'e1-searching');
    const bar1 = await p.$eval('#rec-l1', x => x.textContent);
    await p.waitForTimeout(5200);
    await shot(p, 'e2-found');
    const st = await p.evaluate(() => ({ surah: RahleDebug.Reader.surah, mode: RahleDebug.Rec.tracker.mode, ptr: RahleDebug.Rec.tracker.pointer, l1: document.querySelector('#rec-l1').textContent, toast: (document.querySelector('.toast') || {}).textContent }));
    console.log('recite', JSON.stringify({ prev, bar1, st }));
    await ctx.close();
  }
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
