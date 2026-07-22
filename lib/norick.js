// lib/norick.js — No-Rick Halo2 proof client (WASM).
// Artifacts: /public/wasm/norick/norick_wasm.js + norick_wasm_bg.wasm

let wasm = null;
let wasmReady = false;

/**
 * Load norick-wasm (wasm-pack web target).
 * @param {string} [basePath] — directory containing norick_wasm.js (default public path)
 */
export async function loadWasm(basePath = '/public/wasm/norick') {
  if (wasmReady) return wasm;
  try {
    const base = basePath.replace(/\/$/, '');
    const mod = await import(`${base}/norick_wasm.js`);
    // wasm-pack default() resolves norick_wasm_bg.wasm next to the JS module
    await mod.default(`${base}/norick_wasm_bg.wasm`);
    wasm = mod;
    wasmReady = true;
    return wasm;
  } catch (e) {
    console.warn('[norick] WASM unavailable', e);
    return null;
  }
}

export function isWasmReady() {
  return wasmReady;
}

/**
 * Generate a halo2 proof that secretWord does not contain forbidden.
 * @returns {string} base64-encoded proof bytes
 */
export function generateProof(secretWord, forbidden) {
  if (!wasmReady) throw new Error('WASM not loaded');
  return wasm.generate_proof(secretWord, forbidden);
}

/**
 * Build JSON ExecuteMsg for the zk-wasmvm-test contract.
 */
export function encodeProofMsg(cid, forbidden, proofB64) {
  if (!wasmReady) throw new Error('WASM not loaded');
  return wasm.encode_proof_msg(BigInt(cid), forbidden, proofB64);
}
