"""Give the senses of dev/data/senses_de.json their ids: appends [key, lemma id, "SENSE"] to the lemma table for every
sense that has none yet. The table only grows, so ids stay what they were (progress is stored by id).

Usage: python3 -I add_sense_ids.py SENSES_JSON LEMMA_IDS_JSON
Run build_quran.py and build_lexicon.py afterwards.
"""
import json, sys

SENSES, TABLE = sys.argv[1:3]
senses = json.load(open(SENSES, encoding='utf-8'))
table = json.load(open(TABLE, encoding='utf-8'))
have = {(e[0], e[1]) for e in table if e[2] == 'SENSE'}
new = []
for b, e in senses.items():
    if b.startswith('_'):
        continue
    assert table[int(b)][2] != 'SENSE', b
    for x in e.get('senses', []):
        if (x['key'], b) not in have:
            new.append([x['key'], b, 'SENSE'])
            have.add((x['key'], b))
if new:
    table += new
    with open(TABLE, 'w', encoding='utf-8') as f:
        f.write('[\n' + ',\n'.join(json.dumps(e, ensure_ascii=False) for e in table) + '\n]\n')
print('new sense ids:', len(new), 'table size:', len(table))
