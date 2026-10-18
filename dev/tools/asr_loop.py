"""The streaming loop the browser will run, in Python: our own Kaldi fbank (numpy, as dev/tools/fbank_ref.py), chunks
of T=61 frames advanced by decode_chunk_len=48, the 96 caches + embed_states + processed_lens carried from call to
call, greedy CTC over all output frames. Compared token for token with sherpa-onnx (ref_decode.py output).
Run: python3 dev/tools/asr_loop.py QLAB_DIR EVERYAYAH_DIR REF_JSON [N_FILES]   (REF_JSON from asr_ref.py)
"""
import json
import os
import subprocess
import sys
import time

import numpy as np
import onnxruntime as ort

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbank_ref import kaldi_fbank  # noqa: E402

qlab, ea, refp = sys.argv[1], sys.argv[2], sys.argv[3]
nmax = int(sys.argv[4]) if len(sys.argv) > 4 else 40
ref = json.load(open(refp, encoding='utf-8'))
units = [ln.rsplit(' ', 1)[0] for ln in open(os.path.join(qlab, 'tokens.txt'), encoding='utf-8').read().split('\n') if ln.strip()]
id2u = {}
for ln in open(os.path.join(qlab, 'tokens.txt'), encoding='utf-8'):
    if ln.strip():
        u, i = ln.rstrip('\n').rsplit(' ', 1)
        id2u[int(i)] = u
so = ort.SessionOptions(); so.intra_op_num_threads = 1
sess = ort.InferenceSession(os.path.join(qlab, 'zipformer_p_arabic_v3.1.int8.onnx'), so, providers=['CPUExecutionProvider'])
meta = sess.get_modelmeta().custom_metadata_map
T, SHIFT = int(meta['T']), int(meta['decode_chunk_len'])
ins, outs = sess.get_inputs(), sess.get_outputs()
BLANK = 250


def init_states():
    st = {}
    for i in ins[1:]:
        shp = [1 if isinstance(d, str) else d for d in i.shape]
        st[i.name] = np.zeros(shp, dtype=np.int64 if 'int64' in i.type else np.float32)
    return st


def decode(x):
    feats = kaldi_fbank(np.concatenate([x, np.zeros(int(0.66 * 16000), dtype=np.float32)]))
    st = init_states()
    ids = []
    p = 0
    while p + T <= len(feats):
        feed = {'x': feats[None, p:p + T].astype(np.float32)}
        feed.update(st)
        o = sess.run(None, feed)
        ids.extend(o[0][0].argmax(-1).tolist())
        for k, i in enumerate(ins[1:]):
            st[i.name] = o[k + 1]
        p += SHIFT
    toks, prev = [], -1
    for t, u in enumerate(ids):
        if u != prev and u != BLANK:
            toks.append((id2u[u], t * 0.04))
        prev = u
    return toks


same = diff = 0
t_audio = t_cpu = 0.0
for rel in sorted(ref)[:nmax]:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(ea, rel), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype='<f4').copy()
    t0 = time.time(); toks = decode(x); t_cpu += time.time() - t0; t_audio += len(x) / 16000
    mine = [u for u, _ in toks]
    if mine == ref[rel]['pred']:
        same += 1
    else:
        diff += 1
        print('DIFF', rel, len(mine), len(ref[rel]['pred']))
print(f'token-identical with sherpa-onnx: {same}/{same + diff}; {t_audio:.0f} s audio in {t_cpu:.1f} s ({t_audio / t_cpu:.1f}x real time, 1 thread, onnxruntime python)')
