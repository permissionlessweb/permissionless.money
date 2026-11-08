// lib/mint-svg.js — execute cw721_svg mint on the collection. Not the minter.
// Ship rails: native TERP/THIOL + ZEC (ZIP-321). ETH/Base/BTC parked.

import { b64query as b64querySafe } from '/lib/b64util.js';
import { executeWithSmartAccount } from '/lib/smart-account-tx.js?v=20261108a';
import { loadCwOrchState, TERP_MAINNET } from '/lib/cw-orch-state.js';

/** morocco-1 (2026-10-30): cw721_svg code 98, created through the svg factory (code 99). */
export const SVG_CODE_ID = 98;
export const SVG_MINTER_CODE_ID = 99;
/** Fallback only; the live price comes from current_price_tier (tier 1 of the fractal is 100 THIOL). */
export const NATIVE_MINT_AMOUNT = '100000000';

/** Same-origin mint (CORS). Lab keeps public hosts. */
export function publicChainRpc() {
  try {
    const h = location.hostname;
    if (h === '127.0.0.1' || h === 'localhost') return `${location.origin}/chain-rpc`;
    // Production signing RPC: same public endpoint the live /svg pages use (ACAO *).
    if (h === 'permissionless.money' || h.endsWith('.permissionless.money')) return 'https://terp.network/rpc';
  } catch { /* ignore */ }
  return 'https://rpc.terp.network';
}

export function publicChainLcd() {
  try {
    const h = location.hostname;
    // Production: api.terp.network is the public LCD (ACAO *). No /chain-api route exists on permissionless.money.
    if (h === '127.0.0.1' || h === 'localhost') return `${location.origin}/chain-api`;
  } catch { /* ignore */ }
  return 'https://api.terp.network';
}

/** Display: 1 THIOL = 1_000_000 uthiol. “um” is the spoken ticker. */
export function formatThiol(uthiol) {
  try {
    const n = Number(uthiol) / 1e6;
    if (!Number.isFinite(n)) return `${uthiol} uthiol`;
    const s = n >= 1 ? String(n) : n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    return `${s} THIOL`;
  } catch {
    return `${uthiol} uthiol`;
  }
}

export const CHAINS = {
  '120u-1': {
    chainId: '120u-1',
    chainName: 'Terp Lab 120u-1',
    rpc: 'https://testnet-rpc.terp.network',
    rest: 'https://testnet-api.terp.network',
    denom: 'uthiol',
    gasPrice: '0.025uthiol',
    collection: '',
    minter: '',
    svgCodeId: SVG_CODE_ID,
    minterCodeId: SVG_MINTER_CODE_ID,
  },
  'morocco-1': {
    chainId: 'morocco-1',
    chainName: 'Terp Network',
    rpc: publicChainRpc(),
    rest: publicChainLcd(),
    denom: 'uthiol',
    gasPrice: '0.025uthiol',
    // Permissionless Fractals (static; not read from state.json or the factory).
    collection: 'terp15anc99l7lvk2v2pzjusnmylr3lw3xnpxg89xv8uh0fj6pwrumrksqwzs6x',
    // svg factory (code 99). Mints execute on the collection, never here.
    minter: 'terp1wg5z9rcwpw5kvrl4g78ees2l9ejptrhrx4t2k56nq6t27uly87zssujm80',
    // Payment-minter whitelist (code 73) for the fractal.
    payWhitelist: 'terp1k5vz89g9z2w0yhg4yfgwwza5d2gg0l9396sjqh27wfck4957pkvq2at0z7',
    svgCodeId: SVG_CODE_ID,
    minterCodeId: SVG_MINTER_CODE_ID,
  },
};

let stateLoaded = false;

/** Overlay auth/passkey code ids from the published cw-orch state.json. Collection and minter stay static. */
export async function loadTerpState() {
  if (stateLoaded) return CHAINS;
  const st = await loadCwOrchState({ chainId: TERP_MAINNET });
  const m = CHAINS[TERP_MAINNET];
  // New passkeys use the per-account terp-passkey code 96, whatever state.json lists (still 84).
  m.passkeyCodeId = 96;
  m.passkeyCodeIdStateJson = st.passkeyCodeId;
  m.authCodeIds = st.authCodeIds;
  m.codeIds = st.codeIds;
  // Smoke instantiate addrs are not the user’s authenticator.
  m.noncircuitAuth = st.noncircuitAuth;
  stateLoaded = true;
  return CHAINS;
}

export function detectMintChainId() {
  try {
    const q = new URLSearchParams(location.search).get('chain');
    if (q === '120u-1' || q === 'morocco-1') return q;
  } catch {
    /* ignore */
  }
  return 'morocco-1';
}

export function resolveCollection(chain) {
  const q = new URLSearchParams(location.search).get('minter')
    || new URLSearchParams(location.search).get('collection');
  if (q && q.startsWith('terp1')) return q;
  // No localStorage override: a saved address from the old collection would win over the static one.
  if (typeof window !== 'undefined' && window.__CW721_CONTRACT__) {
    return window.__CW721_CONTRACT__;
  }
  return chain.collection || '';
}

function b64query(obj) {
  try { return b64querySafe(obj); } catch (e) { return encodeURIComponent(btoa(JSON.stringify(obj))); }
}

function lcdOrigin(rest) {
  try {
    const h = location.hostname;
    // Local/LAN only. Production permissionless.money talks to api.terp.network
    // (ACAO * on 200). Do not ship the /__lcd proxy as a prod dependency.
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
      || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      return `${location.origin}/__lcd`;
    }
  } catch {
    /* ignore */
  }
  return String(rest || '').replace(/\/$/, '');
}

export async function querySmart(rest, contract, msg) {
  const base = lcdOrigin(rest);
  const url = `${base}/cosmwasm/wasm/v1/contract/${contract}/smart/${b64query(msg)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error || `query ${res.status}`);
  return json.data ?? json;
}

export async function queryOwnerTokens(rest, collection, owner) {
  const data = await querySmart(rest, collection, {
    tokens: { owner, limit: 30 },
  });
  const ids = data.tokens || data.ids || data.token_list || [];
  return ids.map((id) => String(id));
}

/** Best-effort SVG or data-URI from cw721-svg query blobs. */
export function svgFromNft(info, uriQuery) {
  const blobs = [uriQuery, info, info?.extension, uriQuery?.extension];
  const keys = ['svg', 'token_uri', 'image', 'uri'];
  for (const b of blobs) {
    if (!b) continue;
    if (typeof b === 'string' && (b.includes('<svg') || b.startsWith('data:image'))) return b;
    if (typeof b !== 'object') continue;
    for (const k of keys) {
      const v = b[k];
      if (typeof v === 'string' && (v.includes('<svg') || v.startsWith('data:image'))) return v;
    }
  }
  return '';
}

/** Paid mint, executed on the cw721_svg collection (code 98). */
export function collectionMintMsg({ amount = 1, bogo = false, proofHashes = [] } = {}) {
  return {
    update_extension: {
      msg: {
        mint: {
          amnt: bogo ? 2 : amount,
          proof_hashes: Array.isArray(proofHashes) ? proofHashes : [],
          alloc: 0,
          ext: null,
        },
      },
    },
  };
}

/** Live price for the next mint: extension current_price_tier (a Coin; PriceTier shape accepted too). */
export async function currentPriceCoin(rest, collection) {
  const t = await querySmart(rest, collection, { extension: { msg: { current_price_tier: {} } } });
  const c = t && (t.price || (t.denom ? t : null));
  return c && Number(c.amount) > 0 ? { denom: c.denom, amount: String(c.amount) } : null;
}

/** Tier table + minted count: { minted, total, tiers:[{until,price}], current, next }. */
export async function readPriceTiers(rest, collection) {
  const [info, n] = await Promise.all([
    querySmart(rest, collection, { get_collection_info_and_extension: {} }),
    querySmart(rest, collection, { num_tokens: {} }),
  ]);
  const x = info.extension || {};
  const tiers = (x.price_tiers || []).map((t) => ({ until: Number(t.until_count), price: t.price }));
  const minted = Number(n.count ?? n);
  const i = tiers.findIndex((t) => minted < t.until);
  return { minted, total: Number(x.total || 0), tiers, current: tiers[i] || null, next: i >= 0 ? tiers[i + 1] || null : null };
}

export function nativeMintFunds(denom = 'uthiol', amount = NATIVE_MINT_AMOUNT) {
  return [{ denom, amount: String(amount) }];
}

/**
 * @param {{
 *   chain: object,
 *   collection: string,
 *   address: string,
 *   wallet: object,
 *   amount?: number,
 *   bogo?: boolean,
 *   funds?: {denom:string,amount:string}[],
 * }} opts
 */
export async function mintSvgNft(opts) {
  const { chain, collection, address, wallet, amount, bogo, funds } = opts;
  if (!collection || !collection.startsWith('terp1')) {
    throw new Error(`No cw721_svg collection on ${chain.chainId} — mint disabled`);
  }
  if (!address || !address.startsWith('terp1')) {
    throw new Error('Need a terp1 signer');
  }
  if (!wallet) throw new Error('No offline signer');
  if (collection === chain.minter) {
    throw new Error('Mint execute is on the collection, not the minter');
  }

  const qty = bogo ? 2 : (amount ?? 1);
  const denom = chain.denom || 'uthiol';
  const live = funds && funds.length ? null : await currentPriceCoin(chain.rest, collection).catch(() => null);
  const paid = funds && funds.length
    ? funds
    : (live ? [live] : nativeMintFunds(denom));

  return executeWithSmartAccount({
    chain,
    wallet,
    address,
    contract: collection,
    msg: collectionMintMsg({ amount: qty, proofHashes: [] }),
    funds: paid,
    memo: 'permissionless svg mint',
  });
}
