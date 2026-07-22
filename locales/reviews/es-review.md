# Spanish (es) localization QA — permissionless.money ZK grant desk

**Reviewer role:** strict localization QA (independent of translator session)  
**Baseline:** `locales/en/common.json` + `locales/en/zk.json`  
**Under review:** `locales/es/common.json` + `locales/es/zk.json`  
**Brief:** `locales/TRANSLATION_BRIEF.md`

---

## Summary

**PASS** (no critical blockers).

Spanish packs have full key parity with English, preserve product/protocol identifiers, keep `Verify → Update → Bind → Gate` step names, preserve all HTML tags/URLs in required fields, and retain residual framing and dollar amounts without inventing grant claims.

Quality is production-usable for a ZCG technical audience. Remaining items are medium fidelity/style nits and minor polish—not structure or safety failures. **No JSON fixes applied** (critical-only fix policy).

| Severity   | Count |
| ---------- | ----- |
| Critical   | 0     |
| Medium     | 5     |
| Minor/nits | 8     |

---

## Critical issues (must fix)

*None.*

- Key structure: **parity exact** for `common.json` and `zk.json` (no missing/extra keys).
- Product names / figures: counts match EN for Zcash, CosmWasm, IBC, Crosslink, ZIP-304, ADR-032, DAO-DAO, ZecHub, vote-sdk, terp-rs, smart-account-auth, PERMISSIONLESS.MONEY, `$240k`, `$240,000`, and path string `Verify → Update → Bind → Gate`.
- Residual facts not softened: testnet-already-working framing and `$240k` last-mile scope preserved in `side.residualBody` and `overview.residualBody`.
- Step names kept English in `problem.pathTitle`, `step1–4Plain`, `pathCaption`.

---

## Medium issues

1. **`hero.title` — “liquidarse” for “settle”**  
   EN: *“More places Zcash-grade proofs and curves can settle.”*  
   ES: *“…pueden liquidarse.”*  
   In finance Spanish *liquidar/liquidarse* often reads as cash settlement or liquidation. For proof/curve settlement on-chain, *asentarse*, *resolverse*, or *liquidar* (active, with clear on-chain object) is less ambiguous for reviewers.

2. **`events.bountyBody` — “espacios de diseño focales”**  
   Calque of *focal design spaces*. Natural options: *espacios de diseño enfocados*, *espacios de diseño prioritarios*, or *espacios focales de diseño* (if “focal” is intentional jargon).

3. **`events.rewardsBody` — “tracing” → “trazabilidad”**  
   EN: *“tracing across various stacks”* (following demos/rewards across stacks).  
   ES: *“con trazabilidad a través de varios stacks”* adds an explicit **traceability** product sense not fully present in EN. Prefer *trazando a través de varios stacks* or *a lo largo de varios stacks*.

4. **`events.computeBody1` / `computeBody2` — “curar” for “curate”**  
   Marketing/anglicism calque. Acceptable in some tech Spanish, but for ZCG tone prefer *organizar / diseñar / preparar* (opportunity) and *compilar / reunir / armar* (open training set).

5. **Bridge verb “puentear”** (`hero.essence`, `overview.lede`, `problem.lede`, `problem.deliversBody`)  
   Understandable in crypto Spanish but still a calque of *bridge*. Alternatives some LatAm reviewers prefer: *hacer bridge*, *puenteo* (noun already used well), or *interconectar vía bridge*. Not wrong—flag for voice consistency.

---

## Minor / nits

1. **`hero.openDesk` / desk metaphor:** *escritorio del grant* is literal for UI “desk”; *mesa del grant* can feel more “grant desk/office” in Spanish. Optional.
2. **`side.residualTitle`:** word order flipped (`Última milla $240,000` vs `$240,000 last mile`)—meaning intact.
3. **`events.computeBody2`:** *Pretendemos* is correct Spanish for “we intend,” but can feel stiff; *Queremos* / *Tenemos la intención de* matches rewards tone better.
4. **`side.demosBody` / `events.stackBody1`:** *cableado* calques *wiring/wired*—fine in systems Spanish; *conexión* / *integración* softer for general readers.
5. **Untranslated technical loans kept consistently** (*headers*, *claim*, *testnet*, *iframe*, *tracks*, *stack*, *mint/redeem*, *wallet*, *proof VM*)—appropriate for this audience; no action required unless a glossary mandates Spanish expansions.
6. **`nav.loyalty` / `events.relatedLoyalty`:** *Loyalty* left English (matches EN section brand)—OK.
7. **`footer.copy`:** *Sin permiso requerido* is clear; optional polish *Sin necesidad de permiso*.
8. **`events.stackTitle`:** identifiers preserved; only order differs (*light clients ZIP-304 × ADR-032 zk-JWT* vs EN *ZIP-304 × ADR-032 zk-JWT light clients*).

---

## HTML/URL integrity check

Automated tag + URL extraction vs EN for all HTML-bearing leaves:

| Key | Tags | URLs | Notes |
| --- | ---- | ---- | ----- |
| `hero.essence` | match | match | CosmWasm link + attributes intact |
| `overview.residualBody` | match | n/a | `<strong>` residual + `$240k` intact |
| `overview.techBody` | match | match | vote-sdk, terp-rs suite, smart-account-auth links intact |
| `problem.step1Plain` … `step4Plain` | match | n/a | `<strong>Verify/Update/Bind/Gate</strong>` intact |
| `events.bountyBody` | match | match | ZecHub bounty-board, DAO-DAO, ZecHub wiki; nested `<strong>` + iframe wording intact |
| `events.stackBody1` | match | n/a | `<strong>proof VM</strong>` and gateway emphasis intact |

**Result:** pass. No broken attributes, no reordered tag nests, no rewritten hrefs.

---

## Recommended string fixes

| key | current | suggested |
| --- | ------- | --------- |
| `zk.hero.title` | Más lugares donde las pruebas y curvas de grado Zcash pueden liquidarse. | Más lugares donde las pruebas y curvas de grado Zcash pueden asentarse. |
| `zk.events.bountyBody` *(phrase only)* | …y espacios de diseño focales. | …y espacios de diseño enfocados. |
| `zk.events.rewardsBody` | …sobre recompensas a las mejores demos, con trazabilidad a través de varios stacks. | …sobre recompensas a las mejores demos, trazando a través de varios stacks. |
| `zk.events.computeBody1` | …nos permite curar una oportunidad para quienes… | …nos permite organizar una oportunidad para quienes… |
| `zk.events.computeBody2` | Pretendemos aprovechar esa oportunidad mientras curamos un conjunto de entrenamiento abierto a partir de las conversaciones que surjan de las auditorías. | Queremos aprovechar esa oportunidad mientras reunimos un conjunto de entrenamiento abierto a partir de las conversaciones que surjan de las auditorías. |
| `zk.hero.essence` *(optional bridge verb)* | …verificar, puentear y componer con… | …verificar, hacer bridge y componer con… *(or keep puentear if glossary prefers)* |
| `zk.hero.openDesk` *(optional)* | Abrir escritorio del grant | Abrir mesa del grant |
| `zk.footer` N/A — use `common.footer.copy` | Sin permiso requerido | Sin necesidad de permiso *(optional)* |

---

## Criteria checklist

| # | Criterion | Result |
| - | --------- | ------ |
| 1 | Key parity vs en | **Pass** |
| 2 | Meaning fidelity (ZCG / residual / tech) | **Pass** (medium nits only) |
| 3 | Product names untranslated | **Pass** |
| 4 | HTML/URLs in html-bearing fields | **Pass** |
| 5 | Verify → Update → Bind → Gate kept | **Pass** |
| 6 | Natural professional Spanish | **Pass with medium calques** |
| 7 | `events.*` care | **Pass** (rewards/compute wording nits) |

---

## Notes for next pass (optional)

- Prefer a short glossary decision on: *settle* (asentar/liquidar), *bridge* (puentear vs hacer bridge), *curate* (curar vs organizar/reunir).
- No code or EN baseline changes recommended from this review.
