// lib/hopalong-art.js -- 8-bit hopalong attractor from on-chain params (preview display).
// Matches the mint-page fractal background grammar (a,b,c,d,s,f,g,h + range).

export function paramsFromNftExtension(ext) {
  const list = ext?.params || ext?.extension?.params || [];
  const map = {};
  if (Array.isArray(list)) {
    for (const p of list) {
      if (p && p.name != null) map[String(p.name)] = p.value;
    }
  }
  const num = (k, fallback) => {
    const v = Number(map[k]);
    return Number.isFinite(v) ? v : fallback;
  };
  let zooms = map.zooms;
  if (typeof zooms === 'string') {
    try { zooms = JSON.parse(zooms); } catch { zooms = null; }
  }
  return {
    a: num('a', -2),
    b: num('b', -0.33),
    c: num('c', 0.01),
    d: num('d', -1),
    s: num('s', -1),
    f: num('f', 1),
    g: num('g', 0),
    h: num('h', 0),
    base_range: num('base_range', 60),
    zooms: Array.isArray(zooms) ? zooms : null,
    raw: map,
  };
}

export function formatCoords(p) {
  if (!p) return '';
  const keys = ['a', 'b', 'c', 'd', 's', 'f', 'g', 'h', 'base_range'];
  return keys.map((k) => k + '=' + p[k]).join(' · ');
}

export function hopalongSvg(params, opts = {}) {
  const size = opts.size || 360;
  const px = opts.px || 3;
  const iters = opts.iters || 100000;
  const cols = Math.floor(size / px);
  const rows = Math.floor(size / px);
  const range = Number(params.base_range) > 0 ? Number(params.base_range) / 2 : 30;
  const p = {
    a: params.a, b: params.b, c: params.c, d: params.d,
    s: params.s, f: params.f, g: params.g, h: params.h,
  };
  let fx = 0, fy = 0;
  const hit = new Uint32Array(cols * rows);
  let maxH = 0;
  const xMin = -range, xMax = range, yMin = -range, yMax = range;
  const xR = xMax - xMin, yR = yMax - yMin;
  const sc = Math.min(cols / xR, rows / yR);
  const oX = (cols - xR * sc) / 2, oY = (rows - yR * sc) / 2;
  for (let i = 0; i < iters; i++) {
    const bxc = p.b * fx - p.c;
    const abs = Math.abs(bxc);
    const sf = fx < 0 ? p.s : 1;
    const t = p.f * Math.sqrt(abs) + p.g * Math.sin(bxc) + p.h * abs;
    const xn = fy + p.d * sf * t;
    fy = p.a - fx;
    fx = xn;
    const gx = Math.floor((fx - xMin) * sc + oX);
    const gy = Math.floor((fy - yMin) * sc + oY);
    if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
      const idx = gy * cols + gx;
      hit[idx]++;
      if (hit[idx] > maxH) maxH = hit[idx];
    }
  }
  const pal = [];
  for (let i = 0; i < 120; i++) {
    const hu = (i * 10) % 360, hh = hu / 60, c = 0.7, x = c * (1 - Math.abs(hh % 2 - 1)), m = 0.5 - c / 2;
    let r, g, b;
    if (hh < 1) { r = c; g = x; b = 0; }
    else if (hh < 2) { r = x; g = c; b = 0; }
    else if (hh < 3) { r = 0; g = c; b = x; }
    else if (hh < 4) { r = 0; g = x; b = c; }
    else if (hh < 5) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    pal.push([Math.floor((r + m) * 255), Math.floor((g + m) * 255), Math.floor((b + m) * 255)]);
  }
  const rects = [];
  const lm = Math.log((maxH || 1) + 1);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const h = hit[gy * cols + gx];
      if (!h) continue;
      const lv = Math.log(h + 1) / lm * 119;
      const [r, g, b] = pal[Math.floor(lv) % 120];
      const hex = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
      rects.push('<rect x="' + (gx * px) + '" y="' + (gy * px) + '" width="' + px + '" height="' + px + '" fill="' + hex + '"/>');
    }
  }
  const desc = formatCoords(params).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let body = rects.join('');
  if (body.length > 180000) body = rects.filter((_, i) => i % 2 === 0).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img">' +
    '<title>Permissionless Fractal (8-bit hopalong)</title><desc>' + desc + '</desc>' +
    '<rect width="' + size + '" height="' + size + '" fill="#07080b"/>' + body + '</svg>';
}

export const PROPOSED_ONCHAIN_NOTE = {
  status: 'preview-only',
  reason: 'Live collection template draws polygon vertices from a..h, not the attractor point cloud.',
  needs: 'New SVP1 packed template or new collection instantiate for true on-chain 8-bit hopalong; or keep geometric SVG on-chain and treat 8-bit as display-only from extension.params.',
  coordsAlreadyOnChain: ['a', 'b', 'c', 'd', 's', 'f', 'g', 'h', 'base_range', 'zooms'],
};
