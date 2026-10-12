import sys, json, os, glob, importlib.util
repo, risan, out = sys.argv[1], sys.argv[2], sys.argv[3]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec); sys.modules[name] = m; spec.loader.exec_module(m); return m
load('tree', os.path.join(repo, 'tree.py'))
tc = load('tajweed_classifier', os.path.join(repo, 'tajweed_classifier.py'))
from tree import json2tree
rule_trees = {}
for sf in glob.glob(os.path.join(repo, 'rule_trees', '*.start.json')):
    rn = os.path.basename(sf).partition('.')[0]
    rule_trees[rn] = {'start': json2tree(json.load(open(sf))), 'end': json2tree(json.load(open(sf.replace('.start.', '.end.'))))}
tan = json.load(open(os.path.join(risan, 'data/tanzil/uthmani.json')))
import multiprocessing
def work(t):
    try:
        return tc.label_ayah(t)
    except AssertionError as e:
        print('ERR', t[0], t[1], str(e)[:200], flush=True)
        return {'surah': t[0], 'ayah': t[1], 'annotations': [], 'error': True}
tasks = [(s, v['verse'], v['text'], rule_trees) for s in range(1,115) for v in tan[str(s)]]
if __name__ == '__main__':
    with multiprocessing.Pool(os.cpu_count()) as pool:
        results = pool.map(work, tasks, chunksize=20)
    errors = sum(1 for r in results if r.get('error'))
    json.dump(results, open(out, 'w'), ensure_ascii=False)
    print('done', len(results), 'errors', errors, 'rules', sorted(rule_trees), flush=True)
