/**
 * DREGG SVG mint checkout. Contract: crates/dregg/svg-mint/FE-HANDOFF.md
 * + FE-SPECIALIST-REVIEW.md + FE-ZTREAMER-ZALLET.md
 *
 * TLS only to DREGG (health, /v1/prices, /v1/pay-targets, /v1/status).
 * No HashMerchant onboard, no gRPC/ztreamer, no public LWD.
 * Payment memo is memo_hex / ZIP-321 zec_uri — never terp1, never Pedersen here.
 */

import qrcode from '/lib/qrcode-generator.js';

export const SVG_MINTER =
  'terp188jpppxtfpf0vvt5gypdj52hk2xuswwcn38auczzxv20fcxz3kss9fhlru';
export const SVG_COLLECTION =
  'terp1vp7smemrv846hpsyqrzlnqapmu3sv7hyygf4rrnw3ls26ezk864qupr5zt';

export const DREGG_ORIGIN = 'https://dregg-svg.permissionless.money';

/** Live Cosmic Web rails. ETH/Base/BTC stay parked (no live house watchers). */
export const LIVE_RAILS = ['zec', 'native'];

const LOCK_ABI = [
  'function lock(bytes32 nDeposit, uint64 deadline, string memo)',
];

export function dreggBase() {
  const raw = (typeof window !== 'undefined'
    ? (window.__DREGG_URL || localStorage.getItem('dreggUrl') || DREGG_ORIGIN)
    : DREGG_ORIGIN);
  const origin = String(raw || DREGG_ORIGIN).replace(/\/$/, '');
  try {
    const u = new URL(origin);
    const host = u.hostname;
    if (host === '127.0.0.1' || host === '::1' || host === '[::1]') return DREGG_ORIGIN;
    if (u.protocol !== 'https:' && host !== 'localhost') return DREGG_ORIGIN;
  } catch {
    return DREGG_ORIGIN;
  }
  return origin || DREGG_ORIGIN;
}

export function isTerp1(addr) {
  return typeof addr === 'string' && /^terp1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,58}$/.test(addr);
}

export function isEthAddress(addr) {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export function formatEthWei(wei) {
  try {
    const w = BigInt(wei);
    const whole = w / 1_000_000_000_000_000_000n;
    const frac = w % 1_000_000_000_000_000_000n;
    if (frac === 0n) return `${whole} ETH`;
    return `${whole}.${frac.toString().padStart(18, '0').replace(/0+$/, '')} ETH`;
  } catch {
    return `${wei} wei`;
  }
}

function leaksTerp1(v) {
  if (v == null) return false;
  if (typeof v === 'string') return /terp1/i.test(v);
  try { return /terp1/i.test(JSON.stringify(v)); } catch { return false; }
}

/** QA: stale DREGG, terp1 on a rail, or reused one-time fields. Do not invent a UA. */
export function assertPayTargets(body, previous) {
  if (!body || body.ok !== true) throw new Error(body?.error || 'pay-targets failed');
  if (Object.prototype.hasOwnProperty.call(body, 'recipient')) {
    throw new Error('Server bug: pay-targets must not include recipient. Do not pay.');
  }
  const memoHex = String(body.memo_hex || '');
  if (!memoHex.toLowerCase().startsWith('6431')) {
    throw new Error('This checkout is missing a one-time commitment (memo_hex must start 6431).');
  }
  if (leaksTerp1(body.zec_uri) || leaksTerp1(body.memo_hex) || leaksTerp1(body.memo_commit) || leaksTerp1(body.zec_ua)) {
    throw new Error('This checkout tried to put your Terp address on a public chain. Stopped.');
  }
  // ETH / Base / BTC desks may still be in JSON — do not require or pay them.
  // zec_ua may be present while the indexer is dark — never turn it into a URI.
  const issued = zecPayUri(body);
  if (body.zec_uri != null && String(body.zec_uri).trim() && String(body.zec_uri).trim() !== 'null' && !issued) {
    throw new Error('zec_uri is not a zcash: payment request. Do not invent a UA.');
  }
  if (previous) {
    const same = (a, b) => a && b && String(a) === String(b);
    if (same(body.memo_commit, previous.memo_commit)) {
      throw new Error('This checkout reused a one-time payment. Stopped — ask for a new one.');
    }
    const pu = zecPayUri(previous);
    if (issued && pu && issued === pu) {
      throw new Error('This checkout reused a one-time payment. Stopped — ask for a new one.');
    }
  }
  return body;
}

export function resolveEthPayTo(targets) {
  if (isEthAddress(targets?.eth_vault)) return { to: targets.eth_vault, mode: 'lock' };
  if (isEthAddress(targets?.eth_addr)) return { to: targets.eth_addr, mode: 'raw' };
  return null;
}

export function sameAmt(a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  try { return BigInt(a) === BigInt(b); } catch { return String(a) === String(b); }
}

export function assertPrices(body) {
  if (!body || body.ok !== true) throw new Error(body?.error || 'prices failed');
  if (!body.zec?.zat || !body.native?.amount) {
    throw new Error('Mint desk prices are incomplete.');
  }
  return body;
}

export const MIN_MINT_QTY = 1;
export const MAX_MINT_QTY = 20;

export function clampMintQty(n, remaining) {
  let q = Number(n);
  if (!Number.isFinite(q)) q = 1;
  q = Math.floor(q);
  if (q < MIN_MINT_QTY) q = MIN_MINT_QTY;
  if (q > MAX_MINT_QTY) q = MAX_MINT_QTY;
  const cap = Number(remaining);
  if (Number.isFinite(cap) && cap >= 1) q = Math.min(q, Math.floor(cap));
  return q;
}

/** zatoshis → ZIP-321 amount decimal (same as DREGG zip321::zat_to_zec_decimal). */
export function zatToZecDecimal(zat) {
  const z = BigInt(zat);
  const whole = z / 100000000n;
  const frac = z % 100000000n;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(8, '0')}`.replace(/0+$/, '');
}

export function timesUnit(unit, qty) {
  return (BigInt(unit) * BigInt(clampMintQty(qty))).toString();
}

/** Rewrite only amount= on a ZIP-321 URI. Never touch memo= (base64url) or the UA. */
export function scaleZip321Amount(uri, zat) {
  const base = zecPayUri({ zec_uri: uri });
  if (!base) return null;
  const amount = zatToZecDecimal(zat);
  if (/[?&]amount=/.test(base)) {
    return base.replace(/([?&])amount=[^&]*/, `$1amount=${amount}`);
  }
  const join = base.includes('?') ? '&' : '?';
  return `${base}${join}amount=${amount}`;
}

/**
 * Scale unit prices to qty. If DREGG already returned zat === unit*qty, keep URI as-is.
 * If DREGG still issued 1-unit zat, scale ZIP-321 amount= only (deposit = N units).
 */
export function applyQtyToTargets(targets, prices, qty, remaining) {
  const q = clampMintQty(qty, remaining);
  if (!targets) return targets;
  const out = { ...targets, qty: q };
  const unitZat = prices?.zec?.zat;
  const unitNat = prices?.native?.amount;
  if (unitZat != null) {
    const want = timesUnit(unitZat, q);
    const have = targets.zec_zat;
    out.zec_zat = want;
    const uri = zecPayUri(targets) || (typeof targets.zec_uri === 'string' ? targets.zec_uri : null);
    if (uri && String(uri).startsWith('zcash:')) {
      out.zec_uri = scaleZip321Amount(uri, want) || uri;
    }
  }
  if (unitNat != null) {
    const wantN = timesUnit(unitNat, q);
    const haveN = targets.native_amount;
    if (haveN == null || sameAmt(haveN, unitNat) || sameAmt(haveN, wantN)) {
      out.native_amount = wantN;
    }
  }
  return out;
}

/** Checkout amounts vs unit prices × qty. */
export function assertCheckoutAmounts(targets, prices, rail, qty = 1) {
  if (!prices) throw new Error('Mint desk prices are down. Pay is closed.');
  const q = clampMintQty(qty);
  const checks = {
    eth: () => sameAmt(targets.eth_wei, prices.eth?.wei),
    base: () => sameAmt(targets.base_wei ?? targets.eth_wei, prices.base?.wei ?? prices.eth?.wei),
    btc: () => sameAmt(targets.btc_sats, prices.btc?.sats),
    zec: () => sameAmt(targets.zec_zat, timesUnit(prices.zec?.zat, q)),
    native: () => !targets.native_amount || sameAmt(targets.native_amount, timesUnit(prices.native?.amount, q)),
  };
  const ok = checks[rail] ? checks[rail]() : true;
  if (!ok) throw new Error('Checkout amounts do not match the mint desk. Do not send.');
  return true;
}

export function railLabelFromPrices(prices, rail, qty = 1) {
  if (!prices) return '';
  const q = clampMintQty(qty);
  if (rail === 'eth') return prices.eth?.ether ? `${prices.eth.ether} ETH` : '';
  if (rail === 'base') return prices.base?.ether ? `${prices.base.ether} ETH` : '';
  if (rail === 'btc') return prices.btc?.btc ? `${prices.btc.btc} BTC` : '';
  if (rail === 'zec') {
    if (!prices.zec?.zat) return '';
    const zec = zatToZecDecimal(timesUnit(prices.zec.zat, q));
    return q > 1 ? `${zec} ZEC · ${q} pcs` : `${zec} ZEC`;
  }
  if (rail === 'native') {
    const unit = prices.native?.display;
    if (!unit) return '';
    const n = Number(unit) * q;
    return q > 1 ? `${n} TERP / THIOL · ${q} pcs` : `${unit} TERP / THIOL`;
  }
  return '';
}

/** Base only if this checkout issued a Base desk. Never reuse ETH addr. */
export function resolveEvmPayTo(targets, rail = 'eth') {
  if (rail === 'base') {
    if (isEthAddress(targets?.base_vault)) return { to: targets.base_vault, mode: 'lock', chain: 'base' };
    if (isEthAddress(targets?.base_addr)) return { to: targets.base_addr, mode: 'raw', chain: 'base' };
    return null;
  }
  const eth = resolveEthPayTo(targets);
  return eth ? { ...eth, chain: 'eth' } : null;
}

export const EVM_CHAINS = {
  eth: {
    id: 'eth',
    chainIdHex: '0x1',
    name: 'Ethereum',
    rpc: 'https://ethereum.publicnode.com',
    explorer: 'https://etherscan.io',
  },
  base: {
    id: 'base',
    chainIdHex: '0x2105',
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  },
};

export async function ensureEvmChain(rail, chainId) {
  const spec = { ...(EVM_CHAINS[rail] || EVM_CHAINS.eth) };
  if (chainId != null && Number(chainId) > 0) {
    spec.chainIdHex = '0x' + Number(chainId).toString(16);
  }
  if (!window.ethereum) return spec;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: spec.chainIdHex }],
    });
  } catch (e) {
    if (e && (e.code === 4902 || /unrecognized chain/i.test(String(e.message || e)))) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: spec.chainIdHex,
          chainName: spec.name,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [spec.rpc],
          blockExplorerUrls: [spec.explorer],
        }],
      });
    } else {
      throw e;
    }
  }
  return spec;
}

/** ZIP-321 as DREGG issued it. Null/empty → no ZEC QR. Never build zcash: from zec_ua. */
export function zecPayUri(targets) {
  const uri = targets?.zec_uri;
  if (uri == null) return null;
  if (typeof uri !== 'string') return null;
  const s = uri.trim();
  if (!s || s === 'null') return null;
  if (!s.startsWith('zcash:')) return null;
  if (leaksTerp1(s)) return null;
  // ZIP-321: memo= is RFC 4648 base64url (no padding) of memo bytes — not hex, not terp1.
  const memo = zip321MemoParam(s);
  if (memo != null && !isZip321MemoB64url(memo)) return null;
  const readable = zip321WithReadableMemo(s, targets?.memo_hex);
  return canonicalizeZip321(readable || s);
}

function zip321MemoParam(uri) {
  const q = uri.indexOf('?');
  if (q < 0) return null;
  const parts = uri.slice(q + 1).split('&');
  for (const p of parts) {
    const eq = p.indexOf('=');
    const k = eq < 0 ? p : p.slice(0, eq);
    if (k === 'memo') return eq < 0 ? '' : p.slice(eq + 1);
  }
  return null;
}

/** RFC 4648 §5 base64url, no '=' padding (ZIP-321 param=memo). */
export function isZip321MemoB64url(s) {
  const t = String(s || '');
  if (t.length < 4 || t.includes('=') || t.includes('+') || t.includes('/')) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return false;
  // Raw Pedersen hex (6431…) stuffed into memo= is not ZIP-321.
  if (/^[0-9a-fA-F]+$/.test(t) && t.toLowerCase().startsWith('6431')) return false;
  return true;
}

function b64urlNopadFromUtf8(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeBytes(s) {
  let t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  try {
    const bin = atob(t);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function bytesToHex(b) {
  let h = '';
  for (const x of b) h += x.toString(16).padStart(2, '0');
  return h;
}

/**
 * ZIP-321 memo= is base64url of the shielded memo *bytes*.
 * Put hex ASCII of d1||C there so wallets show 6431… not binary.
 * DREGG parse_commit already accepts memo_hex UTF-8.
 */
export function zip321WithReadableMemo(uri, memoHex) {
  if (!uri || !String(uri).startsWith('zcash:')) return uri;
  let hex = String(memoHex || '').toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]+$/.test(hex) || !hex.startsWith('6431') || hex.length < 68) {
    const cur = zip321MemoParam(uri);
    const raw = cur ? b64urlDecodeBytes(cur) : null;
    if (raw && raw.length >= 34 && raw[0] === 0x64 && raw[1] === 0x31) {
      hex = bytesToHex(raw.subarray(0, 34));
    } else if (raw) {
      const asText = new TextDecoder().decode(raw).trim().toLowerCase();
      if (/^6431[0-9a-f]{64,}$/.test(asText)) hex = asText.slice(0, 68);
    }
  }
  if (!hex || !hex.startsWith('6431') || hex.length < 68) return uri;
  hex = hex.slice(0, 68);
  const memo = b64urlNopadFromUtf8(hex);
  if (!isZip321MemoB64url(memo)) return uri;
  if (/[?&]memo=/.test(uri)) return uri.replace(/([?&])memo=[^&]*/, `$1memo=${memo}`);
  return uri + (uri.includes('?') ? '&' : '?') + 'memo=' + memo;
}

/** Simple CORS GET. No JSON Content-Type (that would preflight; DREGG OPTIONS is CF 520). */
function dreggGet(path, base) {
  const origin = (base || dreggBase() || DREGG_ORIGIN).replace(/\/$/, '');
  return fetch(`${origin}${path}`, { method: 'GET', credentials: 'omit', mode: 'cors' });
}

/**
 * Pay / ZEC QR / native execute only when checkout_ready and zec_tip is ok
 * (or unconfigured). zec_tip.ok === false means the house node drifted off
 * the public Zcash tip — hide all payment UI. No refunds.
 */
export function payOpenFromHealth(health) {
  if (!health || health.checkout_ready !== true) return false;
  const reasons = health.reasons;
  if (Array.isArray(reasons) && reasons.includes('zec_tip_drift')) return false;
  const tip = health.zec_tip;
  if (tip && tip.configured === false) return true;
  if (tip && tip.ok === false) return false;
  return true;
}

export async function fetchDreggHealth(base = dreggBase()) {
  try {
    const res = await dreggGet('/health', base);
    const body = await res.json().catch(() => ({}));
    // Sidecar health is always HTTP 200 when up (closed checkout is ok:false).
    if (!res.ok) {
      return {
        ok: false,
        checkout_ready: false,
        error: body.error || `health ${res.status}`,
      };
    }
    const checkout_ready = body.checkout_ready === true;
    const pay = body.pay === true && payOpenFromHealth({ ...body, checkout_ready });
    return {
      ...body,
      checkout_ready,
      pay,
      pay_open: payOpenFromHealth({ ...body, checkout_ready }),
    };
  } catch (e) {
    return { ok: false, checkout_ready: false, error: e.message || String(e) };
  }
}

export async function fetchDreggPrices(base = dreggBase()) {
  const res = await dreggGet('/v1/prices', base);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `prices ${res.status}`);
  return assertPrices(body);
}

export async function fetchPayTargets(recipient, previous, base = dreggBase(), qty = 1) {
  if (!isTerp1(recipient)) throw new Error('Need a Terp address before asking how to pay');
  const n = clampMintQty(qty);
  let res = await dreggGet(
    `/v1/pay-targets?recipient=${encodeURIComponent(recipient)}&qty=${n}`,
    base,
  );
  let body = await res.json().catch(() => ({}));
  // Older DREGG may ignore or 400 unknown qty — retry unit checkout.
  if (!res.ok && n > 1) {
    res = await dreggGet(
      `/v1/pay-targets?recipient=${encodeURIComponent(recipient)}`,
      base,
    );
    body = await res.json().catch(() => ({}));
  }
  if (!res.ok) throw new Error(body.error || 'pay-targets failed');
  const t = assertPayTargets(body, previous);
  t.qty = t.qty != null ? clampMintQty(t.qty) : n;
  return t;
}

export async function fetchMintStatus(recipient, base = dreggBase()) {
  const q = encodeURIComponent(recipient);
  const res = await dreggGet(`/v1/status?recipient=${q}`, base);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'status failed');
  return body;
}

/** Abandon unpaid checkout. GET to avoid CORS preflight. 409 if payment already seen. */
export async function cancelCheckout(recipient, base = dreggBase()) {
  if (!isTerp1(recipient)) throw new Error('Need a Terp address to cancel checkout');
  const q = encodeURIComponent(recipient);
  const res = await dreggGet(`/v1/cancel?recipient=${q}`, base);
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) return { ok: true, skipped: true, error: 'cancel not on this desk yet' };
  if (!res.ok) throw new Error(body.error || `cancel ${res.status}`);
  return body;
}

export async function encodeEthLock(memoHex, ethWei) {
  if (!memoHex || leaksTerp1(memoHex)) {
    throw new Error('ETH memo must be the one-time commitment, not your Terp address');
  }
  const { Interface, hexlify, randomBytes } = await loadEthers();
  const iface = new Interface(LOCK_ABI);
  const nDeposit = hexlify(randomBytes(32));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
  const data = iface.encodeFunctionData('lock', [nDeposit, deadline, memoHex]);
  return { data, nDeposit, deadline, valueWei: String(ethWei) };
}

export function encodeEthRawMemo(memoHex) {
  if (!memoHex || leaksTerp1(memoHex)) {
    throw new Error('ETH memo must be the one-time commitment, not your Terp address');
  }
  const hex = memoHex.startsWith('0x') ? memoHex.slice(2) : memoHex;
  return '0x' + hex;
}

/** parked: no live house watchers — Cosmic Web mint does not call this (ETH/Base). */
export async function sendEthLock(to, memoHex, ethWei, payMode = 'lock', rail = 'eth', chainId) {
  if (!isEthAddress(to)) {
    throw new Error('This checkout has no Ethereum desk yet');
  }
  if (leaksTerp1(memoHex)) {
    throw new Error('ETH memo must be the one-time commitment, not your Terp address');
  }
  const enc = payMode === 'raw'
    ? { data: encodeEthRawMemo(memoHex), valueWei: String(ethWei) }
    : await encodeEthLock(memoHex, ethWei);
  if (!window.ethereum) {
    return { mode: 'copy', reason: 'no-injected-wallet', ...enc, to, rail };
  }
  await ensureEvmChain(rail, chainId);
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const from = accounts && accounts[0];
  if (!from) throw new Error('Ethereum wallet did not share an account');
  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to,
        value: '0x' + BigInt(ethWei).toString(16),
        data: enc.data,
      },
    ],
  });
  return { mode: 'sent', txHash, ...enc, to };
}

async function loadEthers() {
  const urls = [
    'https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm',
    'https://esm.sh/ethers@6.13.4',
  ];
  let last;
  for (const url of urls) {
    try {
      const mod = await import(/* @vite-ignore */ url);
      const Interface = mod.Interface || mod.default?.Interface;
      const hexlify = mod.hexlify || mod.default?.hexlify;
      const randomBytes = mod.randomBytes || mod.default?.randomBytes;
      if (Interface && hexlify && randomBytes) return { Interface, hexlify, randomBytes };
      last = new Error(`ethers incomplete from ${url}`);
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`ethers load failed: ${last?.message || last}`);
}

/** ZIP-321 ABNF: no zcash://, no percent-encoding on addr/amount/memo, hier-part address. */
export function canonicalizeZip321(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s.startsWith('zcash:')) return null;
  if (s.startsWith('zcash://')) return null;
  if (leaksTerp1(s)) return null;
  const body = s.slice(6);
  let addr = '';
  let query = '';
  if (body.startsWith('?')) {
    query = body.slice(1);
  } else {
    const qi = body.indexOf('?');
    addr = qi < 0 ? body : body.slice(0, qi);
    query = qi < 0 ? '' : body.slice(qi + 1);
  }
  const params = {};
  if (query) {
    for (const part of query.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      const k = eq < 0 ? part : part.slice(0, eq);
      const v = eq < 0 ? '' : part.slice(eq + 1);
      if (k.includes('%') || v.includes('%')) return null;
      if (params[k] != null) return null;
      params[k] = v;
    }
  }
  if (!addr && params.address) {
    addr = params.address;
    delete params.address;
  }
  if (!addr || !/^[A-Za-z0-9]+$/.test(addr)) return null;
  for (const k of Object.keys(params)) {
    if (k.startsWith('req-')) return null;
  }
  const amount = params.amount != null ? canonZip321Amount(params.amount) : null;
  if (params.amount != null && !amount) return null;
  const memo = params.memo;
  if (memo != null && !isZip321MemoB64url(memo)) return null;
  const qp = [];
  if (amount) qp.push(`amount=${amount}`);
  if (memo) qp.push(`memo=${memo}`);
  return qp.length ? `zcash:${addr}?${qp.join('&')}` : `zcash:${addr}`;
}

function canonZip321Amount(a) {
  const t = String(a || '');
  if (!/^[0-9]+(\.[0-9]{1,8})?$/.test(t)) return null;
  if (t.includes('.')) {
    const parts = t.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const w = String(BigInt(parts[0]));
    const f = parts[1].replace(/0+$/, '');
    const out = f ? `${w}.${f}` : w;
    if (Number(out) > 21000000) return null;
    return out;
  }
  const w = String(BigInt(t));
  if (Number(w) > 21000000) return null;
  return w;
}

/**
 * ZIP-321 QR: UTF-8 byte-mode QR of the canonical URI (ISO/IEC 18004).
 * ECC M, quiet zone 4. memo= stays base64url. Do not wrap the URI in base64.
 */
export function paintZecPayQr(canvas, targetsOrUri) {
  const raw = typeof targetsOrUri === 'string'
    ? zecPayUri({ zec_uri: targetsOrUri })
    : zecPayUri(targetsOrUri);
  const uri = canonicalizeZip321(raw);
  if (!canvas) return false;
  const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  if (!uri || !ctx) {
    canvas.hidden = true;
    if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
    return false;
  }
  try {
    const qr = qrcode(0, 'M');
    qr.addData(uri, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 4;
    const scale = Math.max(4, Math.floor(240 / (n + quiet * 2)));
    const dim = (n + quiet * 2) * scale;
    canvas.width = dim;
    canvas.height = dim;
    canvas.style.width = `${Math.min(dim, 240)}px`;
    canvas.style.height = `${Math.min(dim, 240)}px`;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.isDark(y, x)) {
          ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
        }
      }
    }
    canvas.hidden = false;
    return true;
  } catch (e) {
    console.warn('zip321 qr', e);
    canvas.hidden = true;
    return false;
  }
}

