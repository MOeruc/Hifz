// Renders the app icons from logo.js (the heart as a page of the Mushaf): node dev/tools/icons.js dev/app
// (paths to Playwright and Chromium as in the other tools)
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { renderLogo } = require('./logo.js');
const out = process.argv[2] || '.';
const ICONS = [
  // file, size, logo options, full square background (Apple icon and Android maskable icon)
  ['icon-512.png', 512, { groesse: 512 }, false],
  ['icon-192.png', 192, { groesse: 192 }, false],
  ['icon-180.png', 180, { groesse: 180, form: 'ohne' }, true],
  ['icon-maskable.png', 512, { groesse: 512, form: 'ohne', rand: 0.8 }, true],
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
  for (const [name, size, props, bleed] of ICONS) {
    await p.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}#i{position:relative;width:${size}px;height:${size}px;${bleed ? 'background:#1F4E3D;' : ''}}</style><body><div id="i">${renderLogo(props)}</div></body>`);
    await p.waitForTimeout(100);
    await (await p.$('#i')).screenshot({ path: path.join(out, name), omitBackground: !bleed });
  }
  await b.close();
  console.log('icons done');
})();
