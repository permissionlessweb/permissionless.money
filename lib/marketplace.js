/*!
 * marketplace.js — revenue-marketplace (code 91) helpers for the mint Collection modal.
 * Msg shapes match terp-rs api/ts/revenue-marketplace (set_ask / set_bid / accept_*).
 * Safe with contract: null — queries no-op and UI stays read-only until instantiated.
 */
export const MARKETPLACE_CODE_ID = 91;
export const FOUNDATION_DAO = 'terp14w2qva6dx6wcsmq5fvplh7cr7nvptejznyvpe5hp5mtyqhxxjamsz3kw2w';

/** Default denoms shown in the list/offer form. USDC is the Terp IBC denom for usdc.inj. */
export const DENOMS = [
  { id: 'usdc', label: 'USDC', denom: 'ibc/422FAC8ED757E2DEA4C475B86684ED037C6F3DC0211647D83C92EE54EC072E4E', decimals: 6, hint: 'usdc.inj', verified: 'injective-1 bank metadata erc20:0xa00C59fF…235a exponent 6 (trace transfer/channel-17)' },
  { id: 'thiol', label: 'THIOL', denom: 'uthiol', decimals: 6, hint: 'native', verified: 'uthiol: no on-chain metadata; micro prefix, collection tier 100 THIOL = 100000000' },
];

export function shortAddr(a, n = 6) {
  const s = String(a || '');
  if (s.length < n * 2 + 2) return s;
  return `${s.slice(0, n)}…${s.slice(-4)}`;
}

export const MAX_FRACTION = 6;

/** Decimal string -> base units (BigInt math). Rejects more than min(decimals, 6) fraction digits. */
export function toBaseAmount(human, decimals = 6) {
  const t = String(human || '').trim();
  if (!t || !/^\d+(\.\d+)?$/.test(t)) throw new Error('Enter a valid amount');
  const [w, f = ''] = t.split('.');
  const cap = Math.min(decimals, MAX_FRACTION);
  if (f.length > cap) throw new Error(`At most ${cap} decimal places`);
  const frac = (f + '0'.repeat(decimals)).slice(0, decimals);
  const out = BigInt(w || '0') * (10n ** BigInt(decimals)) + BigInt(frac || '0');
  if (out <= 0n) throw new Error('Amount must be more than 0');
  return String(out);
}

/** Base units -> decimal string, at most 6 fraction digits (truncated, never rounded up). */
export function fromBaseAmount(base, decimals = 6) {
  const n = BigInt(String(base || '0'));
  const d = 10n ** BigInt(decimals);
  const w = n / d;
  const cap = Math.min(decimals, MAX_FRACTION);
  const f = (n % d).toString().padStart(decimals, '0').slice(0, cap).replace(/0+$/, '');
  return f ? `${w}.${f}` : String(w);
}

export function denomMeta(denom) {
  return DENOMS.find((d) => d.denom === denom) || { id: 'custom', label: String(denom).length > 14 ? `${String(denom).slice(0, 10)}…` : denom, denom, decimals: 6, hint: 'unverified' };
}

export function formatPrice(coin) {
  if (!coin) return '—';
  const m = denomMeta(coin.denom);
  return `${fromBaseAmount(coin.amount, m.decimals)} ${m.label}`;
}

/** Proposed instantiate msg. fee_manager = Foundation DAO (CONFIRM before broadcast). Not broadcast by this module. */
export function proposedInstantiateMsg({
  feeManager = FOUNDATION_DAO,
  defaultDenom = 'uthiol',
  protocolFeeBps = 400, // 4%, matching loans fee_rate 0.04
  maxRoyaltyFeeBps = 1000,
  makerRewardBps = 0,
  takerRewardBps = 0,
  burnBps = 0,
  royaltyRegistry = null,
} = {}) {
  return {
    _note: 'CONFIRM fee_manager (= Foundation DAO) before instantiate. Wasm admin should match fee_manager.',
    _codeId: MARKETPLACE_CODE_ID,
    fee_manager: feeManager,
    default_denom: defaultDenom,
    protocol_fee_bps: protocolFeeBps,
    max_royalty_fee_bps: maxRoyaltyFeeBps,
    maker_reward_bps: makerRewardBps,
    taker_reward_bps: takerRewardBps,
    burn_bps: burnBps,
    royalty_registry: royaltyRegistry,
  };
}

export function setAskMsg({ collection, tokenId, amount, denom, recipient = null, finder = null }) {
  const details = { price: { denom, amount: String(amount) } };
  if (recipient) details.recipient = recipient;
  if (finder) details.finder = finder;
  return { set_ask: { collection, token_id: String(tokenId), details } };
}

export function removeAskMsg(id) {
  return { remove_ask: { id: String(id) } };
}

export function acceptAskMsg({ id, amount, denom, recipient = null, finder = null }) {
  const details = { price: { denom, amount: String(amount) } };
  if (recipient) details.recipient = recipient;
  if (finder) details.finder = finder;
  return { accept_ask: { id: String(id), details } };
}

export function setBidMsg({ collection, tokenId, amount, denom, recipient = null, finder = null }) {
  const details = { price: { denom, amount: String(amount) } };
  if (recipient) details.recipient = recipient;
  if (finder) details.finder = finder;
  return { set_bid: { collection, token_id: String(tokenId), details } };
}

export function removeBidMsg(id) {
  return { remove_bid: { id: String(id) } };
}

export function acceptBidMsg({ id, amount, denom, recipient = null, finder = null }) {
  const details = { price: { denom, amount: String(amount) } };
  if (recipient) details.recipient = recipient;
  if (finder) details.finder = finder;
  return { accept_bid: { id: String(id), details } };
}

/**
 * Cw721 send_nft hook that lands the token in the marketplace with a SetAsk.
 * Matches revenue-marketplace ReceiveNft accepting SetAsk (ORIGIN.md).
 */
export function sendNftSetAskMsg({ marketplace, collection, tokenId, amount, denom, recipient = null, finder = null }) {
  // revenue-marketplace receive_nft: HookMsg::SetAsk { details } (collection = info.sender, token from the cw721 msg).
  const details = { price: { denom, amount: String(amount) } };
  if (recipient) details.recipient = recipient;
  if (finder) details.finder = finder;
  const hook = { set_ask: { details } };
  const msgB64 = b64json(hook);
  return {
    send_nft: {
      contract: marketplace,
      token_id: String(tokenId),
      msg: msgB64,
    },
  };
}

export function validateMsgShape(msg) {
  if (!msg || typeof msg !== 'object') return { ok: false, error: 'msg must be an object' };
  const keys = Object.keys(msg);
  if (keys.length !== 1) return { ok: false, error: 'msg must have exactly one variant key' };
  const k = keys[0];
  const allowed = new Set([
    'set_ask', 'remove_ask', 'update_ask', 'accept_ask',
    'set_bid', 'remove_bid', 'update_bid', 'accept_bid',
    'set_collection_bid', 'remove_collection_bid', 'update_collection_bid', 'accept_collection_bid',
    'sell_nft', 'buy_specific_nft', 'buy_collection_nft', 'receive_nft',
    'update_config', 'update_collection_denom', 'set_listing_fee', 'remove_listing_fee',
    'send_nft', 'approve', // cw721 wrappers
  ]);
  if (!allowed.has(k)) return { ok: false, error: `unknown variant ${k}` };
  const body = msg[k];
  if (!body || typeof body !== 'object') return { ok: false, error: `${k} body must be object` };
  if (k === 'set_ask' || k === 'set_bid' || k === 'sell_nft' || k === 'buy_specific_nft') {
    for (const req of ['collection', 'token_id', 'details']) {
      if (!(req in body)) return { ok: false, error: `${k} missing ${req}` };
    }
    if (!body.details?.price?.denom || body.details?.price?.amount == null) {
      return { ok: false, error: `${k} details.price.{denom,amount} required` };
    }
  }
  if (k === 'accept_ask' || k === 'accept_bid') {
    if (!('id' in body) || !('details' in body)) return { ok: false, error: `${k} needs id + details` };
  }
  if (k === 'remove_ask' || k === 'remove_bid') {
    if (!('id' in body)) return { ok: false, error: `${k} needs id` };
  }
  if (k === 'send_nft') {
    for (const req of ['contract', 'token_id', 'msg']) {
      if (!(req in body)) return { ok: false, error: `send_nft missing ${req}` };
    }
  }
  return { ok: true, variant: k };
}

function b64json(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
}

/** cw721 approve so the marketplace can move the token (set_ask / accept_bid without escrow). */
export function approveMsg({ spender, tokenId }) {
  return { approve: { spender, token_id: String(tokenId) } };
}
export function setCollectionBidMsg({ collection, amount, denom }) {
  return { set_collection_bid: { collection, details: { price: { denom, amount: String(amount) } } } };
}
export function removeCollectionBidMsg(id) {
  return { remove_collection_bid: { id: String(id) } };
}
export function acceptCollectionBidMsg({ id, tokenId, amount, denom }) {
  return { accept_collection_bid: { id: String(id), token_id: String(tokenId), details: { price: { denom, amount: String(amount) } } } };
}

/** Ask ids are deterministic: hex(sha256(collection || token_id)) (helpers.rs generate_id). */
export async function askIdFor(collection, tokenId) {
  const data = new TextEncoder().encode(String(collection) + String(tokenId));
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(h, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** The one denom this marketplace accepts for a collection: collection_denom, else config.default_denom. */
export async function queryTradeDenom(querySmart, rest, market, collection) {
  const [cd, cfg] = await Promise.all([
    querySmart(rest, market, { collection_denom: { collection } }).catch(() => null),
    querySmart(rest, market, { config: {} }).catch(() => null),
  ]);
  return (typeof cd === 'string' && cd) || cfg?.default_denom || 'uthiol';
}

export async function queryAsk(querySmart, rest, market, collection, tokenId) {
  if (!market || !querySmart) return null;
  try {
    const id = await askIdFor(collection, tokenId);
    const r = await querySmart(rest, market, { ask: { id } });
    // mint-svg querySmart returns the whole body when data is null; only a real ask has an id.
    return r && r.id ? r : null;
  } catch {
    return null;
  }
}

export async function queryBids(querySmart, rest, market, collection, tokenId, denom = 'uthiol', limit = 20) {
  if (!market || !querySmart) return [];
  try {
    const r = await querySmart(rest, market, {
      bids_by_token_price: { collection, token_id: String(tokenId), denom, query_options: { limit, descending: true } },
    });
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

export async function queryCollectionBids(querySmart, rest, market, collection, denom = 'uthiol', limit = 20) {
  if (!market || !querySmart) return [];
  try {
    const r = await querySmart(rest, market, {
      collection_bids_by_price: { collection, denom, query_options: { limit, descending: true } },
    });
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

export async function queryCollectionAsks(querySmart, rest, market, collection, denom = 'uthiol', limit = 30) {
  if (!market || !querySmart) return [];
  try {
    const r = await querySmart(rest, market, {
      asks_by_collection_denom: { collection, denom, query_options: { limit } },
    });
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

export async function queryConfig(querySmart, rest, market) {
  if (!market || !querySmart) return null;
  try {
    return await querySmart(rest, market, { config: {} });
  } catch {
    return null;
  }
}

/** Page of all token ids (cw721 Tokens / AllTokens). */
export async function queryAllTokenPage(querySmart, rest, collection, { startAfter = null, limit = 30 } = {}) {
  const msg = startAfter
    ? { all_tokens: { start_after: String(startAfter), limit } }
    : { all_tokens: { limit } };
  try {
    const data = await querySmart(rest, collection, msg);
    return (data.tokens || data.ids || []).map(String);
  } catch {
    // some cw721 builds use { tokens: { limit } } without owner for all
    const msg2 = startAfter
      ? { tokens: { start_after: String(startAfter), limit } }
      : { tokens: { limit } };
    const data = await querySmart(rest, collection, msg2);
    return (data.tokens || data.ids || []).map(String);
  }
}

export async function queryOwnerOf(querySmart, rest, collection, tokenId) {
  const data = await querySmart(rest, collection, { owner_of: { token_id: String(tokenId) } });
  return data?.owner || data?.access?.owner || null;
}
