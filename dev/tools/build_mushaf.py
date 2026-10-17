"""Page layout of the Madina Mushaf (604 pages, 15 lines) for MyHifz, from the quran-qcf4 data.

Usage: python3 -I build_mushaf.py QCF4_REPO QURAN_JSON OUT_JSON

quran-qcf4 (github.com/MohamadHajjRabee/quran-qcf4, JSON data under the MIT license) gives, for every line of every
page, the glyphs of the King Fahd Complex page fonts (QCF4, Madina Mushaf 1441 H). The fonts themselves are not
redistributed: the app loads them from the repository through jsDelivr when a page is shown.

Output, per page: {"f": font number, "g": first word (index into the app's word list), "l": lines}
  line: ["h", surah]                surah header
        ["b", code]                 basmala (glyph in font 1)
        [glyphs, kinds(, 1)]        text: the glyph characters and what each one is; 1 = centred (a short line)
  kinds: w word, x the rest of the same word (the font has two glyphs for لَّوۡمَا / مَالِيَ),
         s a sign that belongs to the word before (sajda ۩), e end of verse, q quarter of a hizb (۞)
"""
import json, os, re, sys, unicodedata
from fontTools.ttLib import TTFont

REPO, QURAN, OUT = sys.argv[1:4]
quran = json.load(open(QURAN, encoding='utf-8'))
fontmap = json.load(open(os.path.join(REPO, 'font-map.json')))

def is_letter(ch):
    c = ord(ch)
    return (0x0621 <= c <= 0x063A) or (0x0641 <= c <= 0x064A) or c == 0x0671 or (0x0672 <= c <= 0x06D3 and c != 0x06D4) or c in (0x06E5, 0x06E6)

# the app's words, exactly as core.js buildWords counts them
verse_words = []
for v in quran['verses']:
    verse_words.append([t for t in v.split(' ') if t and any(is_letter(ch) for ch in t)])
verse_start = [0]
for ws in verse_words: verse_start.append(verse_start[-1] + len(ws))
vindex = {}
for s in quran['surahs']:
    for a in range(s['ayahs']):
        vindex[f"{s['n']}:{a + 1}"] = s['start'] + a

def plain(t):
    """letters only, one form of alif, for matching a word of one text against the other"""
    t = unicodedata.normalize('NFC', t)
    out = ''
    for ch in t:
        if not is_letter(ch): continue
        out += {'ٱ': 'ا', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ۥ': '', 'ۦ': ''}.get(ch, ch)
    return out

# advance widths, to find the short lines that the mushaf centres
fonts = {}
def advance(font, code):
    if font not in fonts:
        f = TTFont(os.path.join(REPO, 'fonts', font + ('_W' if 'Hafs' in font else '') + '.ttf'))
        fonts[font] = (f.getBestCmap(), f['hmtx'].metrics, f['head'].unitsPerEm)
    cmap, hmtx, upm = fonts[font]
    return hmtx[cmap[code]][0] / upm

# per verse: which glyph of the page fonts belongs to which word of the app
def verse_map(vk, glyph_words):
    """glyph_words: [(position, text)] of the 'word' glyphs of verse vk, in order. Returns {position: (word index, kind)}"""
    v = vindex[vk]
    mine = verse_words[v]
    out, i = {}, 0
    for n, (pos, text) in enumerate(glyph_words):
        if text == '#skip': continue             # the second glyph of a word, mapped with the first
        if text.startswith('#'):                 # a sign (sajda): belongs to the word before
            out[pos] = (verse_start[v] + i - 1, 's')
            continue
        if i < len(mine) and plain(text) == plain(mine[i]):
            out[pos] = (verse_start[v] + i, 'w'); i += 1; continue
        # one word of the text, two glyphs in the font (لَّوۡمَا, مَالِيَ)
        if i < len(mine) and n + 1 < len(glyph_words) and plain(text + glyph_words[n + 1][1]) == plain(mine[i]):
            out[pos] = (verse_start[v] + i, 'w'); out[glyph_words[n + 1][0]] = (verse_start[v] + i, 'x'); i += 1
            glyph_words[n + 1] = (glyph_words[n + 1][0], '#skip')
            continue
        # spelling differs a little between the two texts: same place, same word
        out[pos] = (verse_start[v] + i, 'w'); i += 1
    if i != len(mine):
        raise SystemExit(f'{vk}: {i} of {len(mine)} words mapped')
    return out

# collect the glyphs of every verse first (a verse can run over two pages)
pages = [json.load(open(os.path.join(REPO, 'pages', f'{p:03d}.json'), encoding='utf-8')) for p in range(1, 605)]
by_verse = {}
for pg in pages:
    for l in pg['lines']:
        for w in l['words']:
            if w['type'] == 'word':
                by_verse.setdefault(w['verse_key'], []).append((w['position'], w['text']))
maps = {vk: verse_map(vk, list(gw)) for vk, gw in by_verse.items()}

out_pages = []
expect = 0                                       # the next word in reading order
full_widths = []
for pg in pages:
    p = pg['page']
    font = fontmap[str(p)]
    fnum = int(re.search(r'(\d+)$', font).group(1))
    first = None
    lines = []
    for l in pg['lines']:
        ws = l['words']
        t0 = ws[0]['type']
        if t0 == 'surah_header':
            lines.append(['h', ws[0]['sura']]); continue
        if t0 == 'bismillah':
            assert ws[0]['font'] == 'QCF4_Hafs_01'
            lines.append(['b', ws[0]['code']]); continue
        chars, kinds, width = '', '', 0.0
        for w in ws:
            assert w['font'] == font, (p, w)
            width += advance(font, w['code'])
            if w['type'] == 'word':
                g, k = maps[w['verse_key']][w['position']]
                if k == 'w':
                    if g != expect: raise SystemExit(f'page {p}: word {g} where {expect} was expected')
                    expect += 1
                    if first is None: first = g
                kinds += k
            elif w['type'] == 'end':
                v = vindex[w['verse_key']]
                if expect != verse_start[v + 1]: raise SystemExit(f'page {p}: end of {w["verse_key"]} before its last word')
                kinds += 'e'
            elif w['type'] == 'quarter':
                kinds += 'q'
            else:
                raise SystemExit(f'page {p}: unknown glyph type {w["type"]}')
            chars += chr(w['code'])
        lines.append([chars, kinds, width])
        full_widths.append(width)
    out_pages.append({'f': fnum, 'g': first, 'l': lines})

if expect != verse_start[-1]: raise SystemExit(f'{expect} of {verse_start[-1]} words placed')
full_widths.sort()
median = full_widths[len(full_widths) // 2]
centred = 0
for pg in out_pages:
    for l in pg['l']:
        if l[0] in ('h', 'b'): continue
        w = l.pop()
        if w < 0.86 * median: l.append(1); centred += 1

data = {'v': 1, 'src': 'quran-qcf4', 'em': round(median, 4), 'pages': out_pages}
json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(out_pages)} pages, {expect} words, full line {median:.3f} em, {centred} centred lines, {os.path.getsize(OUT) / 1024:.0f} KB')
