/**
 * Persistent shielded UA for development donations.
 * Not a DREGG mint desk (those UAs are one-time checkouts).
 *
 * Optional override: window.__DONATE_ZEC_UA
 */

import qrcode from './qrcode-generator.js';

const OVERRIDE = (typeof window !== 'undefined' && window.__DONATE_ZEC_UA)
  ? String(window.__DONATE_ZEC_UA).trim()
  : '';

/** Persistent shielded unified address for development donations. */
export const DONATE_UA = OVERRIDE || 'u1uml44spc4nn732t6605wjcwu3wn9dla4aehpyrvnhssq2ew3dk8mqk5e9jhnndzfny7fkrkx5ape05nzf8gwruqykkvc27fm0v9ln4hfrwkmtfrs27r06xu0uc9eneh777le3m8362v7xaurgtkgxtspy5eqhgpzw6axjwgwdy5wjdjt';

export function isShieldedDonateUa(ua) {
  return typeof ua === 'string' && /^u1[a-z0-9]{70,}$/.test(ua.trim());
}

export function donateZip321(ua = DONATE_UA) {
  const a = String(ua || '').trim();
  if (!isShieldedDonateUa(a)) return '';
  return `zcash:${a}`;
}

export const DONATE_ZIP321 = donateZip321();

/** GIF data URL of the ZIP-321 QR (byte mode, ECC M, quiet 4). */
export function donateQrDataUrl(ua = DONATE_UA) {
  const uri = donateZip321(ua);
  if (!uri) return '';
  try {
    const qr = qrcode(0, 'M');
    qr.addData(uri, 'Byte');
    qr.make();
    if (!qr.getModuleCount()) return '';
    return qr.createDataURL(4, 4);
  } catch {
    return '';
  }
}

/** Paint the donate QR onto an <img>. Do this after the sheet is visible. */
export function paintDonateQr(img, ua = DONATE_UA) {
  if (!img) return false;
  const url = donateQrDataUrl(ua);
  if (!url) {
    img.removeAttribute('src');
    img.hidden = true;
    return false;
  }
  img.alt = 'Shielded ZEC donation QR';
  img.src = url;
  img.hidden = false;
  return true;
}
