// HashMerchant onboard plane. Passkey registration feegrant only.
// POST /onboard/v1/mint-grant is 404 — never buy the NFT with HashMerchant.
// Live: https://hash.terp.network  (alias https://onboard.permissionless.money)
// If broadcast:true, HM runtime broadcasts — do not sign with fee.granter.

import { padB64 } from '/lib/b64util.js';
import { signRawMsgs } from '/lib/smart-account-tx.js?v=20261108a';
import { ensureSecondaryKey } from '/lib/browser-wallet.js';
import { PASSKEY_CODE_ID, PASSKEY_CHECKSUM, INSTANTIATE2_URL, GAS, registrationFromPasskey, buildPasskeyRegistration, contractExists } from '/lib/passkey-register.js';
import { markGranted, markAttachPending } from '/lib/passkeys.js';
import { loadCwOrchState, TERP_MAINNET } from '/lib/cw-orch-state.js';

export const HASH_ORIGIN = 'https://hash.terp.network';
export const ONBOARD_ORIGIN = 'https://onboard.permissionless.money';
export const ADD_AUTHENTICATOR_TYPE_URL = '/terp.smartaccount.v1beta1.MsgAddAuthenticator';
export const COSMWASM_AUTHENTICATOR_TYPE = 'CosmwasmAuthenticatorV1';
export const SEED_UTHIOL = '1000000'; // 1 THIOL runway after paid mint — matches house onboard

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
  return fetch(url, { ...opts, signal: ctrl.signal }).catch((e) => {
    if (e && (e.name === 'AbortError' || /aborted/i.test(e.message || ''))) {
      throw new Error('Feegrant desk did not answer in time. The mint was not sent.');
    }
    throw e;
  }).finally(() => clearTimeout(t));
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

/** terp-passkey code on morocco-1 is 96 (checksum 98b5152b…ce67d2). state.json still lists 84 (old shared contract). */
export async function resolvePasskeyCodeId(chain) {
  const id = chain?.chainId || TERP_MAINNET;
  if (id === TERP_MAINNET) return PASSKEY_CODE_ID;
  const st = await loadCwOrchState({ chainId: id }).catch(() => null);
  return st?.passkeyCodeId || null;
}
export { PASSKEY_CODE_ID, PASSKEY_CHECKSUM };

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
    type: 'PartitionedAllOf',
    sub_types: [COSMWASM_AUTHENTICATOR_TYPE, 'SignatureVerification'],
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
    const bin = atob(padB64(s));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new TextEncoder().encode(s);
  }
}

export async function requestPasskeyGrant({ address, authenticator, c }) {
  if (!address || !address.startsWith('terp1')) {
    throw new Error('Passkey grant needs a Terp address');
  }
  const commit = String(c || '').trim();
  if (!commit) {
    throw new Error('Passkey grant waits until this mint is paid (Pedersen c).');
  }
  const payload = {
    address,
    c: commit,
    purpose: 'register_authenticator',
    msgTypeUrls: [ADD_AUTHENTICATOR_TYPE_URL, '/cosmwasm.wasm.v1.MsgInstantiateContract2'],
    seed_uthiol: SEED_UTHIOL,
    authenticator: authenticator || null,
    code_id: authenticator?.code_id || null,
  };
  const urls = uniqueOrigins();
  let here = '';
  try { here = (location.origin || '').replace(/\/$/, ''); } catch { here = ''; }
  const same = urls.filter((o) => o === here);
  const tryUrls = same.length ? same : urls;
  let last = new Error('onboard grant unreachable');
  for (const origin of tryUrls) {
    try {
      const res = await fetchWithTimeout(`${origin}/onboard/v1/passkey-grant`, {
        method: 'POST',
        credentials: 'omit',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 25000);
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
export async function attachPasskeyWithGrant({ address, wallet, chain, passkey, c, secondaryPubKey = null, prfKey = null }) {
  if (!passkey?.credentialId) {
    return { granted: false, skipped: true, reason: 'no-passkey' };
  }
  // Build the code-96 registration first: an RS256/EdDSA passkey cannot be used, so stop before asking for a grant.
  let reg, plan;
  try {
    reg = registrationFromPasskey(passkey);
    // Flow: ephemeral key signs (1) instantiate2 of this account's own code-96 contract,
    // (2) MsgAddAuthenticator PartitionedAllOf[CosmwasmAuthenticatorV1(that contract), SignatureVerification(secondary key)].
    const secondary = secondaryPubKey || (await ensureSecondaryKey(address, { prfKey, credentialId: passkey.credentialId, passkeyPub: passkey.publicKeyUncompressed || '' })).pubkey;
    const pre = await buildPasskeyRegistration(address, reg, { secondaryPubKey: secondary });
    const exists = await contractExists(chain?.rest, pre.contract);
    plan = exists ? await buildPasskeyRegistration(address, reg, { exists: true, secondaryPubKey: secondary }) : pre;
  } catch (e) {
    return { granted: false, error: e.message || String(e), stage: 'encode' };
  }
  const authenticator = {
    type: 'PartitionedAllOf',
    sub_types: [COSMWASM_AUTHENTICATOR_TYPE, 'SignatureVerification'],
    typeUrl: ADD_AUTHENTICATOR_TYPE_URL,
    code_id: PASSKEY_CODE_ID,
    checksum: PASSKEY_CHECKSUM,
    contract: plan.contract,
    credential_id: reg.credentialId,
    rp_id: reg.rpId,
    origin: reg.origin,
  };
  let grant;
  try {
    grant = await requestPasskeyGrant({ address, authenticator, c });
  } catch (e) {
    markAttachPending(passkey.credentialId);
    return { granted: false, skipped: e.skipped === true, error: e.skipped ? null : (e.message || String(e)), stage: 'grant' };
  }
  if (grant.granter) markAttachPending(passkey.credentialId, { lastGranter: grant.granter });
  if (grant.stub) {
    return { granted: false, stub: true, granter: grant.granter, origin: grant.origin, stage: 'stub' };
  }
  const granter = isTerpGrantAddress(grant.granter) ? grant.granter : null;
  if (!granter) return { granted: false, error: 'onboard grant had no fee granter', stage: 'grant', grant };
  if (!wallet) return { granted: false, error: 'no local signer for the passkey registration', stage: 'sign', granter };

  // The feegrant is an AllowedMsgAllowance: if it does not list MsgInstantiateContract2, a
  // tx carrying it is rejected whole. Then instantiate2 is paid from the runway seed and
  // only MsgAddAuthenticator uses the grant.
  const grantAllowsInstantiate = JSON.stringify(grant.raw || {}).includes(INSTANTIATE2_URL);
  const inst = plan.msgs.filter((m) => m.typeUrl === INSTANTIATE2_URL);
  const add = plan.msgs.filter((m) => m.typeUrl !== INSTANTIATE2_URL);
  const txs = [];
  try {
    if (inst.length && grantAllowsInstantiate) {
      txs.push(await signRawMsgs({ chain, wallet, address, msgs: plan.msgs, granter, gas: GAS.both, memo: 'passkey authenticator' }));
    } else {
      if (inst.length) txs.push(await signRawMsgs({ chain, wallet, address, msgs: inst, gas: GAS.instantiate2, memo: 'passkey contract' }));
      txs.push(await signRawMsgs({ chain, wallet, address, msgs: add, granter, gas: GAS.add, memo: 'passkey authenticator' }));
    }
    const last = txs[txs.length - 1];
    const txhash = last?.transactionHash || last?.txhash || last?.hash || null;
    markGranted(passkey.credentialId, { lastGranter: granter, contract: plan.contract, codeId: PASSKEY_CODE_ID });
    return { granted: true, broadcastBy: 'feegrant', txhash, txhashes: txs.map((t) => t?.transactionHash || null), contract: plan.contract, granter, origin: grant.origin };
  } catch (e) {
    markAttachPending(passkey.credentialId, { lastGranter: granter, contract: plan.contract });
    return { granted: false, granter, contract: plan.contract, error: e.message || String(e), stage: txs.length ? 'add-authenticator' : 'broadcast' };
  }
}
