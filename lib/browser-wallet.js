// lib/browser-wallet.js — ephemeral in-browser HD wallet for demos.
// Session-scoped only (sessionStorage). Not for long-term custody.
//
// Loads CosmJS from jsDelivr +esm (more reliable than bare esm.sh for named exports).
// StacksProvider / installHook errors from browser extensions are unrelated noise.

const STORAGE_KEY = 'pm-demo-wallet-v1';
const ROSTER_KEY = 'pm-demo-wallets-v1';
const ACTIVE_KEY = 'pm-demo-wallet-active';

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

function upsertRosterEntry({ mnemonic, prefix, address, label }) {
  if (!mnemonic || !address) return;
  const prev = readRoster().find((w) => w.address === address);
  const rec = {
    mnemonic,
    prefix: prefix || 'terp',
    address,
    label: label || prev?.label || shortWalletLabel(address),
    createdAt: prev?.createdAt || Date.now(),
  };
  writeRoster([rec, ...readRoster().filter((w) => w.address !== address)]);
  try { localStorage.setItem(ACTIVE_KEY, address); } catch { /* ignore */ }
}

/** sessionStorage v1 → localStorage roster. Safe to call often. */
export function migrateBrowserWalletStore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.mnemonic && o?.address) upsertRosterEntry(o);
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
    if (existing?.mnemonic) {
      const wallet = await Promise.resolve(
        DirectSecp256k1HdWallet.fromMnemonic(existing.mnemonic, { prefix })
      );
      if (!wallet || typeof wallet.getAccounts !== 'function') {
        throw new Error('Restored wallet is invalid');
      }
      const accounts = await Promise.resolve(wallet.getAccounts());
      const account = accounts?.[0];
      if (!account?.address) throw new Error('No account on restored wallet');
      upsertRosterEntry({
        mnemonic: existing.mnemonic,
        prefix,
        address: account.address,
        label: existing.label,
      });
      return {
        address: account.address,
        mnemonic: existing.mnemonic,
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

  upsertRosterEntry({ mnemonic, prefix, address: account.address });
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
