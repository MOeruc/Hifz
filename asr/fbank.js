/* Log-mel filterbank as Kaldi computes it, the features k2/icefall models are trained on and sherpa-onnx feeds them
   (kaldi-native-fbank): 16 kHz, frames of 25 ms every 10 ms, 80 mel bins from 20 Hz to 7600 Hz (high -400 = 400 Hz below
   Nyquist), Povey window, pre-emphasis 0.97, DC offset removed per frame, no dither, centred frames (snip_edges false:
   the first frame reaches before the start and is mirrored there), power spectrum of a 512-point FFT, natural log of the
   mel energies floored at FLT_EPSILON. Samples in [-1, 1].
   Streaming: accept(samples) returns every frame whose window is complete; flush() the rest at the end (mirrored).
   Plain JS, for a worker and for Node. */
(function (root) {
  'use strict';
  const FLT_EPSILON = 1.1920928955078125e-7;
  class Fbank {
    constructor(opts) {
      const o = this.o = Object.assign({ rate: 16000, frameMs: 25, shiftMs: 10, mels: 80, low: 20, high: -400, preemph: 0.97, window: 'povey', removeDC: true }, opts || {});
      const N = this.N = Math.round(o.rate * o.frameMs / 1000);       // 400 samples
      this.S = Math.round(o.rate * o.shiftMs / 1000);                  // 160 samples
      let F = 1; while (F < N) F <<= 1; this.F = F;                    // 512
      this.win = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const a = 2 * Math.PI * i / (N - 1);
        this.win[i] = o.window === 'povey' ? Math.pow(0.5 - 0.5 * Math.cos(a), 0.85)
          : o.window === 'hamming' ? 0.54 - 0.46 * Math.cos(a)
          : o.window === 'hann' ? 0.5 - 0.5 * Math.cos(a) : 1;
      }
      // triangles on the mel scale over the FFT bins 0 .. F/2-1 (Kaldi leaves out the Nyquist bin)
      const nyq = o.rate / 2, hi = o.high > 0 ? o.high : nyq + o.high;
      const mel = f => 1127 * Math.log(1 + f / 700);
      const ml = mel(o.low), mh = mel(hi), d = (mh - ml) / (o.mels + 1), bw = o.rate / F;
      this.banks = [];
      for (let m = 0; m < o.mels; m++) {
        const l = ml + m * d, c = l + d, r = c + d;
        let first = -1; const w = [];
        for (let i = 0; i < F / 2; i++) {
          const x = mel(bw * i);
          if (x > l && x < r) { if (first < 0) first = i; w.push(x <= c ? (x - l) / (c - l) : (r - x) / (r - c)); }
          else if (first >= 0) break;
        }
        this.banks.push({ first, w: Float64Array.from(w) });
      }
      // radix-2 FFT tables
      this.bits = Math.round(Math.log2(F));
      this.rev = new Uint32Array(F);
      for (let i = 0; i < F; i++) { let r = 0; for (let b = 0; b < this.bits; b++) r |= ((i >> b) & 1) << (this.bits - 1 - b); this.rev[i] = r; }
      this.cos = new Float64Array(F / 2); this.sin = new Float64Array(F / 2);
      for (let i = 0; i < F / 2; i++) { this.cos[i] = Math.cos(2 * Math.PI * i / F); this.sin[i] = -Math.sin(2 * Math.PI * i / F); }
      this.re = new Float64Array(F); this.im = new Float64Array(F); this.fr = new Float64Array(N); this.pow = new Float64Array(F / 2 + 1);
      this.reset();
    }
    reset() { this.buf = new Float32Array(4096); this.start = 0; this.len = 0; this.total = 0; this.done = 0; }
    /** stream index of the first sample of frame k (centred frames) */
    first(k) { return k * this.S + (this.S >> 1) - (this.N >> 1); }
    /** sample i of the stream; mirrored before the start, and after the end when the stream is finished */
    at(i, end) {
      while (i < 0 || (end && i >= this.total)) i = i < 0 ? -i - 1 : 2 * this.total - 1 - i;
      return this.buf[i - this.start];
    }
    accept(x) {
      if (this.len + x.length > this.buf.length) {
        const keep = Math.max(0, Math.min(this.len, this.total - Math.max(0, this.first(this.done))));
        // samples before the next frame are no longer needed, except the very first ones (mirrored into frame 0)
        const from = this.done === 0 ? 0 : this.len - keep;
        const nb = new Float32Array(Math.max(this.buf.length, (this.len - from + x.length) * 2));
        nb.set(this.buf.subarray(from, this.len));
        this.buf = nb; this.start += from; this.len -= from;
      }
      this.buf.set(x, this.len); this.len += x.length; this.total += x.length;
      const out = [];
      while (this.first(this.done) + this.N <= this.total) out.push(this.frame(this.done++, false));
      return out;
    }
    /** the frames left at the end of the stream: as many as Kaldi makes for the whole signal, (n + S/2) / S */
    flush() {
      const out = [], n = Math.floor((this.total + (this.S >> 1)) / this.S);
      while (this.done < n) out.push(this.frame(this.done++, true));
      return out;
    }
    frame(k, end) {
      const N = this.N, F = this.F, f0 = this.first(k), fr = this.fr, re = this.re, im = this.im;
      let sum = 0;
      for (let i = 0; i < N; i++) { const v = this.at(f0 + i, end); fr[i] = v; sum += v; }
      if (this.o.removeDC) { const m = sum / N; for (let i = 0; i < N; i++) fr[i] -= m; }
      const p = this.o.preemph;
      if (p) { for (let i = N - 1; i > 0; i--) fr[i] -= p * fr[i - 1]; fr[0] -= p * fr[0]; }
      for (let i = 0; i < F; i++) { const j = this.rev[i]; re[j] = i < N ? fr[i] * this.win[i] : 0; im[j] = 0; }
      for (let size = 2; size <= F; size <<= 1) {
        const half = size >> 1, step = F / size;
        for (let s = 0; s < F; s += size) {
          for (let j = 0; j < half; j++) {
            const wr = this.cos[j * step], wi = this.sin[j * step], a = s + j, b = a + half;
            const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
            re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          }
        }
      }
      const pw = this.pow;
      for (let i = 0; i <= F / 2; i++) pw[i] = re[i] * re[i] + im[i] * im[i];
      const out = new Float32Array(this.o.mels);
      for (let m = 0; m < this.o.mels; m++) {
        const bk = this.banks[m]; let e = 0;
        for (let i = 0; i < bk.w.length; i++) e += bk.w[i] * pw[bk.first + i];
        out[m] = Math.log(Math.max(e, FLT_EPSILON));
      }
      return out;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { Fbank };
  else root.Fbank = Fbank;
})(typeof self !== 'undefined' ? self : this);
