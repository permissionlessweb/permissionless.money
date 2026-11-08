// lib/passkey-register.js — register a passkey on a Terp account with the
// terp-passkey contract (morocco-1 code 96). Same contract, schema, salt and
// labels as terp.network (lib/passkey-account.js is shared verbatim).
//
//   tx: [ MsgInstantiateContract2 (code 96, salt = sha256("terp-passkey/v1|acct|cred")[0..16],
//          msg { owner, registration { origin, rp_id, credential_id, public_key } }),
//         MsgAddAuthenticator (CosmwasmAuthenticatorV1, { contract, params b64({credential_id, rp_id}) }) ]
//
// Pure message building lives here so it can be simulated outside a browser.

import { padB64 } from '/lib/b64util.js';
import { passkeySalt, instantiate2Address, passkeyInstantiate, passkeyAuthParams } from './passkey-account.js';

export const PASSKEY_CODE_ID = 96;
export const PASSKEY_CHECKSUM = '98b5152bc9fb30fb23aff9f22308563ea1d166238584ec6d416b217813ce67d2';
export const PASSKEY_LABEL = 'terp-passkey';
export const ADD_AUTH_URL = '/terp.smartaccount.v1beta1.MsgAddAuthenticator';
export const INSTANTIATE2_URL = '/cosmwasm.wasm.v1.MsgInstantiateContract2';
export const COSMWASM_AUTH = 'CosmwasmAuthenticatorV1';
/** x/smartaccount composite: each sub-authenticator gets its own signature
 *  (tx signature = JSON array [passkeyAssertionJSON, secp256k1Sig]). Plain "AllOf"
 *  hands the same signature to every sub-authenticator, which cannot satisfy both. */
export const PARTITIONED_ALLOF = 'PartitionedAllOf';
export const SIGNATURE_VERIFICATION = 'SignatureVerification';
/** Measured with simulate on morocco-1: ~265k for both msgs, ~183k instantiate2 alone. */
export const GAS = { both: 350000, instantiate2: 250000, add: 150000 };

const te = new TextEncoder();
function varint(out, n) { let v = BigInt(n); while (v > 0x7fn) { out.push(Number(v & 0x7fn) | 0x80); v >>= 7n; } out.push(Number(v)); }
function field(no, bytes) { const o = []; varint(o, (no << 3) | 2); varint(o, bytes.length); return Uint8Array.from([...o, ...bytes]); }
function cat(parts) { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
const u8 = (s) => te.encode(String(s));
const b64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };

export function encodeInstantiate2({ sender, admin, codeId, label, msg, salt }) {
  const code = []; varint(code, 3 << 3); varint(code, BigInt(codeId));
  const parts = [field(1, u8(sender))];
  if (admin) parts.push(field(2, u8(admin)));
  parts.push(Uint8Array.from(code), field(4, u8(label)), field(5, u8(JSON.stringify(msg))), field(7, salt));
  return cat(parts);
}
export function encodeAddAuthenticator({ sender, type, data }) {
  return cat([field(1, u8(sender)), field(2, u8(type)), field(3, data)]);
}

/** pm passkey record -> the registration the contract stores. ES256 only (contract verifies P-256). */
export function registrationFromPasskey(passkey, { origin, rpId } = {}) {
  if (!passkey?.credentialId) throw new Error('No passkey to register.');
  if (passkey.alg != null && Number(passkey.alg) !== -7) {
    throw new Error('This passkey is not ES256 (P-256). The Terp passkey contract only verifies ES256; create a new passkey on this device.');
  }
  const pub = passkey.publicKeyUncompressed;
  if (!pub || atob(padB64(pub)).length !== 65 || atob(padB64(pub)).charCodeAt(0) !== 4) {
    throw new Error('This passkey has no 65-byte P-256 public key saved. Create a new passkey on this device.');
  }
  return {
    origin: origin || location.origin,
    rpId: rpId || passkey.rpId || location.hostname,
    credentialId: passkey.credentialId,
    publicKey: pub,
  };
}

/**
 * Build both messages for `account`. Returns { contract, salt, msgs:[{typeUrl, bytes, preview}] }.
 * `exists` skips instantiate2 when the predicted contract is already on chain.
 */
export async function buildPasskeyRegistration(account, reg, { exists = false, secondaryPubKey = null } = {}) {
  const salt = await passkeySalt(account, reg.credentialId);
  const contract = await instantiate2Address(PASSKEY_CHECKSUM, account, salt);
  const inst = passkeyInstantiate(account, reg);
  const data = u8(JSON.stringify({ contract, params: b64(u8(JSON.stringify(passkeyAuthParams(reg)))) }));
  const msgs = [];
  if (!exists) {
    msgs.push({ typeUrl: INSTANTIATE2_URL, bytes: encodeInstantiate2({ sender: account, admin: account, codeId: PASSKEY_CODE_ID, label: PASSKEY_LABEL, msg: inst, salt }),
      preview: { sender: account, admin: account, code_id: String(PASSKEY_CODE_ID), label: PASSKEY_LABEL, msg: inst, salt: b64(salt) } });
  }
  if (secondaryPubKey) {
    // AllOf: per-account passkey contract AND the in-browser secondary secp256k1 key.
    // Go []byte fields marshal as standard base64 in JSON.
    if (atob(padB64(secondaryPubKey)).length !== 33) throw new Error('Secondary key must be a 33-byte compressed secp256k1 pubkey');
    const subs = [
      { type: COSMWASM_AUTH, config: b64(data) },
      { type: SIGNATURE_VERIFICATION, config: secondaryPubKey },
    ];
    const allOf = u8(JSON.stringify(subs));
    msgs.push({ typeUrl: ADD_AUTH_URL, bytes: encodeAddAuthenticator({ sender: account, type: PARTITIONED_ALLOF, data: allOf }),
      preview: { sender: account, authenticator_type: PARTITIONED_ALLOF,
        data: [{ type: COSMWASM_AUTH, config: JSON.parse(new TextDecoder().decode(data)) }, { type: SIGNATURE_VERIFICATION, config: secondaryPubKey }] } });
  } else {
    msgs.push({ typeUrl: ADD_AUTH_URL, bytes: encodeAddAuthenticator({ sender: account, type: COSMWASM_AUTH, data }),
      preview: { sender: account, authenticator_type: COSMWASM_AUTH, data: JSON.parse(new TextDecoder().decode(data)) } });
  }
  return { contract, salt, msgs };
}

/** True if a contract already lives at `addr` (LCD read). */
export async function contractExists(rest, addr) {
  try {
    const r = await fetch(`${String(rest).replace(/\/$/, '')}/cosmwasm/wasm/v1/contract/${addr}`);
    if (!r.ok) return false;
    const j = await r.json();
    return Number(j?.contract_info?.code_id) === PASSKEY_CODE_ID;
  } catch { return false; }
}
