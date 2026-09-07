// lib/auth.js — passkey (WebAuthn) + Keplr. No hidden global auth state.

import { upsertPasskey, getActivePasskey, listPasskeys } from '/lib/passkeys.js';
export { prepareRegisterAuthenticatorMsg } from '/lib/auth-extension.js';

const CHAIN_ID = 'morocco-1';
const CHALLENGE_BYTE_LEN = 32;
const STORE_KEY = 'pm-passkey-id';
const SESSION_UNLOCK = 'pm-passkey-session';

function writeSessionUnlock(payload) {
  try {
    sessionStorage.setItem(SESSION_UNLOCK, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function readSessionUnlock() {
  try {
    const raw = sessionStorage.getItem(SESSION_UNLOCK);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** WebAuthn RP ID cannot be an IP. Any IP origin (127.0.0.1, LAN, v6) uses session-hd. */
export function isIpHostname(host) {
  const h = String(host || '').replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost') return false;
  if (h === '127.0.0.1' || h === '::1') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  return h.includes(':');
}

export function isLoopbackIp() {
  return isIpHostname(location.hostname);
}

export function webauthnRpId() {
  if (isLoopbackIp()) return null;
  return location.hostname;
}

function rpId() {
  return webauthnRpId();
}

export async function loadWasm() {
  return null;
}

const PUBKEY_PARAMS = [
  { type: 'public-key', alg: -7 },
  { type: 'public-key', alg: -257 },
  { type: 'public-key', alg: -8 },
];

/** Samsung Knox / Samsung Pass / Android work profile — do not lock to platform. */
export function isKnoxLike() {
  const ua = String(navigator.userAgent || '');
  return /Android|SamsungBrowser|Knox|KNOX|SM-|Samsung/i.test(ua);
}

function knoxHint(err) {
  const name = err && err.name;
  const msg = String((err && err.message) || err || '');
  if (name === 'NotAllowedError' || /not allowed|denied|abort/i.test(msg)) {
    return 'Knox / Samsung Pass blocked a locked request. Try again — we now leave the authenticator open so the enclave can answer.';
  }
  if (name === 'InvalidStateError') return 'A passkey for this site may already exist in Knox. Use Unlock, or Continue on this device.';
  if (name === 'NotSupportedError') return 'This browser cannot create a passkey here. Use Continue on this device or Keplr.';
  return msg;
}

function bytesToB64(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

/** SPKI from WebAuthn create — needed to register the passkey as a chain authenticator. */
export function extractPasskeyPublicKey(credential) {
  const resp = credential?.response;
  const out = { alg: null, publicKey: null, publicKeyUncompressed: null };
  if (!resp) return out;
  try {
    if (typeof resp.getPublicKeyAlgorithm === 'function') out.alg = resp.getPublicKeyAlgorithm();
  } catch {
    /* ignore */
  }
  try {
    if (typeof resp.getPublicKey !== 'function') return out;
    const buf = resp.getPublicKey();
    if (!buf) return out;
    const u8 = new Uint8Array(buf);
    out.publicKey = bytesToB64(u8);
    if (u8.length >= 65 && u8[u8.length - 65] === 0x04) {
      out.publicKeyUncompressed = bytesToB64(u8.slice(u8.length - 65));
    }
  } catch {
    /* ignore */
  }
  return out;
}

async function createCredential(host) {
  const challenge = crypto.getRandomValues(new Uint8Array(CHALLENGE_BYTE_LEN));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  // Unconstrained: Knox presents as its own authenticator. platform +
  // hints:client-device is what made Samsung Pass return NotAllowedError.
  const publicKey = {
    challenge,
    rp: { name: 'permissionless.money', id: host },
    user: {
      id: userId,
      name: `pm-${Date.now().toString(36)}`,
      displayName: 'permissionless.money',
    },
    pubKeyCredParams: PUBKEY_PARAMS,
    authenticatorSelection: {
      residentKey: 'preferred',
      requireResidentKey: false,
      userVerification: 'preferred',
    },
    timeout: 180000,
    attestation: 'none',
  };
  return navigator.credentials.create({ publicKey });
}

export async function registerPasskey(host = rpId()) {
  if (isLoopbackIp() || !host) {
    throw new Error('Passkeys need a hostname origin. On an IP (127.0.0.1 / LAN) Unlock uses a tab session key.');
  }
  if (!window.PublicKeyCredential) throw new Error('Passkeys not supported in this browser');
  let credential;
  try {
    credential = await createCredential(host);
  } catch (err) {
    throw new Error(knoxHint(err));
  }
  const raw = new Uint8Array(credential.rawId);
  const credId = btoa(String.fromCharCode(...raw));
  const pub = extractPasskeyPublicKey(credential);
  localStorage.setItem(STORE_KEY, credId);
  const rec = upsertPasskey({
    credentialId: credId,
    label: `Passkey ${credId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)}`,
    rpId: host,
    publicKey: pub.publicKey,
    publicKeyUncompressed: pub.publicKeyUncompressed,
    alg: pub.alg,
    pendingAttach: true,
  });
  writeSessionUnlock({ credentialId: credId, at: Date.now() });
  return {
    credentialId: credId,
    publicKey: pub.publicKey,
    publicKeyUncompressed: pub.publicKeyUncompressed,
    alg: pub.alg,
    rpId: host,
    address: rec.account || `passkey:${credId.slice(0, 10)}`,
    record: rec,
    set: listPasskeys(),
  };
}

function credIdToBytes(id) {
  const raw = String(id || '').trim();
  if (!raw) throw new Error('empty credential id');
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pad)) throw new Error('credential id is not base64');
  try {
    const bytes = Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
    if (!bytes.length) throw new Error('empty credential id');
    return bytes;
  } catch (e) {
    if (/not base64|empty credential/i.test(e.message || '')) throw e;
    throw new Error('credential id is not base64');
  }
}

function usableCredId(id) {
  try {
    return credIdToBytes(id).length > 0;
  } catch {
    return false;
  }
}

function knownCredentialIds() {
  const ids = listPasskeys().map((c) => c.credentialId).filter(Boolean);
  const legacy = localStorage.getItem(STORE_KEY);
  if (legacy && !ids.includes(legacy)) ids.push(legacy);
  return ids.filter(usableCredId);
}

/**
 * Unlock an existing device passkey. Prefers known ids; if none stored,
 * asks the authenticator for a discoverable (resident) key — does not create.
 */
async function getAssertion(opts) {
  const challenge = crypto.getRandomValues(new Uint8Array(CHALLENGE_BYTE_LEN));
  const publicKey = {
    challenge,
    userVerification: 'preferred',
    timeout: 180000,
    rpId: rpId(),
  };
  if (opts.allowIds && opts.allowIds.length) {
    publicKey.allowCredentials = opts.allowIds.map((id) => ({
      type: 'public-key',
      id: credIdToBytes(id),
    }));
  }
  const assertion = await navigator.credentials.get({ publicKey });
  return { assertion, challenge };
}

export async function authenticatePasskey(credIdBase64) {
  if (isLoopbackIp() || !rpId()) {
    throw new Error('Passkeys need a hostname origin. On an IP (127.0.0.1 / LAN) Unlock uses a tab session key.');
  }
  if (!window.PublicKeyCredential) throw new Error('Passkeys not supported in this browser');
  const known = (credIdBase64 ? [credIdBase64] : knownCredentialIds()).filter(usableCredId);
  let assertion = null;
  let challenge = null;
  try {
    if (known.length) {
      const first = await getAssertion({ allowIds: known });
      assertion = first.assertion;
      challenge = first.challenge;
    } else {
      // Stored ids were junk (not base64) or absent — ask for a discoverable key.
      const first = await getAssertion({ allowIds: null });
      assertion = first.assertion;
      challenge = first.challenge;
    }
  } catch (err) {
    if (known.length && isKnoxLike()) {
      try {
        const retry = await getAssertion({ allowIds: null });
        assertion = retry.assertion;
        challenge = retry.challenge;
      } catch (err2) {
        throw new Error(knoxHint(err2));
      }
    } else {
      throw new Error(knoxHint(err));
    }
  }
  if (!assertion) throw new Error('Passkey cancelled');
  const raw = new Uint8Array(assertion.rawId);
  const credentialId = btoa(String.fromCharCode(...raw));
  localStorage.setItem(STORE_KEY, credentialId);
  const rec = upsertPasskey({
    credentialId,
    rpId: location.hostname,
  });
  const challengeResponse = btoa(String.fromCharCode(...challenge));
  writeSessionUnlock({ credentialId, challengeResponse, at: Date.now() });
  return {
    assertion,
    credentialId,
    challengeResponse,
    address: rec.account || `passkey:${credentialId.slice(0, 10)}`,
    record: rec,
  };
}

/** Session-hd without a hardware passkey. Not a credential. Do not list as a passkey. */
export async function useDeviceSession() {
  writeSessionUnlock({ credentialId: null, challengeResponse: 'session-hd', at: Date.now() });
  return {
    credentialId: null,
    address: null,
    record: null,
    deviceOnly: true,
  };
}

export async function connectKeplr(chainId = CHAIN_ID) {
  if (!window.keplr) throw new Error('Install Keplr to use a browser wallet');
  await window.keplr.enable(chainId);
  const offlineSigner = window.keplr.getOfflineSigner(chainId);
  const [{ address }] = await offlineSigner.getAccounts();
  sessionStorage.setItem('keplrAddress', address);
  return { address, type: 'keplr' };
}

export async function disconnectKeplr(chainId = CHAIN_ID) {
  try { sessionStorage.removeItem('keplrAddress'); } catch { /* ignore */ }
  try {
    if (typeof window.keplr?.disable === 'function') await window.keplr.disable(chainId);
  } catch { /* ignore */ }
}

export async function signMintMsg() {
  throw new Error('signMintMsg is gone — mint with mintSvgNft / executeWithSmartAccount');
}
