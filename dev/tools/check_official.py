"""The app's Quran against the official release of the King Fahd Complex: KFGQPC Hafs v30 (2026), downloaded from
https://download.qurancomplex.gov.sa/resources_dev/kfgqpc_hafs_v30.zip (data as JSON and other formats, the HAFS v30
font, and a PDF of the whole Mushaf, 604 pages of 15 lines, set in that font).

1. Text: every verse of quran.json, character for character, against kfgqpc_hafs_v30.json. The app's text is the
   Complex's text in the encoding of its older fonts (the app shows it in HAFS v14), so a few code points are
   mapped first; the KFGQPC fonts draw both forms alike:
   - open tanween ٗ ٞ ٖ (U+0657, U+065E, U+0656) are U+08F0, U+08F1, U+08F2 in v30; the imala sign of 11:41
     (U+06EA) is U+065C;
   - 52:37 ٱلۡمُصَۣيۡطِرُونَ: the small sin below the sad is U+06E3 in v30 (the older fonts draw U+06DC there below);
   - 35:43 ٱلسَّيِّئُ: ئ as one code point or as ي + hamza above (the same in Unicode, NFD);
   - 27:20 مَالِيَ and 36:22 وَمَالِيَ: v30 writes مَا لِيَ with a space; the page fonts of the Mushaf draw them
     without one (the app keeps them one word).
2. Pages and sajdas from the same data; juz as well (v30 moves the start of juz 20, 21 and 23 to the verses that give
   these juz their traditional names, mid-page and without the hizb sign: 27:60, 29:45, 36:21; the app keeps the
   division of v18, where every juz starts where the page structure and the hizb signs of the Mushaf have it).
3. The Mushaf pages of the app (mushaf.json) against the PDF, line by line: the kind of every line (surah header,
   basmala, text), the verse numbers ending on it and its letters. Text taken from a PDF loses or moves marks and
   reads some ligatures backwards, so letters are compared without marks and alef; a line whose letters only come
   in another order counts as the same.

Run: python3 -I dev/tools/check_official.py quran.json mushaf.json V30_DIR
     (V30_DIR: the unpacked zip, with kfgqpc_hafs_v30-data/ and kfgqpc_hafs_v30-font/; needs PyMuPDF)
"""
import difflib
import json
import os
import re
import sys
import unicodedata
from collections import Counter

import pymupdf

quran_path, mushaf_path, v30 = sys.argv[1:4]
q = json.load(open(quran_path, encoding='utf-8'))
m = json.load(open(mushaf_path, encoding='utf-8'))
k = json.load(open(os.path.join(v30, 'kfgqpc_hafs_v30-data', 'kfgqpc_hafs_v30.json'), encoding='utf-8-sig'))
pdf_path = os.path.join(v30, 'kfgqpc_hafs_v30-font', 'kfgqpc_hafs_v30.pdf')

ayah = []
for s in q['surahs']:
    for a in range(s['ayahs']):
        ayah.append((s['n'], a + 1))
assert [(r['sura_no'], r['aya_no']) for r in k] == ayah, 'not the same verses'

# ------------------------------------------------------------------------------------------------ 1. text
OLD = str.maketrans({'ٗ': 'ࣰ', 'ٞ': 'ࣱ', 'ٖ': 'ࣲ', '۪': 'ٜ'})


def official(r):
    return re.sub(r'\s*۝?[٠-٩]+\s*$', '', r['aya_text_unicode'].replace(' ', ' ')).strip()


same_raw = same = 0
diff = []
for i, r in enumerate(k):
    a, b = q['verses'][i], official(r)
    if a == b:
        same_raw += 1
    a = a.translate(OLD)
    if ayah[i] == (52, 37):
        a = a.replace('صۜ', 'صۣ')
    if ayah[i] == (35, 43):
        a, b = unicodedata.normalize('NFD', a), unicodedata.normalize('NFD', b)
    if ayah[i] in ((27, 20), (36, 22)):
        b = b.replace('مَا لِيَ', 'مَالِيَ')      # مَا لِيَ -> مَالِيَ
    if a == b:
        same += 1
    else:
        diff.append('%d:%d' % ayah[i])
print(f'text: {same} of {len(k)} verses the same as KFGQPC Hafs v30 ({same_raw} without mapping the encodings)')
if diff:
    print('  different:', ' '.join(diff[:30]))

# ------------------------------------------------------------------------------------------------ 2. pages, juz, sajdas
def starts(col):
    return [i for i, r in enumerate(k) if i == 0 or r[col] != k[i - 1][col]]


print('pages: same starts as v30' if starts('page') == q['pages'] else 'pages: DIFFERENT from v30')
jz = starts('jozz')
print('juz: same starts as v30' if jz == q['juz'] else 'juz: v30 starts ' + ', '.join(
    f'juz {j} at {ayah[x][0]}:{ayah[x][1]} (app {ayah[y][0]}:{ayah[y][1]})' for j, (x, y) in enumerate(zip(jz, q['juz']), 1) if x != y))
print('sajdas: the same as v30' if [i for i, r in enumerate(k) if '۩' in r['aya_text_unicode']] == q['sajdas'] else 'sajdas: DIFFERENT')

# ------------------------------------------------------------------------------------------------ 3. the PDF, line by line
def is_letter(ch):
    c = ord(ch)
    return (0x0621 <= c <= 0x063A) or (0x0641 <= c <= 0x064A) or c == 0x0671 or (0x0672 <= c <= 0x06D3 and c != 0x06D4) or c in (0x06E5, 0x06E6)


# letters only; no alef (the PDF reads the ligature لا as ال) and hamza seats folded
FOLD = {'ٱ': '', 'أ': '', 'إ': '', 'آ': '', 'ا': '', 'ى': 'ي', 'ؤ': 'و', 'ئ': 'ي', 'ء': '', 'ۥ': '', 'ۦ': '', 'ة': 'ه'}


def letters(t):
    return ''.join(FOLD.get(ch, ch) for ch in t if is_letter(ch) or ch in FOLD)


def pdf_letters(t):
    """the PDF reads its ligature of the name Allah as the two lams with the shadda (ٱّلل), without the ha"""
    s = letters(t)
    if re.search('ّ[^ء-يٱ]*لل[^ء-يٱ]*$|للّ[^ء-يٱ]*$', t):
        s += 'ه'
    return s


BASMALA = letters('بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ')
words = []
for vi, v in enumerate(q['verses']):
    for t in v.split(' '):
        if t and any(is_letter(ch) for ch in t):
            words.append((vi, t))
app = []
for P in m['pages']:
    g, lines = P['g'], []
    for line in P['l']:
        if line[0] in ('h', 'b'):
            lines.append((line[0], '', []))
            continue
        sk, vs = '', []
        for ch, kind in zip(line[0], line[1]):
            if kind == 'w':
                sk += letters(words[g][1])
                g += 1
            elif kind == 'e':
                vs.append(ayah[words[g - 1][0]][1])
        lines.append(('t', sk, vs))
    app.append(lines)

DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
pdf = []
for page in pymupdf.open(pdf_path):
    rows = {}
    for x0, y0, x1, y1, t, *_ in page.get_text('words', sort=False):
        if y1 < 735:                                     # below: page number and colophon
            rows.setdefault(round((y1 - 110.7) / 38.68), []).append((x1, t))
    lines = []
    for i in sorted(rows):
        ws = [t for _, t in sorted(rows[i], key=lambda w: -w[0])]
        vs = []
        for t in ws:
            if '۝' in t:                            # end of verse: its number, read in either direction
                d = ''.join(ch for ch in t if '٠' <= ch <= '٩')
                vs.append(int((d[::-1] if t.endswith('۝') else d).translate(DIGITS)))
        sk = ''.join(pdf_letters(t) for t in ws if '۝' not in t)
        kind = 't'
        if not vs and sk.startswith('سوره') and len(ws) <= 5:
            kind = 'h'
        elif not vs and len(sk) <= len(BASMALA) + 2 and difflib.SequenceMatcher(None, sk, BASMALA).ratio() > 0.7:
            kind = 'b'
        lines.append((kind, sk, vs))
    pdf.append(lines)

stats, problems = Counter(), []
for p, (A, B) in enumerate(zip(app, pdf), 1):
    if [x[0] for x in A] != [x[0] for x in B]:
        problems.append((p, 0, 'kinds of lines: app ' + ''.join(x[0] for x in A) + ', PDF ' + ''.join(x[0] for x in B)))
        continue
    for li, (a, b) in enumerate(zip(A, B), 1):
        if a[0] != 't':
            stats['headers and basmalas'] += 1
            continue
        stats['lines of text'] += 1
        if a[2] == b[2]:
            stats['verse numbers the same'] += 1
        else:
            problems.append((p, li, f'verse numbers: app {a[2]}, PDF {b[2]}'))
        if a[1] == b[1]:
            stats['letters the same'] += 1
        elif sorted(a[1]) == sorted(b[1]):
            stats['letters the same, read in another order'] += 1
        else:
            stats['letters different'] += 1
            problems.append((p, li, 'letters: app ' + a[1] + ' | PDF ' + b[1]))
print('PDF: ' + ', '.join(f'{k}: {v}' for k, v in stats.items()))
for x in problems[:40]:
    print('  page %d, line %d: %s' % x)
