# Translation brief — permissionless.money ZK desk

**Baseline (source of truth):** `locales/en/common.json` + `locales/en/zk.json`  
**Do not invent keys.** Preserve exact JSON structure and key names.  
**Output only:** `locales/<lang>/common.json` and `locales/<lang>/zk.json`

## Rules

1. Professional, natural target language for a **Zcash Community Grants** audience (community + technical reviewers).
2. **Never translate** product/protocol identifiers: Zcash, CosmWasm, IBC, Crosslink, ZIP-304, ADR-032, DAO-DAO, ZecHub, vote-sdk, terp-rs, smart-account-auth, zk-cosmwasm, zebra-crosslink, Orchard, Wasmer, JWT, LLM, R&D, ZCG, VM, DAO, API when used as names.
3. Keep path tokens as-is when product names: **Verify → Update → Bind → Gate** (you may add a short localized gloss in the same string if it helps, but keep English step names).
4. Preserve all HTML tags/attributes and URLs exactly (`<a href=…>`, `<strong>`, etc.).
5. Preserve currency figures: `$240k`, `$240,000`.
6. Brand string `PERMISSIONLESS.MONEY` stays unchanged.
7. Valid JSON only (UTF-8). No trailing comments. No markdown wrappers in the files.
8. `lang` block labels: keep each language name in its own script (English, Español, 中文, 日本語, Português) as in English baseline — do not romanize 中文/日本語.

## Focus

Full chrome + grant desk copy currently in the English packs, with special care on **`events.*`** (community event plane / bounty board / compute credits / hackathon rewards).

## Review later

A separate model will review accuracy. Prefer precise technical meaning over marketing fluff.
