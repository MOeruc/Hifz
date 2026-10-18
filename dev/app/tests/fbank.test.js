// The filterbank of the recogniser on the phone (asr/fbank.js) against the numpy reference (tools/fbank_ref.py):
// whole signal at once, and streamed in random pieces (as the microphone delivers it), must give the same frames.
// Run: node dev/app/tests/fbank.test.js dev/testdata/fbank-ref.json
const fs = require('fs');
const path = require('path');
const { Fbank } = require(path.join(__dirname, '..', 'asr', 'fbank.js'));
const ref = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, '..', '..', 'testdata', 'fbank-ref.json'), 'utf8'));
const f32 = s => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
const x = f32(ref.signal), want = f32(ref.fbank);
let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) ok = false; };

function run(pieces) {
  const fb = new Fbank();
  const frames = [];
  let i = 0, lens = 0;
  while (i < x.length) { const n = Math.min(x.length - i, pieces()); frames.push(...fb.accept(x.subarray(i, i + n))); i += n; lens++; }
  const streamed = frames.length;
  frames.push(...fb.flush());
  return { frames, streamed, lens };
}
function diff(frames) {
  let max = 0, at = -1;
  for (let k = 0; k < frames.length; k++) for (let m = 0; m < ref.mels; m++) { const d = Math.abs(frames[k][m] - want[k * ref.mels + m]); if (d > max) { max = d; at = k; } }
  return { max, at };
}
const whole = run(() => x.length);
let d = diff(whole.frames);
check(whole.frames.length === ref.frames, `frames: ${whole.frames.length} (Kaldi: ${ref.frames})`);
check(d.max < 2e-3, `whole signal, largest difference ${d.max.toExponential(2)} (frame ${d.at})`);
// streamed: 100 ms blocks like the microphone, and random sizes down to a single sample
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
for (const [name, pieces] of [['100 ms blocks', () => 1600], ['random pieces', () => 1 + Math.floor(rnd() * 900)], ['single samples', () => 1]]) {
  const r = run(pieces);
  d = diff(r.frames);
  // while streaming, a frame is ready as soon as its 25 ms window is complete: all but the last ones before the end
  const expectStreamed = Math.floor((x.length - 280) / 160) + 1;
  check(r.frames.length === ref.frames && r.streamed === expectStreamed && d.max < 2e-3, `${name} (${r.lens} pieces): ${r.streamed} frames while streaming, ${r.frames.length} with the end, largest difference ${d.max.toExponential(2)}`);
}
// speed: frames per second of audio must be far below real time
const t0 = process.hrtime.bigint();
const fb = new Fbank(); const long = new Float32Array(16000 * 20); for (let i = 0; i < long.length; i++) long[i] = x[i % x.length];
let n = 0; for (let i = 0; i < long.length; i += 1600) n += fb.accept(long.subarray(i, i + 1600)).length;
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
check(ms < 2000, `20 s of audio in ${ms.toFixed(0)} ms (${n} frames)`);
console.log(ok ? 'ok   fbank' : 'FAIL fbank');
process.exitCode = ok ? 0 : 1;
