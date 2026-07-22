# Translation session review — rollup

**Date:** 2026-07-21  
**Baseline:** `locales/en/common.json` + `locales/en/zk.json`  
**Brief:** `locales/TRANSLATION_BRIEF.md`  
**Reviewers:** independent agents (not the original translators)

## Portuguese support

| Check | Status |
|-------|--------|
| `locales/pt/common.json` | Present, valid JSON |
| `locales/pt/zk.json` | Present, valid JSON, 92/92 keys |
| `lib/i18n.js` `AVAILABLE` | includes `pt` |
| `pages/zk.html` switcher | `<option value="pt">PT</option>` |
| Early bootstrap avail | includes `pt` |
| Live `https://permissionless.money/locales/pt/zk.json` | 200 |

**PT support status: READY** — open `/zk?lang=pt` or choose **PT** in the language switcher.

## Per-language verdicts

| Lang | Critical | Medium | Minor | Verdict | Report |
|------|----------|--------|-------|---------|--------|
| **es** | 0 | 5 | 8 | PASS / shippable | [es-review.md](./es-review.md) |
| **zh** | 0 | 6 | 8 | PASS / shippable | [zh-review.md](./zh-review.md) |
| **ja** | 0 | 6 | 8 | PASS / shippable | [ja-review.md](./ja-review.md) |
| **pt** | 0 | 6 | 7 | PASS / READY | [pt-review.md](./pt-review.md) |

**No critical defects** in any pack. JSON was not mutated by reviewers (critical-only policy).

## Cross-language themes (medium polish)

1. **“Settle” proofs** → often translated as payment *settle/liquidate* (ES *liquidarse*, PT *liquidar*, JA *決済*) — prefer “land / confirm / finalize claim” sense.
2. **“Claim”** (ZK disclosure claim) → complaint/assertion ambiguity (JA クレーム, PT English residue *claim*, ZH 主张).
3. **“Event plane / control plane”** → calques (ZH 活动平面, ES *plano de eventos*).
4. **“Curate”** opportunities/datasets → ES/PT *curar* is awkward.
5. **Circuit footer** → overly literal in ZH.

These do not block residual-grant review; optional polish pass later.

## Key parity

All langs: **common 12/12**, **zk 92/92** vs English. HTML/URL integrity checks passed for critical HTML fields.
