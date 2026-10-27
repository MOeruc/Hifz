"""The word lexicon of MyHifz: lemmas with German short meanings, and the segments of every word of the Quran.

Usage: python3 -I build_lexicon.py DATA_DIR GLOSSES_JSON
Reads DATA_DIR/morph.json and DATA_DIR/quran.json (from build_quran.py) and GLOSSES_JSON (dev/data/glosses_de.json:
{lemma id: German short meaning}); writes DATA_DIR/lex.json and DATA_DIR/words.json.

lex.json:  lemmas[id] = [display, root, pos, occurrences, German meaning] (null where a lemma has no words of its own),
           feats (the feature strings of the segments), moved {old id: [new ids]} (see below)
words.json: words[verse][word] = [end, feature index, lemma id] per segment of the word (end: offset in the word)

Word forms that the corpus files under one lemma but that look and mean too different for one card are learnt as words
of their own, with ids of their own from the lemma table (pos FORM): the demonstratives (ذا: ذَٰلِكَ, هَٰذَا, تِلۡكَ,
أُوْلَٰٓئِكَ ...), the relative pronouns (الَّذِي: ٱلَّذِي, ٱلَّذِينَ, ٱلَّتِي ...) and ذُو (ذُو, ذَات, أُوْلُواْ). Progress
learnt under the old lemma moves to the new ids (lex.json "moved").
"""
import json, sys, os, unicodedata, collections

DATA, GLOSSES = sys.argv[1:3]
m = json.load(open(os.path.join(DATA, 'morph.json'), encoding='utf-8'))
quran = json.load(open(os.path.join(DATA, 'quran.json'), encoding='utf-8'))
lemmas = m['lemmas']
gloss = {int(k): v.strip() for k, v in json.load(open(GLOSSES, encoding='utf-8')).items()}

def qpc_words(text):
    return [t for t in text.split() if any(unicodedata.category(c) == 'Lo' for c in t)]

def strip(s):
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn' and c not in 'ـۥۦ')

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

# ------------------------------------------------------------------ word forms learnt on their own
form_id = {lem: i for i, (lem, root, pos, _) in enumerate(lemmas) if pos == 'FORM'}
BASES = {'ذا': 'dem', 'الذي': 'rel', 'ذو': 'dhu'}               # the lemmas split into forms, by their letters
base_id, base_of = {}, {}                                        # dem/rel/dhu -> lemma id, lemma id -> dem/rel/dhu
for i, (lem, root, pos, _) in enumerate(lemmas):
    if pos == 'N' and not root and strip(lem) in BASES:
        base_id[BASES[strip(lem)]] = i
        base_of[i] = BASES[strip(lem)]
    if pos == 'FORM':
        assert strip(root) in BASES, (lem, root)
assert len(base_id) == 3, base_id

def form_of(base, tags, after, text):
    """the form (label in the lemma table) of a demonstrative, relative pronoun or ذُو; tags of its segment, tags of the
    segments after it in the word, its letters"""
    far = any('DIST' in t or 'ADDR' in t for t in after)        # ذَٰ+لِ+كَ, تِ+لۡ+كَ, أُوْلَٰٓئِ+كَ: pointing far
    two = 'MD' in tags or 'FD' in tags
    if base == 'dem':
        if two:
            return 'hadhani'
        if 'FS' in tags:
            return 'tilka' if far else 'hadhihi'
        if 'P' in tags or 'MP' in tags:
            return 'ulaika' if far else 'haulai'
        return 'dhalika' if far else 'hadha'
    if base == 'rel':
        if two:
            return 'alladhani'
        if 'MP' in tags:
            return 'alladhina'
        if 'FS' in tags:
            return 'allati'
        if 'FP' in tags:
            return 'allati_pl'
        return 'alladhi'
    if 'FS' in tags or 'FD' in tags:
        return 'dhat'
    if strip(text).startswith('أول'):
        return 'ulu'
    return 'dhu'

# the letters each form may have (without marks), to catch a wrong rule
FORM_LETTERS = {
    'dhalika': {'ذلك', 'ذلكم', 'ذلكما', 'ذلكن'}, 'hadha': {'هذا', 'ذا'}, 'hadhihi': {'هذه'}, 'tilka': {'تلك', 'تلكم', 'تلكما'},
    'ulaika': {'أولئك', 'أولئكم'}, 'haulai': {'هؤلاء', 'أولاء'}, 'hadhani': {'هذن', 'هذان', 'هتين', 'ذنك'},
    'alladhi': {'ٱلذي', 'لذي'}, 'alladhina': {'ٱلذين', 'لذين'}, 'allati': {'ٱلتي', 'لتي'}, 'allati_pl': {'ٱلتي', 'ٱلي'},
    'alladhani': {'ٱلذان', 'ٱلذين'}, 'dhu': {'ذو', 'ذي', 'ذا', 'ذوا', 'ذوي'}, 'dhat': {'ذات', 'ذواتا', 'ذواتي'},
    'ulu': {'أولوا', 'أولي', 'أولت'},
}

# ------------------------------------------------------------------ the words
words_text = [qpc_words(v) for v in quran['verses']]
freq = [0] * len(lemmas)
feat_idx = {}
feats = []
words_out = []
form_texts = collections.defaultdict(collections.Counter)      # form -> its letters as written (for the display)
form_written = collections.defaultdict(collections.Counter)
for vi, vw in enumerate(m['words']):
    vout = []
    for wi, w in enumerate(vw):
        if not w:
            vout.append([])
            continue
        text = words_text[vi][wi]
        starts = [0] + [seg[0] for seg in w[:-1]]
        flat = []
        for k, (end, pos, lid, fs, main) in enumerate(w):
            if lid in alias:
                lid = alias[lid]
            if main and lid in base_of:
                tags = fs.split('|')
                after = [x[3].split('|') for x in w[k + 1:]]
                # the form as written: from a هَٰ before it to the end of the pointing suffixes after it
                a = starts[k - 1] if k > 0 and 'ATT' in w[k - 1][3].split('|') else starts[k]
                b = end
                for x in w[k + 1:]:
                    if 'DIST' in x[3] or 'ADDR' in x[3]:
                        b = x[0]
                    else:
                        break
                label = form_of(base_of[lid], tags, after, text[starts[k]:end])
                written = text[a:b]
                letters = strip(written)
                assert letters in FORM_LETTERS[label], (label, written, quran['verses'][vi])
                form_texts[label][written] += 1
                lid = form_id[label]
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
moved = collections.defaultdict(list)
for i, (lem, root, pos, _) in enumerate(lemmas):
    if i in alias or i in base_of:
        lex.append(None)
        continue
    if pos == 'FORM':
        if not freq[i]:
            lex.append(None)
            continue
        # the most frequent spelling, without a prefix (ٱلَّذِينَ, not لِّلَّذِينَ)
        disp = max(form_texts[lem].items(), key=lambda x: (x[1], x[0].startswith(('ٱ', 'أ', 'ه', 'ذ', 'ت'))))[0]
        moved[base_id[BASES[strip(root)]]].append(i)
        lex.append([disp, '', 'N', freq[i], gloss.get(i, '')])
        continue
    disp = PRON_DISPLAY.get(lem, lem) if pos == 'PRON' else to_qpc_marks(lem)
    lex.append([disp, root, pos, freq[i], gloss.get(i, '')])

json.dump({'source': 'Lemmata/Wurzeln: Quranic Arabic Corpus (GPL); deutsche Kurzbedeutungen für diese App erstellt, an Bubenheim & Elyas orientiert',
           'feats': feats, 'lemmas': lex, 'moved': moved}, open(os.path.join(DATA, 'lex.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
json.dump({'words': words_out}, open(os.path.join(DATA, 'words.json'), 'w', encoding='utf-8'), separators=(',', ':'))
used = [l for l in lex if l and l[3]]
missing = [i for i, l in enumerate(lex) if l and l[3] and not l[4]]
print('lemmas with words', len(used), 'with a German meaning', len(used) - len(missing), 'feature strings', len(feats))
print('word forms:', ', '.join(f'{lex[i][0]} {lex[i][3]}' for ids in moved.values() for i in ids))
if missing:
    print('WITHOUT a German meaning:', len(missing), [(i, lex[i][0]) for i in missing[:20]])
