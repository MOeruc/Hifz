// MyHifz logo: the heart is a page of the Mushaf. 15 lines (like a page of the Madina Mushaf) fill the heart;
// memorised lines are bright, the rest faint; a small golden light writes from right to left, verse ends are gold,
// the last verse end is the tip of the heart. Used by icons.js; the start screen in app/src/index.html uses the same data.

// [x, y, w, h, line, verse end, position along the line (0 right end, 1 left end)] in a 512 box, in writing order
const ITEMS = [[369.1,140.5,26.9,11,0,0,0],[312.4,140.5,49.7,11,0,0,0.121],[276,140.5,29.4,11,0,0,0.324],[180.8,140.5,55.2,11,0,0,0.571],[116,140.5,57.8,11,0,0,0.794],[374.4,158.1,32.6,11,1,0,0],[328.5,158.1,38.9,11,1,0,0.131],[295.3,158.1,26.2,11,1,0,0.283],[270,158.1,18.4,11,1,0,0.393],[207,158.1,56,11,1,0,0.477],[181,158.1,19,11,1,0,0.686],[150.5,158.1,23.4,11,1,0,0.772],[105,158.1,38.5,11,1,0,0.872],[366.9,175.6,45.6,11,2,0,0],[337,175.6,22.8,11,2,0,0.168],[275.2,175.6,54.9,11,2,0,0.263],[230.4,175.6,37.8,11,2,0,0.461],[189.5,175.6,33.8,11,2,0,0.604],[126.2,175.6,56.3,11,2,0,0.735],[99.5,175.6,19.7,11,2,0,0.937],[351.4,193.2,61.1,11,3,0,0],[312,193.2,32.4,11,3,0,0.218],[287,191.2,15,15,3,1,0.353],[237.2,193.2,43.9,11,3,0,0.42],[186.6,193.2,43.6,11,3,0,0.583],[141.8,193.2,37.8,11,3,0,0.744],[99.5,193.2,35.3,11,3,0,0.887],[370.4,210.8,36.6,11,4,0,0],[324.3,210.8,39.1,11,4,0,0.144],[291.2,210.8,26.1,11,4,0,0.297],[255.2,210.8,28.9,11,4,0,0.407],[195.5,210.8,52.7,11,4,0,0.526],[163.9,210.8,24.6,11,4,0,0.723],[105,210.8,51.9,11,4,0,0.828],[335,228.4,61,11,5,0,0],[301,228.4,27,11,5,0,0.243],[237,228.4,57.1,11,5,0,0.364],[201,228.4,29,11,5,0,0.593],[156.4,228.4,37.6,11,5,0,0.722],[116,228.4,33.4,11,5,0,0.881],[325.2,245.9,56.8,11,6,0,0],[277.6,245.9,40.5,11,6,0,0.253],[236.5,245.9,34.1,11,6,0,0.442],[186,245.9,43.5,11,6,0,0.605],[158.3,245.9,20.7,11,6,0,0.806],[130,245.9,21.3,11,6,0,0.915],[348.3,263.5,19.7,11,7,0,0],[318.8,263.5,22.5,11,7,0,0.119],[259.8,263.5,52,11,7,0,0.251],[223.5,263.5,29.3,11,7,0,0.515],[198.5,261.5,15,15,7,1,0.69],[144,263.5,48.5,11,7,0,0.784],[331,281.1,23,11,8,0,0],[291.5,281.1,32.4,11,8,0,0.153],[268.4,281.1,16.1,11,8,0,0.354],[214.6,281.1,46.8,11,8,0,0.472],[180.3,281.1,27.2,11,8,0,0.747],[158,281.1,15.3,11,8,0,0.922],[297.4,298.6,42.1,11,9,0,0],[241.7,298.6,48.7,11,9,0,0.294],[200.4,298.6,34.3,11,9,0,0.628],[172.5,298.6,20.9,11,9,0,0.875],[302.8,316.2,22.7,11,10,0,0],[277.8,314.2,15,15,10,1,0.235],[251.5,316.2,20.3,11,10,0,0.386],[186.5,316.2,58,11,10,0,0.582],[253.3,333.8,58.2,11,11,0,0],[200.5,333.8,45.8,11,11,0,0.588],[277.3,351.4,20.2,11,12,0,0],[214.5,351.4,55.8,11,12,0,0.328],[259.9,368.9,23.1,11,13,0,0],[229,368.9,23.9,11,13,0,0.557],[248.5,384.5,15,15,14,1,0]];
// per line: right end, left end, height of the line
const PENS = [[393,119,146],[404,108,163.6],[409.5,102.5,181.1],[409.5,102.5,198.7],[404,108,216.3],[393,119,233.9],[379,133,251.4],[365,147,269],[351,161,286.6],[336.5,175.5,304.1],[322.5,189.5,321.7],[308.5,203.5,339.3],[294.5,217.5,356.9],[280,232,374.4],[260.5,251.5,392]];
const HEART = 'M256 133.4A98 98 0 1 0 99.6 251.4C138.7 316 204.4 391.4 256 446C307.6 391.4 373.3 316 412.4 251.4A98 98 0 1 0 256 133.4Z';
const THEMES = {
  // green leather of the Madina Mushaf's binding, the page written in cream, verse ends and the pen in gold
  mushaf: { bg: '#1F4E3D', ink: '#F6EBCD', ghost: 'rgba(246, 235, 205, .18)', gold: '#E2BE6A', gghost: 'rgba(222, 186, 104, .32)', pen: '#F3D58A' },
  kobalt: { bg: '#2347A8', ink: '#FFFFFF', ghost: 'rgba(255, 255, 255, .2)', gold: '#E4B24E', gghost: 'rgba(228, 178, 78, .32)', pen: '#3CC2B4' },
  hell: { bg: '#FFFFFF', ink: '#2347A8', ghost: 'rgba(35, 71, 168, .14)', gold: '#C98A1B', gghost: 'rgba(201, 138, 27, .3)', pen: '#0F7D77' },
  dunkel: { bg: '#0D1424', ink: '#E6EBF4', ghost: 'rgba(230, 235, 244, .16)', gold: '#E4B24E', gghost: 'rgba(228, 178, 78, .3)', pen: '#3CC2B4' },
};

// zustand: 'aufbau' (the logo: two thirds of the page memorised, the light at the next word), 'fertig' (whole page)
function renderLogo(p) {
  const T = THEMES[p.farbe] || THEMES.mushaf;
  const size = Number(p.groesse) || 512;
  const inset = Number(p.rand) || 1;
  const px = size * inset, k = px / 512, off = (size - px) / 2;
  const done = p.zustand === 'fertig' ? ITEMS.length : Math.round(0.68 * ITEMS.length);
  const sw = px < 72 ? 20 : px < 110 ? 16 : px < 160 ? 14 : 12;
  const box = it => `position:absolute;left:${it[0]}px;top:${it[1]}px;width:${it[2]}px;height:${it[3]}px;border-radius:${it[3]}px;`;
  let s = '';
  ITEMS.forEach((it, i) => {
    s += `<i style="${box(it)}background:${it[5] ? T.gghost : T.ghost}"></i>`;
    if (i < done) s += `<i style="${box(it)}background:${it[5] ? T.gold : T.ink}${it[5] ? ';box-shadow:0 0 10px ' + T.gold : ''}"></i>`;
  });
  if (done < ITEMS.length) {
    const it = ITEMS[done - 1];
    s += `<i style="position:absolute;left:${it[0] - 7}px;top:${it[1] + it[3] / 2 - 7}px;width:14px;height:14px;border-radius:50%;background:${T.pen};box-shadow:0 0 14px 4px ${T.pen}"></i>`;
  }
  const bg = p.form === 'ohne' ? 'transparent' : T.bg;
  const corner = p.form === 'rund' ? '50%' : p.form === 'ohne' ? '0' : '22.5%';
  return `<div style="position:relative;width:${size}px;height:${size}px;border-radius:${corner};background:${bg};overflow:hidden;flex:none">`
    + `<div style="position:absolute;left:0;top:0;width:512px;height:512px;transform-origin:0 0;transform:translate(${off}px,${off}px) scale(${k})">`
    + `<svg viewBox="0 0 512 512" width="512" height="512" style="position:absolute;left:0;top:0"><path d="${HEART}" fill="none" stroke="${T.ink}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`
    + s + '</div></div>';
}

module.exports = { renderLogo, ITEMS, PENS, HEART, THEMES };
