/* MyHifz: the recogniser on the phone, in a worker. A streaming phoneme model for Quran recitation (Quran Lab,
   zipformer_p-arabic v3.1, int8 ONNX, NPL-1.2, see model/LICENSE) run with onnxruntime-web (WebAssembly).
   In: 16 kHz mono blocks from the microphone. Out: the phonetic units heard, with their time and confidence.

   The model is a standard sherpa-onnx streaming CTC zipformer2: every call takes T=61 fbank frames (80 Kaldi mel
   bins, fbank.js) and moves on by decode_chunk_len=48 frames (0.48 s; the 13 frames more are its look-ahead).
   96 attention and convolution caches, embed_states and processed_lens go from each call's outputs into the next
   one, all zero at the start. Each call gives 12 frames of log-probabilities over 251 units (blank 250), 40 ms
   apart. Greedy CTC: a unit is heard where the most likely unit changes to one that is not blank. Token for token
   the same as sherpa-onnx (dev/tools/asr_check.js).

   model.json (made by dev/tools/asr_model.py): {model, tokens, T, shift, blank, states: {name: [dims]}}
   Messages in:  {type:'init', config, threads}  {type:'audio', pcm: Float32Array}  {type:'end'}  {type:'reset'}
   Messages out: {type:'progress', loaded, total}  {type:'ready', ms}  {type:'units', units: [{id, u, t, p, m}],
                  frames, ms, behind}  {type:'ended', frames}  {type:'error', message} */
import * as ort from './ort-1.29.0/ort.wasm.bundle.min.mjs';
import './fbank.js';

let cfg = null, sess = null, outNames = [], id2u = [];
let fb = null, feats = [], base = 0, processed = 0, states = null, prev = -1, frame = 0;
let busy = false, queue = [];

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  const total = +res.headers.get('content-length') || 0;
  if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const parts = []; let loaded = 0, last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); loaded += value.length;
    if (Date.now() - last > 250) { last = Date.now(); postMessage({ type: 'progress', loaded, total }); }
  }
  postMessage({ type: 'progress', loaded, total: total || loaded });
  const out = new Uint8Array(loaded); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function init(msg) {
  const t0 = performance.now();
  const cfgUrl = new URL(msg.config, self.location.href);
  cfg = await (await fetch(cfgUrl)).json();
  ort.env.wasm.numThreads = msg.threads || 1;
  // the glue code is in the bundle; only the WebAssembly binary is fetched, from next to this file
  ort.env.wasm.wasmPaths = { wasm: new URL('./ort-1.29.0/ort-wasm-simd-threaded.wasm', import.meta.url).href };
  const [bytes, tok] = await Promise.all([fetchBytes(new URL(cfg.model, cfgUrl).href), fetch(new URL(cfg.tokens, cfgUrl)).then(r => r.text())]);
  id2u = [];
  for (const ln of tok.split('\n')) { const i = ln.lastIndexOf(' '); if (i > 0) id2u[+ln.slice(i + 1)] = ln.slice(0, i); }
  sess = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  outNames = sess.outputNames;
  reset();
  postMessage({ type: 'ready', ms: Math.round(performance.now() - t0), threads: ort.env.wasm.numThreads });
}

function reset() {
  fb = new self.Fbank(); feats = []; base = 0; processed = 0; prev = -1; frame = 0;
  states = {};
  for (const [name, dims] of Object.entries(cfg.states)) {
    const n = dims.reduce((a, b) => a * b, 1);
    states[name] = name === 'processed_lens' ? new ort.Tensor('int64', new BigInt64Array(n), dims) : new ort.Tensor('float32', new Float32Array(n), dims);
  }
}

/** one call of the model on frames [processed, processed + T) */
async function step() {
  const T = cfg.T, x = new Float32Array(T * 80);
  for (let k = 0; k < T; k++) x.set(feats[processed - base + k], k * 80);
  const t0 = performance.now();
  const out = await sess.run(Object.assign({ x: new ort.Tensor('float32', x, [1, T, 80]) }, states));
  const ms = performance.now() - t0;
  const lp = out[outNames[0]], F = lp.dims[1], V = lp.dims[2], d = lp.data;
  const units = [];
  for (let f = 0; f < F; f++) {
    let b = 0, bv = -Infinity, sv = -Infinity;
    for (let v = 0; v < V; v++) { const z = d[f * V + v]; if (z > bv) { sv = bv; bv = z; b = v; } else if (z > sv) sv = z; }
    if (b !== prev && b !== cfg.blank) units.push({ id: b, u: id2u[b], t: Math.round(frame * 40) / 1000, p: Math.round(Math.exp(bv) * 1000) / 1000, m: Math.round((Math.exp(bv) - Math.exp(sv)) * 1000) / 1000 });
    prev = b; frame++;
  }
  // outputs after log_probs are the new states, in the order of the state inputs (new_<name>)
  for (let k = 1; k < outNames.length; k++) states[outNames[k].replace(/^new_/, '')] = out[outNames[k]];
  processed += cfg.shift;
  const drop = processed - base;
  if (drop > 0) { feats.splice(0, drop); base += drop; }
  return { units, ms, F };
}

async function pump() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      if (job === 'reset') { reset(); continue; }
      if (job === 'end') {
        for (const f of fb.accept(new Float32Array(Math.round(0.66 * 16000)))) feats.push(f);
        for (const f of fb.flush()) feats.push(f);
      } else for (const f of fb.accept(job)) feats.push(f);
      const units = []; let ms = 0, frames = 0;
      while (processed + cfg.T <= base + feats.length) { const r = await step(); for (const u of r.units) units.push(u); ms += r.ms; frames += r.F; }
      if (frames) postMessage({ type: 'units', units, frames, ms: Math.round(ms), behind: queue.length });
      if (job === 'end') { postMessage({ type: 'ended', frames: frame }); reset(); }
    }
  } catch (e) { postMessage({ type: 'error', message: String((e && e.message) || e) }); }
  busy = false;
}

self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'init') await init(m);
    else if (m.type === 'audio') { if (sess) { queue.push(m.pcm); pump(); } }
    else if (m.type === 'end') { if (sess) { queue.push('end'); pump(); } }
    else if (m.type === 'reset') { if (sess) { queue = ['reset']; pump(); } }
  } catch (err) { postMessage({ type: 'error', message: String((err && err.message) || err) }); }
};
