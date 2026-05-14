// lib/queries.js — Batched, cached, throttled. No 100-query bombs.
// Cw721SvgQueryClient is imported at the page level and passed as `client` param.

const CACHE_PREFIX = 'terp-query-';
const TTL_MS = 300000; // 5min — WebAuthn session window.
const BATCH_SIZE = 10; // Throttle to avoid RPC bans.

export async function batchedQuery(client, queries) {
  const results = [];
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const batchRes = await Promise.all(batch.map(q => q().catch(e => ({ error: e.message }))));
    results.push(...batchRes);
    if (i + BATCH_SIZE < queries.length) await new Promise(r => setTimeout(r, 100));
  }
  return results.filter(r => !r.error);
}

export async function viewCollection(client, contractAddr, page = 0, limit = 100, owner = null) {
  const cacheKey = `${CACHE_PREFIX}view-${contractAddr}-${owner || 'all'}-${page}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, ts } = JSON.parse(cached);
    if (Date.now() - ts < TTL_MS) return data;
  }

  const startAfter = (page * limit).toString();
  const [allTokensRes, ownerTokensRes] = await Promise.all([
    client.allTokens({ startAfter, limit }).catch(() => ({ tokens: [] })),
    owner ? client.tokens({ owner, limit }).catch(() => ({ tokens: [] })) : Promise.resolve({ tokens: [] }),
  ]);
  const ids = owner ? ownerTokensRes.tokens : allTokensRes.tokens;

  const infoQueries = ids.map(id => () => client.nftInfo({ tokenId: id }));
  const infos = await batchedQuery(client, infoQueries);

  const data = { ids, infos, total: allTokensRes.tokens.length + (page * limit) };
  localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
  return data;
}

export async function prepareMintWorkflow(client, contractAddr, quantity, pricePer) {
  const summary = await fetchCollectionSummary(client, contractAddr);
  if (!summary || quantity > 10) throw new Error('Invalid: max 10 or no config');
  const totalCost = BigInt(quantity) * BigInt(pricePer);
  const gasEst = totalCost * 2n / 100n;
  return { summary, totalCost: totalCost.toString(), gasEst: gasEst.toString() };
}

export async function fetchRandomVars(client, count = 1) {
  const queries = Array.from({ length: count }, (_, i) =>
    () => client.extension({ msg: { get_random_params: { seed: Date.now() + i } } }),
  );
  const params = await batchedQuery(client, queries);
  return params.map(p => ({
    a: p.a || Math.random() * 4 - 2,
    b: p.b || Math.random() * 2 - 1,
  }));
}

async function fetchCollectionSummary(client) {
  // Query collection config — adapt contract address from caller context.
  try {
    return await client.extension({ msg: { get_config: {} } });
  } catch {
    return {};
  }
}
