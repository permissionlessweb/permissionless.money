// lib/hopalong-live.js -- the mint page background renderer, as independent instances.
// Same hop(), palette, log-density colouring, 3px cells, 50k iters/frame to 2M, palette cycling
// as the inline background script in mint.html. Seeded by a token's on-chain extension.params.

const PAL = (() => {
  const pal = new Array(120);
  for (let i = 0; i < 120; i++) {
    const hu = (i * 10) % 360, hh = hu / 60, c = 0.7, x = c * (1 - Math.abs(hh % 2 - 1)), m = 0.5 - c / 2;
    let r, g, b;
    if (hh < 1) { r = c; g = x; b = 0; }
    else if (hh < 2) { r = x; g = c; b = 0; }
    else if (hh < 3) { r = 0; g = c; b = x; }
    else if (hh < 4) { r = 0; g = x; b = c; }
    else if (hh < 5) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    pal[i] = [Math.floor((r + m) * 255), Math.floor((g + m) * 255), Math.floor((b + m) * 255)];
  }
  return pal;
})();

/**
 * Two views of one token, both from the background renderer's own windowing:
 *  - Full: the window fitted to the orbit's own extent (0.5–99.5 percentile of a 60k-point pre-run),
 *    so the whole piece is shown whatever its scale.
 *  - Constrained: the background's fixed window, centred on 0 and base_range wide; points outside it
 *    are dropped (exactly how the mint background clamps its seq.range).
 */
export function variantsFromParams(params) {
  const base = Number(params?.base_range) > 0 ? Number(params.base_range) : 60;
  return [
    { name: 'Full', mode: 'full' },
    { name: 'Constrained', mode: 'constrained', cx: 0, cy: 0, range: base },
  ];
}

export function orbitBounds(params, n = 60000) {
  const p = params;
  let fx = 0, fy = 0;
  const xs = new Float64Array(n), ys = new Float64Array(n);
  let k = 0;
  for (let i = 0; i < n + 200; i++) {
    const bxc = p.b * fx - p.c, abs = Math.abs(bxc), sf = fx < 0 ? p.s : 1;
    const t = p.f * Math.sqrt(abs) + p.g * Math.sin(bxc) + p.h * abs;
    const xn = fy + p.d * sf * t;
    fy = p.a - fx; fx = xn;
    if (!Number.isFinite(fx) || !Number.isFinite(fy)) break;
    if (i >= 200) { xs[k] = fx; ys[k] = fy; k++; }
  }
  if (k < 10) return null;
  const q = (arr, lo, hi) => { const a = Array.from(arr.subarray(0, k)).sort((x, y) => x - y); return [a[Math.floor(k * lo)], a[Math.min(k - 1, Math.floor(k * hi))]]; };
  const [x0, x1] = q(xs, 0.005, 0.995), [y0, y1] = q(ys, 0.005, 0.995);
  const range = Math.max(x1 - x0, y1 - y0, 1e-6) * 1.08;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, range };
}

export function mountHopalong(canvas, params, opts = {}) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pxSz = opts.px || 3;
  const MAX = opts.maxIter || 2000000;
  const PER = opts.perFrame || 50000;
  const p = { a: +params.a, b: +params.b, c: +params.c, d: +params.d, s: +params.s, f: +params.f, g: +params.g, h: +params.h };
  let view = { cx: 0, cy: 0, range: Number(params.base_range) > 0 ? Number(params.base_range) : 60 };
  let W, H, cols, rows, hitBuf, maxH = 0, fx = 0, fy = 0, iter = 0, cOff = 0, raf = 0, alive = true;

  function reset() { hitBuf = new Uint32Array(cols * rows); maxH = 0; iter = 0; fx = 0; fy = 0; }
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    W = canvas.width = Math.max(60, Math.floor((r.width || 360) * dpr));
    H = canvas.height = opts.square === false ? Math.max(60, Math.floor((r.height || 360) * dpr)) : W;
    cols = Math.floor(W / pxSz); rows = Math.floor(H / pxSz);
    reset();
  }
  function hop() {
    const bxc = p.b * fx - p.c, abs = Math.abs(bxc), sf = fx < 0 ? p.s : 1;
    const t = p.f * Math.sqrt(abs) + p.g * Math.sin(bxc) + p.h * abs;
    const xn = fy + p.d * sf * t;
    fy = p.a - fx;
    fx = xn;
  }
  function draw() {
    if (!alive) return;
    const range = view.range;
    const xMin = view.cx - range / 2, yMin = view.cy - range / 2;
    const xR = range, yR = range;
    const sc = Math.min(cols / xR, rows / yR);
    const oX = (cols - xR * sc) / 2, oY = (rows - yR * sc) / 2;
    cOff = (cOff + 0.25) % 120;
    if (iter < MAX) {
      for (let i = 0; i < PER && iter < MAX; i++, iter++) {
        hop();
        const gx = Math.floor((fx - xMin) * sc + oX), gy = Math.floor((fy - yMin) * sc + oY);
        if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
          const idx = gy * cols + gx;
          hitBuf[idx]++;
          if (hitBuf[idx] > maxH) maxH = hitBuf[idx];
        }
      }
    }
    const id = ctx.createImageData(W, H), d32 = new Uint32Array(id.data.buffer);
    d32.fill(0xff0b0807);
    if (maxH > 0) {
      const lm = Math.log(maxH + 1);
      for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
        const hv = hitBuf[gy * cols + gx];
        if (hv > 0) {
          const lv = Math.log(hv + 1) / lm * 119;
          const sh = (lv + cOff) % 120, ci = Math.floor(sh) % 120, ci2 = (ci + 1) % 120, bl = sh - Math.floor(sh);
          const [r1, g1, b1] = PAL[ci], [r2, g2, b2] = PAL[ci2];
          const r = r1 + (r2 - r1) * bl | 0, g = g1 + (g2 - g1) * bl | 0, b = b1 + (b2 - b1) * bl | 0;
          const c32 = (255 << 24) | (b << 16) | (g << 8) | r;
          const bpx = gx * pxSz, bpy = gy * pxSz;
          for (let py = 0; py < pxSz; py++) {
            const py2 = bpy + py; if (py2 >= H) break;
            for (let px = 0; px < pxSz; px++) {
              const px2 = bpx + px; if (px2 >= W) break;
              d32[py2 * W + px2] = c32;
            }
          }
        }
      }
    }
    ctx.putImageData(id, 0, 0);
    raf = requestAnimationFrame(draw);
  }
  resize();
  raf = requestAnimationFrame(draw);
  return {
    setView(v) {
      if (v && v.mode === 'full') {
        const bb = orbitBounds(p);
        view = bb || { cx: 0, cy: 0, range: Number(params.base_range) > 0 ? Number(params.base_range) : 60 };
      } else {
        view = { cx: +v.cx || 0, cy: +v.cy || 0, range: +v.range || view.range };
      }
      reset();
      return { ...view };
    },
    progress() { return iter / MAX; },
    replay() { reset(); },
    resize,
    destroy() { alive = false; cancelAnimationFrame(raf); },
  };
}
