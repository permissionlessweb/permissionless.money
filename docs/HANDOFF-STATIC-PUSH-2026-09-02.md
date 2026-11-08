# Handoff — push Cosmic Web dist (2026-09-02)

**To:** Phase G / oline static-edge (you push objects)  
**From:** Cosmic Web static HTML  
**Tree (already built):** `websites/permissionless.money/dist/` — `pages/` + `lib/` + `public/` **together**. `npm run build` / `node build.js` passed `verify-mint-libs`. **usb2 success ≠ live site.**

---

## Paragraph (paste)

Publish this generation to the **oline Phase G** bucket only: `static/permissionless.money/dist/` (path-style, then `mc anonymous set download`). Mirror the **whole** `dist/` (`pages/` **and** `lib/` **and** `public/`) — HTML-only uploads leave a mixed `onboard-client.js` and kill mint sliders. Do **not** use groot2 `usb2`, `static/permissionless/pages/`, or `manage close`. This build fetches **one** cw-orch file at `https://s3.terp.network/snapshots/mainnet/morocco-1/state.json` (same object on minio.terp.network); `dist/public/` must **not** contain `state.json` or `terp-state.json`. After mirror: `mc cat …/lib/cw-orch-state.js` has that S3 URL; `…/lib/dregg-svg-checkout.js` exports `payOpenFromHealth`; `…/lib/onboard-client.js` still exports `attachPasskeyWithGrant`; `…/pages/mint.html` has `LIVE_RAILS` and `payOpenFromHealth`. Origin `Host: permissionless.money` `/mint` then public https://permissionless.money/mint — `Last-Modified` after this upload (if it stays 24 Aug 2026, origin is still the old object). Live rails stay **ZEC + native**; hide Pay when DREGG `zec_tip.ok === false`. Passkey code id comes from that state.json (`terp-passkey` **84**), not 120u-1 **4**, and not `noncircuit-auth` smoke addrs.

---

## Commands

```bash
# alias = Phase G static edge, NOT usb2
mc mirror --overwrite \
  websites/permissionless.money/dist/ \
  <edge-alias>/static/permissionless.money/dist/
mc anonymous set download <edge-alias>/static

mc cat <edge-alias>/static/permissionless.money/dist/lib/onboard-client.js \
  | grep -q 'export async function attachPasskeyWithGrant'
mc cat <edge-alias>/static/permissionless.money/dist/lib/cw-orch-state.js \
  | grep -q 's3.terp.network/snapshots/mainnet/morocco-1/state.json'
mc stat <edge-alias>/static/permissionless.money/dist/public/state.json && echo FAIL_slim_state
```

Do **not** change CF orange / SSL unless origin Host map already 200. Full gold keys: `crates/dregg/svg-mint/HANDOFF-OLINE-STATIC-MINT.md`.
