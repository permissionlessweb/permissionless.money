/**
 * Per-wallet ZIP-321 handoff.
 *
 * Zodl does not take external zcash: routing from this site. Hand Zodl
 * a PNG of the ZIP-321 QR (Save image → import picture in Zodl).
 * Vizor (com.keplr.vizor) has no zcash: filter either — launch by
 * package on Android, otherwise copy + scan. ZIP-321 forbids zcash://.
 * Do not invent a Vizor URL scheme.
 */

export const ZODL_ANDROID_PKG = 'co.electriccoin.zcash';
export const VIZOR_ANDROID_PKG = 'com.keplr.vizor';
export const ZODL_GET = 'https://play.google.com/store/apps/details?id=co.electriccoin.zcash';
export const VIZOR_GET = 'https://play.google.com/store/apps/details?id=com.keplr.vizor';
export const ZODL_GET_WEB = 'https://zodl.com/';
export const VIZOR_GET_WEB = 'https://vizor.cash/get';

export function isAndroidUa(ua) {
  return /Android/i.test(String(ua || ''));
}

export function androidZcashIntent(uri, pkg, fallbackHttps) {
  if (!uri || !String(uri).startsWith('zcash:')) return '';
  const rest = String(uri).slice('zcash:'.length);
  const fb = encodeURIComponent(fallbackHttps || ZODL_GET);
  return `intent://${rest}#Intent;scheme=zcash;package=${pkg};S.browser_fallback_url=${fb};end`;
}

export function androidLaunchPackageIntent(pkg, fallbackHttps) {
  const fb = encodeURIComponent(fallbackHttps || VIZOR_GET);
  return `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${pkg};S.browser_fallback_url=${fb};end`;
}

/** Zodl can take the ZIP-321 URI. Android pins the package so other zcash: apps lose. */
export function zodlOpenHref(uri, ua) {
  if (!uri || !String(uri).startsWith('zcash:')) return '';
  if (isAndroidUa(ua)) return androidZcashIntent(uri, ZODL_ANDROID_PKG, ZODL_GET);
  return String(uri);
}

/**
 * Vizor has no zcash: handler. Android: launch the app by package.
 * iOS/desktop: empty — copy the URI and scan the QR in Vizor.
 */
export function vizorOpenHref(ua) {
  if (isAndroidUa(ua)) return androidLaunchPackageIntent(VIZOR_ANDROID_PKG, VIZOR_GET);
  return '';
}

export async function copyText(text) {
  const v = String(text || '');
  if (!v) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(v);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = v;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function clickHref(href) {
  if (!href) return false;
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export async function openZodlWallet(uri, ua) {
  const href = zodlOpenHref(uri, ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''));
  return clickHref(href);
}

export function qrPngFileName(kind = 'pay') {
  const k = String(kind || 'pay').replace(/[^a-z0-9-]+/gi, '').slice(0, 24) || 'pay';
  return `permissionless-zip321-${k}.png`;
}

export function canvasPngDataUrl(canvas) {
  if (!canvas || typeof canvas.toDataURL !== 'function') return '';
  if (!canvas.width || !canvas.height) return '';
  try {
    const url = canvas.toDataURL('image/png');
    return url && url.startsWith('data:image/png') ? url : '';
  } catch {
    return '';
  }
}

function ensureQrPrompt() {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById('qr-file-prompt');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'qr-file-prompt';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Saved ZIP-321 QR');
  root.innerHTML = '<div data-qr-card><img alt="ZIP-321 QR"><p data-qr-name></p><p data-qr-help>Saved. Open this picture in Zodl (import image).</p><button type="button" data-qr-close>Close</button></div>';
  root.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:flex-end;justify-content:center;background:rgba(8,9,13,0.55)';
  const card = root.querySelector('[data-qr-card]');
  card.style.cssText = 'width:min(420px,calc(100vw - 1.25rem));margin:0 0.6rem max(0.7rem,env(safe-area-inset-bottom));padding:0.9rem;background:rgba(8,9,13,0.96);border:1px solid rgba(177,235,235,0.2);border-radius:16px;text-align:center;color:#f8f8f2;font:650 0.78rem system-ui,sans-serif';
  const img = root.querySelector('img');
  img.style.cssText = 'display:block;width:min(240px,70vw);height:auto;margin:0 auto 0.65rem;background:#fff;border-radius:10px;box-shadow:0 0 0 10px #fff';
  root.querySelector('[data-qr-name]').style.cssText = 'margin:0.45rem 0 0.2rem;color:#b1ebeb;word-break:break-all;font-weight:500;font-size:0.68rem';
  root.querySelector('[data-qr-help]').style.cssText = 'margin:0 0 0.7rem;color:#6272a4;font-weight:400;line-height:1.4';
  const close = root.querySelector('[data-qr-close]');
  close.style.cssText = 'width:100%;border:0;border-radius:8px;padding:0.62rem;cursor:pointer;font:inherit;font-weight:650;background:#b1ebeb;color:#08090d';
  const hide = () => { root.hidden = true; root.style.display = 'none'; };
  close.addEventListener('click', hide);
  root.addEventListener('click', (e) => { if (e.target === root) hide(); });
  document.body.appendChild(root);
  return root;
}

export function promptQrPicture(dataUrl, filename) {
  const root = ensureQrPrompt();
  if (!root || !dataUrl) return false;
  root.querySelector('img').src = dataUrl;
  root.querySelector('[data-qr-name]').textContent = filename || qrPngFileName();
  root.hidden = false;
  root.style.display = 'flex';
  return true;
}

export function savePngDataUrl(dataUrl, filename) {
  if (!dataUrl || typeof document === 'undefined') return false;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename || qrPngFileName();
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/** Open the PNG in a new tab. Never navigate the mint tab away. */
export function openPngDataUrl(dataUrl) {
  if (!dataUrl || typeof window === 'undefined') return false;
  try {
    const w = window.open(dataUrl, '_blank', 'noopener');
    return !!w;
  } catch {
    return false;
  }
}

/**
 * Save the painted ZIP-321 QR as a PNG, then open that picture
 * (new tab if the browser allows, plus an on-page prompt).
 * Zodl imports the image from Files / Photos.
 */
export function saveAndOpenQrPng(canvas, filename) {
  const name = filename || qrPngFileName();
  const dataUrl = canvasPngDataUrl(canvas);
  if (!dataUrl) return { saved: false, opened: false, prompted: false };
  const saved = savePngDataUrl(dataUrl, name);
  const opened = openPngDataUrl(dataUrl);
  const prompted = promptQrPicture(dataUrl, name);
  return { saved, opened, prompted };
}

export async function openVizorWallet(uri, ua) {
  const agent = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const copied = uri ? await copyText(uri) : false;
  const href = vizorOpenHref(agent);
  const launched = clickHref(href);
  return { copied, launched };
}
