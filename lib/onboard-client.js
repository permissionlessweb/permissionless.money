// HashMerchant onboard plane. Passkey registration feegrant only.
// POST /onboard/v1/mint-grant is 404 — never buy the NFT with HashMerchant.
// Live: https://hash.terp.network  (alias https://onboard.permissionless.money)
// If broadcast:true, HM runtime broadcasts — do not sign with fee.granter.

import { signAddAuthenticator } from '/lib/smart-account-tx.js';
import { markGranted, markAttachPending } from '/lib/passkeys.js';
import { loadCwOrchState, TERP_MAINNET } from '/lib/cw-orch-state.js';

export const HASH_ORIGIN = 'https://hash.terp.network';
export const ONBOARD_ORIGIN = 'https://onboard.permissionless.money';
export const ADD_AUTHENTICATOR_TYPE_URL = '/terp.smartaccount.v1beta1.MsgAddAuthenticator';
export const COSMWASM_AUTHENTICATOR_TYPE = 'CosmwasmAuthenticatorV1';
export const SEED_UTHIOL = '4200000'; // 4.20 THIOL — HM may send this; FE only requests it

export function onboardBase() {
  return (
    window.__ONBOARD_URL ||
    localStorage.getItem('onboardUrl') ||
    HASH_ORIGIN
  ).replace(/\/$/, '');
}

function uniqueOrigins() {
  const remote = onboardBase();
  let here = '';
  try { here = location.origin || ''; } catch { here = ''; }
  const localish = /localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.|\.local/i.test(here);
  const list = [];
  if (localish && here) list.push(here);
  for (const o of [remote, HASH_ORIGIN, ONBOARD_ORIGIN]) {
    if (o && !list.includes(o)) list.push(o);
  }
  return list.filter(Boolean);
}

function fetchWithTimeout(url, opts, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export async function onboardStatus() {
  const urls = uniqueOrigins();
  for (const origin of urls) {
    try {
      const res = await fetchWithTimeout(`${origin}/onboard/v1/status`, { credentials: 'omit' });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok !== false) return { ...body, origin };
    } catch {
      /* try next */
    }
  }
  return { ok: false, error: 'onboard status unreachable' };
}

export function isTerpGrantAddress(addr) {
  return typeof addr === 'string' && /^terp1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,58}$/.test(addr);
}

function isSmokeAuthAddr(addr, chain) {
  const bag = chain?.noncircuitAuth || {};
  return Object.values(bag).some((a) => a === addr);
}

export function resolvePasskeyAuthContract(grant, chain) {
  const fromGrant = grant?.contract || grant?.authenticator_contract || grant?.raw?.contract;
  const fromWin = typeof window !== 'undefined' ? window.__PASSKEY_AUTH_CONTRACT : null;
  let fromStore = null;
  try { fromStore = localStorage.getItem('passkeyAuthContract'); } catch { /* ignore */ }
  const fromChain = chain?.passkeyAuth || chain?.contracts?.passkeyAuth || chain?.contracts?.smartAccount;
  const c = fromGrant || fromWin || fromStore || fromChain || null;
  if (!isTerpGrantAddress(c)) return null;
  if (isSmokeAuthAddr(c, chain)) return null;
  return c;
}

export async function resolvePasskeyCodeId(chain) {
  const fromChain = Number(chain?.passkeyCodeId || chain?.authCodeIds?.['terp-passkey'] || chain?.codeIds?.['terp-passkey']);
  if (fromChain === 84) return 84;
  const st = await loadCwOrchState({ chainId: chain?.chainId || TERP_MAINNET });
  return st.passkeyCodeId;
}

/** Params JSON the CosmwasmAuthenticator contract reads (must be JSON bytes on-chain). */
export function passkeyAuthParams(passkey) {
  return {
    credential_id: passkey.credentialId,
    public_key: passkey.publicKey || null,
    public_key_uncompressed: passkey.publicKeyUncompressed || null,
    rp_id: passkey.rpId || (typeof location !== 'undefined' ? location.hostname : null),
    alg: passkey.alg ?? null,
  };
}

export function buildPasskeyAuthenticator({ passkey, contract, codeId }) {
  const params = passkeyAuthParams(passkey);
  return {
    type: COSMWASM_AUTHENTICATOR_TYPE,
    typeUrl: ADD_AUTHENTICATOR_TYPE_URL,
    credential_id: passkey.credentialId,
    public_key: passkey.publicKey || null,
    public_key_uncompressed: passkey.publicKeyUncompressed || null,
    rp_id: params.rp_id,
    alg: params.alg,
    contract: contract || null,
    code_id: codeId || null,
    params,
  };
}

export function encodeCosmwasmAuthData({ contract, params }) {
  if (!isTerpGrantAddress(contract)) throw new Error('CosmwasmAuthenticator needs a contract address');
  const paramBytes = new TextEncoder().encode(JSON.stringify(params || {}));
  // Go json.Marshal of []byte is standard base64.
  let b64 = '';
  for (let i = 0; i < paramBytes.length; i++) b64 += String.fromCharCode(paramBytes[i]);
  const body = JSON.stringify({ contract, params: btoa(b64) });
  return new TextEncoder().encode(body);
}

function decodeGrantData(raw) {
  if (!raw) return null;
  if (raw instanceof Uint8Array) return raw;
  if (Array.isArray(raw)) return Uint8Array.from(raw);
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new TextEncoder().encode(s);
  }
}

export async function requestPasskeyGrant({ address, authenticator }) {
  if (!address || !address.startsWith('terp1')) {
    throw new Error('Passkey grant needs a Terp address');
  }
  const payload = {
    address,
    purpose: 'register_authenticator',
    msgTypeUrls: [ADD_AUTHENTICATOR_TYPE_URL],
    seed_uthiol: SEED_UTHIOL,
    authenticator: authenticator || null,
    code_id: authenticator?.code_id || null,
  };
  const urls = uniqueOrigins();
  let here = '';
  try { here = (location.origin || '').replace(/\/$/, ''); } catch { here = ''; }
  // Cross-origin POST with JSON Content-Type preflights; HashMerchant OPTIONS has no ACAO.
  // Only hit grant on same-origin (LAN mint). Cosmic Web skips until HM CORS is on.
  const same = urls.filter((o) => o === here);
  if (!same.length) {
    const err = new Error('passkey-grant skipped (cross-origin CORS)');
    err.skipped = true;
    throw err;
  }
  let last = new Error('onboard grant unreachable');
  for (const origin of same) {
    try {
      const res = await fetchWithTimeout(`${origin}/onboard/v1/passkey-grant`, {
        method: 'POST',
        credentials: 'omit',
        mode: 'cors',
        // text/plain → no OPTIONS preflight. HM may still need CORS on POST.
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        last = new Error(body.error || `onboard grant ${res.status}`);
        continue;
      }
      return normalizeGrant(body, origin);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

function normalizeGrant(body, origin) {
  const granter = body.granter || body.msg?.granter || body.fee_granter || null;
  const stub = body.stub === true || (typeof granter === 'string' && granter.includes('localdev'));
  return {
    ok: body.ok !== false,
    granter,
    stub,
    origin,
    seededUthiol: body.seeded_uthiol || body.seed_uthiol || null,
    txhash: body.txhash || body.transactionHash || null,
    broadcast: body.broadcast === true,
    contract: body.contract || body.authenticator_contract || null,
    authenticatorType: body.authenticator_type || body.authenticatorType || COSMWASM_AUTHENTICATOR_TYPE,
    data: body.data || body.authenticator_data || null,
    raw: body,
  };
}

/**
 * Ask HashMerchant for a feegrant (and optional 4.20 THIOL seed), then
 * register the passkey as CosmwasmAuthenticatorV1 on the new account.
 * Never throws past the grant/attach — callers get { granted, error }.
 */
export async function attachPasskeyWithGrant({ address, wallet, chain, passkey }) {
  if (!passkey?.credentialId) {
    return { granted: false, skipped: true, reason: 'no-passkey' };
  }
  const contract = resolvePasskeyAuthContract(null, chain);
  const codeId = await resolvePasskeyCodeId(chain);
  const authenticator = buildPasskeyAuthenticator({ passkey, contract, codeId });
  let grant;
  try {
    grant = await requestPasskeyGrant({ address, authenticator });
  } catch (e) {
    markAttachPending(passkey.credentialId);
    return {
      granted: false,
      skipped: e.skipped === true,
      error: e.skipped ? null : (e.message || String(e)),
      stage: 'grant',
    };
  }

  if (grant.granter) {
    markAttachPending(passkey.credentialId, { lastGranter: grant.granter });
  }

  if (grant.stub) {
    return {
      granted: false,
      stub: true,
      granter: grant.granter,
      origin: grant.origin,
      stage: 'stub',
    };
  }

  // Live HM: broadcast:true — runtime submits the tx. fee.granter is not the runtime.
  if (grant.broadcast === true) {
    if (grant.txhash) {
      markGranted(passkey.credentialId, { lastGranter: grant.granter || null });
    }
    return {
      granted: !!grant.txhash,
      broadcastBy: 'hashmerchant',
      txhash: grant.txhash,
      granter: grant.granter,
      origin: grant.origin,
    };
  }

  const granter = isTerpGrantAddress(grant.granter) ? grant.granter : null;
  if (!granter) {
    return { granted: false, error: 'onboard grant had no fee granter', stage: 'grant', grant };
  }
  if (!wallet) {
    return { granted: false, error: 'no local signer for MsgAddAuthenticator', stage: 'sign', granter };
  }

  const resolvedContract = resolvePasskeyAuthContract(grant, chain);
  let data = decodeGrantData(grant.data);
  if (!data && resolvedContract) {
    data = encodeCosmwasmAuthData({
      contract: resolvedContract,
      params: passkeyAuthParams(passkey),
    });
  }
  if (!data) {
    return {
      granted: false,
      granter,
      error: 'HashMerchant grant is live but has no authenticator data yet (needs contract or encoded data)',
      stage: 'encode',
    };
  }

  const authenticatorType = grant.authenticatorType || COSMWASM_AUTHENTICATOR_TYPE;
  try {
    const tx = await signAddAuthenticator({
      chain,
      wallet,
      address,
      authenticatorType,
      data,
      granter,
      memo: 'passkey authenticator',
    });
    const txhash = tx?.transactionHash || tx?.txhash || tx?.hash || null;
    markGranted(passkey.credentialId, { lastGranter: granter });
    return {
      granted: true,
      broadcastBy: 'feegrant',
      txhash,
      granter,
      origin: grant.origin,
      raw: tx,
    };
  } catch (e) {
    markAttachPending(passkey.credentialId, { lastGranter: granter });
    return { granted: false, granter, error: e.message || String(e), stage: 'broadcast' };
  }
}
