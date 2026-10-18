"""Reference decoding of EveryAyah recitations with sherpa-onnx (the runtime the Quran Lab model was exported for),
and the phoneme error rate against the canonical phonemisation (ordered_quran_phonemes.json).
Run: python3 -I dev/tools/asr_ref.py QLAB_DIR EVERYAYAH_DIR OUT_JSON [model file name]
(QLAB_DIR: files of Quran-Lab/zipformer_p-arabic-v3; EVERYAYAH_DIR: RECITER/SSSAAA.mp3; needs sherpa-onnx, ffmpeg)
"""
import json
import os
import subprocess
import sys
import time

import numpy as np
import sherpa_onnx

qlab, ea, out = sys.argv[1], sys.argv[2], sys.argv[3]
model = sys.argv[4] if len(sys.argv) > 4 else 'zipformer_p_arabic_v3.1.int8.onnx'

units = [ln.rsplit(' ', 1)[0] for ln in open(os.path.join(qlab, 'tokens.txt'), encoding='utf-8').read().split('\n') if ln.strip()]
unit_set = sorted({u for u in units if u != '<blank>'}, key=len, reverse=True)
maxlen = max(len(u) for u in unit_set)


def tokenize(s):
    """greedy longest match over the unit inventory (spaces dropped)"""
    s = s.replace(' ', '')
    out, i = [], 0
    while i < len(s):
        for L in range(min(maxlen, len(s) - i), 0, -1):
            if s[i:i + L] in unit_set_lookup:
                out.append(s[i:i + L]); i += L
                break
        else:
            out.append('?' + s[i]); i += 1
    return out


unit_set_lookup = set(unit_set)


def edit(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = cur
    return d[len(b)]


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<f4').copy()


gold_all = json.load(open(os.path.join(qlab, 'ordered_quran_phonemes.json'), encoding='utf-8'))
rec = sherpa_onnx.OnlineRecognizer.from_zipformer2_ctc(tokens=os.path.join(qlab, 'tokens.txt'), model=os.path.join(qlab, model), num_threads=2, decoding_method='greedy_search')
res = {}
tot_e = tot_n = 0
per_rec = {}
t_audio = t_cpu = 0.0
files = sorted(os.path.join(r, f) for r in os.listdir(ea) if os.path.isdir(os.path.join(ea, r)) for f in os.listdir(os.path.join(ea, r)) if f.endswith('.mp3'))
for rel in files:
    p = os.path.join(ea, rel)
    reciter, name = rel.split('/')
    s, a = int(name[:3]), int(name[3:6])
    x = load(p)
    t0 = time.time()
    st = rec.create_stream()
    st.accept_waveform(16000, x)
    st.accept_waveform(16000, np.zeros(int(0.66 * 16000), dtype=np.float32))
    st.input_finished()
    while rec.is_ready(st):
        rec.decode_stream(st)
    r = rec.get_result_all(st)
    t_cpu += time.time() - t0
    t_audio += len(x) / 16000
    pred = list(r.tokens)
    gold = tokenize(gold_all[f'{s}:{a}']['aya_phoneme'])
    e = edit(gold, pred)
    tot_e += e; tot_n += len(gold)
    pr = per_rec.setdefault(reciter, [0, 0, 0, 0]); pr[0] += e; pr[1] += len(gold); pr[2] += 1; pr[3] += e == 0
    res[rel] = {'pred': pred, 'gold': gold, 'times': [round(t, 3) for t in r.timestamps], 'edits': e}
print(f'{len(files)} clips, {t_audio/60:.1f} min audio, decoded in {t_cpu:.1f} s ({t_audio/max(t_cpu,1e-9):.1f}x real time, 2 threads)')
for k, v in sorted(per_rec.items()):
    print(f'  {k:32s} PER {100*v[0]/v[1]:5.2f}%  exact {v[3]}/{v[2]}')
print(f'  ALL PER {100*tot_e/tot_n:.2f}%')
unk = sum(1 for v in res.values() for u in v['gold'] if u.startswith('?'))
print('gold symbols outside the unit inventory:', unk)
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
