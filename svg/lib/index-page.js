// Landing: one card per collection (art, mint state, count, price) read live from the chain. The fractal card sits in
// its own privacy category (it is paid through its own checkout); the interchain logos card sums its 13 collections.
import { $, h, loadConfig, Collection, walletBar } from "./collection.js";
import { mountOwned, knownCollections } from "./owned.js";
import { donateButton } from "./donate.js";
import { preflightBanner } from "./preflight.js";
import { readMintState, statePill, priceText, tierLines } from "./mint-state.js";
import { fractalCoverSvg } from "./fractal-cover.js?v=20261107a";

const svgSrc = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
async function fill(card, cfg, addr, tiered = false) {
  const slot = card.querySelector(".state-slot");
  if (!addr) { if (slot) slot.textContent = "not deployed yet"; return; }
  const col = new Collection(cfg, addr);
  try {
    const st = await readMintState(col);
    slot?.replaceWith(statePill(st));
    card.querySelector(".count").textContent = `${st.minted.toLocaleString("en-US")} of ${st.total.toLocaleString("en-US")} minted`;
    const t = tierLines(st);
    card.querySelector(".price").textContent = tiered ? `${t.now}, ${t.next}` : priceText(st);
  } catch { if (slot) slot.textContent = "network unreachable"; }
  if (tiered) {
    // Permissionless Fractals: the cover is a static frame of the collection's own renderer (the mint-page
    // hopalong, Classic form), never the on-chain placeholder template.
    try { card.querySelector(".art").replaceChildren(h("img", { src: svgSrc(fractalCoverSvg()), alt: "" })); } catch {}
    return;
  }
  try {
    const ids = await col.allTokens(undefined, 1).catch(() => []);
    const svg = ids[0] ? await col.svg(ids[0]) : (await col.ext({ svg_placeholder: {} })).svg;
    if (svg) card.querySelector(".art").replaceChildren(h("img", { src: svgSrc(svg), alt: "" }));
  } catch {}
}
// Series card: one card for many collections. Count is the sum; price is the lowest current tier.
async function fillSeries(card, cfg, addrs) {
  const slot = card.querySelector(".state-slot");
  if (!addrs.length) { slot.textContent = "not deployed yet"; return; }
  const sts = (await Promise.all(addrs.map((a) => readMintState(new Collection(cfg, a)).catch(() => null)))).filter(Boolean);
  if (!sts.length) { slot.textContent = "network unreachable"; return; }
  const open = sts.find((s) => s.state === "open") || sts[0];
  slot.replaceWith(statePill(open));
  const sum = (k) => sts.reduce((s, x) => s + x[k], 0).toLocaleString("en-US");
  card.querySelector(".count").textContent = `${sum("minted")} of ${sum("total")} minted`;
  const low = sts.filter((s) => s.price).sort((a, b) => Number(a.price.amount) - Number(b.price.amount))[0];
  card.querySelector(".price").textContent = low ? `from ${priceText(low)}` : priceText(open);
  try { const svg = (await new Collection(cfg, addrs[0]).ext({ svg_placeholder: {} })).svg; if (svg) card.querySelector(".art").replaceChildren(h("img", { src: svgSrc(svg), alt: "" })); } catch {}
}
async function main() {
  const cfg = await loadConfig(); donateButton(cfg);
  const live = preflightBanner(cfg).ready;
  const col0 = new Collection(cfg, "");
  // One wallet for the landing tab; View owned reads every SVG collection in one batched pass.
  if (live && $("#wallet")) { walletBar(col0, $("#wallet")); mountOwned(cfg, { wallet: col0.wallet, collections: knownCollections(cfg, ["marain", "latentBenders", "yijing", "fractal", "interchainLogos"]), anchor: $("#wallet"), title: "Your SVG collections" }); }
  try { const s = await col0.rpc.status(); $("#net").textContent = `chain ${cfg.chain.chainId} · block ${s.sync_info.latest_block_height}`; } catch { $("#net").textContent = `chain ${cfg.chain.chainId} · offline`; }
  const lb = Object.entries(cfg.collections?.latentBenders || {}).sort().pop()?.[1];
  const addr = { marain: cfg.collections?.marain, latentBenders: lb, yijing: cfg.collections?.yijing, fractal: cfg.collections?.fractal };
  const logos = Object.entries(cfg.collections?.interchainLogos || {}).filter(([k]) => !k.startsWith("_")).map(([, a]) => a);
  await Promise.all([...document.querySelectorAll(".col-card[data-col]")].map((c) => c.dataset.col === "interchainLogos"
    ? fillSeries(c, cfg, live ? logos : [])
    : fill(c, cfg, live ? addr[c.dataset.col] : null, c.dataset.col === "fractal")));
  document.body.dataset.ready = "1";
}
main();
