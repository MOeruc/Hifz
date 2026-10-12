// Feed the Tanzil "simple-clean" text (modern spelling, no marks) as if it were recogniser output,
// verse by verse, and check the tracker accepts the whole Quran as correctly recited.
const fs = require('fs');
const QC = require('../core.js');
const quran = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const simple = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const Q = QC.buildWords(quran);
const t = new QC.Tracker(Q, { strictness: 1 });
const counts = {}; const pairs = new Map();
let vi = 0, words = 0, t0 = Date.now();
for (let s = 1; s <= 114; s++) {
  for (const v of simple[String(s)]) {
    const a = Q.verseStart[vi], b = Q.verseStart[vi + 1];
    t.reset(a);
    t.feed([v.text], '');
    for (let g = a; g < b; g++) {
      words++;
      const st = t.status[g];
      counts[st] = (counts[st] || 0) + 1;
      if (st !== QC.ST.OK) {
        const key = st + ' ' + Q.words[g].t + ' => ' + (t.heard.get(g) || '-');
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
    vi++;
  }
}
console.log('verses', vi, 'words', words, 'ms', Date.now() - t0);
console.log('status counts', counts, 'ok rate', ((counts[1] || 0) / words * 100).toFixed(2) + '%');
const top = [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, +(process.argv[4] || 60));
for (const [k, n] of top) console.log(n, k);
