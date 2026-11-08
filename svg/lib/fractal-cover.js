// svg/lib/fractal-cover.js -- static collection cover for Permissionless Fractals.
// Deterministic frame of the mint-page background renderer (Classic form, same hop(), palette, log density,
// 3px cells). Not the on-chain template. Pure function: same output every load.
export function fractalCoverSvg(opts = {}) {
  const size = opts.size || 360, px = 3, iters = opts.iters || 400000;
  const p = { a: -2.0, b: -0.33, c: 0.01, d: -1, s: -1, f: 1, g: 0, h: 0 }, range = 35;
  const cols = Math.floor(size / px), rows = cols;
  const hit = new Uint32Array(cols * rows);
  let fx = 0, fy = 0, maxH = 0;
  const xMin = -range / 2, yMin = -range / 2, sc = Math.min(cols / range, rows / range);
  const oX = (cols - range * sc) / 2, oY = (rows - range * sc) / 2;
  for (let i = 0; i < iters; i++) {
    const bxc = p.b * fx - p.c, abs = Math.abs(bxc), sf = fx < 0 ? p.s : 1;
    const t = p.f * Math.sqrt(abs) + p.g * Math.sin(bxc) + p.h * abs;
    const xn = fy + p.d * sf * t; fy = p.a - fx; fx = xn;
    const gx = Math.floor((fx - xMin) * sc + oX), gy = Math.floor((fy - yMin) * sc + oY);
    if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) { const k = gy * cols + gx; hit[k]++; if (hit[k] > maxH) maxH = hit[k]; }
  }
  const pal = [];
  for (let i = 0; i < 120; i++) {
    const hu = (i * 10) % 360, hh = hu / 60, c = 0.7, x = c * (1 - Math.abs(hh % 2 - 1)), m = 0.5 - c / 2;
    let r, g, b;
    if (hh < 1) { r = c; g = x; b = 0; } else if (hh < 2) { r = x; g = c; b = 0; } else if (hh < 3) { r = 0; g = c; b = x; }
    else if (hh < 4) { r = 0; g = x; b = c; } else if (hh < 5) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
    pal.push('#' + [r, g, b].map((v) => Math.floor((v + m) * 255).toString(16).padStart(2, '0')).join(''));
  }
  const lm = Math.log(maxH + 1), out = [];
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const v = hit[gy * cols + gx]; if (!v) continue;
    out.push(`<rect x="${gx * px}" y="${gy * px}" width="${px}" height="${px}" fill="${pal[Math.floor(Math.log(v + 1) / lm * 119) % 120]}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><title>Permissionless Fractals</title><rect width="${size}" height="${size}" fill="#07080b"/>${out.join('')}</svg>`;
}
