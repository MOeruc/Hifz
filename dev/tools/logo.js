// MyHifz logo: a heart in which particles from outside come together and form the Mushaf.
// Used by icons.js to render the app icons; the start screen in app/src/index.html draws the same shapes.
// zustand: 'aufbau' (the logo, Mushaf half formed), 'fertig', 'schritt' (with fortschritt 0..1), 'animiert'.
const HEART = 'M256 133.4A98 98 0 1 0 99.6 251.4C138.7 316 204.4 391.4 256 446C307.6 391.4 373.3 316 412.4 251.4A98 98 0 1 0 256 133.4Z';

function logoVals(p) {
  // --- the Mushaf, drawn around (256, 243) and placed at (256, 232) at 0.88 ---
  const yAt = (x, f) => {
    const t = x / 108;
    const top = 186 + (176 - 186) * t - 22 * t * (1 - t);
    const bot = 302 + (290 - 302) * t - 4 * t * (1 - t);
    return top + (bot - top) * f;
  };
  const ROWS = [0.27, 0.39, 0.51, 0.63, 0.75, 0.87];
  const WORDS = [[0, .30, .36, .62, .68, 1], [0, .18, .24, .55, .61, 1], [0, .42, .48, .80, .86, 1], [0, .26, .32, 1], [0, .12, .18, .50, .56, 1], [0, .36, .42, .70, .76, 1], [0, .22, .28, .64, .70, 1]];
  const words = [];     // [x1, y1, xm, ym, x2, y2], right to left
  [1, -1].forEach(s => ROWS.forEach((f, i) => {
    if (s === 1 && i === 0) return;
    const w = WORDS[(i + (s === 1 ? 0 : 3)) % WORDS.length];
    for (let k = 0; k < w.length; k += 2) {
      let d1 = 16 + w[k] * 76, d2 = 16 + w[k + 1] * 76;
      let x1 = 256 + s * d1, x2 = 256 + s * d2;
      if (x1 < x2) { const a = x1; x1 = x2; x2 = a; const b = d1; d1 = d2; d2 = b; }
      const y1 = yAt(d1, f), y2 = yAt(d2, f), dm = (d1 + d2) / 2;
      words.push([x1, y1, (x1 + x2) / 2, 2 * yAt(dm, f) - (y1 + y2) / 2, x2, y2]);
    }
  }));
  const f1 = n => n.toFixed(1);
  const geo = {
    heart: HEART,
    cover: 'M256 196C286 184 330 182 372 192L372 304C330 296 290 300 256 320C222 300 182 296 140 304L140 192C182 182 226 184 256 196Z',
    backs: 'M256 192C286 178 328 174 370 184L370 298C328 289 288 293 256 311ZM256 192C226 178 184 174 142 184L142 298C184 289 224 293 256 311Z',
    pages: 'M256 186C286 170 326 166 364 176L364 290C326 280 288 284 256 302ZM256 186C226 170 186 166 148 176L148 290C186 280 224 284 256 302Z',
    frame: 'M266 197.3Q310 186.5 354 189L354 285Q310 288.2 266 294.7ZM246 197.3Q202 186.5 158 189L158 285Q202 288.2 246 294.7Z',
    header: 'M276 196.5C300 189 330 187.5 350 190L350 202C330 199.5 300 201 276 208.5Z',
    lines: words.map(w => 'M' + f1(w[0]) + ' ' + f1(w[1]) + 'Q' + f1(w[2]) + ' ' + f1(w[3]) + ' ' + f1(w[4]) + ' ' + f1(w[5])).join(''),
  };
  const THEMES = {
    kobalt: { bg: '#2347A8', line: '#FFFFFF', page: '#FFFFFF', back: '#C9D6FF', ink: '#3CC2B4', gold: '#E4B24E' },
    hell: { bg: '#FFFFFF', line: '#2347A8', page: '#EAF0FC', back: '#9DB2EA', ink: '#0F7D77', gold: '#C98A1B' },
    dunkel: { bg: '#0D1424', line: '#E6EBF4', page: '#E6EBF4', back: '#8D9CBB', ink: '#3CC2B4', gold: '#E4B24E' },
  };
  const T = THEMES[p.farbe] || THEMES.kobalt;
  const DOT = { P: T.page === '#EAF0FC' ? '#2347A8' : T.page, B: T.back, I: T.ink, G: T.gold };
  const size = Number(p.groesse) || 512;
  const form = p.form || 'abgerundet';
  const inset = Number(p.rand) || 1;
  const px = size * inset;
  let mode = p.zustand || 'aufbau';
  const prog = mode === 'aufbau' ? 0.5 : mode === 'schritt' ? (p.fortschritt == null || p.fortschritt === '' ? 1 : Math.max(0, Math.min(1, Number(p.fortschritt) || 0))) : 1;

  // --- where the particles go: points of the Mushaf ---
  let seed = 7;
  const R = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const tg = [];
  [1, -1].forEach(s => {
    for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) {
      const d = (0.07 + a * 0.145) * 108, v = 0.08 + b * 0.135 + (a % 2) * 0.06;
      if (v > 0.95) continue;
      tg.push([256 + s * d + (R() - 0.5) * 3, yAt(d, v) + (R() - 0.5) * 3, 'P']);
    }
  });
  words.forEach(w => {
    for (let t = 0; t <= 1.001; t += 0.5) {
      const u = 1 - t;
      tg.push([u * u * w[0] + 2 * u * t * w[2] + t * t * w[4], u * u * w[1] + 2 * u * t * w[3] + t * t * w[5], 'I']);
    }
  });
  [1, -1].forEach(s => {
    for (let i = 0; i <= 5; i++) { const d = 10 + i * 17.6; tg.push([256 + s * d, yAt(d, 0.12), 'G'], [256 + s * d, yAt(d, 0.95), 'G']); }
    for (let i = 1; i < 6; i++) { tg.push([256 + s * 98, 189 + i * 16, 'G'], [256 + s * 10, 197 + i * 16, 'G']); }
    for (let i = 0; i <= 5; i++) { const d = 8 + i * 21; tg.push([256 + s * d, yAt(Math.min(d, 108), 1) + 10, 'G']); }
    for (let i = 0; i < 4; i++) tg.push([256 + s * 114, 200 + i * 30, 'G']);
  });
  // when each point is reached: from the middle of the Mushaf outward, a little uneven
  const CX = 256, CY = 243, W = 130, H = 92;
  const ell = q => Math.hypot((q[0] - CX) / W, (q[1] - CY) / H);
  const emax = Math.max(...tg.map(ell));
  const S = 0.88, OY = 232;
  const place = q => [256 + (q[0] - 256) * S, OY + (q[1] - CY) * S];
  const r1 = n => Math.round(n * 10) / 10;
  const parts = tg.map(q => {
    const at = Math.min(1, Math.max(0, ell(q) / emax * 0.9 + R() * 0.1));
    const tgt = place(q);
    const rt = Math.hypot(tgt[0] - 256, tgt[1] - OY);
    const th = rt < 1 ? -Math.PI / 2 : Math.atan2(tgt[1] - OY, tgt[0] - 256);
    const turn = 1.0 + R() * 0.6;                       // every particle turns the same way, like being drawn in
    const Ls = 250 + R() * 80;
    const pol = (a, r) => [256 + Math.cos(a) * r * 1.08, OY + Math.sin(a) * r];
    const th0 = th - turn;
    const st = pol(th0, Ls);
    const c1 = pol(th0 + turn * 0.4, Ls * 0.72);
    const c2 = pol(th0 + turn * 0.82, rt + (Ls - rt) * 0.28);
    return { at, P: [st, c1, c2, tgt], c: DOT[q[2]], d: 4 + R() * 4 };
  });

  const dots = [];
  const CYCLE = 12, SHIFT = -0.8 * CYCLE;
  const bez = (P, t) => { const u = 1 - t; return [0, 1].map(i => u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i]); };
  if (mode === 'animiert') {
    parts.forEach(q => {
      const delay = (0.12 + 0.54 * q.at - 0.15) * CYCLE + SHIFT;
      dots.push({
        x: r1(-q.d / 2), y: r1(-q.d / 2), s: r1(q.d), f: q.c, o: 0, k: 'mh-p', glow: '0 0 ' + r1(q.d * 1.3) + 'px ' + q.c,
        path: "path('M" + q.P.map(pt => r1(pt[0]) + ' ' + r1(pt[1])).join(' ').replace(/^(\S+ \S+) /, '$1C') + "')",
        a: 'mhp ' + CYCLE + 's ' + delay.toFixed(2) + 's infinite',
      });
    });
  } else if (mode !== 'fertig') {
    const F = 0.35;
    parts.forEach(q => {
      let s, o;
      if (prog >= q.at - F && prog < q.at) { s = (prog - (q.at - F)) / F; o = 0.5 + 0.5 * s; }
      else if (prog >= q.at && prog < q.at + 0.05) { s = 1; o = 1 - (prog - q.at) / 0.05; }
      else return;
      const xy = bez(q.P, s);
      const d = q.d * 1.25;
      dots.push({ x: r1(xy[0] - d / 2), y: r1(xy[1] - d / 2), s: r1(d), f: q.c, o: r1(o * 100) / 100, k: '', path: 'none', a: 'none', glow: s > 0.85 ? '0 0 ' + r1(d) + 'px ' + q.c : 'none' });
    });
  }
  // the solid Mushaf shows where the particles have arrived: a soft ellipse growing from its middle
  const reveal = e => {
    const k = e + 0.16;
    return r1(2 * W * k * S / 0.8) + 'px ' + r1(2 * H * k * S / 0.8) + 'px';
  };
  const full = mode !== 'animiert' && (mode === 'fertig' || prog >= 1);
  const mask = full ? 'none' : 'radial-gradient(closest-side, #000 70%, transparent 100%)';
  const msize = full ? 'auto' : mode === 'animiert' ? '0px 0px' : reveal(prog * emax * 0.97);
  const sw = px < 100 ? 18 : px < 160 ? 15 : 12;
  return {
    size, k: Math.round(px / 512 * 100000) / 100000, off: r1((size - px) / 2),
    bg: form === 'ohne' ? 'transparent' : T.bg,
    corner: form === 'rund' ? '50%' : form === 'abgerundet' ? '22.5%' : '0',
    t: T, sw, geo, dots, mask, msize,
    bookAnim: mode === 'animiert' ? 'mhrev ' + CYCLE + 's ' + SHIFT + 's infinite' : 'none',
    endSize: reveal(emax * 1.1),
  };
}

function keyframes(endSize) {
  return [
    '@keyframes mhp{0%{offset-distance:0%;opacity:0;animation-timing-function:cubic-bezier(.3,.5,.4,1)}2%{opacity:1}15%{offset-distance:100%;opacity:1}17%{offset-distance:100%;opacity:0}100%{offset-distance:100%;opacity:0}}',
    `@keyframes mhrev{0%,12%{mask-size:0px 0px;opacity:1}66%{mask-size:${endSize};opacity:1}67%,92%{mask-size:1400px 1100px;opacity:1}97%{mask-size:1400px 1100px;opacity:0}100%{mask-size:0px 0px;opacity:0}}`,
    '@media (prefers-reduced-motion: reduce){.mh-p{animation:none!important}.mh-g{animation:none!important;mask-image:none!important}}',
  ].join('\n');
}

function renderLogo(props) {
  const v = logoVals(props);
  const G = v.geo, t = v.t;
  const dots = v.dots.map(d => `<div class="${d.k}" style="position: absolute; left: ${d.x}px; top: ${d.y}px; width: ${d.s}px; height: ${d.s}px; border-radius: 50%; background: ${d.f}; opacity: ${d.o}; box-shadow: ${d.glow}; offset-path: ${d.path}; offset-rotate: 0deg; animation: ${d.a}"></div>`).join('');
  return `<div style="position: relative; width: ${v.size}px; height: ${v.size}px; border-radius: ${v.corner}; background: ${v.bg}; overflow: hidden; flex: none">
<div style="position: absolute; left: 0; top: 0; width: 512px; height: 512px; transform-origin: 0 0; transform: translate(${v.off}px, ${v.off}px) scale(${v.k})">
<svg viewBox="0 0 512 512" width="512" height="512" style="position: absolute; left: 0; top: 0" role="img" aria-label="MyHifz Logo"><path d="${G.heart}" style="fill: none; stroke: ${t.line}; stroke-width: ${v.sw}px; stroke-linejoin: round"></path></svg>
<div class="mh-g" style="position: absolute; left: 0; top: -24px; width: 512px; height: 512px; mask-image: ${v.mask}; mask-size: ${v.msize}; mask-position: center; mask-repeat: no-repeat; animation: ${v.bookAnim}">
<svg viewBox="0 0 512 512" width="512" height="512" style="position: absolute; left: 0; top: 24px" aria-hidden="true">
<g transform="translate(256 232) scale(0.88) translate(-256 -243)">
<path d="${G.cover}" style="fill: ${t.gold}"></path><path d="${G.backs}" style="fill: ${t.back}"></path><path d="${G.pages}" style="fill: ${t.page}"></path>
<path d="M256 186L256 302" style="stroke: ${t.back}; stroke-width: 3px"></path>
<path d="${G.frame}" style="fill: none; stroke: ${t.gold}; stroke-width: 2.4px; stroke-linejoin: round"></path><path d="${G.header}" style="fill: ${t.gold}"></path>
<path d="${G.lines}" style="fill: none; stroke: ${t.ink}; stroke-width: 4.6px; stroke-linecap: round"></path>
</g></svg></div>
<div aria-hidden="true">${dots}</div>
</div></div>`;
}

module.exports = { logoVals, keyframes, renderLogo, HEART };
