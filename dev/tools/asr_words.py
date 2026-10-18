"""What each word of MyHifz sounds like, in the units of the recogniser on the phone: for every word of the app's word
list (quran.json, split as core.js buildWords does) the phonetic units of the Quran Lab model (tokens.txt), taken
from its canonical phonemisation of every ayah (ordered_quran_phonemes.json, quran-transcript, Hafs, murattal).

The phonemisation writes an ayah as phonetic words; where letters merge across a word boundary (idgham, iqlab,
e.g. بِدُخَانٍ مُبِينٍ -> بِدُخَاانِممممُبِۦۦن) two written words become one phonetic word. Such a phonetic word is
shared out by the consonants of the written words (each written word keeps its own consonants, in order).

Out (JSON): {"units": base64 of all unit ids (uint8) word after word, "count": base64 uint8 per word (number of
units), "tokens": [...], "words": N}. Checks: the same words as the app, every unit known to the model.

Run: python3 -I dev/tools/asr_words.py quran.json QLAB_DIR asr/model/words.json
"""
import base64
import json
import re
import sys
import unicodedata

quran_path, qlab, out = sys.argv[1:4]


def is_letter(ch):
    c = ord(ch)
    return (0x0621 <= c <= 0x063A) or (0x0641 <= c <= 0x064A) or c == 0x0671 or (0x0672 <= c <= 0x06D3 and c != 0x06D4) or c in (0x06E5, 0x06E6)


q = json.load(open(quran_path, encoding='utf-8'))
app_words = []                                     # per verse: the words as the app has them
for t in q['verses']:
    app_words.append([w for w in t.split(' ') if w and any(is_letter(ch) for ch in w)])

tokens = {}
for ln in open(f'{qlab}/tokens.txt', encoding='utf-8'):
    if ln.strip():
        u, i = ln.rstrip('\n').rsplit(' ', 1)
        tokens[u] = int(i)
units = sorted((u for u in tokens if u != '<blank>'), key=len, reverse=True)
maxlen = max(map(len, units))

ph = json.load(open(f'{qlab}/ordered_quran_phonemes.json', encoding='utf-8'))
keys = [f"{s['n']}:{a}" for s in q['surahs'] for a in range(1, s['ayahs'] + 1)]
assert len(keys) == len(q['verses']) == len(ph)

# consonant skeletons to share a merged phonetic word out among the written words
DIAC = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
NORM = str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و', 'ة': 'ت', 'ء': 'ا', 'ں': 'ن', 'ۥ': 'و', 'ۦ': 'ي', 'ٲ': 'ا'})
PH_ONLY = re.compile('[ڇ۪ۜ۾ـ]')


def cons(s):
    """the consonant letters of a word, long vowels and hamza seats out, doubled letters once"""
    s = unicodedata.normalize('NFC', s)
    s = DIAC.sub('', PH_ONLY.sub('', s)).translate(NORM)
    s = re.sub('[اوي]', '', s)                   # long vowels and their seats: not reliable across script and sound
    return re.sub(r'(.)\1+', r'\1', s)


HARAKAT = set('\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u06E1\u0656\u065E')
HAMZA = set('ءأإؤئٔ')


def cons2(s, unit=False):
    """consonants for sharing out merged words: hamza counts, و and ي count where they carry a vowel, shadda or sukun
    (in a unit: where they are not a madd unit), long vowels and hamzat al-wasl do not"""
    s = unicodedata.normalize('NFC', s)
    out = []
    for i, ch in enumerate(s):
        nxt = s[i + 1] if i + 1 < len(s) else ''
        if ch in HAMZA or ch == 'ٲ':
            out.append('ء')
        elif ch in 'وي':
            if unit or nxt in HARAKAT:
                out.append(ch)
        elif ch == 'ں':
            out.append('ن')
        elif ch == '۾':
            out.append('م')
        elif ch in 'اٱآىۥۦـ' or not is_letter(ch):
            continue
        else:
            out.append({'ة': 'ت'}.get(ch, ch))
    return re.sub(r'(.)\1+', r'\1', ''.join(out))


_dist = {}


def dist(a, b):
    """edit distance of two short consonant strings"""
    key = (a, b)
    if key not in _dist:
        prev = list(range(len(b) + 1))
        for x in range(1, len(a) + 1):
            cur = [x] + [0] * len(b)
            for y in range(1, len(b) + 1):
                cur[y] = min(prev[y] + 1, cur[y - 1] + 1, prev[y - 1] + (a[x - 1] != b[y - 1]))
            prev = cur
        _dist[key] = prev[len(b)]
    return _dist[key]


def split_units(toks, wcons):
    """share the units of a phonetic word out among the written words it holds. The consonants of the units are
    aligned with the consonants of the written words (edit distance); a unit that sounds two equal consonants
    (a merged ممممِ for هُم مِّن) may take one from each word and goes to the later word. Units without a consonant
    (vowels, madd) stay with the unit before them."""
    tc = [(c, w) for w, cs in enumerate(wcons) for c in cs]
    uc = [cons2(t, unit=True) for t, _ in toks]
    n, m = len(tc), len(uc)
    INF = 10 ** 9
    d = [[INF] * (m + 1) for _ in range(n + 1)]
    bk = [[None] * (m + 1) for _ in range(n + 1)]
    d[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            c0 = d[i][j]
            if c0 == INF:
                continue
            if j < m and not uc[j]:                       # a unit without consonant: free
                if c0 < d[i][j + 1]:
                    d[i][j + 1] = c0; bk[i][j + 1] = (i, j, 'v')
                continue
            if i < n and j < m:                          # consonant against consonant
                c = c0 + (0 if tc[i][0] == uc[j] else 1)
                if c < d[i + 1][j + 1]:
                    d[i + 1][j + 1] = c; bk[i + 1][j + 1] = (i, j, 'm')
            if i + 1 < n and j < m and tc[i][0] == tc[i + 1][0] == uc[j]:   # one unit, two equal consonants
                if c0 < d[i + 2][j + 1]:
                    d[i + 2][j + 1] = c0; bk[i + 2][j + 1] = (i, j, 'mm')
            if i < n and c0 + 1 < d[i + 1][j]:          # a written consonant not sounded
                d[i + 1][j] = c0 + 1; bk[i + 1][j] = (i, j, 'dt')
            if j < m and c0 + 1 < d[i][j + 1]:          # a sounded consonant not written
                d[i][j + 1] = c0 + 1; bk[i][j + 1] = (i, j, 'du')
    owner = [None] * m
    i, j = n, m
    while i or j:
        pi, pj, op = bk[i][j]
        if op == 'm':
            owner[pj] = tc[pi][1]
        elif op == 'mm':
            owner[pj] = tc[pi + 1][1]
        i, j = pi, pj
    # units without a word of their own (vowels, extra sounds) stay with the unit before them
    last = 0
    for j in range(m):
        if owner[j] is None:
            owner[j] = last
        last = owner[j]
    for j in range(m - 1):                               # never backwards
        if owner[j + 1] < owner[j]:
            owner[j + 1] = owner[j]
    parts = [[] for _ in wcons]
    for j, t in enumerate(toks):
        parts[owner[j]].append(t)
    return parts


def tokenize(s):
    out, i = [], 0
    while i < len(s):
        for L in range(min(maxlen, len(s) - i), 0, -1):
            if s[i:i + L] in tokens:
                out.append((s[i:i + L], i)); i += L
                break
        else:
            raise ValueError('unknown phonetic symbol ' + repr(s[i]) + ' in ' + s)
    return out


all_units, counts = [], []
merged = mism = 0
for v, key in enumerate(keys):
    words = app_words[v]
    pw = ph[key]['aya_phonemes_list']
    text_words = [w for w in ph[key]['aya_text'].split(' ') if w and any(is_letter(ch) for ch in w)]
    if len(text_words) != len(words):
        mism += 1
    # share the phonetic words out among the written words: align by consonants, a phonetic word may hold several
    n, m = len(words), len(pw)
    wc = [cons(w) for w in words]
    pc = [cons(p) for p in pw]
    INF = 10 ** 9
    # dp[i][j]: cost of words[:i] against phonetic words[:j]; a phonetic word takes 1..3 written words
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            if dp[i][j] == INF:
                continue
            # (written words, phonetic words): a phonetic word may hold up to 6 written words (letters merged across
            # them), and a written word up to 5 phonetic words (the letters of الم, كهيعص are read by their names)
            for k, kp in ((1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (1, 2), (1, 3), (1, 4), (1, 5)):
                if i + k <= n and j + kp <= m:
                    c = dp[i][j] + dist(''.join(wc[i:i + k]), ''.join(pc[j:j + kp])) + (k - 1) * 0.5 + (kp - 1) * 0.5
                    if c < dp[i + k][j + kp]:
                        dp[i + k][j + kp] = c
                        back[i + k][j + kp] = (i, j, k, kp)
    assert dp[n][m] < INF, key
    groups = []
    i, j = n, m
    while i or j:
        pi, pj, k, kp = back[i][j]
        groups.append((pi, k, pj, kp))
        i, j = pi, pj
    groups.reverse()
    for (wi, k, pj, kp) in groups:
        toks = tokenize(''.join(pw[pj:pj + kp]))
        if k == 1:
            parts = [toks]
        else:
            merged += 1
            parts = split_units(toks, [cons2(words[wi + x]) for x in range(k)])
        for part in parts:
            ids = [tokens[t] for t, _ in part]
            assert len(ids) < 256
            counts.append(len(ids))
            all_units.extend(ids)

total_words = sum(len(w) for w in app_words)
assert len(counts) == total_words, (len(counts), total_words)
empty = sum(1 for c in counts if c == 0)
json.dump({'v': 1, 'words': total_words, 'source': 'Quran-Lab zipformer_p-arabic-v3 ordered_quran_phonemes.json (quran-transcript), NPL-1.2',
           'units': base64.b64encode(bytes(all_units)).decode(), 'count': base64.b64encode(bytes(counts)).decode()},
          open(out, 'w', encoding='utf-8'))
print(f'{total_words} words, {len(all_units)} units ({len(all_units) / total_words:.1f} per word); '
      f'{merged} phonetic words shared by several written words, {empty} words without a unit of their own; '
      f'{mism} ayat where the phonemisation counts words differently')
