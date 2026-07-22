# zh (Simplified Chinese) localization review — permissionless.money ZK grant desk

**Reviewer role:** Independent localization QA (separate session from translator)  
**Source of truth:** `locales/en/common.json`, `locales/en/zk.json`  
**Under review:** `locales/zh/common.json`, `locales/zh/zk.json`  
**Brief:** `locales/TRANSLATION_BRIEF.md`

## Summary

| Check | Result |
| --- | --- |
| Key parity (`common` + `zk`) | **Pass** — 12/12 common, 92/92 zk; no missing/extra keys |
| JSON validity | **Pass** |
| Product/protocol names untranslated | **Pass** — Zcash, CosmWasm, IBC, Crosslink, ZIP-304, ADR-032, DAO-DAO, ZecHub, vote-sdk, terp-rs, smart-account-auth, VK, LLM, R&D, ZCG, VM, DAO, JWT, iframe, Loyalty (as product surface) preserved |
| Path tokens Verify → Update → Bind → Gate | **Pass** — English step names kept in `pathTitle`, steps, `pathCaption` |
| HTML tags & URLs | **Pass** — all tags/attrs/URLs match intent; see HTML integrity |
| Currency / brand | **Pass** — `$240k`, `$240,000`, `PERMISSIONLESS.MONEY` intact |
| `lang` labels | **Pass** — English, Español, 中文, 日本語, Português per brief |
| Meaning fidelity (grant residual / stack) | **Good overall** — residual framed as 尾款 is acceptable ZCG-style Chinese |
| Natural technical Chinese | **Mostly natural**; a few calques and claim-term choices need polish |
| `events.*` | **Usable**; control-plane / mint-redeem / compute-credit meaning intact; a few awkward strings |

**Severity counts:** Critical **0** · Medium **6** · Minor **8**

**Locale JSON edits applied this review:** none (no critical defects).

Overall: shippable for ZCG reviewer audience. Residual/last-mile framing, stack inventory, and path pipeline read correctly. Main polish debt is literal calques (`活动平面`, `电路页脚`), ZK *claim* as 主张, and a couple of compressed `events` sentences.

---

## Critical

*None.*

No wrong product identifiers, no broken HTML/URLs, no key drift, no loss of Verify → Update → Bind → Gate English tokens, no currency/brand corruption, and no meaning inversions that would misstate residual scope, $240k use, or stack architecture.

---

## Medium

1. **`problem.step1Tech` — `电路页脚` for “circuit footer”**  
   - Current: `参数文件、电路页脚、证明 VM 上的分层缓存。`  
   - Risk: 页脚 strongly implies UI page footer; if “circuit footer” is a named inventory surface/component, a calque misleads. Prefer gloss + English token or “电路 footer”.

2. **`overview.product1Body` / claim language — `证明主张`**  
   - “prove a claim” → `证明主张` is circular and slightly legalistic. In ZK grant copy, 声明 / 断言 is clearer for verified claims bound later in Bind/Gate.

3. **`events.h2` / `events.eventPlaneCta` — `活动平面`**  
   - Direct calque of “event plane”. Readable next to `控制平面`, but odd as a standalone H2/CTA. Prefer `社区活动层` / `活动控制面` or keep English “event plane” with a short gloss.

4. **`events.computeBody2` — awkward noun stack**  
   - `整理审计中产生对话的开放训练集` reads machine-translated (missing 的 / 过程中). Meaning recoverable but not natural.

5. **`events.rewardsBody` — trailing `跨多种技术栈追踪`**  
   - “tracing across various stacks” is underspecified in EN; ZH inherits vagueness. Reviewers may not know what is being traced (attribution, reward flow, demo lineage).

6. **`overview.product2Body` — subject demotion**  
   - EN leads with **Light clients** as the product. ZH opens with the action (`将…带入…轻客户端`), so the product is the destination, not the subject. Meaning of “headers/finality into light clients in the DAO contract env” is still correct, but product framing is weaker.

---

## Minor

1. **`common.nav.loyalty`** left as `Loyalty` (consistent with product naming; optional localized gloss elsewhere).  
2. **`problem.sitsTitle`** `定位所在` is stiff for “Where this sits” → better `所处位置` / `位置`.  
3. **`side.openContact`** `打开联系` feels truncated vs `打开联系方式` / `前往联系`.  
4. **`pills.pending`** `待完成` ≈ “to finish”; EN “Pending” is status-neutral → `待处理` / `进行中` also fine.  
5. **`overview.productsTitle` / surface vocabulary** — `界面` for “surfaces” is OK; alternate `产品面` if you want less UI-chrome tone.  
6. **`events.relatedLoyalty`** keeps `Loyalty ·` (good) and translates bounty board naturally.  
7. **`side.residualNote`** `完整服务` for “full service” is slightly opaque (ops vs full residual package); optional `全包服务/全量支持`.  
8. **`hero.essence` / punctuation** — Chinese full-width dash and parentheses used well; no issue, only note consistency with other locales.

---

## HTML integrity

Checked all strings containing markup/URLs in `zk.json`:

| Key | Tags | URLs | Notes |
| --- | --- | --- | --- |
| `hero.essence` | `<a …>CosmWasm</a>` | `https://cosmwasm.com/` | Intact |
| `overview.residualBody` | `<strong>` ×2 | — | Intact (`尾款申请`, `$240k`) |
| `overview.techBody` | three `<a>` | vote-sdk, terp-rs smart authenticators, smart-account-auth paths | Intact; link text preserved |
| `problem.step1–4Plain` | `<strong>Verify/Update/Bind/Gate</strong>` | — | English step names preserved |
| `events.bountyBody` | ZecHub bounty-board `<a>`, nested DAO-DAO `<strong>+<a>`, ZecHub wiki `<a>`, compute-credits `<strong>` | All three hosts match EN | Nested order of words inside `<strong>` differs (ZH: “DAO-DAO 中的 iframe” vs EN “iframe in DAO-DAO”) — **semantically equivalent, tags/attrs OK** |
| `events.stackBody1` | `<strong>` proof VM + light-client/authenticator gateway | — | Intact |

No missing `rel="noopener"`, no rewritten `href`, no unescaped breakage observed. Valid JSON after UTF-8 review.

---

## Recommended fixes table

| key | current | suggested |
| --- | --- | --- |
| `zk.problem.step1Tech` | 参数文件、电路页脚、证明 VM 上的分层缓存。 | 参数文件、circuit footer（电路页脚）、证明 VM 上的分层缓存。 |
| `zk.overview.product1Body` | … — 证明主张，并在策略披露规则下在链上结算。 | … — 证明一项声明，并按策略的披露规则在链上结算。 |
| `zk.problem.step3Plain` | …将已验证主张附加到… | …将已验证声明附加到… *(align claim lexicon)* |
| `zk.problem.step4Plain` | …基于这些主张的 DAO… | …基于这些声明的 DAO… |
| `zk.problem.deliversBody` | …将主张绑定到智能账户… | …将声明绑定到智能账户… |
| `zk.events.h2` | 社区活动平面 | 社区活动层（event plane） |
| `zk.events.eventPlaneCta` | 活动平面 → | 活动层 → |
| `zk.events.computeBody2` | 我们计划利用该机会，同时整理审计中产生对话的开放训练集。 | 我们计划在利用该机会的同时，把审计过程中产生的对话整理为开放训练集。 |
| `zk.events.rewardsBody` | …并跨多种技术栈追踪。 | …并在多种技术栈之间追溯演示与奖励归属。 |
| `zk.overview.product2Body` | 将 Zcash 区块头与最终性带入 DAO 已用于组合的同一合约环境中的轻客户端。 | 轻客户端将 Zcash 区块头与最终性带入 DAO 已用于组合的同一合约环境。 |
| `zk.problem.sitsTitle` | 定位所在 | 所处位置 |
| `zk.side.openContact` | 打开联系 | 打开联系方式 |

### What already works well (do not regress)

- **Residual framing:** `尾款` / `尾款申请` / `最后一公里` consistently maps residual ask + last-mile scope.  
- **Path pipeline:** Verify → Update → Bind → Gate left in English with clear Chinese glosses.  
- **Stack names:** CosmWasm, IBC, Crosslink, vote-sdk, terp-rs, smart-account-auth, ZIP-304, ADR-032, zk-JWT untouched.  
- **`events.bountyBody`:** fork → iframe-in-DAO-DAO → control plane for audits/tracks/**黑客松算力额度** is faithful; improves awkward EN “have access to coordinating”.  
- **`events.stackBody2`:** mint/redeem intent → `铸造/赎回意图` is correct ops language.  
- **Currency & ask:** `$240k` / `$240,000` / `申请金额 $240,000` clear for reviewers.

---

## Key parity detail

```
common.json  en=12  zh=12  missing=[]  extra=[]
zk.json      en=92  zh=92  missing=[]  extra=[]
```

## Disposition

- **Critical fixes applied to `locales/zh/*.json`:** none required.  
- **Recommended next step:** apply Medium rows (especially claim lexicon + `step1Tech` + `events.computeBody2` / `rewardsBody`) in a non-critical polish pass if desired before publish.
