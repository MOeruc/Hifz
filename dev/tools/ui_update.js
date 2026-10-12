// Simulates: app installed (v1), new files uploaded (v2), app opened again -> runs v2 without reinstall.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [,, base, dir] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(base + '/index.html'); await p.waitForSelector('.w');
  await p.evaluate(async () => { await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 1200)); });
  await p.evaluate(() => { RahleDebug.Hifz.setVerses([0, 1, 2], true); });
  const v1 = await p.evaluate(() => document.documentElement.innerHTML.match(/APP_VERSION = '([^']*)'/)[1]);
  // "upload" a new version: change version string and cache name
  let html = fs.readFileSync(dir + '/index.html', 'utf8').replace(/APP_VERSION = '[^']*'/, "APP_VERSION = 'NEUE-VERSION'");
  fs.writeFileSync(dir + '/index.html', html);
  let sw = fs.readFileSync(dir + '/sw.js', 'utf8').replace(/const CACHE = 'rahle-[^']*'/, "const CACHE = 'rahle-test2'");
  fs.writeFileSync(dir + '/sw.js', sw);
  await p.close();
  // open the app again (new launch)
  const p2 = await ctx.newPage();
  await p2.goto(base + '/index.html'); await p2.waitForSelector('.w');
  await p2.waitForTimeout(3000);
  await p2.waitForFunction(() => window.RahleDebug && window.RahleDebug.D.quran && document.querySelector('.w'), null, { timeout: 15000 });
  const v2 = await p2.evaluate(() => (document.documentElement.innerHTML.match(/APP_VERSION = '([^']*)'/) || [])[1]);
  const memCount = await p2.evaluate(() => { const s = atob(RahleDebug.Store.data.mem); return s.charCodeAt(0); });
  console.log('before:', v1, '| after reopening:', v2, '| progress kept (bits of first byte):', memCount);
  await b.close();
})();
