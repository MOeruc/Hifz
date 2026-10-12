"""Transfer cpfair tajweed annotations (computed on the Tanzil Uthmani text) onto KFGQPC words.

Usage: python3 -I build_tajweed.py RISAN_DIR TAJWEED_TANZIL_JSON QURAN_JSON OUT_JSON
Output: {"rules": [...names], "verses": [[w, start, end, rule, ...], ...]}
start/end are UTF-16 offsets inside the KFGQPC word (all chars are BMP), covering whole letters.
"""
import json, sys, unicodedata, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

RISAN, TJ, QJ, OUT = sys.argv[1:5]
tan = json.load(open(os.path.join(RISAN, 'data/tanzil/uthmani.json'), encoding='utf-8'))
tj = json.load(open(TJ, encoding='utf-8'))
q = json.load(open(QJ, encoding='utf-8'))

RULES = ['madd_2', 'madd_246', 'madd_munfasil', 'madd_muttasil', 'madd_6',
         'ghunnah', 'ikhfa', 'ikhfa_shafawi', 'iqlab', 'idghaam_ghunnah', 'idghaam_shafawi',
         'idghaam_no_ghunnah', 'idghaam_mutajanisayn', 'idghaam_mutaqaribayn',
         'qalqalah', 'hamzat_wasl', 'lam_shamsiyyah', 'silent']
RID = {r: i for i, r in enumerate(RULES)}

def clusters(word):
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
    return mp

def qpc_words(text):
    return [t for t in text.split() if any(unicodedata.category(c) == 'Lo' for c in t)]

def skel(w):
    return ''.join(bnorm(c) for c in w if unicodedata.category(c) != 'Mn')

out_verses = []
vi = 0
stats = {'ann': 0, 'mapped': 0, 'unmapped': 0}
for s in range(1, 115):
    for k, v in enumerate(tan[str(s)]):
        a = k + 1
        text = v['text']
        ann = tj[vi]
        assert ann['surah'] == s and ann['ayah'] == a
        # Tanzil words with offsets
        tw = []
        pos = 0
        for tok in text.split(' '):
            tw.append([tok, pos, pos + len(tok)])
            pos += len(tok) + 1
        if s not in (1, 9) and a == 1:
            tw = tw[4:]
        qw = qpc_words(q['verses'][vi])
        # pair words; merge Tanzil words where the KFGQPC text writes one word (15:7, 27:20, 36:22)
        groups = [[t] for t in tw]
        while len(groups) > len(qw):
            for gi in range(len(qw)):
                if skel(''.join(t[0] for t in groups[gi])) != skel(qw[gi]):
                    groups[gi] = groups[gi] + groups[gi + 1]
                    del groups[gi + 1]
                    break
            else:
                raise SystemExit(f'cannot pair words {s}:{a}')
        assert len(groups) == len(qw), (s, a, len(groups), len(qw))
        # per word cluster maps
        maps = []
        for gi, grp in enumerate(groups):
            # build combined tanzil string with absolute offsets (skip spaces)
            chars = []
            for tok, st, en in grp:
                for x in range(st, en):
                    chars.append((text[x], x))
            tstr = ''.join(c for c, _ in chars)
            ca, cb = clusters(tstr), clusters(qw[gi])
            mp = align_clusters(ca, cb)
            # absolute tanzil offset -> qpc cluster index
            abs2q = {}
            for ci, (_, st, en) in enumerate(ca):
                for x in range(st, en):
                    if ci in mp:
                        abs2q[chars[x][1]] = mp[ci]
            maps.append((abs2q, cb))
        flat = []
        for an in ann['annotations']:
            stats['ann'] += 1
            r = RID[an['rule']]
            hit = False
            for gi, (abs2q, cb) in enumerate(maps):
                cls = sorted({abs2q[x] for x in range(an['start'], an['end']) if x in abs2q})
                if not cls:
                    continue
                hit = True
                # contiguous runs of clusters
                run = [cls[0], cls[0]]
                for c in cls[1:] + [None]:
                    if c is not None and c == run[1] + 1:
                        run[1] = c
                        continue
                    flat.append((gi, cb[run[0]][1], cb[run[1]][2], r))
                    if c is not None:
                        run = [c, c]
            stats['mapped' if hit else 'unmapped'] += 1
        flat.sort()
        # drop exact duplicates
        dedup = []
        for t in flat:
            if not dedup or dedup[-1] != t:
                dedup.append(t)
        out_verses.append([x for t in dedup for x in t])
        vi += 1

json.dump({'source': 'Tajweed rules: cpfair/quran-tajweed decision trees (CC BY 4.0), computed on the Tanzil Uthmani text and mapped onto the KFGQPC words',
           'rules': RULES, 'verses': out_verses}, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'))
print(stats)
