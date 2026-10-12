const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, base, out] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  // 1) offline after first visit
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(base + '/index.html', { waitUntil: 'load' });
    await p.waitForSelector('.w');
    const ctrl = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; await new Promise(res => setTimeout(res, 1500)); return !!r.active; });
    await ctx.setOffline(true);
    await p.reload({ waitUntil: 'load' });
    const ok = await p.waitForSelector('.w', { timeout: 15000 }).then(() => true).catch(() => false);
    await p.evaluate(() => document.querySelector('.tab[data-tab="words"]').click());
    const lex = await p.waitForSelector('#w-list .li', { timeout: 15000 }).then(() => true).catch(() => false);
    console.log('1 offline: sw active', ctrl, 'reader after reload', ok, 'words offline', lex);
    await ctx.close();
  }
  // 2) preview mode: microphone explanation
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.addInitScript(() => { window.claude = { use: () => Promise.resolve(null) }; });
    await p.goto(base + '/index.html', { waitUntil: 'load' });
    await p.waitForSelector('.w');
    await p.click('#fab'); await p.waitForTimeout(500);
    const title = await p.textContent('.sheet h2');
    await p.screenshot({ path: out + '/m-preview.png' });
    console.log('2 preview sheet:', title);
    await ctx.close();
  }
  // 3) interruption after first session -> paused with resume button
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      let n = 0;
      class FakeSR { start() { const me = this; n++; setTimeout(() => { if (n === 1) { me.onstart && me.onstart(); const x = [{ transcript: 'بسم الله الرحمن الرحيم الحمد لله' }]; x.isFinal = true; me.onresult({ results: [x], resultIndex: 0 }); setTimeout(() => me.onend && me.onend(), 50); } else { me.onerror && me.onerror({ error: 'not-allowed' }); me.onend && me.onend(); } }, 40); } stop() { setTimeout(() => this.onend && this.onend(), 5); } }
      window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
    });
    await p.goto(base + '/index.html', { waitUntil: 'load' });
    await p.waitForSelector('.w');
    await p.click('#fab'); await p.waitForTimeout(900);
    const st = await p.evaluate(() => ({ active: RahleDebug.Rec.active, paused: RahleDebug.Rec.paused, resumeVisible: !document.querySelector('#rec-resume').hidden, l1: document.querySelector('#rec-l1').textContent, ok: Array.from(RahleDebug.Rec.tracker.status.slice(0, 6)) }));
    await p.screenshot({ path: out + '/m-paused.png' });
    console.log('3 interruption:', JSON.stringify(st));
    await ctx.close();
  }
  await b.close();
})();
