// lib/browser-wallet.js — ephemeral in-browser HD wallet for demos.
// Session-scoped only (sessionStorage). Not for long-term custody.
//
// Loads CosmJS from jsDelivr +esm (more reliable than bare esm.sh for named exports).
// StacksProvider / installHook errors from browser extensions are unrelated noise.

import { padB64 } from '/lib/b64util.js';
const STORAGE_KEY = 'pm-demo-wallet-v1';
const ROSTER_KEY = 'pm-demo-wallets-v1';
const ACTIVE_KEY = 'pm-demo-wallet-active';


function b64(bytes) {
  let o = '';
  for (const b of bytes) o += String.fromCharCode(b);
  return btoa(o);
}
function b64ToBytes(text) {
  const bin = atob(padB64(text));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function sealAad(credentialId, passkeyPub) {
  return new TextEncoder().encode(`${credentialId || ''}|${passkeyPub || ''}`);
}
async function aesKey(prfKey) {
  const raw = prfKey instanceof Uint8Array ? prfKey : new Uint8Array(prfKey);
  if (raw.length < 32) throw new Error('Passkey seal key is too short');
  return crypto.subtle.importKey('raw', raw.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function sealMnemonic(mnemonic, prfKey, credentialId, passkeyPub) {
  const key = await aesKey(prfKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: sealAad(credentialId, passkeyPub) },
    key,
    new TextEncoder().encode(mnemonic),
  );
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)), credentialId: credentialId || '', passkeyPub: passkeyPub || '' };
}
async function openMnemonic(sealed, prfKey) {
  const key = await aesKey(prfKey);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(sealed.iv), additionalData: sealAad(sealed.credentialId, sealed.passkeyPub) },
    key,
    b64ToBytes(sealed.ct),
  );
  return new TextDecoder().decode(plain);
}

function readRoster() {
  try {
    const raw = JSON.parse(localStorage.getItem(ROSTER_KEY) || '{}');
    return Array.isArray(raw.wallets) ? raw.wallets : [];
  } catch {
    return [];
  }
}

function writeRoster(wallets) {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify({ wallets: wallets.slice(0, 12) }));
  } catch { /* ignore */ }
}

function shortWalletLabel(address) {
  const a = String(address || '');
  if (a.length < 12) return a || 'wallet';
  return `${a.slice(0, 8)}…${a.slice(-4)}`;
}

async function upsertRosterEntry({ mnemonic, prefix, address, label, prfKey, credentialId, passkeyPub }) {
  if (!mnemonic || !address) return;
  const prev = readRoster().find((w) => w.address === address);
  const rec = {
    prefix: prefix || 'terp',
    address,
    label: label || prev?.label || shortWalletLabel(address),
    createdAt: prev?.createdAt || Date.now(),
  };
  if (prfKey) {
    rec.sealed = await sealMnemonic(mnemonic, prfKey, credentialId || prev?.sealed?.credentialId || '', passkeyPub || prev?.sealed?.passkeyPub || '');
  } else if (prev?.sealed && !mnemonic) {
    rec.sealed = prev.sealed;
  } else {
    rec.mnemonic = mnemonic;
  }
  writeRoster([rec, ...readRoster().filter((w) => w.address !== address)]);
  try { localStorage.setItem(ACTIVE_KEY, address); } catch { /* ignore */ }
}

/** sessionStorage v1 → localStorage roster. Safe to call often. */
export function migrateBrowserWalletStore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.mnemonic && o?.address) void upsertRosterEntry(o);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* ignore */ }
  try {
    if (!localStorage.getItem(ACTIVE_KEY) && readRoster()[0]?.address) {
      localStorage.setItem(ACTIVE_KEY, readRoster()[0].address);
    }
  } catch { /* ignore */ }
}

/** Public rows only — never put mnemonics in the DOM. */
export function listBrowserWallets() {
  migrateBrowserWalletStore();
  return readRoster().map((w) => ({
    address: w.address,
    prefix: w.prefix || 'terp',
    label: w.label || shortWalletLabel(w.address),
    createdAt: w.createdAt || 0,
  }));
}

/** Prefer jsDelivr ESM; fall back to esm.sh if needed. */
const PROTO_SIGNING_URLS = [
  'https://esm.sh/@cosmjs/proto-signing@0.32.4?bundle',
  'https://cdn.jsdelivr.net/npm/@cosmjs/proto-signing@0.32.4/+esm',
];

function withTimeout(promise, ms, msg) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * @returns {Promise<typeof import('@cosmjs/proto-signing').DirectSecp256k1HdWallet>}
 */
async function loadHdWalletClass() {
  let lastErr;
  for (const url of PROTO_SIGNING_URLS) {
    try {
      const mod = await withTimeout(
        import(/* @vite-ignore */ url),
        12000,
        `CosmJS load timed out from ${url}`,
      );
      const W =
        mod.DirectSecp256k1HdWallet ||
        mod.default?.DirectSecp256k1HdWallet ||
        (typeof mod.default === 'function' ? mod.default : null);
      if (W && typeof W.generate === 'function' && typeof W.fromMnemonic === 'function') {
        return W;
      }
      lastErr = new Error(`Module loaded from ${url} but DirectSecp256k1HdWallet.generate missing`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Could not load CosmJS wallet library: ${lastErr?.message || lastErr || 'unknown'}`
  );
}

/**
 * Create or restore an ephemeral Secp256k1 HD wallet (bech32 prefix default terp).
 * @param {{ prefix?: string, forceNew?: boolean }} [opts]
 * @returns {Promise<{ address: string, mnemonic: string, wallet: object, created: boolean }>}
 */
export async function ensureBrowserWallet(opts = {}) {
  const prefix = opts.prefix || 'terp';
  migrateBrowserWalletStore();
  const DirectSecp256k1HdWallet = await loadHdWalletClass();

  if (!opts.forceNew) {
    const roster = readRoster();
    const want = opts.address || (typeof localStorage !== 'undefined' && localStorage.getItem(ACTIVE_KEY)) || '';
    const existing = roster.find((w) => w.address === want && w.prefix === prefix)
      || (!opts.address && roster.find((w) => w.prefix === prefix))
      || null;
    let mnemonic = existing?.mnemonic || '';
    if (existing?.sealed) {
      if (!opts.prfKey) throw new Error('Unlock the passkey to open this wallet');
      mnemonic = await openMnemonic(existing.sealed, opts.prfKey);
    }
    if (mnemonic) {
      const wallet = await Promise.resolve(
        DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix })
      );
      if (!wallet || typeof wallet.getAccounts !== 'function') {
        throw new Error('Restored wallet is invalid');
      }
      const accounts = await Promise.resolve(wallet.getAccounts());
      const account = accounts?.[0];
      if (!account?.address) throw new Error('No account on restored wallet');
      await upsertRosterEntry({
        mnemonic,
        prefix,
        address: account.address,
        label: existing.label,
        prfKey: opts.prfKey || null,
        credentialId: opts.credentialId || '',
        passkeyPub: opts.passkeyPub || '',
      });
      return {
        address: account.address,
        mnemonic,
        wallet,
        created: false,
      };
    }
  }

  // generate may return a Promise or (rarely) a thenable — always wrap
  const wallet = await Promise.resolve(DirectSecp256k1HdWallet.generate(24, { prefix }));
  if (!wallet || typeof wallet.getAccounts !== 'function') {
    throw new Error('Wallet generate returned an invalid object');
  }

  const accounts = await Promise.resolve(wallet.getAccounts());
  const account = accounts?.[0];
  if (!account?.address) throw new Error('Generated wallet has no address');

  // Prefer public mnemonic getter; fall back if implementation differs
  const mnemonic =
    typeof wallet.mnemonic === 'string'
      ? wallet.mnemonic
      : wallet.secret?.toString?.() || null;

  if (!mnemonic) {
    throw new Error('Could not read mnemonic from generated wallet');
  }

  if (opts.credentialId && !opts.prfKey) {
    throw new Error('This passkey cannot seal the wallet. Unlock again, or use Keplr.');
  }
  await upsertRosterEntry({
    mnemonic,
    prefix,
    address: account.address,
    prfKey: opts.prfKey || null,
    credentialId: opts.credentialId || '',
    passkeyPub: opts.passkeyPub || '',
  });
  return {
    address: account.address,
    mnemonic,
    wallet,
    created: true,
  };
}

export function clearBrowserWallet() {
  try { localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function peekBrowserWalletAddress() {
  migrateBrowserWalletStore();
  try {
    return localStorage.getItem(ACTIVE_KEY) || readRoster()[0]?.address || null;
  } catch {
    return readRoster()[0]?.address || null;
  }
}

/**
 * Request test funds (when faucet is available).
 * @param {string} address
 * @param {string} [faucetBase]
 */
export async function requestFaucet(address, faucetBase = 'https://faucet.terp.network') {
  const res = await fetch(
    `${faucetBase.replace(/\/$/, '')}/faucet?address=${encodeURIComponent(address)}`
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Faucet error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}


/**
 * In-browser secondary secp256k1 key for the passkey AllOf authenticator.
 * One per account. Sealed with the passkey PRF exactly like sealed roster wallets
 * (AES-GCM, aad = credentialId|passkeyPub). Without a PRF key it falls back to the
 * unsealed form and is re-sealed the next time a PRF key is passed.
 * Returns { pubkey (base64, 33-byte compressed), address, wallet, sealed }.
 */
const SECONDARY_PREFIX = 'pm.passkey.secondary.v1.';
function readSecondary(account) {
  try {
    const raw = localStorage.getItem(SECONDARY_PREFIX + account) || '';
    if (!raw) return null;
    if (raw.trim().startsWith('{')) return JSON.parse(raw);
    return { mnemonic: raw }; // legacy unsealed (preview builds before sealing)
  } catch { return null; }
}
function writeSecondary(account, rec) {
  try { localStorage.setItem(SECONDARY_PREFIX + account, JSON.stringify(rec)); } catch { /* session only */ }
}
export async function ensureSecondaryKey(account, opts = {}) {
  const prefix = opts.prefix || 'terp';
  const DirectSecp256k1HdWallet = await loadHdWalletClass();
  const prev = readSecondary(account);
  let mnemonic = prev?.mnemonic || '';
  if (!mnemonic && prev?.sealed) {
    if (!opts.prfKey) throw new Error('Unlock the passkey to open the secondary key');
    mnemonic = await openMnemonic(prev.sealed, opts.prfKey);
  }
  const wallet = mnemonic
    ? await Promise.resolve(DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix }))
    : await Promise.resolve(DirectSecp256k1HdWallet.generate(24, { prefix }));
  if (!mnemonic) mnemonic = wallet.mnemonic;
  const [acct] = await Promise.resolve(wallet.getAccounts());
  let bin = ''; for (const b of acct.pubkey) bin += String.fromCharCode(b);
  const pubkey = btoa(bin);
  if (opts.prfKey) {
    const sealed = await sealMnemonic(mnemonic, opts.prfKey,
      opts.credentialId || prev?.sealed?.credentialId || '', opts.passkeyPub || prev?.sealed?.passkeyPub || '');
    writeSecondary(account, { v: 1, account, pubkey, address: acct.address, sealed });
  } else if (!prev?.sealed) {
    writeSecondary(account, { v: 1, account, pubkey, address: acct.address, mnemonic });
  }
  return { pubkey, address: acct.address, wallet, sealed: !!(opts.prfKey || prev?.sealed) };
}

/**
 * Export the secondary key. Default: the sealed record (still encrypted; restore needs
 * the same passkey). With { reveal: true, prfKey } it opens the seal and returns the
 * 24 words — same rule as sealed roster wallets: no PRF, no plaintext.
 */
export async function exportSecondaryKey(account, opts = {}) {
  const rec = readSecondary(account);
  if (!rec) throw new Error('No secondary key for this account on this device');
  if (!opts.reveal) {
    if (!rec.sealed) throw new Error('Secondary key is not sealed yet. Unlock the passkey once to seal it.');
    return { kind: 'pm-passkey-secondary', v: 1, account, pubkey: rec.pubkey, address: rec.address, sealed: rec.sealed };
  }
  if (!rec.sealed) throw new Error('Seal the secondary key with the passkey before export');
  if (!opts.prfKey) throw new Error('Unlock the passkey to reveal the secondary key');
  return { account, address: rec.address, mnemonic: await openMnemonic(rec.sealed, opts.prfKey) };
}

/** Same export for a sealed roster wallet (the ephemeral account). */
export async function exportBrowserWallet(address, opts = {}) {
  const rec = readRoster().find((w) => w.address === address);
  if (!rec) throw new Error('No wallet for this address on this device');
  if (!opts.reveal) {
    if (!rec.sealed) throw new Error('Wallet is not sealed with a passkey');
    return { kind: 'pm-browser-wallet', v: 1, address, prefix: rec.prefix, sealed: rec.sealed };
  }
  if (!rec.sealed) throw new Error('Seal the wallet with the passkey before export');
  if (!opts.prfKey) throw new Error('Unlock the passkey to reveal this wallet');
  return { address, mnemonic: await openMnemonic(rec.sealed, opts.prfKey) };
}

/** Restore a sealed export file onto this device (still sealed). */
export function importSealedExport(file) {
  if (file?.kind === 'pm-passkey-secondary' && file.sealed && file.account) {
    writeSecondary(file.account, { v: 1, account: file.account, pubkey: file.pubkey, address: file.address, sealed: file.sealed });
    return { kind: file.kind, account: file.account };
  }
  if (file?.kind === 'pm-browser-wallet' && file.sealed && file.address) {
    const rec = { prefix: file.prefix || 'terp', address: file.address, label: shortWalletLabel(file.address), createdAt: Date.now(), sealed: file.sealed };
    writeRoster([rec, ...readRoster().filter((w) => w.address !== file.address)]);
    return { kind: file.kind, address: file.address };
  }
  throw new Error('Not a sealed permissionless export');
}
