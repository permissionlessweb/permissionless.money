// CosmWasm execute via Keplr / local HD signer. Native mint on the collection.

const STARGATE_URLS = [
  'https://esm.sh/@cosmjs/cosmwasm-stargate@0.32.4?bundle',
  'https://cdn.jsdelivr.net/npm/@cosmjs/cosmwasm-stargate@0.32.4/+esm',
];

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
  const { chain, wallet, address, contract, msg, funds, memo } = opts;
  if (!contract || !contract.startsWith('terp1')) {
    throw new Error('Mint execute is on the collection contract');
  }
  const mint = msg?.update_extension?.msg?.mint;
  if (mint == null || mint.amnt == null || mint.alloc == null) {
    throw new Error('Expected { update_extension: { msg: { mint: { amnt, proof_hashes, alloc, ext: null } } } }');
  }
  const SigningCosmWasmClient = await loadSigningClient();
  const gasPrice = chain.gasPrice || '0.025uthiol';
  const client = await SigningCosmWasmClient.connectWithSigner(chain.rpc, wallet, {
    gasPrice,
  });
  return client.execute(address, contract, msg, 'auto', memo || '', funds || []);
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
  const client = await Client.connectWithSigner(chain.rpc, wallet, connectOpts);
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
