"""Does the font of the app draw every word of the Quran? Each word of quran.json (as the app shows it: one span per
word) and each whole verse is shaped with HarfBuzz in the given font. A character the font lacks gives glyph 0
(.notdef, a box); a mark without a letter to sit on gives a dotted circle (U+25CC). Either is a visible error.

Run: python3 -I dev/tools/check_font.py quran.json FONT.(woff2|ttf) [more fonts]
"""
import collections
import io
import json
import sys

import uharfbuzz as hb
from fontTools.ttLib import TTFont

quran = json.load(open(sys.argv[1], encoding='utf-8'))
surah_of = {}
for s in quran['surahs']:
    for a in range(s['ayahs']):
        surah_of[s['start'] + a] = (s['n'], a + 1)


def load(path):
    f = TTFont(path)
    buf = io.BytesIO()
    f.flavor = None
    f.save(buf)
    data = buf.getvalue()
    face = hb.Face(data)
    font = hb.Font(face)
    cmap = f.getBestCmap()
    dotted = cmap.get(0x25CC)
    names = f.getGlyphOrder()
    return font, cmap, dotted, names


def shape(font, text):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {})
    return [i.codepoint for i in buf.glyph_infos], [i.cluster for i in buf.glyph_infos]


for path in sys.argv[2:]:
    font, cmap, dotted, names = load(path)
    dotted_gid = names.index(dotted) if dotted in names else None
    missing_chars = collections.Counter()
    bad_words = collections.Counter()
    where = collections.defaultdict(list)
    for v, verse in enumerate(quran['verses']):
        for ch in verse:
            if ch != ' ' and ord(ch) not in cmap:
                missing_chars[ch] += 1
        for w in verse.split(' '):
            if not w:
                continue
            gids, _ = shape(font, w)
            if 0 in gids or (dotted_gid is not None and dotted_gid in gids):
                bad_words[w] += 1
                if len(where[w]) < 3:
                    where[w].append('%d:%d' % surah_of[v])
        # the whole verse too (marks across a space)
        gids, _ = shape(font, verse)
        if 0 in gids or (dotted_gid is not None and dotted_gid in gids):
            bad_words['<verse %d:%d>' % surah_of[v]] += 1
    print(f'== {path}')
    print('   characters of the text the font does not have:', {f'U+{ord(c):04X}': n for c, n in missing_chars.items()} or 'none')
    print('   words drawn with a box or a dotted circle:', sum(bad_words.values()))
    for w, n in bad_words.most_common(25):
        print(f'     {n:4d}  {w}  {" ".join(f"U+{ord(c):04X}" for c in w) if not w.startswith("<") else ""}  {" ".join(where.get(w, []))}')
