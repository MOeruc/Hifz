"""Merge German glosses into a lexicon and compact the morphology file.

Usage: python3 -I build_lexicon.py DATA_DIR GLOSS_DIR
Reads DATA_DIR/morph.json and GLOSS_DIR/out_*.json, writes DATA_DIR/lex.json and DATA_DIR/words.json
"""
import json, sys, os, glob, unicodedata

DATA, GL = sys.argv[1:3]
m = json.load(open(os.path.join(DATA, 'morph.json'), encoding='utf-8'))
lemmas = m['lemmas']
gloss = {}
for f in sorted(glob.glob(os.path.join(GL, 'out_*.json'))):
    for k, v in json.load(open(f, encoding='utf-8')).items():
        gloss[int(k)] = v.strip()

FIX = {  # small editorial adjustments after review
    'أَنزَلَ': 'herabsenden, offenbaren',
}

# canonical pronoun lemmas (whole-word or after a prefix like بِ / لَ)
PRON_DISPLAY = {
    'هم': 'هُمۡ', 'هو': 'هُوَ', 'كم': 'ـكُمۡ', 'ه': 'ـهُۥ', 'هۦ': 'ـهُۥ', 'هۥ': 'ـهُۥ', 'أنتم': 'أَنتُمۡ', 'ها': 'ـهَا',
    'نا': 'ـنَا', 'نحن': 'نَحۡنُ', 'ك': 'ـكَ', 'أنت': 'أَنتَ', 'ى': 'ـِي', 'ي': 'ـِي', 'أنا': 'أَنَا', 'هى': 'هِيَ', 'هي': 'هِيَ',
    'هما': 'هُمَا', 'كما': 'ـكُمَا', 'هن': 'هُنَّ', 'كن': 'ـكُنَّ', 'أنتما': 'أَنتُمَا', 'أنتن': 'أَنتُنَّ',
}
alias = {}
canon_by_display = {}
for i, (lem, root, pos, freq) in enumerate(lemmas):
    if pos == 'PRON':
        disp = PRON_DISPLAY.get(lem, lem)
        if disp in canon_by_display:
            alias[i] = canon_by_display[disp]
        else:
            canon_by_display[disp] = i

def to_qpc_marks(s):
    # corpus lemmas use the plain sukun; the KFGQPC font draws the mushaf sukun at U+06E1
    return s.replace('ْ', 'ۡ')

# recompute frequencies with aliases folded in
freq = [0] * len(lemmas)
feat_idx = {}
feats = []
words_out = []
for vw in m['words']:
    vout = []
    for w in vw:
        if not w:
            vout.append([])
            continue
        flat = []
        for end, pos, lid, fs, main in w:
            if lid in alias:
                lid = alias[lid]
            key = pos + ('|' + fs if fs else '')
            if key not in feat_idx:
                feat_idx[key] = len(feats)
                feats.append(key)
            flat += [end, feat_idx[key], lid]
            if main and lid >= 0:
                freq[lid] += 1
        vout.append(flat)
    words_out.append(vout)

lex = []
for i, (lem, root, pos, _) in enumerate(lemmas):
    if i in alias:
        lex.append(None)
        continue
    disp = PRON_DISPLAY.get(lem, lem) if pos == 'PRON' else to_qpc_marks(lem)
    g = FIX.get(lem, gloss.get(i, ''))
    lex.append([disp, root, pos, freq[i], g])

json.dump({'source': 'Lemmata/Wurzeln: Quranic Arabic Corpus (GPL); deutsche Kurzbedeutungen für diese App erstellt, an Bubenheim & Elyas orientiert',
           'feats': feats, 'lemmas': lex}, open(os.path.join(DATA, 'lex.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
json.dump({'words': words_out}, open(os.path.join(DATA, 'words.json'), 'w', encoding='utf-8'), separators=(',', ':'))
glossed = [l for l in lex if l and l[4]]
tot = sum(l[3] for l in lex if l)
cov = sum(l[3] for l in glossed)
print('lemmas', sum(1 for l in lex if l), 'glossed', len(glossed), 'coverage of glossed %.1f%%' % (100 * cov / tot), 'feature strings', len(feats))
