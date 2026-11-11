// UI check: learning with counting with the recogniser on the phone, end to end. A real recitation of one verse said
// again and again (al-Ikhlas 1, five times, EveryAyah) comes in through a fake microphone; the model is chosen and
// loaded in the settings, the counting begins at al-Ikhlas 1 (5 times), and every time must be counted.
// Run: node ui_drill_phone.js http://127.0.0.1:8765 OUT_DIR RECITATION_WAV [SECONDS]
// (the WAV: 112001.mp3 of a reciter five times, with a second of silence before and between, e.g. with ffmpeg concat)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, base, out, wav, secsArg] = process.argv;
const SECS = +(secsArg || 45);
(async () => {
  const b = await chromium.launch({
    executablePath: require('./chrome.js'),
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + wav + '%noloop'],
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: ['microphone'] });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let ok = true;
  const check = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) ok = false; };
  await p.addInitScript(() => { if (!localStorage.getItem('rahle.v1')) localStorage.setItem('rahle.v1', JSON.stringify({ v: 1, settings: { intro: false }, tab: 'read' })); });
  await p.goto(base + '/index.html');
  await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(1500);
  // the recogniser on the phone, loaded in the settings
  await p.click('#settings-btn'); await p.waitForTimeout(400);
  await p.click('#s-engine [data-v="phone"]');
  await p.waitForFunction(() => /Bereit/.test(document.querySelector('#s-engine-load span').textContent), null, { timeout: 120000 });
  check(true, 'model loaded: ' + await p.textContent('#s-engine-load span'));
  await p.click('.sheet [data-close]'); await p.waitForTimeout(400);
  // al-Ikhlas, the 20-times method (5 times), without the last portion: the first step is al-Ikhlas 1
  await p.evaluate(() => {
    const R = RahleDebug, v = R.D.quran.surahs[111].start;
    R.Store.data.plan = R.PL.normalize({ model: 'ssm' });
    Object.assign(R.Store.data.settings, { drillN: 5, drillLink: false });
    R.Drill.open([v, v + 1, v + 2, v + 3], true);
  });
  await p.waitForSelector('#drill:not([hidden]) .dw');
  check(await p.textContent('#dr-what') === 'Vers 1', 'first step: ' + await p.textContent('#dr-what'));
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < SECS * 1000) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => ({ i: RahleDebug.Drill.st.i, laps: RahleDebug.Drill.st.laps, n: document.querySelector('#dr-n').textContent }));
    const line = `step ${s.i + 1}, ${s.laps.length} times (${s.laps})`;
    if (line !== last) { console.log('  ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s: ' + line); last = line; }
    if (s.i >= 1) break;
  }
  await p.screenshot({ path: out + '/drill-phone.png' });
  const s = await p.evaluate(() => ({ i: RahleDebug.Drill.st.i, laps: RahleDebug.Drill.st.laps }));
  check(s.i === 1, `al-Ikhlas 1 five times: ${s.i === 1 ? 'counted, on to the next step' : s.laps.length + ' times counted'}`);
  check(errs.length === 0, 'no page errors ' + errs.join(' | '));
  console.log(ok ? 'ok   all' : 'FAIL');
  await b.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
