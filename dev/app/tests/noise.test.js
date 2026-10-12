// Simulated recogniser noise: tracking must keep its place and flag roughly only the injected errors.
const fs = require('fs');
const QC = require('../core.js');
const quran = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const simple = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const Q = QC.buildWords(quran);
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const letters = 'بتثجحخدذرزسشصضطظعغفقكلمنهوي';
function simpleWords(s, a) { let w = simple[String(s)][a - 1].text.split(' '); if (a === 1 && s !== 1 && s !== 9) w = w.slice(4); return w; }
function run(s, a1, a2, noise, searchFrom) {
  const v1 = quran.surahs[s - 1].start + a1 - 1, v2 = quran.surahs[s - 1].start + a2 - 1;
  const A = Q.verseStart[v1], B = Q.verseStart[v2 + 1];
  let toks = []; for (let a = a1; a <= a2; a++) toks = toks.concat(simpleWords(s, a));
  let injected = 0; const out = [];
  for (let i = 0; i < toks.length; i++) {
    const r = rnd();
    if (r < noise.drop) { injected++; continue; }
    if (r < noise.drop + noise.garble && toks[i].length > 2) { const p = 1 + Math.floor(rnd() * (toks[i].length - 1)); out.push(toks[i].slice(0, p) + letters[Math.floor(rnd() * letters.length)] + toks[i].slice(p + 1)); injected++; continue; }
    if (r < noise.drop + noise.garble + noise.merge && i + 1 < toks.length) { out.push(toks[i] + toks[i + 1]); i++; continue; }
    out.push(toks[i]);
  }
  const t = new QC.Tracker(Q);
  let jumps = 0, found = 0; t.on('jump', () => jumps++); t.on('found', () => found++);
  if (searchFrom != null) t.reset(Q.verseStart[quran.surahs[searchFrom - 1].start], { search: true }); else t.reset(A);
  let i = 0, calls = 0; const t0 = Date.now(); let maxMs = 0;
  while (i < out.length) {
    t.newSession(); const finals = []; const end = Math.min(out.length, i + 14 + Math.floor(rnd() * 10));
    while (i < end) {
      const n = Math.min(end - i, 2 + Math.floor(rnd() * 5));
      const part = out.slice(i, i + n).join(' ');
      let c0 = Date.now(); t.feed(finals, part); maxMs = Math.max(maxMs, Date.now() - c0);
      finals.push(part); c0 = Date.now(); t.feed(finals, ''); maxMs = Math.max(maxMs, Date.now() - c0);
      calls += 2; i += n;
    }
  }
  let flagged = 0; for (let g = A; g < B; g++) if (t.status[g] !== QC.ST.OK) flagged++;
  console.log(`${s}:${a1}-${a2}${searchFrom ? ' (search from ' + searchFrom + ')' : ''} words ${B - A} injected ${injected} flagged ${flagged} pointerAtEnd ${t.pointer === B} jumps ${jumps} found ${found} avg ${((Date.now() - t0) / calls).toFixed(1)}ms max ${maxMs}ms`);
  return t.pointer === B && flagged <= injected * 2 + 6 && jumps === 0 && (searchFrom == null || found === 1);
}
let ok = true;
ok &= run(18, 1, 60, { drop: 0.03, garble: 0.03, merge: 0.03 });
ok &= run(2, 1, 40, { drop: 0.05, garble: 0.04, merge: 0.02 });
ok &= run(36, 1, 83, { drop: 0.02, garble: 0.02, merge: 0.05 });
ok &= run(55, 1, 78, { drop: 0.04, garble: 0.03, merge: 0.02 });
ok &= run(67, 1, 30, { drop: 0.1, garble: 0.06, merge: 0.03 });
ok &= run(36, 1, 40, { drop: 0.04, garble: 0.04, merge: 0.03 }, 2);
ok &= run(55, 1, 60, { drop: 0.03, garble: 0.03, merge: 0.02 }, 18);
ok &= run(26, 1, 60, { drop: 0.03, garble: 0.03, merge: 0.02 }, 1);
console.log(ok ? 'robustness ok' : 'ROBUSTNESS FAILED');
if (!ok) process.exitCode = 1;
