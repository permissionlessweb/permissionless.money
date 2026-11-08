// CosmWasm execute via Keplr / local HD signer. Native mint on the collection.

const STARGATE_URLS = [
  'https://esm.sh/@cosmjs/cosmwasm-stargate@0.32.4?bundle',
  'https://cdn.jsdelivr.net/npm/@cosmjs/cosmwasm-stargate@0.32.4/+esm',
];


// morocco-1 runs CometBFT 0.39. CosmJS 0.32 connectWithSigner() only knows 0.37/0.38 and falls
// back to the Tendermint 0.34 client, which base64-decodes plain-string event attributes after a
// committed tx: "Invalid string. Length must be a multiple of 4". Use the Comet38 client explicitly.
const TM_RPC_URLS = [
  'https://esm.sh/@cosmjs/tendermint-rpc@0.32.4?bundle',
  'https://cdn.jsdelivr.net/npm/@cosmjs/tendermint-rpc@0.32.4/+esm',
];
async function connectCometSigning(Client, rpc, wallet, opts) {
  let last;
  for (const url of TM_RPC_URLS) {
    try {
      const mod = await import(/* @vite-ignore */ url);
      const C38 = mod.Comet38Client || mod.default?.Comet38Client;
      if (C38 && typeof Client.createWithSigner === 'function') {
        const comet = await C38.connect(rpc);
        return Client.createWithSigner(comet, wallet, opts);
      }
    } catch (e) { last = e; }
  }
  console.warn('Comet38 client unavailable, falling back', last);
  return Client.connectWithSigner(rpc, wallet, opts);
}

async function loadSigningClient() {
  let last;
  for (const url of STARGATE_URLS) {
    try {
      const mod = await import(/* @vite-ignore */ url);
      const C = mod.SigningCosmWasmClient || mod.default?.SigningCosmWasmClient;
      if (C && typeof C.connectWithSigner === 'function') return C;
      last = new Error(`SigningCosmWasmClient missing from ${url}`);
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`Could not load CosmJS: ${last?.message || last}`);
}

/**
 * @param {{
 *   chain: { rpc: string, gasPrice?: string },
 *   wallet: object,
 *   address: string,
 *   contract: string,
 *   msg: object,
 *   funds?: {denom:string,amount:string}[],
 *   memo?: string,
 * }} opts
 */
export async function executeWithSmartAccount(opts) {
  const { chain, wallet, address, contract, msg, funds, memo, feeGranter } = opts;
  if (!contract || !contract.startsWith('terp1')) {
    throw new Error('Mint execute is on the collection contract');
  }
  const mint = msg?.update_extension?.msg?.mint;
  if (mint == null || mint.amnt == null || mint.alloc == null) {
    throw new Error('Expected { update_extension: { msg: { mint: { amnt, proof_hashes, alloc, ext: null } } } }');
  }
  const SigningCosmWasmClient = await loadSigningClient();
  const gasPriceStr = chain.gasPrice || '0.025uthiol';
  let gasPrice = gasPriceStr;
  try {
    const stargate = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@cosmjs/stargate@0.32.4/+esm');
    const GP = stargate.GasPrice || stargate.default?.GasPrice;
    if (GP?.fromString) gasPrice = GP.fromString(gasPriceStr);
  } catch { /* string often accepted */ }
  const client = await connectCometSigning(SigningCosmWasmClient, chain.rpc, wallet, {
    gasPrice,
  });
  const granter = feeGranter && String(feeGranter).startsWith('terp1') ? String(feeGranter) : '';
  if (!granter) {
    return client.execute(address, contract, msg, 'auto', memo || '', funds || []);
  }
  const gasLimit = 450000;
  const price = Number(String(chain.gasPrice || '0.025uthiol').replace(/[^0-9.]/g, '')) || 0.025;
  const denom = chain.denom || 'uthiol';
  const fee = {
    amount: [{ denom, amount: String(Math.ceil(gasLimit * price)) }],
    gas: String(gasLimit),
    granter,
  };
  return client.execute(address, contract, msg, fee, memo || 'permissionless svg mint', funds || []);
}

const STARGATE_SIGN_URLS = [
  'https://esm.sh/@cosmjs/stargate@0.32.4?bundle',
  'https://cdn.jsdelivr.net/npm/@cosmjs/stargate@0.32.4/+esm',
];

export const ADD_AUTHENTICATOR_TYPE_URL = '/terp.smartaccount.v1beta1.MsgAddAuthenticator';

function concatBytes(parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function encodeVarint(value) {
  const bytes = [];
  let n = value >>> 0;
  while (n >= 0x80) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n);
  return Uint8Array.from(bytes);
}

function encodeLenDelimited(field, payload) {
  return concatBytes([
    encodeVarint((field << 3) | 2),
    encodeVarint(payload.length),
    payload,
  ]);
}

function utf8(s) {
  return new TextEncoder().encode(String(s || ''));
}

/** Minimal GeneratedType for MsgAddAuthenticator (sender, authenticator_type, data). */
export const MsgAddAuthenticatorType = {
  encode(message) {
    const parts = [];
    if (message.sender) parts.push(encodeLenDelimited(1, utf8(message.sender)));
    const typ = message.authenticatorType || message.authenticator_type;
    if (typ) parts.push(encodeLenDelimited(2, utf8(typ)));
    const data = message.data instanceof Uint8Array
      ? message.data
      : (message.data ? Uint8Array.from(message.data) : new Uint8Array());
    if (data.length) parts.push(encodeLenDelimited(3, data));
    const bytes = concatBytes(parts);
    return { finish: () => bytes };
  },
  decode() {
    return { sender: '', authenticatorType: '', data: new Uint8Array() };
  },
  fromPartial(object) {
    const data = object?.data;
    return {
      sender: object?.sender || '',
      authenticatorType: object?.authenticatorType || object?.authenticator_type || '',
      data: data instanceof Uint8Array ? data : (data ? Uint8Array.from(data) : new Uint8Array()),
    };
  },
};

async function loadSigningStargate() {
  let last;
  for (const url of STARGATE_SIGN_URLS) {
    try {
      const mod = await import(/* @vite-ignore */ url);
      const C = mod.SigningStargateClient || mod.default?.SigningStargateClient;
      if (C && typeof C.connectWithSigner === 'function') return { Client: C, GasPrice: mod.GasPrice };
      last = new Error(`SigningStargateClient missing from ${url}`);
    } catch (e) {
      last = e;
    }
  }
  try {
    const SigningCosmWasmClient = await loadSigningClient();
    return { Client: SigningCosmWasmClient, GasPrice: null };
  } catch (e) {
    throw new Error(`Could not load CosmJS stargate: ${last?.message || last}; wasm: ${e.message || e}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Sign and broadcast MsgAddAuthenticator, paying gas via fee.granter (HashMerchant).
 * Does not mint. The session-hd wallet signs; the granter covers fees.
 */
export async function signAddAuthenticator(opts) {
  const { chain, wallet, address, authenticatorType, data, granter, memo } = opts;
  if (!address || !address.startsWith('terp1')) throw new Error('AddAuthenticator needs a Terp sender');
  if (!granter || !granter.startsWith('terp1')) throw new Error('AddAuthenticator needs a fee granter');
  if (!authenticatorType) throw new Error('AddAuthenticator needs authenticator_type');
  if (!data || !data.length) throw new Error('AddAuthenticator needs data');
  if (!wallet) throw new Error('AddAuthenticator needs a local signer');

  const { Client, GasPrice } = await loadSigningStargate();
  const gasPriceStr = chain?.gasPrice || '0.025uthiol';
  const denom = chain?.denom || 'uthiol';
  const connectOpts = {};
  if (GasPrice && typeof GasPrice.fromString === 'function') {
    connectOpts.gasPrice = GasPrice.fromString(gasPriceStr);
  }
  const client = await connectCometSigning(Client, chain.rpc, wallet, connectOpts);
  if (client.registry && typeof client.registry.register === 'function') {
    client.registry.register(ADD_AUTHENTICATOR_TYPE_URL, MsgAddAuthenticatorType);
  }

  const msg = {
    typeUrl: ADD_AUTHENTICATOR_TYPE_URL,
    value: {
      sender: address,
      authenticatorType,
      data,
    },
  };

  const gasLimit = 400000;
  const price = Number(String(gasPriceStr).replace(/[^0-9.]/g, '')) || 0.025;
  const fee = {
    amount: [{ denom, amount: String(Math.ceil(gasLimit * price)) }],
    gas: String(gasLimit),
    granter,
  };

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await client.signAndBroadcast(address, [msg], fee, memo || '');
    } catch (e) {
      lastErr = e;
      const text = String(e?.message || e);
      if (attempt === 0 && /does not exist|account sequence|insufficient funds/i.test(text)) {
        await sleep(1800);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** GeneratedType for a message that is already protobuf-encoded: value = { bytes }. */
export const RawMsgType = {
  fromPartial: (v) => v,
  encode: (v) => ({ finish: () => v.bytes }),
  decode: (bytes) => ({ bytes }),
};

/**
 * Sign and broadcast pre-encoded messages ([{ typeUrl, bytes }]) with the local
 * (session-hd or extension) direct signer. `granter` is optional: with it the
 * fee comes from that feegrant, without it the account pays from its runway.
 */
export async function signRawMsgs({ chain, wallet, address, msgs, granter = null, gas = 350000, memo = '' }) {
  if (!address?.startsWith('terp1')) throw new Error('Needs a Terp sender');
  if (!wallet) throw new Error('Needs a local signer');
  if (!msgs?.length) throw new Error('Nothing to sign');
  const { Client, GasPrice } = await loadSigningStargate();
  const gasPriceStr = chain?.gasPrice || '0.025uthiol';
  const denom = chain?.denom || 'uthiol';
  const connectOpts = {};
  if (GasPrice?.fromString) connectOpts.gasPrice = GasPrice.fromString(gasPriceStr);
  const client = await connectCometSigning(Client, chain.rpc, wallet, connectOpts);
  for (const m of msgs) client.registry?.register?.(m.typeUrl, RawMsgType);
  const price = Number(String(gasPriceStr).replace(/[^0-9.]/g, '')) || 0.025;
  const fee = { amount: [{ denom, amount: String(Math.ceil(gas * price)) }], gas: String(gas), ...(granter ? { granter } : {}) };
  const body = msgs.map((m) => ({ typeUrl: m.typeUrl, value: { bytes: m.bytes } }));
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await client.signAndBroadcast(address, body, fee, memo);
      if (r?.code) throw new Error(r.rawLog || `tx failed (code ${r.code})`);
      return r;
    } catch (e) {
      lastErr = e;
      if (attempt === 0 && /does not exist|account sequence/i.test(String(e?.message || e))) { await sleep(1800); continue; }
      throw e;
    }
  }
  throw lastErr;
}


/**
 * Generic CosmWasm execute (marketplace + cw721 approve), one tx, many MsgExecuteContract.
 * Same Comet38 client path as the mint. instructions: [{ contract, msg, funds? }].
 */
export async function executeContractMsgs({ chain, wallet, address, instructions, memo = 'permissionless market' }) {
  if (!address?.startsWith('terp1')) throw new Error('Needs a Terp sender');
  if (!wallet) throw new Error('No offline signer');
  if (!instructions?.length) throw new Error('Nothing to sign');
  const SigningCosmWasmClient = await loadSigningClient();
  const gasPriceStr = chain?.gasPrice || '0.025uthiol';
  let gasPrice = gasPriceStr;
  try {
    const stargate = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@cosmjs/stargate@0.32.4/+esm');
    const GP = stargate.GasPrice || stargate.default?.GasPrice;
    if (GP?.fromString) gasPrice = GP.fromString(gasPriceStr);
  } catch { /* string often accepted */ }
  const client = await connectCometSigning(SigningCosmWasmClient, chain.rpc, wallet, { gasPrice });
  const ix = instructions.map((i) => ({ contractAddress: i.contract, msg: i.msg, funds: i.funds || [] }));
  return client.executeMultiple(address, ix, 'auto', memo);
}
