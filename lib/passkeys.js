// lib/passkeys.js — identify and manage a set of device passkeys (no private keys).

const STORE = 'pm-passkey-set-v1';
const ACTIVE = 'pm-passkey-active';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || '{}');
    const credentials = Array.isArray(raw.credentials) ? raw.credentials : [];
    return { credentials };
  } catch {
    return { credentials: [] };
  }
}

function save(state) {
  localStorage.setItem(STORE, JSON.stringify({ credentials: state.credentials.slice(0, 24) }));
}

function shortId(credId) {
  return String(credId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'pk';
}

export function listPasskeys() {
  return load().credentials.slice();
}

export function getActivePasskey() {
  const id = localStorage.getItem(ACTIVE);
  const all = listPasskeys();
  return all.find((c) => c.credentialId === id) || all[0] || null;
}

export function setActivePasskey(credentialId) {
  if (credentialId) localStorage.setItem(ACTIVE, credentialId);
  else localStorage.removeItem(ACTIVE);
}

export function upsertPasskey(partial) {
  const state = load();
  const credentialId = partial.credentialId;
  if (!credentialId) throw new Error('credentialId required');
  const prev = state.credentials.find((c) => c.credentialId === credentialId);
  const rec = {
    credentialId,
    label: partial.label || prev?.label || `Passkey ${shortId(credentialId)}`,
    rpId: partial.rpId || prev?.rpId || location.hostname,
    createdAt: prev?.createdAt || new Date().toISOString(),
    account: partial.account !== undefined ? partial.account : prev?.account || null,
    grantAt: partial.grantAt !== undefined ? partial.grantAt : prev?.grantAt || null,
    publicKey: partial.publicKey !== undefined ? partial.publicKey : prev?.publicKey || null,
    publicKeyUncompressed: partial.publicKeyUncompressed !== undefined
      ? partial.publicKeyUncompressed
      : prev?.publicKeyUncompressed || null,
    alg: partial.alg !== undefined ? partial.alg : prev?.alg || null,
    pendingAttach: partial.pendingAttach !== undefined
      ? partial.pendingAttach
      : prev?.pendingAttach || false,
    lastGranter: partial.lastGranter !== undefined ? partial.lastGranter : prev?.lastGranter || null,
  };
  state.credentials = [rec, ...state.credentials.filter((c) => c.credentialId !== credentialId)];
  save(state);
  setActivePasskey(credentialId);
  return rec;
}

export function renamePasskey(credentialId, label) {
  const name = String(label || '').trim().slice(0, 48);
  if (!name) return getActivePasskey();
  return upsertPasskey({ credentialId, label: name });
}

export function bindAccount(credentialId, address) {
  return upsertPasskey({ credentialId, account: address || null });
}

export function markGranted(credentialId, extra = {}) {
  return upsertPasskey({
    credentialId,
    grantAt: new Date().toISOString(),
    pendingAttach: false,
    ...extra,
  });
}

export function markAttachPending(credentialId, extra = {}) {
  return upsertPasskey({ credentialId, pendingAttach: true, ...extra });
}

export function forgetPasskey(credentialId) {
  const state = load();
  state.credentials = state.credentials.filter((c) => c.credentialId !== credentialId);
  save(state);
  if (localStorage.getItem(ACTIVE) === credentialId) {
    setActivePasskey(state.credentials[0]?.credentialId || '');
  }
}

export function passkeyHandle(rec) {
  if (!rec) return '';
  if (rec.account) return rec.account;
  return `pk:${shortId(rec.credentialId)}`;
}
