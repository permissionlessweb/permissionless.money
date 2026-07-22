# Japanese (ja) localization review — permissionless.money ZK grant desk

**Reviewer role:** Independent localization QA (separate session from translator)  
**Baseline:** `locales/en/common.json`, `locales/en/zk.json`  
**Under review:** `locales/ja/common.json`, `locales/ja/zk.json`  
**Brief:** `locales/TRANSLATION_BRIEF.md`

---

## Summary

Japanese packs are **structurally complete** and largely **meaning-faithful** for a ZCG technical residual-ask desk. Key parity is full (common 12/12, zk 92/92). Product/protocol identifiers, currency figures, brand string, language-name scripts, and all HTML tags/URLs match the English baseline. **Verify → Update → Bind → Gate** is correctly left in English in path title, steps, and caption.

Technical register is mostly appropriate: **選択的開示**, **周縁**, **ライトクライアント**, **ファイナリティ**, **閉ループ** land well for reviewers. Main quality gaps are **terminology consistency** (残余 vs 残額; 主張 vs クレーム), a few **payment-flavored 決済** uses for proof “settle,” status label **未完了** for Pending, and some **katakana-heavy pill labels**. **events.*** is careful and usable; minor calques only.

**Critical fixes applied to `locales/ja/*.json`:** none (no critical defects).

| Severity   | Count |
|-----------|-------|
| Critical  | 0     |
| Medium    | 6     |
| Minor     | 8     |
| HTML integrity issues | 0 |

**Ship readiness:** Acceptable for grant-desk review; recommend medium-tier polish before public launch if Japanese is a primary reviewer language.

---

## Critical

*None.*

- No missing/extra keys vs English.
- No broken or reordered HTML attributes; all `href`/`target`/`rel` preserved.
- No forbidden translation of product/protocol names (Zcash, CosmWasm, IBC, Crosslink, ZIP-304, ADR-032, DAO-DAO, ZecHub, vote-sdk, terp-rs, smart-account-auth, zk-JWT, LLM, R&D, ZCG, VM, DAO, PERMISSIONLESS.MONEY).
- Path tokens **Verify → Update → Bind → Gate** kept in English with correct `<strong>` wrapping on steps.
- Currency `$240k` / `$240,000` intact.
- No severe meaning inversions on residual / last-mile / light client / selective disclosure.

---

## Medium

### M1 — Identity “claim” rendered as クレーム (complaint risk)

| Key | EN | JA |
|-----|----|----|
| `problem.deliversBody` | claim binding | クレーム紐付け |
| `problem.step3Plain` | verified claims | 検証済みクレーム |
| `problem.step4Plain` | those claims | それらのクレーム |

In general Japanese, **クレーム** strongly means *complaint / customer claim*. For ZKP/identity/auth, prefer **クレーム（主張）**, **検証済みの主張**, or **クレーム情報** on first use. `overview.product1Body` already uses **主張** correctly — unify on that line.

### M2 — Proof “settle” → 決済 (payment settlement flavor)

| Key | EN | JA |
|-----|----|----|
| `hero.title` | proofs and curves can settle | 証明と曲線が**決済**できる |
| `overview.product1Body` | settle it on-chain | オンチェーンに**決済** |
| `problem.step1Plain` | settle Zcash-grade proofs | 証明を**決済** |

On-chain “settle” here is finalize/land a verified proof, not pay. Japanese grant readers may parse 決済 as payment. Prefer **確定する / 着地させる / オンチェーンで成立させる** (keep 決済 only if intentionally matching chain settlement jargon).

### M3 — Residual terminology split: 残余 vs 残額

| Key | JA |
|-----|-----|
| `hero.eyebrow` | **残余** R&D |
| `pills.residual`, `side.residualKicker`, notes/bodies | **残額** / 残額申請 |

EN consistently uses *residual* (residual R&D / residual request / ZCG residual), not only “remaining budget.” **残額** over-emphasizes leftover money; **残余** better matches residual framing. Recommend one primary term, e.g. **ZCG 残余**, **残余申請**, with 残額 only where the ask amount is the focus.

### M4 — `pills.pending`: Pending → 未完了

EN **Pending** is workflow status (not yet shipped / awaiting). **未完了** implies incomplete/failed completion. Prefer **保留** / **未出荷** / **待機** to pair with **出荷済み** (Shipped).

### M5 — `side.residualNote`: “compensation” and dual sponsorship

EN: `full service, compensation, compute & hackathon sponsorship`  
JA: `フルサービス、報酬、コンピュート、ハッカソン支援`

- **報酬** for compensation is acceptable (contributor pay).
- **コンピュート、ハッカソン支援** flattens “compute & hackathon sponsorship”; sponsorship force is weaker than EN. Prefer **コンピュートおよびハッカソンのスポンサー支援** (or keep スポンサーシップ).

### M6 — events.* control-plane / routing density

`events.bountyBody`, `stackBody1`, `stackBody2` are accurate but dense with loanwords (**コントロールプレーン**, **mint／redeem**, **オーセンティケーター・ゲートウェイ**). Meaning holds for technical ZCG readers; slightly hard for mixed community reviewers. Not wrong — flag for optional gloss if event plane is community-facing.

**events.*** fidelity notes (no critical issues):

| Key | Assessment |
|-----|------------|
| `h2` event plane → イベント面 | Good plane/surface mapping |
| `bountyBody` fork + iframe + ZecHub + compute credits | Faithful; HTML intact |
| `stackTitle` ZIP-304 × ADR-032 zk-JWT light clients | Names untranslated correctly |
| `computeBody1/2` LLM + open training set | Good meaning |
| `rewardsBody` coinholder voting + tracing stacks | Good (**コインホルダー投票**, **横断して追跡**) |

---

## Minor

### m1 — Katakana pill dumps

- `pills.capabilities` → **ケイパビリティ** (prefer **機能** / **能力**)
- `pills.inventory` → **インベントリ** (prefer **一覧** to match `desk.stackTitle` スタック一覧)
- `pills.scope` → **スコープ** (acceptable short label)

### m2 — `common.footer.copy` mixed language

`Built on Terp Network · オープンソース · 許可不要` — first clause English. Intentional brand OK; full JP would be **Terp Network 上に構築 · オープンソース · 許可不要**.

### m3 — `pills.shipped` → 出荷済み

Common in JP product shipping; for software some prefer **リリース済み** / **提供済み**. Acceptable as-is.

### m4 — `events.bountyBody` “support” → サポート

“forked the … bounty-board support” → **bounty-board のサポートをフォーク** can read as forking “customer support.” Prefer **bounty-board 実装／基盤をフォーク**.

### m5 — `events.bountyBody` “focal design spaces” → 焦点デザインスペース

Calque. Prefer **重点デザインスペース** / **焦点を絞ったデザインスペース**.

### m6 — `side.demosBody` telegraph style

`プレビュー一覧は公開中。対話型ローンチは testnet 配線待ち。` — faithful to EN brevity; fine for UI chrome.

### m7 — `overview.deskBody` “surface” → 窓口

**窓口** is good UX Japanese for residual surface; slightly softer than technical “surface/plane” used elsewhere (面). Consistent enough.

### m8 — `problem.sitsBody` “speak” proofs/curves/headers

EN metaphor “surface that speak Zcash-grade…” → JA **扱う** — correct demetaphorization.

---

## HTML integrity

Checked all string values for tag sequences (`<a …>`, `</a>`, `<strong>`, `</strong>`).

| Location | Result |
|----------|--------|
| `hero.essence` CosmWasm link | Match |
| `overview.residualBody` strong residual / $240k | Match |
| `overview.techBody` vote-sdk, terp-rs, smart-account-auth | Match (URLs exact) |
| `problem.step1–4Plain` strong step names | Match |
| `events.bountyBody` multi-link + strong | Match (nesting order of “iframe in DAO-DAO” vs “DAO-DAO 内の iframe” differs in word order only; tags/attrs intact) |

No URL drift. No stripped attributes. No unclosed tags.

---

## Recommended fixes table

Apply as polish (none are ship-blockers). **Critical column = not applied** (none required).

| ID | Sev | File / key | Current (JA) | Recommended |
|----|-----|------------|--------------|-------------|
| M1 | Medium | `zk.json` `problem.deliversBody` | クレーム紐付け | **主張（クレーム）の紐付け** or **検証済み主張のバインド** |
| M1 | Medium | `zk.json` `problem.step3Plain` | 検証済みクレームを…付与 | **検証済みの主張を**スマートアカウントとオーセンティケーターに付与 |
| M1 | Medium | `zk.json` `problem.step4Plain` | それらのクレームから | **それらの主張から** |
| M2 | Medium | `zk.json` `hero.title` | 決済できる場所を | **オンチェーンで確定できる場所を** / **着地できる場所を** |
| M2 | Medium | `zk.json` `overview.product1Body` | オンチェーンに決済 | **オンチェーンで確定** |
| M2 | Medium | `zk.json` `problem.step1Plain` | 証明を決済 | **証明を確定（着地）させる** |
| M3 | Medium | residual keys cluster | 残額 / 残余 mixed | Prefer **残余** for residual framing; e.g. `ZCG 残余`, `残余申請`, `この残余で` |
| M4 | Medium | `zk.json` `pills.pending` | 未完了 | **保留** or **未出荷** |
| M5 | Medium | `zk.json` `side.residualNote` | コンピュート、ハッカソン支援 | **コンピュートおよびハッカソンのスポンサー支援** |
| m1 | Minor | `pills.capabilities` | ケイパビリティ | **機能** |
| m1 | Minor | `pills.inventory` | インベントリ | **一覧** |
| m2 | Minor | `common.json` `footer.copy` | Built on Terp Network · … | Optional: **Terp Network 上に構築 · オープンソース · 許可不要** |
| m4 | Minor | `events.bountyBody` | サポートをフォーク | **実装をフォーク** / **基盤をフォーク** |
| m5 | Minor | `events.bountyBody` | 焦点デザインスペース | **重点デザインスペース** |

### Keep as-is (explicit pass)

| Item | Verdict |
|------|---------|
| Verify → Update → Bind → Gate | Correct English retention |
| 選択的開示 / ライトクライアント / 周縁 | Strong technical JP |
| Product names & $ amounts | Per brief |
| `lang.*` native scripts | Per brief |
| `events.stackTitle` ZIP-304 × ADR-032 zk-JWT | Untranslated correctly |
| HTML/URL set | Intact |

---

## Appendix — key parity

| Pack | EN keys | JA keys | Missing | Extra |
|------|---------|---------|---------|-------|
| `common.json` | 12 | 12 | 0 | 0 |
| `zk.json` | 92 | 92 | 0 | 0 |

## Appendix — JSON files touched this review

- **Written:** `locales/reviews/ja-review.md` (this file)
- **Edited:** none under `locales/ja/` (no critical fixes)
