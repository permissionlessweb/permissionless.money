// lib/mint-svg.js — execute cw721_svg mint on the collection. Not the minter.
// Ship rails: native TERP/THIOL + ZEC (ZIP-321). ETH/Base/BTC parked.

import { executeWithSmartAccount } from '/lib/smart-account-tx.js';
import { loadCwOrchState, TERP_MAINNET } from '/lib/cw-orch-state.js';

/** Live hopalong collection is code 71. Minter svg_code_id is 83 (new collections). */
export const SVG_CODE_ID = 83;
export const SVG_MINTER_CODE_ID = 72;
export const LIVE_COLLECTION_CODE_ID = 71;
export const NATIVE_MINT_AMOUNT = '100000000';

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
    rpc: 'https://rpc.terp.network',
    rest: 'https://api.terp.network',
    denom: 'uthiol',
    gasPrice: '0.025uthiol',
    collection: 'terp1vp7smemrv846hpsyqrzlnqapmu3sv7hyygf4rrnw3ls26ezk864qupr5zt',
    minter: 'terp188jpppxtfpf0vvt5gypdj52hk2xuswwcn38auczzxv20fcxz3kss9fhlru',
    svgCodeId: SVG_CODE_ID,
    minterCodeId: SVG_MINTER_CODE_ID,
    liveCollectionCodeId: LIVE_COLLECTION_CODE_ID,
  },
};

let stateLoaded = false;

/** Overlay CHAINS from the published cw-orch S3 state.json. */
export async function loadTerpState() {
  if (stateLoaded) return CHAINS;
  const st = await loadCwOrchState({ chainId: TERP_MAINNET });
  const m = CHAINS[TERP_MAINNET];
  if (st.default?.cw721_svg) m.collection = st.default.cw721_svg;
  if (st.default?.['cw-svg-minter']) m.minter = st.default['cw-svg-minter'];
  if (st.codeIds?.cw721_svg) m.svgCodeId = st.codeIds.cw721_svg;
  if (st.codeIds?.['cw-svg-minter']) m.minterCodeId = st.codeIds['cw-svg-minter'];
  m.passkeyCodeId = st.passkeyCodeId;
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
  try {
    const stored = localStorage.getItem('pm-minter');
    if (stored && stored.startsWith('terp1')) return stored;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.__CW721_CONTRACT__) {
    return window.__CW721_CONTRACT__;
  }
  return chain.collection || '';
}

function b64query(obj) {
  return btoa(JSON.stringify(obj));
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
  return data.tokens || data.ids || [];
}

/** Paid mint on live code-71 collection. Do not migrate minter code 72. */
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
  const paid = funds && funds.length
    ? funds
    : nativeMintFunds(denom);

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
