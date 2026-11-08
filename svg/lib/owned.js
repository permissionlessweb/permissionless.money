// Owned NFTs across collections. One data-source interface, two implementations:
//   chainSource(rpcUrl)   on-chain now: cw721 tokens{owner} + nft_info, sent as JSON-RPC batches (one HTTP POST per round)
//   indexerSource(url)    later: one GraphQL/REST call; drop in by setting cfg.owned.indexer. Falls back to chain on any error.
// A source returns [{ collection, name, tokens: [{ token_id, token_uri, extension }] }] and never throws for one bad collection.
import { h, modal, short, svgImg } from './collection.js';

const te = new TextEncoder(), td = new TextDecoder();
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const vint = (n) => { const o = []; while (n > 127) { o.push((n & 127) | 128); n >>>= 7; } o.push(n); return o; };
const fld = (no, b) => [(no << 3) | 2, ...vint(b.length), ...b];
function lenField1(buf) { let i = 0; while (i < buf.length) { let k = 0, s = 0, b; do { b = buf[i++]; k |= (b & 127) << s; s += 7; } while (b & 128);
  if ((k & 7) === 2) { let l = 0; s = 0; do { b = buf[i++]; l |= (b & 127) << s; s += 7; } while (b & 128); if (k >>> 3 === 1) return buf.slice(i, i + l); i += l; } else do { b = buf[i++]; } while (b & 128); } return new Uint8Array(); }

/** The one batching helper: many smart queries -> JSON-RPC batch POSTs (chunk per request). Result per item: {ok, data|error}. */
export async function batchSmart(rpcUrl, items, { chunk = 10, parallel = 4 } = {}) {
  // CometBFT caps a batch at 10 requests by default (max_batch_request_size), so chunk at 10 and run a few chunks at once.
  const out = new Array(items.length);
  const one = async (s) => {
    const part = items.slice(s, s + chunk);
    const body = part.map(([addr, msg], i) => ({ jsonrpc: '2.0', id: s + i, method: 'abci_query',
      params: { path: '/cosmwasm.wasm.v1.Query/SmartContractState', data: hex([...fld(1, te.encode(addr)), ...fld(2, te.encode(JSON.stringify(msg)))]) } }));
    let res;
    try { res = await (await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { res = { error: { message: e.message } }; }
    for (const r of Array.isArray(res) ? res : res?.result ? [res] : []) { // a one-item batch comes back unwrapped
      const q = r.result?.response; if (!(r.id >= s && r.id < s + part.length)) continue;
      if (!q || q.code) { out[r.id] = { ok: false, error: q?.log || r.error?.message || 'query failed' }; continue; }
      try { out[r.id] = { ok: true, data: JSON.parse(td.decode(lenField1(Uint8Array.from(atob(q.value || ''), (c) => c.charCodeAt(0))))) }; }
      catch (e) { out[r.id] = { ok: false, error: e.message }; }
    }
    for (let i = s; i < s + part.length; i++) out[i] ||= { ok: false, error: res?.error?.data || res?.error?.message || 'no answer' };
  };
  const starts = []; for (let s = 0; s < items.length; s += chunk) starts.push(s);
  for (let i = 0; i < starts.length; i += parallel) await Promise.all(starts.slice(i, i + parallel).map(one));
  return out;
}

/** On-chain source. Round 1: tokens{owner} for every collection; round 2: nft_info for every token found (both batched). */
export function chainSource(rpcUrl, { pageLimit = 100, maxPerCollection = 300 } = {}) {
  return { name: 'chain', async owned(owner, collections) {
    const out = collections.map((c) => ({ ...c, tokens: [], ids: [], after: undefined, done: false }));
    while (out.some((c) => !c.done)) {
      const live = out.filter((c) => !c.done);
      const res = await batchSmart(rpcUrl, live.map((c) => [c.collection, { tokens: { owner, limit: pageLimit, ...(c.after ? { start_after: c.after } : {}) } }]));
      live.forEach((c, i) => { const ids = res[i].ok ? res[i].data.tokens || [] : []; if (!res[i].ok) c.error = res[i].error;
        c.ids.push(...ids); c.after = ids[ids.length - 1]; c.done = ids.length < pageLimit || c.ids.length >= maxPerCollection; });
    }
    const flat = out.flatMap((c) => c.ids.map((id) => [c, id]));
    const info = await batchSmart(rpcUrl, flat.map(([c, id]) => [c.collection, { nft_info: { token_id: id } }]));
    flat.forEach(([c, id], i) => c.tokens.push({ token_id: id, token_uri: info[i].ok ? info[i].data.token_uri ?? null : null, extension: info[i].ok ? info[i].data.extension ?? null : null }));
    return out.map(({ collection, name, kind, tokens, error }) => ({ collection, name, kind, tokens, ...(error ? { error } : {}) }));
  } };
}

/** Indexer source (placeholder contract). Expected: GET {url}/owned/{owner}?collections=a,b -> same shape as chainSource. */
export function indexerSource(url) {
  return { name: 'indexer', async owned(owner, collections) {
    const r = await fetch(`${url.replace(/\/$/, '')}/owned/${owner}?collections=${collections.map((c) => c.collection).join(',')}`);
    if (!r.ok) throw new Error(`indexer ${r.status}`);
    const j = await r.json(); const byAddr = new Map((j.collections || j).map((c) => [c.collection, c]));
    return collections.map((c) => ({ ...c, tokens: byAddr.get(c.collection)?.tokens || [] }));
  } };
}
/** First source that answers wins; later ones are fallbacks. */
export function withFallback(...sources) {
  return { name: sources.map((s) => s.name).join('>'), async owned(owner, cols) {
    let last; for (const s of sources) { try { const r = await s.owned(owner, cols); r.source = s.name; return r; } catch (e) { last = e; } } throw last;
  } };
}
export function ownedSource(cfg) {
  const chain = chainSource(cfg.chain.rpc);
  return cfg.owned?.indexer ? withFallback(indexerSource(cfg.owned.indexer), chain) : chain;
}

/** Collections listed in config, grouped by page key. kind 'svg' renders through the svg_token_uri extension query. */
export function knownCollections(cfg, keys) {
  const C = cfg.collections || {}; const names = { marain: 'Marain orb', latentBenders: 'Latent Benders', yijing: 'Yi Jing Harmony', fractal: 'Fractal', interchainLogos: 'Interchain logos' };
  return keys.flatMap((k) => { const v = C[k]; if (!v) return [];
    if (typeof v === 'string') return [{ collection: v, name: names[k] || k, kind: 'svg' }];
    return Object.entries(v).filter(([n]) => !n.startsWith('_')).map(([n, a]) => ({ collection: a, name: `${names[k] || k} · ${n}`, kind: 'svg' })); });
}

/** "View owned" button beside the wallet; it fills on connect and reloads on an account switch. Opens the shared #detail modal. */
export function mountOwned(cfg, { wallet, collections, anchor, title = 'Owned here' }) {
  if (!anchor || !collections.length) return null;
  const src = ownedSource(cfg);
  const btn = h('button', { class: 'sq owned-btn', hidden: true, 'aria-haspopup': 'dialog' }, 'View owned');
  anchor.append(btn);
  let res = null, loading = null, who = null, isOpen = false;
  const load = (addr) => { who = addr; res = null; btn.textContent = 'View owned…';
    return (loading = src.owned(addr, collections).then((r) => { if (who !== addr) return; res = r; const n = r.reduce((a, c) => a + c.tokens.length, 0);
      btn.textContent = `View owned (${n})`; if (isOpen) show(); }).catch(() => { if (who === addr) btn.textContent = 'View owned (unavailable)'; })); };
  const svgCache = new Map();
  async function art(c, t) {
    if (c.kind !== 'svg') return h('div', { class: 'owned-ph' }, `#${t.token_id}`);
    const k = `${c.collection}/${t.token_id}`;
    if (!svgCache.has(k)) svgCache.set(k, batchSmart(cfg.chain.rpc, [[c.collection, { extension: { msg: { svg_token_uri: { token_id: t.token_id } } } }]]).then(([r]) => (r.ok ? r.data.svg : null)));
    const svg = await svgCache.get(k); return svg ? svgImg(svg, `${c.name} #${t.token_id}`) : h('div', { class: 'owned-ph' }, `#${t.token_id}`);
  }
  async function show() {
    isOpen = true; const m = modal();
    await m.open(title, async (body) => {
      body.classList.add('owned');
      if (!who) { body.append(h('p', { class: 'meta' }, 'Connect a wallet to see what you hold.')); return; }
      body.append(h('p', { class: 'meta owned-who' }, `${short(who)} · ${res ? `read from ${res.source || src.name}` : 'reading the chain…'}`));
      if (!res) { await loading; return; }
      const any = res.some((c) => c.tokens.length);
      if (!any) body.append(h('p', {}, 'Nothing from these collections in this account yet.'));
      for (const c of res) { if (!c.tokens.length && !c.error) continue;
        const grid = h('div', { class: 'grid owned-grid' });
        body.append(h('h3', {}, c.name, ' ', h('span', { class: 'meta' }, c.error ? 'could not read' : String(c.tokens.length))), grid);
        for (const t of c.tokens.slice(0, 60)) { const card = h('div', { class: 'card' }, h('div', { class: 'owned-art' }), h('div', { class: 't' }, h('span', {}, `#${t.token_id}`)));
          grid.append(card); art(c, t).then((el) => card.firstChild.replaceChildren(el)); }
        if (c.tokens.length > 60) body.append(h('p', { class: 'meta' }, `and ${c.tokens.length - 60} more`));
      }
    });
    const d = m.el; d.addEventListener('close', () => { isOpen = false; }, { once: true });
  }
  btn.onclick = show;
  const sync = () => { const a = wallet.address; btn.hidden = !a; if (!a) { who = null; res = null; return; } if (a !== who) load(a); };
  wallet.addEventListener('change', sync); wallet.addEventListener('account-switch', sync); sync();
  return { reload: () => who && load(who), get result() { return res; } };
}
