// UI check: the recogniser on the phone, end to end. A real recitation (al-Mulk 1-5, EveryAyah) comes in through a
// fake microphone; the model is chosen and loaded in the settings, the recitation is started on the page of al-Mulk
// (the app looks for the place itself), and every word of the five verses must be heard.
// Run: node ui_phone.js http://127.0.0.1:8765 OUT_DIR RECITATION_WAV SECONDS
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, base, out, wav, secsArg] = process.argv;
const SECS = +(secsArg || 125);
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + wav + '%noloop'],
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: ['microphone'] });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let ok = true;
  const check = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) ok = false; };
  await p.goto(base + '/index.html');
  await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(2600);
  // choose the recogniser on the phone; it loads with progress
  await p.click('#settings-btn'); await p.waitForTimeout(400);
  await p.click('#s-engine [data-v="phone"]');
  await p.waitForFunction(() => /Bereit/.test(document.querySelector('#s-engine-load span').textContent), null, { timeout: 120000 });
  const loadTxt = await p.textContent('#s-engine-load span');
  await p.screenshot({ path: out + '/phone-settings.png' });
  check(true, 'model loaded: ' + loadTxt);
  await p.click('.sheet [data-close]'); await p.waitForTimeout(400);
  // al-Mulk's page, then recite (the app looks for the place from the page in view)
  await p.evaluate(() => RahleDebug.Mushaf.go(562));
  await p.waitForTimeout(800);
  const t0 = Date.now();
  await p.click('#fab');
  const until = Date.now() + SECS * 1000;
  let shot = false;
  while (Date.now() < until) {
    await p.waitForTimeout(5000);
    const s = await p.evaluate(() => { const t = RahleDebug.Rec.tracker; return { mode: t.mode, ptr: t.pointer, l1: document.querySelector('#rec-l1').textContent, l2: document.querySelector('#rec-l2').textContent }; });
    console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)} s: ${s.mode} ${s.l1} | ${s.l2}`);
    if (!shot && s.mode === 'track') { await p.screenshot({ path: out + '/phone-reciting.png' }); shot = true; }
  }
  const res = await p.evaluate(() => {
    const { D, Rec } = RahleDebug, t = Rec.tracker, Q = D.Q;
    const s = D.quran.surahs[66], g0 = Q.verseStart[s.start], g1 = Q.verseStart[s.start + 5];
    const miss = [];
    for (let g = g0; g < g1; g++) if (t.status[g] !== 1) miss.push((g - g0) + ':' + t.status[g]);
    return { n: g1 - g0, miss, ptr: t.pointer, g1, log: RahleDebug.RecLog.lines.filter(l => /words|model|listen|error|found|jump/.test(l)).slice(0, 40) };
  });
  console.log(res.log.join('\n'));
  await p.click('#rec-stop'); await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/phone-summary.png' });
  check(res.miss.length === 0, `al-Mulk 1-5: ${res.n - res.miss.length}/${res.n} words heard${res.miss.length ? ', not: ' + res.miss.join(' ') : ''}`);
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  console.log(ok ? 'ok   all' : 'FAIL');
  await b.close();
})();
