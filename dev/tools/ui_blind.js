// UI check: the blind test. No text at all; the teacher card says per verse whether it was right, stops at a word
// left out, counts a skipped verse, helps step by step; n-best alternatives; the end of the surah; hidden text too.
// Run: node ui_blind.js http://127.0.0.1:8765 OUT_DIR
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, base, out] = process.argv;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// a scripted recogniser: one phrase per session; a phrase may come with alternatives (n-best) for its final result
function fakeSR() {
  window.__queue = []; window.__busy = false; window.__maxAlt = 0;
  class FakeSR {
    constructor() { this.stopped = false; }
    start() { window.__maxAlt = this.maxAlternatives; setTimeout(() => { this.onstart && this.onstart(); this.wait(); }, 30); }
    stop() { this.stopped = true; setTimeout(() => this.onend && this.onend(), 10); }
    abort() { this.stop(); }
    wait() {
      if (this.stopped) return;
      if (!window.__queue.length) { setTimeout(() => this.wait(), 60); return; }
      const item = window.__queue.shift();
      const alts = typeof item === 'string' ? [item] : item.alts;
      const words = alts[0].split(' ');
      window.__busy = true;
      let k = 0;
      const emit = (list, f) => { const x = list.map(t => ({ transcript: t, confidence: 0.9 })); x.isFinal = f; this.onresult && this.onresult({ results: [x], resultIndex: 0 }); };
      const step = () => {
        if (this.stopped) return;
        k++;
        if (k < words.length) { emit([words.slice(0, k).join(' ')], false); setTimeout(step, 30); }
        else { emit(alts, true); setTimeout(() => { window.__busy = false; this.onend && this.onend(); }, 80); }
      };
      step();
    }
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
}

const V67 = {
  1: 'تبارك الذي بيده الملك وهو على كل شيء قدير',
  2: 'الذي خلق الموت والحياة ليبلوكم أيكم أحسن عملا وهو العزيز الغفور',
  3: 'الذي خلق سبع سماوات طباقا ما ترى في خلق الرحمن من تفاوت فارجع البصر هل ترى من فطور',
  4: 'ثم ارجع البصر كرتين ينقلب إليك البصر خاسئا وهو حسير',
  5: 'ولقد زينا السماء الدنيا بمصابيح وجعلناها رجوما للشياطين وأعتدنا لهم عذاب السعير',
  6: 'وللذين كفروا بربهم عذاب جهنم وبئس المصير',
  7: 'إذا ألقوا فيها سمعوا لها شهيقا وهي تفور',
};
const V112 = ['قل هو الله أحد', 'الله الصمد', 'لم يلد ولم يولد', 'ولم يكن له كفوا أحد'];

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404|fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); }); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); watch(p);
  await p.addInitScript(fakeSR);
  await p.goto(base + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('.w'); await p.waitForTimeout(400);
  const say = async item => { await p.evaluate(t => window.__queue.push(t), item); await p.waitForTimeout(120); await p.waitForFunction(() => !window.__busy && !window.__queue.length, null, { timeout: 8000 }); await p.waitForTimeout(300); };
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });
  const card = () => p.evaluate(() => {
    const q = s => document.querySelector(s);
    const t = RahleDebug.Rec.tracker, D = RahleDebug.D, g = Math.min(t.pointer, D.Q.words.length - 1), v = D.Q.words[g].v;
    return { tone: q('#bl-card').dataset.tone, msg: q('#bl-msg').textContent.trim(), ar: q('#bl-ar').hidden ? '' : q('#bl-ar').textContent, small: q('#bl-small').hidden ? '' : q('#bl-small').textContent,
      verse: q('#bl-an').textContent, of: q('#bl-of').textContent, band: [...q('#bl-band').children].map(i => i.className || '-').join(' '), tries: q('#bl-tries').hidden ? '' : q('#bl-tries').textContent,
      ptr: D.Q.verseSurah[v] + ':' + D.Q.verseAyah[v] + '#' + D.Q.words[g].k, reader: document.querySelectorAll('#reader .w.s1').length };
  });
  const log = [];
  const note = async label => { const c = await card(); log.push([label, c]); return c; };

  // 1. the way in: Hifz tab, the card, the picker
  await p.click('.tab[data-tab="hifz"]'); await p.waitForTimeout(400);
  await shot('b0-hifz');
  await p.click('#h-blind'); await p.waitForTimeout(500);
  await shot('b1-pick');
  await p.click('[data-s="67"]'); await p.waitForTimeout(600);
  console.log('max alternatives asked:', await p.evaluate(() => window.__maxAlt));
  await note('start'); await shot('b2-start');
  // 2. isti'adha and basmala: nothing to say about them
  await say('أعوذ بالله من الشيطان الرجيم');
  await say('بسم الله الرحمن الرحيم');
  await note('isti + basmala');
  // 3. verse 1 right
  await say(V67[1]);
  await note('verse 1'); await shot('b3-verse1');
  // 4. verse 2 with a word left out: stop there, "read again from"
  await say(V67[2].replace(' أيكم', ''));
  await note('verse 2 without a word'); await shot('b4-unheard');
  await say('ليبلوكم أيكم أحسن عملا وهو العزيز الغفور');
  await note('verse 2 again from there');
  // 5. verse 4 instead of 3, three times: what happened, then where to start again
  await say(V67[4]);
  await note('skip 1'); await shot('b5-skip');
  await say(V67[4]); await say(V67[4]);
  await note('skip 3'); await shot('b6-runup');
  // 6. the button: the next word
  await p.click('#bl-hint'); await p.waitForTimeout(300);
  await note('button: next word'); await shot('b7-word');
  await say(V67[3]);
  await note('verse 3 (with help)');
  // 7. give up on verse 4
  await p.click('#bl-skip'); await p.waitForTimeout(300);
  await note('skip verse 4'); await shot('b8-shown');
  // 8. verse 5 with a wrong word, twice: what was said, what belongs there. Only at "Genauer": by default
  // (whole words) a word heard as another word goes through, the recogniser mishears too often
  await p.evaluate(() => { RahleDebug.Store.data.settings.strict = 1; RahleDebug.Rec.tracker.opts.strictness = 1; });
  const wrong5 = V67[5].replace('رجوما', 'كتابا');
  await say(wrong5);
  await note('verse 5 wrong word');
  await say(wrong5.split(' ').slice(4).join(' '));
  await note('again the same'); await shot('b9-wrong');
  await say(V67[5].split(' ').slice(4).join(' '));
  await note('verse 5 corrected');
  await p.evaluate(() => { RahleDebug.Store.data.settings.strict = 0; RahleDebug.Rec.tracker.opts.strictness = 0; });
  // 9. n-best: the first guess is wrong, the second right -> the right one is taken
  await say({ alts: ['وللذين كفروا بربهم عذاب جهنم وبئس المسير قدير', V67[6]] });
  await note('verse 6 with alternatives');
  // 10. stop: the summary
  await p.click('#bl-close'); await p.waitForTimeout(600);
  await shot('b10-summary');
  const sum = await p.evaluate(() => ({ title: document.querySelector('.sheet h2').textContent, score: document.querySelector('.sheet .score').textContent.replace(/\s+/g, ' '),
    chips: [...document.querySelectorAll('.bl-chip')].map(c => c.textContent + ':' + c.className.replace('bl-chip ', '')).join(' '), issues: document.querySelectorAll('#bs-issues .issue').length, next: !!document.querySelector('#bs-next') }));
  console.log('summary', JSON.stringify(sum));
  await p.click('#bs-done'); await p.waitForTimeout(400);

  // 11. a whole short surah: the end comes by itself, it never goes on into the next surah; going on is a button
  await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[111].start, mode: 'test', blind: true }); });
  await p.waitForTimeout(500);
  for (const v of V112) await say(v);
  await p.waitForTimeout(500);
  const end = await p.evaluate(() => ({ active: RahleDebug.Rec.active, title: document.querySelector('.sheet h2') && document.querySelector('.sheet h2').textContent, next: document.querySelector('#bs-next') && document.querySelector('#bs-next').textContent }));
  console.log('end of al-Ikhlas', JSON.stringify(end));
  await shot('b11-done');
  await p.click('#bs-next'); await p.waitForTimeout(600);
  const nx = await card();
  console.log('after "next":', nx.verse, nx.of, JSON.stringify(await p.evaluate(() => document.querySelector('#bl-name').textContent)));
  await p.click('#bl-close'); await p.waitForTimeout(400);
  if (await p.$('#bs-done')) await p.click('#bs-done');

  // 12. dark, mid-test
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[66].start, mode: 'test', blind: true }); });
  await p.waitForTimeout(400);
  await say(V67[1]); await say(V67[3]);
  await shot('b12-dark');
  await p.click('#bl-close'); await p.waitForTimeout(400);
  if (await p.$('#bs-done')) await p.click('#bs-done');
  await p.emulateMedia({ colorScheme: 'light' });

  // 13. hidden text (Prüfen): the same gate, said in the card above the bar
  await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[66].start, endV: D.quran.surahs[66].start + 4, mode: 'test' }); });
  await p.waitForTimeout(600);
  await say(V67[1]);
  await say(V67[2].replace(' أيكم', ''));
  const hidden = await p.evaluate(() => ({ hint: document.querySelector('#rec-hint').hidden ? '' : document.querySelector('#rec-hint-t').textContent, tone: document.querySelector('#rec-hint').dataset.tone }));
  console.log('hidden text, a word left out:', JSON.stringify(hidden));
  await shot('b13-hidden');
  await p.click('#rec-stop'); await p.waitForTimeout(500);
  if (await p.$('#sum-done')) { await p.click('#sum-done'); await p.waitForTimeout(400); }

  // 14. hidden text to the end of a short surah: the summary offers the next surah, nothing starts by itself
  await p.evaluate(() => { const D = RahleDebug.D; RahleDebug.Rec.start({ v: D.quran.surahs[111].start, mode: 'test' }); });
  await p.waitForTimeout(500);
  for (const v of V112) await say(v);
  await p.waitForTimeout(500);
  console.log('hidden text, end of al-Ikhlas:', JSON.stringify(await p.evaluate(() => ({ active: RahleDebug.Rec.active, title: document.querySelector('.sheet h2').textContent, next: document.querySelector('#sum-next') && document.querySelector('#sum-next').textContent }))));
  await shot('b14-hidden-done');
  await p.click('#sum-done'); await p.waitForTimeout(400);
  // 15. the picker: a page
  await p.click('.tab[data-tab="hifz"]'); await p.waitForTimeout(300);
  await p.click('#h-blind'); await p.waitForTimeout(400);
  await p.click('.sheet .seg [data-m="p"]'); await p.waitForTimeout(300);
  await p.fill('#bp-range', '603'); await p.dispatchEvent('#bp-range', 'input'); await p.waitForTimeout(200);
  await shot('b15-pick-page');
  await p.click('#bp-go'); await p.waitForTimeout(500);
  console.log('page picked:', JSON.stringify(await p.evaluate(() => ({ name: document.querySelector('#bl-name').textContent, sub: document.querySelector('#bl-sub').textContent, of: document.querySelector('#bl-of').textContent }))));
  await p.click('#bl-close'); await p.waitForTimeout(300);

  for (const [l, c] of log) console.log(l.padEnd(28), JSON.stringify(c));
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
