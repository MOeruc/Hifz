"""Are the Mushaf pages of the app the pages of the KFGQPC V4 (1441 H) Mushaf? Two independent publications of the
King Fahd Complex page fonts are compared, line by line and word by word, on all 604 pages:

- the app: mushaf.json (the glyphs of every line, from quran-qcf4, see build_mushaf.py) in the 47 QCF4_Hafs fonts;
- QUL (Tarteel's Quranic Universal Library): the words of the QPC V4 script (qpc-v4.json), the 15-line layout
  (qpc-v4-tajweed-15-lines.db) and the 604 page fonts p1..p604.

Both lines are shaped with HarfBuzz (right to left, with the GPOS of the QUL fonts). A line is cut into words: a glyph
that moves the pen starts one, the glyphs drawn from the same place (pause signs, the line over a sajda, which have no
width) belong to it. Every word is the set of its contours, point for point, placed where they are drawn. A line is
right when it has the same words in the same order, each drawn with the same outlines (a whole word may sit a few
units of 2500 to the side: the two publications round a few glyphs differently). The kind of every line (surah
header, basmala, text), the surah of each header and the centring of short lines are compared too. Advances (the space
a word takes) are only counted: the app spreads the words over the line anyway.

Run: python3 -I dev/tools/check_mushaf.py mushaf.json QCF4_FONT_DIR QUL_WORDS_JSON QUL_LAYOUT_DB QUL_FONT_DIR [PAGES]
"""
import io
import json
import sqlite3
import sys
from collections import Counter, defaultdict

import uharfbuzz as hb
from fontTools.ttLib import TTFont

mushaf_path, our_dir, qul_words, qul_db, qul_dir = sys.argv[1:6]
only = set(int(x) for x in sys.argv[6].split(',')) if len(sys.argv) > 6 else None
m = json.load(open(mushaf_path, encoding='utf-8'))
by_id = {w['id']: w for w in json.load(open(qul_words, encoding='utf-8')).values()}
layout = defaultdict(list)
con = sqlite3.connect(qul_db)
for page, line, typ, centred, a, b, surah in con.execute('select page_number, line_number, line_type, is_centered, first_word_id, last_word_id, surah_number from pages order by page_number, line_number'):
    layout[page].append((typ, centred, a, b, surah))


class Font:
    def __init__(self, path):
        f = TTFont(path)
        self.glyf, self.hmtx, self.order = f['glyf'], f['hmtx'], f.getGlyphOrder()
        f.flavor = None
        buf = io.BytesIO()
        f.save(buf)
        self.hb = hb.Font(hb.Face(buf.getvalue()))
        self._c = {}

    def contours(self, name):
        """the outline as drawn: TrueType places a glyph so that its leftmost point is at its left side bearing
        (a few glyphs of both publications have points elsewhere than their hmtx says, e.g. page 498, 44:42:5)"""
        if name not in self._c:
            coords, ends, flags = self.glyf[name].getCoordinates(self.glyf)
            dx = self.hmtx[name][1] - min(x for x, y in coords) if len(coords) else 0
            out, s = [], 0
            for e in ends:
                out.append((tuple((x + dx, y) for x, y in coords[s:e + 1]), tuple(fl & 1 for fl in flags[s:e + 1])))
                s = e + 1
            self._c[name] = out
        return self._c[name]

    def words(self, text):
        """the line as words in reading order: (set of placed contours, advance)"""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.direction, buf.script, buf.language = 'rtl', 'Arab', 'ar'
        hb.shape(self.hb, buf, {})
        out = []
        for i, p in reversed(list(zip(buf.glyph_infos, buf.glyph_positions))):   # visual order back to reading order
            if p.x_advance > 0 or not out:
                out.append([[], p.x_advance])
            for pts, on in self.contours(self.order[i.codepoint]):
                out[-1][0].append((tuple((x + p.x_offset, y + p.y_offset) for x, y in pts), on))
        return [(frozenset(c), adv) for c, adv in out]


_fonts = {}


def font(path):
    if path not in _fonts:
        if len(_fonts) > 8:
            _fonts.clear()
        _fonts[path] = Font(path)
    return _fonts[path]


def canon(word):
    """contour shape -> where it is drawn (its first point)"""
    out = defaultdict(list)
    for pts, on in word:
        x0, y0 = pts[0]
        out[(tuple((x - x0, y - y0) for x, y in pts), on)].append((x0, y0))
    return out


def same(a, b, tol=3):
    """the same word: the same contours, each drawn at most tol units (of 2500 per em) from where the other has it
    (the two publications round some glyphs differently)"""
    if a == b:
        return True
    A, B = canon(a), canon(b)
    if set(A) != set(B):
        return False
    near = lambda P, Q: all(any(abs(x - u) <= tol and abs(y - v) <= tol for u, v in Q) for x, y in P)
    return all(near(A[k], B[k]) and near(B[k], A[k]) for k in A)


problems = []
stats = Counter()
advances = Counter()
widths = []
for p, page in enumerate(m['pages'], 1):
    if only and p not in only:
        continue
    ours, qul = page['l'], layout.get(p, [])
    of = font(f"{our_dir}/QCF4_Hafs_{page['f']:02d}_W.woff2")
    qf = font(f'{qul_dir}/p{p}.woff2')
    stats['pages'] += 1
    if len(ours) != len(qul):
        problems.append((p, 0, f'{len(ours)} lines in the app, {len(qul)} in QUL'))
    ow, qw = [], []                       # the words of the page: (line, word, advance)
    for li, (o, q) in enumerate(zip(ours, qul), 1):
        typ, centred, a, b, surah = q
        if o[0] in ('h', 'b'):
            want = 'surah_name' if o[0] == 'h' else 'basmallah'
            if typ != want or (o[0] == 'h' and int(surah) != o[1]):
                problems.append((p, li, f'app: {"header of surah %d" % o[1] if o[0] == "h" else "basmala"}, QUL: {typ} {surah}'))
            stats['surah headers' if o[0] == 'h' else 'basmalas'] += 1
            continue
        stats['lines of text'] += 1
        if typ != 'ayah':
            problems.append((p, li, f'app: text, QUL: {typ}'))
            continue
        ow += [(li, w, adv) for w, adv in of.words(o[0])]
        qw += [(li, w, adv) for w, adv in qf.words(''.join(by_id[w]['text'] for w in range(int(a), int(b) + 1)))]
        if bool(len(o) > 2 and o[2] == 1) != bool(int(centred)):
            problems.append((p, li, f'centred in the app: {len(o) > 2 and o[2] == 1}, in QUL: {bool(int(centred))}'))
    stats['words and signs'] += len(qw)
    # 1. the words of the page, in order, drawn the same
    if len(ow) != len(qw):
        problems.append((p, 0, f'app {len(ow)} words and signs on the page, QUL {len(qw)}'))
    bad = [k for k, (x, y) in enumerate(zip(ow, qw)) if not same(x[1], y[1])]
    for k in bad[:5]:
        problems.append((p, ow[k][0], f'word {k + 1} of the page drawn differently'))
    stats['words drawn the same'] += min(len(ow), len(qw)) - len(bad)
    for x, y in zip(ow, qw):
        if x[2] != y[2]:
            advances[x[2] - y[2]] += 1
    # 2. the same words on every line
    if not bad and len(ow) == len(qw):
        for li in sorted(set(x[0] for x in ow)):
            ko = [k for k, x in enumerate(ow) if x[0] == li]
            kq = [k for k, x in enumerate(qw) if x[0] == li]
            if ko != kq:
                wo = sum(ow[k][2] for k in ko) / 2500 / m['em']
                wq = sum(qw[k][2] for k in kq) / 2500 / m['em']
                problems.append((p, li, f'line break: the app has words {ko[0] + 1}-{ko[-1] + 1} of the page on this line '
                                        f'({wo:.3f} of a full line), QUL {kq[0] + 1}-{kq[-1] + 1} ({wq:.3f})'))

print(', '.join(f'{k}: {v}' for k, v in stats.items()))
print('words with another advance (app - QUL, units of 2500): ' + ', '.join(f'{k}: {v}' for k, v in advances.most_common()))
print(f'differences: {len(problems)}')
for p, i, msg in problems[:200]:
    print(f'  page {p}, line {i}: {msg}')
