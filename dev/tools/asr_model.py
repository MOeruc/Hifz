"""model.json for the recogniser on the phone (asr/worker.js): what onnxruntime-web cannot read from the model
itself (custom metadata) and the shapes of the state inputs, for a sherpa-onnx streaming CTC zipformer2 export.

Run: python3 -I dev/tools/asr_model.py MODEL.onnx tokens.txt OUT_DIR/model.json
"""
import json
import os
import sys

import onnxruntime as ort

model, tokens, out = sys.argv[1:4]
s = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
meta = s.get_modelmeta().custom_metadata_map
blank = next(int(ln.rsplit(' ', 1)[1]) for ln in open(tokens, encoding='utf-8') if ln.startswith('<blank> '))
states = {}
for i in s.get_inputs():
    if i.name == 'x':
        continue
    states[i.name] = [1 if isinstance(d, str) else d for d in i.shape]
cfg = {
    'model': os.path.basename(model), 'tokens': os.path.basename(tokens),
    'T': int(meta['T']), 'shift': int(meta['decode_chunk_len']), 'blank': blank,
    'model_type': meta.get('model_type'), 'left_context_len': meta.get('left_context_len'),
    'states': states,
}
json.dump(cfg, open(out, 'w', encoding='utf-8'), indent=1)
n = sum(1 for _ in states)
size = sum(eval('*'.join(map(str, d))) for d in states.values())
print(f'{out}: T={cfg["T"]} shift={cfg["shift"]} blank={blank} {n} state inputs, {size * 4 / 1e6:.1f} MB of state')
