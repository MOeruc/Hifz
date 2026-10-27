"""The word lexicon of MyHifz: lemmas with German short meanings, and the segments of every word of the Quran.

Usage: python3 -I build_lexicon.py DATA_DIR GLOSSES_JSON SENSES_JSON
Reads DATA_DIR/morph.json and DATA_DIR/quran.json (from build_quran.py), GLOSSES_JSON (dev/data/glosses_de.json:
{lemma id: German short meaning}) and SENSES_JSON (dev/data/senses_de.json, see below); writes DATA_DIR/lex.json and
DATA_DIR/words.json.

lex.json:  lemmas[id] = [display, root, pos, occurrences, German meaning] (null where a lemma has no words of its own),
           feats (the feature strings of the segments), moved {old id: [new ids]}, split {sense id: lemma id} and
           alt {"surah:ayah:word": meaning in this verse} (see below)
words.json: words[verse][word] = [end, feature index, lemma id] per segment of the word (end: offset in the word)

Word forms that the corpus files under one lemma but that look and mean too different for one card are learnt as words
of their own, with ids of their own from the lemma table (pos FORM): the demonstratives (ذا: ذَٰلِكَ, هَٰذَا, تِلۡكَ,
أُوْلَٰٓئِكَ ...), the relative pronouns (الَّذِي: ٱلَّذِي, ٱلَّذِينَ, ٱلَّتِي ...) and ذُو (ذُو, ذَات, أُوْلُواْ). Progress
learnt under the old lemma moves to the new ids (lex.json "moved").

Every card shows the meaning of the word in its own verse. SENSES_JSON lists, per lemma id, the verses where a lemma
means something else than its gloss:
  "senses": [{"key", "gloss", "at": ["surah:ayah:word", ...]}]: another word to learn, with an id of its own from the
            lemma table ([key, lemma id, "SENSE"]): a name (Malik, the angel of 43:77, under مالِك "Herrscher"), a
            homonym (عَيۡن "Quelle" and "Auge"), Allah's name where people use the word in blame (ٱلۡجَبَّارُ in 59:23).
            Instead of "at", particles name their use by the corpus tags: "tags" (of the word itself, ما "SUB") and
            "with" (of another part of the written word, إِنَّ with the ما "PREV" of إِنَّمَا).
            The app moves progress made in a surah that now has only the new word (lex.json "split").
  "alt":    [{"gloss", "at": [...]}]: the same word and meaning, worded for these verses ("Angesicht (Allahs)" for
            وَجۡه), shown on the cards of these verses (lex.json "alt").
"""
import json, sys, os, unicodedata, collections

DATA, GLOSSES, SENSES = sys.argv[1:4]
m = json.load(open(os.path.join(DATA, 'morph.json'), encoding='utf-8'))
quran = json.load(open(os.path.join(DATA, 'quran.json'), encoding='utf-8'))
lemmas = m['lemmas']
gloss = {int(k): v.strip() for k, v in json.load(open(GLOSSES, encoding='utf-8')).items()}
senses = json.load(open(SENSES, encoding='utf-8'))

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

# ------------------------------------------------------------------ meanings of single verses
sense_id = {(int(root), lem): i for i, (lem, root, pos, _) in enumerate(lemmas) if pos == 'SENSE'}
sense_at, alt_at, sense_base = {}, {}, {}           # ref -> (lemma id, sense id) / (lemma id, meaning); sense id -> lemma id
sense_rules = collections.defaultdict(list)          # lemma id -> [(tags, tags of another part, sense id)]
missing_ids = []
for b, e in senses.items():
    if b.startswith('_'):
        continue
    base = int(b)
    assert lemmas[base][2] != 'SENSE', b
    assert lemmas[base][2] == 'FORM' or strip(lemmas[base][0]) == strip(e['lemma']), ('wrong lemma id in ' + SENSES, b, e['lemma'], lemmas[base][0])
    for x in e.get('senses', []):
        sid = sense_id.get((base, x['key']))
        if sid is None:
            missing_ids.append([x['key'], str(base), 'SENSE'])
            continue
        assert ';' not in x['gloss'] and x['gloss'].strip(), (b, x)
        gloss[sid] = x['gloss'].strip()
        sense_base[sid] = base
        if 'tags' in x or 'with' in x:
            assert 'at' not in x, x
            sense_rules[base].append((set(x.get('tags', [])), set(x.get('with', [])), sid))
            continue
        for r in x['at']:
            assert r not in sense_at and r not in alt_at, ('verse given twice', b, r)
            sense_at[r] = (base, sid)
    for x in e.get('alt', []):
        assert ';' not in x['gloss'] and x['gloss'].strip(), (b, x)
        for r in x['at']:
            assert r not in sense_at and r not in alt_at, ('verse given twice', b, r)
            alt_at[r] = (base, x['gloss'].strip())
if missing_ids:
    sys.exit('add these senses to the end of the lemma table (dev/data/lemma_ids.json), then run build_quran.py again:\n'
             + ',\n'.join(json.dumps(x, ensure_ascii=False) for x in missing_ids))
vref = [(su['n'], a + 1) for su in quran['surahs'] for a in range(su['ayahs'])]
alt, used, rule_used = {}, set(), collections.Counter()

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
            if main:
                r = '%d:%d:%d' % (vref[vi] + (wi + 1,))
                if r in sense_at:
                    assert sense_at[r][0] == lid, ('not a word of this lemma', r, sense_at[r][0], lid)
                    lid = sense_at[r][1]
                    used.add(r)
                elif r in alt_at:
                    assert alt_at[r][0] == lid, ('not a word of this lemma', r, alt_at[r][0], lid)
                    alt[r] = alt_at[r][1]
                    used.add(r)
                elif lid in sense_rules:
                    own = set(fs.split('|'))
                    others = [set(x[3].split('|')) for j, x in enumerate(w) if j != k]
                    for tags, other, sid in sense_rules[lid]:
                        if tags <= own and (not other or any(other <= o for o in others)):
                            rule_used[sid] += 1
                            lid = sid
                            break
            key = pos + ('|' + fs if fs else '')
            if key not in feat_idx:
                feat_idx[key] = len(feats)
                feats.append(key)
            flat += [end, feat_idx[key], lid]
            if main and lid >= 0:
                freq[lid] += 1
        vout.append(flat)
    words_out.append(vout)

unused = sorted((set(sense_at) | set(alt_at)) - used)
assert not unused, ('verses in ' + SENSES + ' without a word of their lemma', unused[:20])
idle = [sid for rules in sense_rules.values() for _, _, sid in rules if not rule_used[sid]]
assert not idle, ('senses by tags that no word has', [lemmas[i][:2] for i in idle])

def display(i):
    lem, root, pos, _ = lemmas[i]
    return PRON_DISPLAY.get(lem, lem) if pos == 'PRON' else to_qpc_marks(lem)

lex = []
moved = collections.defaultdict(list)
split = {}
for i, (lem, root, pos, _) in enumerate(lemmas):
    if i in alias or i in base_of:
        lex.append(None)
        continue
    if pos == 'SENSE':
        base = int(root)
        if not freq[i]:
            lex.append(None)
            continue
        split[i] = base
        lex.append(lex[base][:3] + [freq[i], gloss[i]])        # the table has the senses after their lemmas
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
    lex.append([display(i), root, pos, freq[i], gloss.get(i, '')])

json.dump({'source': 'Lemmata/Wurzeln: Quranic Arabic Corpus (GPL); deutsche Kurzbedeutungen für diese App erstellt, an Bubenheim & Elyas orientiert',
           'feats': feats, 'lemmas': lex, 'moved': moved, 'split': split, 'alt': alt}, open(os.path.join(DATA, 'lex.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
json.dump({'words': words_out}, open(os.path.join(DATA, 'words.json'), 'w', encoding='utf-8'), separators=(',', ':'))
used = [l for l in lex if l and l[3]]
missing = [i for i, l in enumerate(lex) if l and l[3] and not l[4]]
print('lemmas with words', len(used), 'with a German meaning', len(used) - len(missing), 'feature strings', len(feats))
print('word forms:', ', '.join(f'{lex[i][0]} {lex[i][3]}' for ids in moved.values() for i in ids))
print('words of their own for single verses (senses):', len(split), 'verses with a meaning worded for them:', len(alt))
semi = [(i, l[4]) for i, l in enumerate(lex) if l and ';' in l[4]]
assert not semi, ('a meaning with ";" shows meanings of other verses on a card', semi[:10])
if missing:
    print('WITHOUT a German meaning:', len(missing), [(i, lex[i][0]) for i in missing[:20]])
