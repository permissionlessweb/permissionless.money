// lib/demos/norick.js — No-Rick selective disclosure demo (minimal UI).
// Details live in the shell "?" info panel. Body is controls only.

import { loadWasm, generateProof, encodeProofMsg, isWasmReady } from '../norick.js';
import {
  ensureBrowserWallet,
  clearBrowserWallet,
  peekBrowserWalletAddress,
  requestFaucet,
} from '../browser-wallet.js';

const FORBIDDEN = 'rick';
const CIRCUIT_CODE_ID = 1;
const DEFAULT_CHAIN = {
  chainId: 'morocco-1',
  chainName: 'Terp Network',
  rpc: 'https://rpc.terp.network',
  rest: 'https://api.terp.network',
  denom: 'uthiol',
  denomDisplay: 'THIOL',
  bech32Prefix: 'terp',
  gasPrice: '0.025uthiol',
  contracts: { zkWasmvmTest: '' },
};

const norickDemo = {
  id: 'norick',
  title: 'No Rick',
  kicker: 'Trustless selective disclosure · on-chain',
  infoTitle: 'What is No Rick demonstrating?',
  infoHtml: `
    <p>
      Apps where you can prove something is true <strong style="color:#b1ebeb;font-weight:500;">without
      handing over the private details</strong> — and where anyone can check that claim on a
      public chain, without trusting a company or a server to “believe you.”
    </p>
    <p>
      That pattern <strong style="color:#b1ebeb;font-weight:500;">complements Zcash’s existing designs</strong>
      for private voting and selective disclosure: you choose what to reveal (here: only that your secret is
      <em>not</em> the forbidden word), keep the rest private, and the network verifies it —
      proof in the browser, check on-chain via the same proof-verification VM path.
    </p>
    <p>
      Pick any word except <code style="color:#ff5555;">rick</code>. A valid proof earns
      <strong style="color:#50fa7b;">RANDY</strong>; the forbidden word fails and earns
      <strong style="color:#ff5555;">RICK</strong>. Toy rules, real shape for freer apps.
    </p>
    <p style="color:#6272a4;font-size:0.95rem;margin-bottom:0;">
      Throwaway browser wallet (sessionStorage only). Demo / education — not a finished privacy product.
      Also at terp.network/no-rick.
    </p>
  `,
  pills: [
    { label: 'Mainnet path', tone: 'live' },
    { label: 'Client-side prove' },
    { label: 'On-chain verify' },
  ],
  footer: 'Configure contract via ?contract=terp1… or localStorage zk-wasmvm-test when minting on-chain.',

  async mount(el, ctx) {
    const chain = {
      ...DEFAULT_CHAIN,
      ...(ctx.config || {}),
      contracts: {
        ...DEFAULT_CHAIN.contracts,
        ...(ctx.config?.contracts || {}),
      },
    };

    try {
      const q = new URLSearchParams(location.search).get('contract');
      const stored = localStorage.getItem('zk-wasmvm-test');
      if (q) chain.contracts.zkWasmvmTest = q;
      else if (stored && !chain.contracts.zkWasmvmTest) {
        chain.contracts.zkWasmvmTest = stored;
      }
    } catch {
      /* ignore */
    }

    const contractAddr = chain.contracts.zkWasmvmTest || '';
    const hasContract = !!contractAddr;

    el.innerHTML = `
      <style>
        .nr { display: flex; flex-direction: column; gap: 0.95rem; }
        .nr-forbidden-row {
          display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
        }
        .nr-muted {
          font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; color: #6272a4;
        }
        .nr-forbidden {
          font-weight: 600; font-size: 1.1rem; letter-spacing: 0.06em;
          color: #ff5555; padding: 0.28rem 0.65rem; border-radius: 6px;
          border: 1px solid rgba(255,85,85,0.3); background: rgba(255,85,85,0.08);
        }
        .nr-wallet-row {
          display: flex; align-items: center; gap: 0.45rem;
        }
        .nr-addr {
          flex: 1; min-width: 0; font-family: ui-monospace, monospace; font-size: 0.85rem;
          color: #50fa7b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          background: rgba(0,0,0,0.3); border: 1px solid rgba(80,250,123,0.12);
          border-radius: 6px; padding: 0.55rem 0.65rem;
        }
        .nr-addr.empty { color: #6272a4; }
        .nr-icon-btn {
          width: 40px; height: 40px; flex-shrink: 0; border-radius: 8px; cursor: pointer;
          border: 1px solid rgba(189,147,249,0.3); background: rgba(189,147,249,0.08);
          color: #bd93f9; font-size: 1.1rem; line-height: 1; font-family: inherit;
        }
        .nr-icon-btn:hover { background: rgba(189,147,249,0.18); }
        .nr-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .nr-input {
          width: 100%; padding: 0.75rem 0.85rem; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.35);
          color: #f8f8f2; font-family: inherit; font-size: 1.05rem;
        }
        .nr-input:focus { outline: none; border-color: rgba(189,147,249,0.5); }
        .nr-input:disabled { opacity: 0.5; }
        .nr-rewards {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem;
        }
        .nr-card {
          border-radius: 8px; padding: 0.7rem 0.7rem; text-align: center;
          border: 1px solid rgba(255,255,255,0.07); background: rgba(0,0,0,0.22);
        }
        .nr-card.randy { border-color: rgba(80,250,123,0.2); }
        .nr-card.rick { border-color: rgba(255,85,85,0.2); }
        .nr-card .tok { font-weight: 600; font-size: 1rem; }
        .nr-card.randy .tok { color: #50fa7b; }
        .nr-card.rick .tok { color: #ff5555; }
        .nr-card .bal {
          font-size: 0.85rem; color: #6272a4; margin-top: 0.25rem;
          font-family: ui-monospace, monospace; min-height: 1em;
        }
        .nr-card.highlight {
          box-shadow: 0 0 16px rgba(189,147,249,0.15);
        }
        .nr-btn {
          width: 100%; padding: 0.8rem 0.9rem; border-radius: 8px; cursor: pointer;
          border: none; font-family: inherit; font-size: 1.05rem; font-weight: 600;
          background: #bd93f9; color: #08090d;
        }
        .nr-btn:hover:not(:disabled) { filter: brightness(1.05); }
        .nr-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .nr-pipeline {
          display: none; align-items: center; gap: 0.35rem;
          font-size: 0.85rem; color: #6272a4;
        }
        .nr-pipeline.show { display: flex; }
        .nr-step {
          flex: 1; text-align: center; padding: 0.45rem 0.25rem; border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .nr-step.active { border-color: rgba(189,147,249,0.45); color: #bd93f9; }
        .nr-step.done { border-color: rgba(80,250,123,0.4); color: #50fa7b; }
        .nr-step.error { border-color: rgba(255,85,85,0.45); color: #ff5555; }
        .nr-line { width: 10px; height: 1px; background: rgba(255,255,255,0.12); flex-shrink: 0; }
        .nr-status {
          font-size: 0.95rem; color: #6272a4; min-height: 1.2em; text-align: center;
        }
        .nr-status.ok { color: #98e8c1; }
        .nr-status.err { color: #ff5555; }
        .nr-verdict {
          text-align: center; font-weight: 700; font-size: 1.2rem;
        }
        .nr-verdict.randy { color: #50fa7b; }
        .nr-verdict.rick { color: #ff5555; }
        .nr-tx {
          font-size: 0.8rem; color: #6272a4; word-break: break-all;
          font-family: ui-monospace, monospace; text-align: center; margin-top: 0.25rem;
        }
      </style>

      <div class="nr">
        <div class="nr-forbidden-row">
          <span class="nr-muted">Forbidden</span>
          <span class="nr-forbidden">${FORBIDDEN}</span>
        </div>

        <div class="nr-wallet-row">
          <div class="nr-addr empty" id="nr-addr" title="Session wallet">No wallet</div>
          <button type="button" class="nr-icon-btn" id="nr-gen-wallet" title="Generate wallet" aria-label="Generate wallet">⊕</button>
          <button type="button" class="nr-icon-btn" id="nr-faucet" title="Faucet" aria-label="Request faucet gas" disabled>💧</button>
          <button type="button" class="nr-icon-btn" id="nr-reset-wallet" title="New wallet" aria-label="Reset wallet" disabled>↺</button>
        </div>

        <input class="nr-input" id="nr-secret" type="text" maxlength="20" autocomplete="off"
          placeholder="Secret word (not rick)" disabled />

        <div class="nr-rewards">
          <div class="nr-card randy" id="nr-randy-card">
            <div class="tok">+1 RANDY</div>
            <div class="bal" id="nr-randy-bal"></div>
          </div>
          <div class="nr-card rick" id="nr-rick-card">
            <div class="tok">+1 RICK</div>
            <div class="bal" id="nr-rick-bal"></div>
          </div>
        </div>

        <button type="button" class="nr-btn" id="nr-prove" disabled>Prove &amp; submit</button>

        <div class="nr-pipeline" id="nr-pipeline">
          <div class="nr-step" id="nr-step-prove">Prove</div>
          <div class="nr-line"></div>
          <div class="nr-step" id="nr-step-broadcast">Broadcast</div>
          <div class="nr-line"></div>
          <div class="nr-step" id="nr-step-confirm">Confirm</div>
        </div>

        <div class="nr-status" id="nr-status">Loading prover…</div>
        <div id="nr-verdict"></div>
      </div>
    `;

    const $ = (sel) => el.querySelector(sel);
    const statusEl = $('#nr-status');
    const addrEl = $('#nr-addr');
    const proveBtn = $('#nr-prove');
    const secretInput = $('#nr-secret');
    const faucetBtn = $('#nr-faucet');
    const resetBtn = $('#nr-reset-wallet');
    const genBtn = $('#nr-gen-wallet');

    /** @type {{ address: string, wallet: object } | null} */
    let session = null;
    let randyBal = 0;
    let rickBal = 0;

    const w = await loadWasm();
    if (w) {
      statusEl.textContent = hasContract
        ? 'Ready — generate a wallet'
        : 'Ready — proofs work; set contract to mint';
      statusEl.className = 'nr-status ok';
    } else {
      statusEl.textContent = 'WASM unavailable';
      statusEl.className = 'nr-status err';
    }

    function setStep(id, state) {
      const node = el.querySelector(id);
      if (node) node.className = `nr-step ${state || ''}`.trim();
    }

    function shortAddr(a) {
      if (!a || a.length < 16) return a || 'No wallet';
      return `${a.slice(0, 10)}…${a.slice(-6)}`;
    }

    function updateProveEnabled() {
      const word = secretInput.value.trim();
      proveBtn.disabled = !isWasmReady() || !session?.address || !word;
    }

    async function paintWallet(created) {
      if (!session) {
        addrEl.textContent = 'No wallet';
        addrEl.title = '';
        addrEl.className = 'nr-addr empty';
        secretInput.disabled = true;
        faucetBtn.disabled = true;
        resetBtn.disabled = true;
        updateProveEnabled();
        return;
      }
      addrEl.textContent = shortAddr(session.address);
      addrEl.title = session.address;
      addrEl.className = 'nr-addr';
      secretInput.disabled = false;
      faucetBtn.disabled = false;
      resetBtn.disabled = false;
      statusEl.textContent = created ? 'Wallet ready' : 'Wallet restored';
      statusEl.className = 'nr-status ok';
      updateProveEnabled();
      await fetchBalances();
    }

    async function createWallet(forceNew = false) {
      try {
        statusEl.textContent = 'Generating…';
        statusEl.className = 'nr-status';
        genBtn.disabled = true;
        const res = await ensureBrowserWallet({
          prefix: chain.bech32Prefix || 'terp',
          forceNew,
        });
        session = { address: res.address, wallet: res.wallet };
        await paintWallet(res.created || forceNew);
      } catch (e) {
        statusEl.textContent = e.message || String(e);
        statusEl.className = 'nr-status err';
      } finally {
        genBtn.disabled = false;
      }
    }

    async function fetchBalances() {
      if (!session?.address || !contractAddr || !chain.rest) {
        $('#nr-randy-bal').textContent = '';
        $('#nr-rick-bal').textContent = '';
        return;
      }
      const query = async (denom) => {
        try {
          const url = `${chain.rest}/cosmos/bank/v1beta1/balances/${session.address}/by_denom?denom=${encodeURIComponent(denom)}`;
          const res = await fetch(url);
          if (!res.ok) return 0;
          const json = await res.json();
          return parseInt(json.balance?.amount || '0', 10);
        } catch {
          return 0;
        }
      };
      randyBal = await query(`factory/${contractAddr}/randy`);
      rickBal = await query(`factory/${contractAddr}/rick`);
      $('#nr-randy-bal').textContent = String(randyBal);
      $('#nr-rick-bal').textContent = String(rickBal);
    }

    genBtn.addEventListener('click', () => createWallet(false));
    resetBtn.addEventListener('click', () => {
      clearBrowserWallet();
      session = null;
      createWallet(true);
    });
    faucetBtn.addEventListener('click', async () => {
      if (!session?.address) return;
      try {
        faucetBtn.disabled = true;
        statusEl.textContent = 'Faucet…';
        statusEl.className = 'nr-status';
        const res = await requestFaucet(session.address);
        statusEl.textContent = res.txhash ? 'Faucet funded' : 'Faucet submitted';
        statusEl.className = 'nr-status ok';
      } catch (e) {
        statusEl.textContent = e.message || String(e);
        statusEl.className = 'nr-status err';
      } finally {
        faucetBtn.disabled = false;
      }
    });
    secretInput.addEventListener('input', updateProveEnabled);

    proveBtn.addEventListener('click', async () => {
      const word = secretInput.value.trim();
      if (!word || !session) return;

      proveBtn.disabled = true;
      const pipeline = $('#nr-pipeline');
      pipeline.classList.add('show');
      ['#nr-step-prove', '#nr-step-broadcast', '#nr-step-confirm'].forEach((id) =>
        setStep(id, '')
      );
      $('#nr-verdict').innerHTML = '';
      statusEl.className = 'nr-status';

      try {
        setStep('#nr-step-prove', 'active');
        statusEl.textContent = 'Proving…';
        const proofB64 = generateProof(word, FORBIDDEN);
        setStep('#nr-step-prove', 'done');

        if (!hasContract) {
          statusEl.textContent = 'Proof ok — set contract to broadcast';
          statusEl.className = 'nr-status ok';
          setStep('#nr-step-broadcast', 'error');
          return;
        }

        setStep('#nr-step-broadcast', 'active');
        statusEl.textContent = 'Broadcasting…';

        const msgJson = encodeProofMsg(CIRCUIT_CODE_ID, FORBIDDEN, proofB64);
        const execMsg = JSON.parse(msgJson);

        const { SigningCosmWasmClient } = await import(
          'https://cdn.jsdelivr.net/npm/@cosmjs/cosmwasm-stargate@0.32.4/+esm'
        );
        const { GasPrice } = await import(
          'https://cdn.jsdelivr.net/npm/@cosmjs/stargate@0.32.4/+esm'
        );

        const client = await SigningCosmWasmClient.connectWithSigner(
          chain.rpc,
          session.wallet,
          { gasPrice: GasPrice.fromString(chain.gasPrice || '0.025uthiol') }
        );

        const result = await client.execute(
          session.address,
          contractAddr,
          execMsg,
          'auto',
          'no-rick proof (permissionless.money)'
        );

        setStep('#nr-step-broadcast', 'done');
        setStep('#nr-step-confirm', 'done');

        const isRick = word.toLowerCase() === FORBIDDEN;
        const verdict = $('#nr-verdict');
        if (result.code === 0 || !result.code) {
          verdict.innerHTML = `
            <div class="nr-verdict ${isRick ? 'rick' : 'randy'}">${isRick ? 'RICK' : 'RANDY'}</div>
            <div class="nr-tx">${result.transactionHash}</div>
          `;
          statusEl.textContent = 'Verified on-chain';
          statusEl.className = 'nr-status ok';
          const card = el.querySelector(isRick ? '#nr-rick-card' : '#nr-randy-card');
          card?.classList.add('highlight');
          setTimeout(() => card?.classList.remove('highlight'), 3000);
          await fetchBalances();
        } else {
          verdict.innerHTML = `<div class="nr-verdict rick">FAILED</div>`;
          statusEl.textContent = result.rawLog || `Code ${result.code}`;
          statusEl.className = 'nr-status err';
        }
      } catch (e) {
        ['#nr-step-prove', '#nr-step-broadcast', '#nr-step-confirm'].forEach((id) => {
          const n = el.querySelector(id);
          if (n?.classList.contains('active')) setStep(id, 'error');
        });
        statusEl.textContent = e.message || String(e);
        statusEl.className = 'nr-status err';
      } finally {
        updateProveEnabled();
      }
    });

    if (peekBrowserWalletAddress()) {
      try {
        const existing = await ensureBrowserWallet({
          prefix: chain.bech32Prefix || 'terp',
          forceNew: false,
        });
        session = { address: existing.address, wallet: existing.wallet };
        await paintWallet(false);
      } catch {
        /* ignore */
      }
    }

    return () => {
      session = null;
    };
  },
};

export default norickDemo;
