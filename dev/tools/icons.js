const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [,, html, outdir] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const [id, size, name] of [['std', 512, 'icon-512.png'], ['std', 192, 'icon-192.png'], ['apple', 180, 'icon-180.png'], ['mask', 512, 'icon-maskable.png']]) {
    const p = await b.newPage({ viewport: { width: 600, height: 1100 }, deviceScaleFactor: size / 512 });
    await p.goto('file://' + html);
    const el = await p.$('#' + id);
    await el.screenshot({ path: outdir + '/' + name, omitBackground: id === 'std' });
    await p.close();
  }
  await b.close();
  console.log('icons done');
})();
