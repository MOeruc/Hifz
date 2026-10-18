"""Reference for dev/app/asr/fbank.js: the Kaldi log-mel filterbank written once more, vectorised in numpy and
independently of the JS code, on a fixed test signal (chirp, two tones, noise, silence). Writes the signal and the
features to a JSON file that tests/fbank.test.js compares against. If kaldi_native_fbank or torchaudio is installed,
it is compared against them as well (the features the models were trained with).

Run: python3 -I dev/tools/fbank_ref.py dev/testdata/fbank-ref.json
"""
import base64
import json
import sys

import numpy as np


def mel(f):
    return 1127.0 * np.log(1.0 + f / 700.0)


def kaldi_fbank(x, sr=16000, frame_len=400, shift=160, n_fft=512, mels=80, low=20.0, high=-400.0, preemph=0.97):
    x = np.asarray(x, dtype=np.float64)
    n = len(x)
    num = (n + shift // 2) // shift
    idx = np.arange(num)[:, None] * shift + shift // 2 - frame_len // 2 + np.arange(frame_len)[None, :]
    while (idx < 0).any() or (idx >= n).any():
        idx = np.where(idx < 0, -idx - 1, idx)
        idx = np.where(idx >= n, 2 * n - 1 - idx, idx)
    fr = x[idx]
    fr = fr - fr.mean(axis=1, keepdims=True)
    pre = fr.copy()
    pre[:, 1:] = fr[:, 1:] - preemph * fr[:, :-1]
    pre[:, 0] = fr[:, 0] - preemph * fr[:, 0]
    i = np.arange(frame_len)
    win = (0.5 - 0.5 * np.cos(2 * np.pi * i / (frame_len - 1))) ** 0.85
    spec = np.fft.rfft(pre * win, n_fft)
    power = spec.real ** 2 + spec.imag ** 2                       # n_fft/2 + 1 bins
    hi = high if high > 0 else sr / 2 + high
    ml, mh = mel(low), mel(hi)
    delta = (mh - ml) / (mels + 1)
    freqs = np.arange(n_fft // 2) * sr / n_fft                     # Kaldi leaves out the Nyquist bin
    mf = mel(freqs)
    left = ml + np.arange(mels)[:, None] * delta
    center, right = left + delta, left + 2 * delta
    up = (mf[None, :] - left) / (center - left)
    down = (right - mf[None, :]) / (right - center)
    banks = np.where((mf[None, :] > left) & (mf[None, :] < right), np.where(mf[None, :] <= center, up, down), 0.0)
    e = power[:, : n_fft // 2] @ banks.T
    return np.log(np.maximum(e, np.finfo(np.float32).eps)).astype(np.float32)


def signal(sr=16000, secs=1.6, seed=7):
    t = np.arange(int(sr * secs)) / sr
    rng = np.random.default_rng(seed)
    chirp = 0.3 * np.sin(2 * np.pi * (100 * t + 1500 * t * t))     # 100 Hz rising to about 4900 Hz
    tones = 0.2 * np.sin(2 * np.pi * 440 * t) + 0.05 * np.sin(2 * np.pi * 3100 * t)
    x = np.where(t < 0.6, chirp, np.where(t < 1.1, tones + 0.01 * rng.standard_normal(len(t)), 0.02 * rng.standard_normal(len(t))))
    x[int(1.4 * sr):] = 0.0                                          # silence at the end (the floor of the log)
    return x.astype(np.float32)


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype='<f4').tobytes()).decode()


def main(out):
    x = signal()
    f = kaldi_fbank(x)
    print('frames', f.shape, 'range', float(f.min()), float(f.max()))
    try:
        import kaldi_native_fbank as knf
        o = knf.FbankOptions()
        o.frame_opts.dither = 0
        o.frame_opts.snip_edges = False
        o.frame_opts.samp_freq = 16000
        o.mel_opts.num_bins = 80
        o.mel_opts.high_freq = -400
        o.mel_opts.low_freq = 20
        fb = knf.OnlineFbank(o)
        fb.accept_waveform(16000, x.tolist())
        fb.input_finished()
        k = np.array([fb.get_frame(i) for i in range(fb.num_frames_ready)])
        print('kaldi_native_fbank', k.shape, 'max diff', float(np.abs(k - f[: len(k)]).max()))
    except ImportError:
        print('kaldi_native_fbank not installed, not compared')
    try:
        import torch
        import torchaudio.compliance.kaldi as tk
        k = tk.fbank(torch.from_numpy(x)[None], num_mel_bins=80, frame_length=25, frame_shift=10, dither=0.0, snip_edges=False,
                     sample_frequency=16000, low_freq=20, high_freq=-400, energy_floor=0.0).numpy()
        print('torchaudio kaldi fbank', k.shape, 'max diff', float(np.abs(k - f[: len(k)]).max()))
    except ImportError:
        print('torchaudio not installed, not compared')
    json.dump({'rate': 16000, 'signal': b64(x), 'frames': int(f.shape[0]), 'mels': int(f.shape[1]), 'fbank': b64(f)}, open(out, 'w'))
    print('written', out)


if __name__ == '__main__':
    main(sys.argv[1])
