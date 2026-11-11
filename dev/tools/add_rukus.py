"""Add the sections of the Quran that belong together in meaning (rukūʿ, 556 in Hafs) to quran.json: `rukus`, the
first verse (index in the app's verse list) of every section. A rukūʿ is the traditional thematic section of a surah,
marked ع in the margin of the mushafs of South Asia; a surah has one or more, a section never crosses a surah.

Source: Tanzil.net Quran Metadata 1.0 (quran-data.js, https://tanzil.net/res/text/metadata/quran-data.js),
Creative Commons Attribution 3.0. The same list is in quran-meta (MIT, quran-center), which checks it against the
Quranpedia dumps; the app's credits name Tanzil.

Checked here: 556 sections in order, every surah begins one, the surah starts and verse counts of Tanzil are those of
quran.json, and every surah has as many sections as Tanzil's surah table says.

Usage: python3 -I add_rukus.py TANZIL_QURAN_DATA_JS QURAN_JSON   (after build_quran.py; quran.json is rewritten)
"""
import json, re, sys

META, QURAN = sys.argv[1:3]
t = open(META, encoding='utf-8').read()
assert 'Tanzil' in t and 'Creative Commons Attribution 3.0' in t, 'not the Tanzil metadata'


def block(name):
    i = t.index('QuranData.%s = [' % name)
    return t[i:t.index('];', i)]


# [start, ayas, order, rukus, name, tname, ename, type]
sura = [tuple(int(x) for x in m) for m in re.findall(r"\[(\d+), (\d+), (\d+), (\d+),", block('Sura'))]
pairs = [(int(s), int(a)) for s, a in re.findall(r'\[(\d+),\s*(\d+)\]', block('Ruku'))]
assert len(sura) == 114 and len(pairs) == 556, (len(sura), len(pairs))

q = json.load(open(QURAN, encoding='utf-8'))
for n, s in enumerate(q['surahs']):
    assert (s['start'], s['ayahs']) == sura[n][:2], ('surah', n + 1)
rukus = []
for s, a in pairs:
    assert 1 <= a <= q['surahs'][s - 1]['ayahs'], (s, a)
    rukus.append(q['surahs'][s - 1]['start'] + a - 1)
assert rukus == sorted(set(rukus)) and rukus[0] == 0
assert all((n + 1, 1) in set(pairs) for n in range(114)), 'a surah that does not begin a section'
per = {}
for s, _ in pairs:
    per[s] = per.get(s, 0) + 1
assert all(per[n + 1] == sura[n][3] for n in range(114)), 'sections per surah'

out = {}
for k, v in q.items():
    if k == 'rukus':
        continue
    out[k] = v
    if k == 'juz':
        out['rukus'] = rukus
src = re.sub(r'; rukus: .*$', '', out['source'])
out['source'] = src + '; rukus: Tanzil.net Quran Metadata 1.0 (CC BY 3.0)'
json.dump(out, open(QURAN, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('sections:', len(rukus), 'surahs with one:', sum(1 for n in range(114) if per[n + 1] == 1))
