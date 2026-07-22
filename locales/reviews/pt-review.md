# Portuguese (pt-BR) localization review — permissionless.money ZK grant desk

**Reviewer role:** independent localization QA (strict)  
**Source of truth:** `locales/en/common.json`, `locales/en/zk.json`  
**Under review:** `locales/pt/common.json`, `locales/pt/zk.json`  
**Brief:** `locales/TRANSLATION_BRIEF.md`

---

## Summary

| Check | Result |
| --- | --- |
| Files exist | Yes — `locales/pt/common.json`, `locales/pt/zk.json` |
| Valid JSON (UTF-8 parse) | Yes (both packs) |
| Key parity vs EN | **12/12** common · **92/92** zk — no missing, no extra |
| Product/protocol names | Preserved (Zcash, CosmWasm, IBC, Crosslink, ZIP-304, ADR-032, DAO-DAO, ZecHub, vote-sdk, terp-rs, smart-account-auth, LLM, ZCG, etc.) |
| Path steps | **Verify → Update → Bind → Gate** kept in English in titles, steps, caption |
| HTML / URLs | Tags, `href`, `target`, `rel` match EN on all HTML-bearing keys |
| Currency / brand | `$240k`, `$240,000`, `PERMISSIONLESS.MONEY` intact |
| `lang` labels | Own-script names preserved (English, Español, 中文, 日本語, Português) |
| i18n wiring | `lib/i18n.js` `SUPPORTED` + `AVAILABLE` include `'pt'`; `pages/zk.html` has `<option value="pt">` and early `avail` includes `pt` |

**PT support status: READY**

Overall quality is solid for a ZCG technical audience: natural pt-BR register, residual framing and light-client terminology largely correct, path English step names kept. No critical defects. Remaining issues are English loanword residue (`claim(s)`, `board`), a few awkward software calques (`fiação`, `se liquidar`/`liquidar` for proof settlement), and light fidelity nits on membership wording and events copy polish.

**Severity counts:** Critical **0** · Medium **6** · Minor **7** · HTML integrity issues **0**

**JSON fixes applied this review:** none (no criticals).

---

## Critical

_None._

- Key sets match EN exactly.
- No broken or rewritten HTML attributes/URLs.
- No dropped Verify/Update/Bind/Gate step names.
- No product/protocol identifier mistranslations (light clients, residual, ZCG, stack names kept appropriately).
- Packs parse; PT is wired as available.

---

## Medium

1. **`claim` / `claims` left in English** (technical fidelity + register)  
   - `overview.product1Body`: “provar uma **claim** e liquidá-la”  
   - `problem.deliversBody`, `problem.step3Plain`, `problem.step4Plain`: “**claims**”  
   ZKP “claim” is often kept, but mixed into full PT sentences it reads as residual English. Prefer **alegação(ões)** / **afirmação(ões)** / **reivindicação(ões)**, or keep **claim** consistently as a loanword with masculine agreement (**claims verificados**), not feminine “verificadas / liquidá-la” unless treating *claim* as feminine.

2. **`board` English residue in events**  
   - `events.bountyTitle`: “**Bounty board** como primitivo…”  
   - `events.stackBody1`: “O **board** está ligado…”  
   - `events.relatedLoyalty`: “Loyalty · **bounty board**…”  
   Product path `bounty-board` in the GitHub link text is fine; surrounding prose can use **quadro de bounties** / **quadro de recompensas** (cf. ES “tablero”) while leaving the linked label as-is.

3. **`settle` → `liquidar` / `se liquidar`** (possible false friend)  
   - `hero.title`: “podem **se liquidar**”  
   - `overview.product1Body`: “**liquidá-la** on-chain”  
   - `problem.step1Plain`: “**liquidar** provas”  
   In pt-BR finance/crypto, **liquidar** often means *liquidate* (close/unwind). EN “settle” here is *settle a proof/claim on-chain*. Safer: **assentar**, **efetivar**, **confirmar**, or **liquidar** only if reviewers already accept the ES parallel “liquidar(se)”.

4. **`side.demosBody` — “fiação do testnet”**  
   EN “testnet wiring” → electrical **fiação** is the wrong domain. Prefer **integração do testnet**, **ligação do testnet**, or keep **wiring**. Also “Lista de prévia ao vivo” is stiff for “Preview list live” → e.g. **Lista de pré-visualização ao vivo**.

5. **Membership → “membros”** (meaning narrow)  
   - `overview.product3Body`, `problem.deliversBody`, `problem.step4Plain`  
   EN **membership** is the privilege/status, not just “members”. Prefer **membresia**, **associação**, or **participação (em DAOs)** for closer fidelity.

6. **`events.computeBody1` — “curar uma oportunidade”**  
   EN “curate an opportunity”: pt-BR **curar** is primarily medical or content-curation; here it sounds odd. Prefer **estruturar / criar / oferecer uma oportunidade** for people exploring LLMs for review and building with Zcash.

---

## Minor

1. **`última milha` for last-mile** (`side.residualTitle`, `side.residualBody`, `overview.residualBody`)  
   Established logistics calque; acceptable. Tech residual copy sometimes keeps **last mile** or uses **trecho final** / **fase final**. Not wrong — optional polish.

2. **“fazer bridge”** (`hero.essence`, `overview.lede`, `problem.lede`, etc.)  
   Common crypto code-switch; brief flags Spanglish. Alternatives: **fazer a ponte**, **interligar**, or keep **bridge** as noun (“bridge nativo” already used well in `product2Title`).

3. **Inconsistent “proof VM” vs “VM de provas”**  
   `events.stackBody1` keeps English **proof VM** while overview/problem use **VM de provas**. Align to **VM de provas** for consistency (product path still English where required).

4. **`events.rewardsBody` — “traçando entre vários stacks”**  
   Weak for “tracing across various stacks”. Prefer **rastreando / acompanhando entre vários stacks**.

5. **Intentional English chrome (not defects)**  
   `nav.loyalty` “Loyalty”, `nav.zk` “ZK”, `desk.stack` / demos labels “Stack” / “Demos”, `pills.links` “Links”, `meta.title` product string — aligned with brand/nav and EN identical keys. OK.

6. **Loanwords kept by design (OK if consistent)**  
   light clients, headers, finality, testnet, on-chain, compute, mint/redeem, wallet, residual, loops, stack — appropriate for ZCG technical readers; do not “translate away” light client.

7. **`common.nav.contact` / footer**  
   Natural (“Contato”, “Construído na Terp Network · Código aberto · Sem permissão necessária”). No issue.

---

## HTML integrity

Checked programmatically against EN for every string containing tags:

| Key | Tags | hrefs | Notes |
| --- | --- | --- | --- |
| `hero.essence` | CosmWasm `<a>` | `https://cosmwasm.com/` | Match |
| `overview.residualBody` | `<strong>` ×2 | — | Match |
| `overview.techBody` | vote-sdk, terp-rs, smart-account-auth `<a>` | All three GitHub URLs | Match |
| `problem.step1–4Plain` | `<strong>Verify\|Update\|Bind\|Gate</strong>` | — | English step names kept |
| `events.bountyBody` | Nested ZecHub / DAO-DAO / ZecHub links + strong | All three URLs | Match |
| `events.stackBody1` | `<strong>` proof VM / gateway | — | Match |

No missing/extra tags, no URL drift, no attribute reordering that breaks markup.

---

## PT support wiring

| Item | Status |
| --- | --- |
| `locales/pt/common.json` | Present, parses |
| `locales/pt/zk.json` | Present, parses |
| `lib/i18n.js` → `AVAILABLE` | Includes `'pt'` (also `SUPPORTED`) |
| `pages/zk.html` language `<option value="pt">` | Present |
| Early inline `avail` in `zk.html` | Includes `'pt'` |

**PT support status: READY** — packs are loadable and selectable; no wiring gap found for Portuguese.

---

## Recommended fixes table

| Severity | Key | Current (PT) | Recommended |
| --- | --- | --- | --- |
| Medium | `overview.product1Body` | provar uma claim e liquidá-la on-chain | provar uma alegação e assentá-la on-chain *(or keep claim + masculine agreement)* |
| Medium | `problem.step3Plain` | claims verificadas | alegações verificadas / claims verificados |
| Medium | `problem.step4Plain` | membros DAO … dessas claims | membresia DAO … dessas alegações |
| Medium | `problem.deliversBody` | vínculo de claims … portões DAO para membros | vínculo de alegações … membresia, votação e acesso |
| Medium | `hero.title` | podem se liquidar | podem assentar / ser assentadas |
| Medium | `problem.step1Plain` | liquidar provas | assentar / efetivar provas |
| Medium | `side.demosBody` | Lista de prévia ao vivo; … fiação do testnet | Lista de pré-visualização ao vivo; … integração do testnet |
| Medium | `events.stackBody1` | O board está ligado … **proof VM** | O quadro está ligado … **VM de provas** |
| Medium | `events.bountyTitle` | Bounty board como primitivo | Quadro de bounties como primitivo *(link label may stay)* |
| Medium | `events.computeBody1` | curar uma oportunidade | estruturar / oferecer uma oportunidade |
| Medium | `overview.product3Body` | Membros, votação e portões | Membresia, votação e portões |
| Minor | `events.relatedLoyalty` | Loyalty · bounty board (…) | Loyalty · quadro de bounties (…) |
| Minor | `events.rewardsBody` | traçando entre vários stacks | rastreando / acompanhando entre vários stacks |
| Minor | `side.residualTitle` | Última milha $240,000 | optional: Last mile $240,000 / Trecho final $240,000 |

**Do not change (brief-compliant):** Verify → Update → Bind → Gate; product names; `$240k` / `$240,000`; `PERMISSIONLESS.MONEY`; HTML/URLs; `lang.*` script forms; intentional nav chrome (Loyalty, ZK, GitHub).

---

## events.* notes (focus)

| Key | Assessment |
| --- | --- |
| `h2` / `eventPlaneCta` | “Plano de eventos…” correctly maps control-plane “plane” (same strategy as ES). |
| `bountyBody` | Meaning faithful; fork + iframe + audit/hackathon compute credits preserved; HTML intact. “Fizemos fork” is natural BR tech. |
| `stackTitle` | Protocol names ZIP-304 × ADR-032 zk-JWT light clients preserved. |
| `stackBody1–2` | Sense OK; **board** / **proof VM** English residue (medium). mint/redeem OK. |
| `computeTitle/Body*` | Sponsorship intent clear; “curar uma oportunidade” + open training set mostly fine with medium polish on *curar*. |
| `rewardsBody` | Coinholder voting intent preserved; “traçando” weak (minor). |
| `related*` | Desk cross-links OK; Loyalty product name kept. |

---

## Conclusion

Portuguese packs are **shippable**: full key parity, brief-safe product/path handling, intact HTML, and complete i18n wiring.

**PT support status: READY**

No critical fixes applied. Medium items (`claim`/`board` residue, settle→liquidar risk, fiação, membership wording, events polish) are recommended follow-ups, not blockers.
