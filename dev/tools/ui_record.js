// UI check: the microphone for the recogniser on the phone (16 kHz frames, also resampled in the worklet) and the own
// recordings (record from the settings, save, list, download as zip). The fake microphone plays a WAV file:
// two tones, 440 Hz throughout and 2500 Hz switched on and off every half second.
// Run: node ui_record.js http://127.0.0.1:8765 OUT_DIR TONES_WAV
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [,, base, out, wav] = process.argv;
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + wav, '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', acceptDownloads: true, permissions: ['microphone'] });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/index.html');
  await p.waitForSelector('.mushaf .mp'); await p.waitForTimeout(2600);
  let ok = true;
  const check = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) ok = false; };

  // 1. frames: 16 kHz, both tones there, nothing else; once with the context at 16 kHz, once resampled in the worklet
  for (const native of [false, true]) {
    const r = await p.evaluate(async native => {
      const frames = []; let n = 0, levels = 0;
      const h = await RahleDebug.Mic.open({ frames: f => { frames.push(f); n += f.length; }, level: () => { levels++; }, native });
      const t0 = performance.now();
      await new Promise(res => setTimeout(res, 3000));
      const el = (performance.now() - t0) / 1000;
      h.close();
      const all = new Float32Array(n); let o = 0; for (const f of frames) { all.set(f, o); o += f.length; }
      const x = all.subarray(Math.max(0, n - 16000));           // the last second
      const pw = f => { let re = 0, im = 0; for (let i = 0; i < x.length; i++) { const a = 2 * Math.PI * f * i / 16000; re += x[i] * Math.cos(a); im -= x[i] * Math.sin(a); } return (re * re + im * im) / (x.length * x.length) * 4; };
      let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i];
      return { rate: h.rate, worklet: h.worklet, n, perSec: n / el, levels, a440: Math.sqrt(pw(440)), a2500: Math.sqrt(pw(2500)), a1000: Math.sqrt(pw(1000)), a6000: Math.sqrt(pw(6000)), rms: Math.sqrt(e / x.length) };
    }, native);
    console.log(native ? 'resampled in the worklet' : 'context at 16 kHz', JSON.stringify(r));
    check(r.worklet && (native ? r.rate !== 16000 : r.rate === 16000), (native ? 'worklet resamples from ' + r.rate + ' Hz' : 'audio context runs at 16 kHz'));
    check(r.perSec > 14500 && r.perSec < 17000, 'about 16000 samples a second (' + Math.round(r.perSec) + ')');
    check(r.a440 > 0.15 && r.a440 < 0.35, '440 Hz with its amplitude (' + r.a440.toFixed(3) + ', played 0.25)');
    check(r.a2500 > 0.02, '2500 Hz there (' + r.a2500.toFixed(3) + ')');
    check(r.a1000 < 0.01 && r.a6000 < 0.01, 'nothing at 1000 Hz or 6000 Hz (' + r.a1000.toFixed(4) + ', ' + r.a6000.toFixed(4) + ')');
    check(r.levels >= 40, 'level 20 times a second (' + r.levels + ' in 3 s)');
  }

  // 2. a recording from the settings: bar, save sheet, list, download
  await p.click('#settings-btn'); await p.waitForTimeout(400);
  await p.click('#s-recs'); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/rec-empty.png' });
  await p.click('#rc-new');
  await p.waitForSelector('#capbar:not([hidden])');
  await p.waitForTimeout(3200);
  const bar = await p.evaluate(() => ({ l1: document.querySelector('#cap-l1').textContent, from: document.querySelector('#cap-from').textContent, state: document.querySelector('#capbar').dataset.state, meter: document.querySelector('#capbar .cap-meter i').style.width, fab: document.querySelector('#fab').hidden, recOn: document.body.classList.contains('rec-on') }));
  console.log('bar', JSON.stringify(bar));
  await p.screenshot({ path: out + '/rec-bar.png' });
  check(/^Aufnahme · 0:0[2-4]$/.test(bar.l1) && /^ab /.test(bar.from) && bar.state === 'speech' && parseInt(bar.meter) > 40 && bar.fab && bar.recOn, 'recording: timer, start verse, level, the record button out of the way');
  // going away pauses, Weiter goes on
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(1500);
  const paused = await p.evaluate(() => ({ l1: document.querySelector('#cap-l1').textContent, resume: !document.querySelector('#cap-resume').hidden }));
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
  await p.click('#cap-resume');
  await p.waitForTimeout(800);
  check(/^Pausiert · 0:0[3-4]$/.test(paused.l1) && paused.resume, 'paused when the app is left (' + paused.l1 + ')');
  await p.click('#cap-done');
  await p.waitForSelector('#cs-save');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/rec-save.png' });
  const form = await p.evaluate(() => ({ from: document.querySelector('#cs-from').selectedOptions[0].textContent, to: document.querySelector('#cs-to').selectedOptions[0].textContent, text: document.querySelector('.sheet .note').textContent }));
  console.log('save sheet', JSON.stringify(form));
  await p.click('#cs-kind [data-v="errors"]');
  await p.fill('#cs-note', 'Vers 2 ausgelassen');
  await p.click('#cs-save');
  await p.waitForTimeout(800);
  const saved = await p.evaluate(async () => (await RahleDebug.RecStore.list()).map(m => ({ from: m.fromRef, to: m.toRef, secs: m.secs, kind: m.kind, note: m.note, mime: m.mime, size: m.size, rate: m.rate })));
  console.log('saved', JSON.stringify(saved));
  check(saved.length === 1 && saved[0].secs >= 3.2 && saved[0].secs <= 5 && saved[0].kind === 'errors' && saved[0].note === 'Vers 2 ausgelassen' && saved[0].size > 5000, 'saved with what was read, how, and the time without the pause');
  // the list, playing, the zip
  await p.click('#settings-btn'); await p.waitForTimeout(400);
  const label = await p.textContent('#s-recs span');
  await p.click('#s-recs'); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/rec-list.png' });
  const rows = await p.$$eval('.rc-item', r => r.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  console.log('settings button:', label, '| list:', JSON.stringify(rows));
  check(/Aufnahmen \(1 · 0:0\d Min\.\)/.test(label) && rows.length === 1 && /mit Fehlern/.test(rows[0]), 'listed in the settings and in the list');
  await p.click('.rc-item [data-play]'); await p.waitForTimeout(700);
  const playing = await p.evaluate(() => !!(RahleDebug.Recordings.playing && !RahleDebug.Recordings.playing.a.paused));
  await p.click('.rc-item [data-play]');
  check(playing, 'plays back');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#rc-zip')]);
  const zipPath = out + '/' + dl.suggestedFilename();
  await dl.saveAs(zipPath);
  check(/^myhifz-aufnahmen-\d{4}-\d\d-\d\d\.zip$/.test(dl.suggestedFilename()) && fs.statSync(zipPath).size > 5000, 'zip downloaded: ' + dl.suggestedFilename());
  // deleting needs a second tap
  await p.click('.rc-item [data-del]'); await p.waitForTimeout(300);
  const still = await p.$$eval('.rc-item', r => r.length);
  await p.click('.rc-item [data-del]'); await p.waitForTimeout(500);
  const gone = await p.evaluate(async () => (await RahleDebug.RecStore.list()).length);
  check(still === 1 && gone === 0, 'deleted after the second tap');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  console.log(ok ? 'ok   all' : 'FAIL');
  await b.close();
})();
