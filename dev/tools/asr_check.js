// The recogniser in the browser (asr/worker.js with onnxruntime-web) against sherpa-onnx: same units, token for
// token, on recitations decoded by sherpa-onnx before (REF_JSON from asr_ref.py), and how fast it runs.
// Run: node asr_check.js http://127.0.0.1:8765 EVERYAYAH_DIR REF_JSON [N]   (REF_JSON from asr_ref.py)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const [,, base, ea, refPath, nArg] = process.argv;
const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
const N = +(nArg || 12);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(base + '/dev/tools/asr_test.html');
  const ready = await p.evaluate(() => start(1));
  console.log('ready', JSON.stringify(ready));
  // a spread of reciters and lengths
  const keys = Object.keys(ref).sort();
  const pick = []; for (let i = 0; i < N; i++) pick.push(keys[Math.floor(i * keys.length / N)]);
  let same = 0, secs = 0, ms = 0, wall = 0;
  for (const k of pick) {
    const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', ea + '/' + k, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
    const r = await p.evaluate(([b64, block]) => decode(b64, block), [raw.toString('base64'), 1600]);
    const mine = r.units.map(u => u.u), want = ref[k].pred;
    const ok = mine.length === want.length && mine.every((u, i) => u === want[i]);
    if (ok) same++;
    secs += r.secs; ms += r.ms; wall += r.wall;
    console.log((ok ? 'same ' : 'DIFF ') + k + `  ${mine.length} units, ${r.secs.toFixed(1)} s audio, model ${r.ms.toFixed(0)} ms` + (ok ? '' : `\n  mine: ${mine.join(' ')}\n  ref:  ${want.join(' ')}`));
  }
  console.log(`token-identical with sherpa-onnx: ${same}/${pick.length}; model time ${(secs / (ms / 1000)).toFixed(1)}x real time, with fbank and messages ${(secs / (wall / 1000)).toFixed(1)}x (1 thread, WebAssembly)`);
  if (errs.length) console.log('errors:', errs.join(' | '));
  await b.close();
})();
