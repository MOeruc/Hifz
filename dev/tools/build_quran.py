"""Build the app's core data files from the downloaded sources.

Usage: python3 -I build_quran.py RISAN_DIR FAWAZ_DIR MORPH_FILE OUT_DIR KFGQPC_HAFS_JSON

Outputs (in OUT_DIR):
  quran.json   surahs, verse texts (KFGQPC Hafs, verbatim), pages, juz, quarters, sajdas
  de.json      German translation (Bubenheim & Elyas, QuranEnc v1.1.4), one string per verse
  morph.json   per-word segments mapped onto the KFGQPC words + lemma table
  lemmas_for_gloss.json  lemma list with contexts (input for the German glossing step)
"""
import json, sys, os, unicodedata, collections

RISAN, FAWAZ, MORPH, OUT, KFGQPC = sys.argv[1:6]
os.makedirs(OUT, exist_ok=True)

qpc = json.load(open(os.path.join(RISAN, 'data/quranpedia/qpc-hafs.json'), encoding='utf-8'))
tan = json.load(open(os.path.join(RISAN, 'data/tanzil/uthmani.json'), encoding='utf-8'))
chap = json.load(open(os.path.join(RISAN, 'data/tanzil/chapters.json'), encoding='utf-8'))['chapters']
deu = json.load(open(os.path.join(RISAN, 'data/quranenc/german_bubenheim.json'), encoding='utf-8'))
info = json.load(open(os.path.join(FAWAZ, 'info.json'), encoding='utf-8'))

# German surah titles and German-friendly transliterations (written for this app).
SURAH_DE = """Al-Fatiha|Die Eröffnende
Al-Baqara|Die Kuh
Al-ʿImran|Die Sippe ʿImrans
An-Nisaʾ|Die Frauen
Al-Maʾida|Der Tisch
Al-Anʿam|Das Vieh
Al-Aʿraf|Die Höhen
Al-Anfal|Die Beute
At-Tauba|Die Reue
Yunus|Jonas
Hud|Hud
Yusuf|Josef
Ar-Raʿd|Der Donner
Ibrahim|Abraham
Al-Hidschr|Al-Hidschr
An-Nahl|Die Biene
Al-Isra|Die Nachtreise
Al-Kahf|Die Höhle
Maryam|Maria
Ta-Ha|Ta-Ha
Al-Anbiya|Die Propheten
Al-Hadsch|Die Pilgerfahrt
Al-Muʾminun|Die Gläubigen
An-Nur|Das Licht
Al-Furqan|Die Unterscheidung
Asch-Schuʿara|Die Dichter
An-Naml|Die Ameisen
Al-Qasas|Die Geschichte
Al-ʿAnkabut|Die Spinne
Ar-Rum|Die Römer
Luqman|Luqman
As-Sadschda|Die Niederwerfung
Al-Ahzab|Die Gruppierungen
Sabaʾ|Saba
Fatir|Der Erschaffer
Ya-Sin|Ya-Sin
As-Saffat|Die sich Reihenden
Sad|Sad
Az-Zumar|Die Scharen
Ghafir|Der Vergebende
Fussilat|Ausführlich dargelegt
Asch-Schura|Die Beratung
Az-Zukhruf|Der Prunk
Ad-Dukhan|Der Rauch
Al-Dschathiya|Die Kniende
Al-Ahqaf|Die Sanddünen
Muhammad|Muhammad
Al-Fath|Der Sieg
Al-Hudschurat|Die Gemächer
Qaf|Qaf
Adh-Dhariyat|Die Aufwirbelnden
At-Tur|Der Berg
An-Nadschm|Der Stern
Al-Qamar|Der Mond
Ar-Rahman|Der Allerbarmer
Al-Waqiʿa|Das eintreffende Ereignis
Al-Hadid|Das Eisen
Al-Mudschadala|Der Streit
Al-Haschr|Die Versammlung
Al-Mumtahana|Die Geprüfte
As-Saff|Die Reihe
Al-Dschumuʿa|Der Freitag
Al-Munafiqun|Die Heuchler
At-Taghabun|Die Übervorteilung
At-Talaq|Die Scheidung
At-Tahrim|Das Verbot
Al-Mulk|Die Herrschaft
Al-Qalam|Das Schreibrohr
Al-Haqqa|Die fällig Werdende
Al-Maʿaridsch|Die Aufstiegswege
Nuh|Noah
Al-Dschinn|Die Dschinn
Al-Muzzammil|Der Eingehüllte
Al-Muddaththir|Der Zugedeckte
Al-Qiyama|Die Auferstehung
Al-Insan|Der Mensch
Al-Mursalat|Die Entsandten
An-Nabaʾ|Die Kunde
An-Naziʿat|Die Entreißenden
ʿAbasa|Er runzelte die Stirn
At-Takwir|Das Umschlingen
Al-Infitar|Das Zerbrechen
Al-Mutaffifin|Die das Maß Verkürzenden
Al-Inschiqaq|Das Zerreißen
Al-Burudsch|Die Türme
At-Tariq|Der Pochende
Al-Aʿla|Der Höchste
Al-Ghaschiya|Die Bedeckende
Al-Fadschr|Die Morgendämmerung
Al-Balad|Die Ortschaft
Asch-Schams|Die Sonne
Al-Lail|Die Nacht
Ad-Duha|Die Morgenhelle
Asch-Scharh|Das Auftun
At-Tin|Die Feige
Al-ʿAlaq|Das Anhängsel
Al-Qadr|Die Bestimmung
Al-Bayyina|Der klare Beweis
Az-Zalzala|Das Beben
Al-ʿAdiyat|Die Rennenden
Al-Qariʿa|Das Verhängnis
At-Takathur|Die Vermehrung
Al-ʿAsr|Das Zeitalter
Al-Humaza|Der Stichler
Al-Fil|Der Elefant
Quraisch|Quraisch
Al-Maʿun|Die Hilfeleistung
Al-Kauthar|Die Fülle
Al-Kafirun|Die Ungläubigen
An-Nasr|Die Hilfe
Al-Masad|Die Palmfasern
Al-Ikhlas|Die Aufrichtigkeit
Al-Falaq|Das Frühlicht
An-Nas|Die Menschen""".split('\n')
assert len(SURAH_DE) == 114

# ---------------------------------------------------------------- verses
verses = []          # QPC verse texts, verbatim
vref = []            # (surah, ayah)
surahs = []
for s in range(1, 115):
    qv = qpc[str(s)]
    tv = tan[str(s)]
    assert len(qv) == len(tv) == chap[s - 1]['total_verses'], s
    start = len(verses)
    for i, v in enumerate(qv):
        assert v['chapter'] == s and v['verse'] == i + 1
        # the qpc-hafs dump doubles the kashida before a hamza on a tooth (ــٔ, 495 times); the Complex's own data
        # (Hafs v18 and v30) has one, as the printed Mushaf has a short stroke there
        verses.append(v['text'].replace('\u0640\u0640', '\u0640'))
        vref.append((s, i + 1))
    tr, de = SURAH_DE[s - 1].split('|')
    surahs.append({'n': s, 'ar': chap[s - 1]['name'], 'tr': tr, 'de': de,
                   'type': 'm' if chap[s - 1]['type'] == 'meccan' else 'd',
                   'ayahs': len(qv), 'start': start})
assert len(verses) == 6236
vidx = {r: i for i, r in enumerate(vref)}

def ref_idx(r):
    return vidx[(r['chapter'], r['verse'])]

# The text, the pages and the juz checked against the data of the King Fahd Complex itself (KFGQPC Hafs data v18,
# hafsData_v18.json: text, page and juz of every verse of the Madina Mushaf). The texts are the same letter for letter
# and mark for mark; v18 only has a kashida (tatweel, U+0640) more in كـَلَّا (33 times), which its newer v30 dropped
# again. dev/tools/check_official.py compares the text with v30, the newest release of the Complex, character for
# character.
# Pages and juz are taken from the Complex: the lists of fawazahmed0 follow an older print on 25 pages (their page
# 600 starts with 100:10, in the 1441 H Mushaf that the app shows it starts with 100:6) and begin juz 4 and 11 with
# the hizb sign (3:93, 9:93), where the Complex begins them with the page (3:92 on page 62, 9:94 on page 202).
kf = json.load(open(KFGQPC, encoding='utf-8'))
assert len(kf) == 6236
pages, juz = [], []
for i, r in enumerate(kf):
    assert (r['sora'], r['aya_no']) == vref[i], (i, r['sora'], r['aya_no'])
    t = r['aya_text'].replace('\u00a0', ' ').rstrip('\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669 ')
    assert t.replace('\u0640', '') == verses[i].replace('\u0640', ''), ('text differs from KFGQPC', vref[i])
    if i == 0 or r['page'] != kf[i - 1]['page']:
        assert r['page'] == len(pages) + 1
        pages.append(i)
    if i == 0 or r['jozz'] != kf[i - 1]['jozz']:
        assert r['jozz'] == len(juz) + 1
        juz.append(i)
sajdas = [vidx[(x['chapter'], x['verse'])] for x in info['sajdas']['references']]
assert len(pages) == 604 and len(juz) == 30
assert pages == sorted(pages) and pages[0] == 0
assert sajdas == [i for i, v in enumerate(verses) if '\u06e9' in v]

# sanity: every juz start (except surah starts) carries the rub-el-hizb sign in the KFGQPC text; juz 4 and 11 start
# one verse before / after it (see above)
for j, i in enumerate(juz):
    s_, a_ = vref[i]
    if a_ == 1: continue
    k = {(3, 92): 1, (9, 94): -1}.get((s_, a_), 0)
    assert verses[i + k].startswith('۞'), ('juz start without hizb sign', j + 1, vref[i])

quran = {
    'v': 1,
    'source': 'King Fahd Glorious Quran Printing Complex (KFGQPC), Hafs an Asim, via Quranpedia.net dumps (qpc-hafs), checked against the KFGQPC Hafs data v18; pages/juz: KFGQPC Hafs data v18 (Madinah mushaf, 604 pages)',
    'surahs': surahs, 'verses': verses, 'pages': pages, 'juz': juz,
    'sajdas': sajdas,
}
json.dump(quran, open(os.path.join(OUT, 'quran.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------------------------------------------------------------- German translation
de = []
for s in range(1, 115):
    dv = deu[str(s)]
    assert len(dv) == surahs[s - 1]['ayahs']
    for i, v in enumerate(dv):
        assert v['verse'] == i + 1
        de.append(v['text'].strip())
json.dump({'source': 'Frank Bubenheim & Nadeem Elyas, Der edle Qurʾān (QuranEnc.com german_bubenheim v1.1.4)', 'verses': de},
          open(os.path.join(OUT, 'de.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------------------------------------------------------------- words
def qpc_words(text):
    return [t for t in text.split() if any(unicodedata.category(c) == 'Lo' for c in t)]

def tan_words(s, a, text):
    w = text.split()
    if s not in (1, 9) and a == 1:
        w = w[4:]
    return w

def clusters(word):
    """letters as (base, start, end): base char plus following combining marks."""
    out = []
    for i, c in enumerate(word):
        if unicodedata.category(c) == 'Mn' and out:
            out[-1][2] = i + 1
        else:
            out.append([c, i, i + 1])
    return out

EQ = {'ى': 'ي', 'ی': 'ي', 'ٱ': 'ا', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ـ': 'ا', 'ۥ': 'و', 'ۦ': 'ي'}

def bnorm(c):
    return EQ.get(c, c)

def align_clusters(a, b):
    """DP alignment of two cluster lists on their base letters. Returns map a_index -> b_index."""
    n, m = len(a), len(b)
    INF = 1e9
    D = [[INF] * (m + 1) for _ in range(n + 1)]
    P = [[None] * (m + 1) for _ in range(n + 1)]
    D[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            if D[i][j] >= INF:
                continue
            if i < n and j < m:
                c = 0 if bnorm(a[i][0]) == bnorm(b[j][0]) else 1.0
                if D[i][j] + c < D[i + 1][j + 1]:
                    D[i + 1][j + 1] = D[i][j] + c; P[i + 1][j + 1] = (i, j, 'm')
            if i < n and D[i][j] + 0.8 < D[i + 1][j]:
                D[i + 1][j] = D[i][j] + 0.8; P[i + 1][j] = (i, j, 'd')
            if j < m and D[i][j] + 0.8 < D[i][j + 1]:
                D[i][j + 1] = D[i][j] + 0.8; P[i][j + 1] = (i, j, 'i')
    mp = {}
    i, j = n, m
    while (i, j) != (0, 0):
        pi, pj, op = P[i][j]
        if op == 'm':
            mp[pi] = pj
        i, j = pi, pj
    # unmapped a-clusters inherit the nearest mapped neighbour (so ranges never vanish)
    last = 0
    for k in range(n):
        if k in mp:
            last = mp[k]
        else:
            mp[k] = min(last, m - 1) if m else 0
    return mp, D[n][m]

# ---------------------------------------------------------------- morphology
morph_words = collections.OrderedDict()
for line in open(MORPH, encoding='utf-8'):
    loc, form, pos, feats = line.rstrip('\n').split('\t')
    s, a, w, g = map(int, loc.split(':'))
    morph_words.setdefault((s, a), collections.OrderedDict()).setdefault(w, []).append((form, pos, feats.split('|') if feats else []))

lemma_ids = {}
lemmas = []   # [lemma, root, pos, freq]
def lemma_id(lem, root, pos):
    key = (lem, root, pos)
    if key not in lemma_ids:
        lemma_ids[key] = len(lemmas)
        lemmas.append([lem, root, pos, 0])
    return lemma_ids[key]

def seg_info(form, pos, feats):
    lem = root = ''
    rest = []
    for f in feats:
        if f.startswith('LEM:'):
            lem = f[4:]
        elif f.startswith('ROOT:'):
            root = f[5:]
        else:
            rest.append(f)
    return lem, root, rest

def strip_marks(s):
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')

def main_segment(segs):
    for k, (form, pos, feats) in enumerate(segs):
        if 'PREF' not in feats and 'SUFF' not in feats:
            return k
    return 0

word_morph = []  # per verse: list per QPC word of segments [endOffset, pos, lemmaId, featstring, isMain]
mismatch_verses = []
total_words = 0
for vi, (s, a) in enumerate(vref):
    qw = qpc_words(verses[vi])
    total_words += len(qw)
    mw = list(morph_words.get((s, a), {}).values())
    # pair morphology words with QPC words
    pairs = {}
    if len(mw) == len(qw):
        pairs = {k: k for k in range(len(qw))}
    else:
        mismatch_verses.append((s, a, len(qw), len(mw)))
        # greedy: align by concatenated base letters
        qi = 0
        for k, segs in enumerate(mw):
            mform = strip_marks(''.join(f for f, _, _ in segs))
            best, bestj = None, None
            for j in range(qi, min(len(qw), qi + 3)):
                qform = strip_marks(qw[j])
                d = sum(1 for x, y in zip(mform, qform) if bnorm(x) != bnorm(y)) + abs(len(mform) - len(qform))
                if best is None or d < best:
                    best, bestj = d, j
            if bestj is not None and best <= max(2, len(mform) // 2):
                if bestj not in pairs.values():
                    pairs[k] = bestj
                qi = bestj + 1
    vwords = [None] * len(qw)
    for k, j in pairs.items():
        segs = mw[k]
        whole = ''.join(f for f, _, _ in segs)
        ca, cb = clusters(whole), clusters(qw[j])
        mp, _ = align_clusters(ca, cb)
        # char offset (in whole) -> cluster index
        char2cl = {}
        for ci, (_, st, en) in enumerate(ca):
            for x in range(st, en):
                char2cl[x] = ci
        out = []
        pos_in_whole = 0
        mi = main_segment(segs)
        for sk, (form, pos, feats) in enumerate(segs):
            pos_in_whole += len(form)
            last_cl = char2cl.get(pos_in_whole - 1, len(ca) - 1)
            end_off = cb[mp[last_cl]][2] if cb else len(qw[j])
            lem, root, rest = seg_info(form, pos, feats)
            lid = -1
            if lem:
                lid = lemma_id(lem, root, pos)
            elif sk == mi and 'PRON' in rest:
                lid = lemma_id(strip_marks(form), '', 'PRON')
            if sk == mi and lid >= 0:
                lemmas[lid][3] += 1
            out.append([end_off, pos, lid, '|'.join(rest), 1 if sk == mi else 0])
        # make offsets monotonic and end at word length
        for x in range(1, len(out)):
            out[x][0] = max(out[x][0], out[x - 1][0])
        if out:
            out[-1][0] = len(qw[j])
        vwords[j] = out
    word_morph.append(vwords)

print('total QPC words', total_words, 'verses with morph/QPC count mismatch', len(mismatch_verses), mismatch_verses)
missing = sum(1 for vw in word_morph for w in vw if w is None)
print('QPC words without morphology', missing)

json.dump({'source': 'Quranic Arabic Corpus morphology v0.4 (Kais Dukes, GPL) as revised by mustafa0x/quran-morphology',
           'lemmas': lemmas, 'words': word_morph},
          open(os.path.join(OUT, 'morph.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------------------------------------------------------------- lemma contexts for glossing
occ = collections.defaultdict(list)
for vi, vw in enumerate(word_morph):
    for wi, w in enumerate(vw):
        if not w:
            continue
        for seg in w:
            if seg[4] and seg[2] >= 0:
                occ[seg[2]].append((vi, wi))
order = sorted(range(len(lemmas)), key=lambda i: -lemmas[i][3])
items = []
for rank, lid in enumerate(order):
    lem, root, pos, freq = lemmas[lid]
    if freq == 0:
        continue
    oc = occ[lid]
    # choose up to 3 examples from short verses, spread over the Quran
    cand = sorted(oc, key=lambda x: len(verses[x[0]]))
    picks = []
    for vi, wi in cand:
        if all(abs(vi - p[0]) > 50 for p in picks):
            picks.append((vi, wi))
        if len(picks) == 3:
            break
    ex = []
    for vi, wi in picks:
        qw = qpc_words(verses[vi])
        marked = ' '.join(('«' + w + '»') if k == wi else w for k, w in enumerate(qw))
        s, a = vref[vi]
        ex.append({'ref': f'{s}:{a}', 'ar': marked, 'de': de[vi]})
    feats = collections.Counter()
    for vi, wi in oc[:200]:
        for seg in word_morph[vi][wi]:
            if seg[2] == lid:
                feats.update(seg[3].split('|'))
    items.append({'id': lid, 'rank': rank + 1, 'lemma': lem, 'root': root, 'pos': pos, 'freq': freq,
                  'tags': [k for k, _ in feats.most_common(6) if k], 'examples': ex})
json.dump(items, open(os.path.join(OUT, 'lemmas_for_gloss.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('lemmas', len(lemmas), 'with freq', len(items))
cum = 0
tot = sum(l[3] for l in lemmas)
for k, it in enumerate(items):
    cum += it['freq']
    if k + 1 in (100, 500, 1000, 1500, 2000):
        print('top', k + 1, 'coverage %.1f%%' % (100 * cum / tot))
