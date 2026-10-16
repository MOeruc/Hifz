const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, url, out] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(url, { waitUntil: 'load' }); await p.waitForSelector('.w');
  await p.evaluate(() => RahleDebug.Reader.render(2)); await p.waitForTimeout(300);
  const g1 = await p.evaluate(() => RahleDebug.D.Q.verseStart[RahleDebug.D.quran.surahs[1].start + 2] + 3); // 2:3 word 4
  const g2 = await p.evaluate(() => RahleDebug.D.Q.verseStart[RahleDebug.D.quran.surahs[1].start + 5] + 4); // 2:6 word 5
  for (const [g, name] of [[g1, 'w1'], [g2, 'w2']]) {
    await p.evaluate(gg => document.querySelector(`.w[data-g="${gg}"]`).click(), g);
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${out}/${name}.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  }
  await p.evaluate(() => document.querySelector('.tab[data-tab="words"]').click());
  await p.waitForSelector('#w-list .li');
  await p.click('#w-surah'); await p.waitForTimeout(500);
  await p.click('.sheet [data-s="112"]'); await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/w3-surahwords.png` });
  await p.click('.sheet .lemma-row'); await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/w4-lemma.png` });
  console.log('errors', JSON.stringify(errors));
  await b.close();
})();
