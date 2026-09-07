# Grant demo desk — iteration notes

**Live:** https://permissionless.money/zk  
**Forum:** https://forum.zcashcommunity.com/t/54211 (topic id `54211`)  
**Issue:** https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/369 (active residual; original #182)  


## Goals (async with engineering)

1. **Readable residual narrative** — progressive disclosure already on Overview + Problem → path; continue polishing Stack / Progress / Timeline when feedback lands.
2. **Forum gateway** — monitor topic 54211 for new posts while engineering tracks stable components in parallel.
3. **Content iteration** — human comments drive copy updates; do not invent grant claims.

## Forum watch

```bash
cd websites/permissionless.money
chmod +x scripts/forum-watch.sh
./scripts/forum-watch.sh              # one-shot status
./scripts/forum-watch.sh --watch 180  # poll every 3m; prints NEW blocks
```

State file: `.cache/forum-watch/topic-54211.json` (highest post watermark).

Discourse JSON (no auth for public topics):  
`https://forum.zcashcommunity.com/t/54211.json`

## Suggested reviewer path (desk)

1. Overview  
2. Problem → path  
3. Timeline ($230k residual)  
4. Stack / Progress  
5. Community event  
6. Sources + forum thread  

## Snapshot (2026-07-21)

- Topic posts_count ≈ 10; last activity reopening residual clarity (post #10, hard-nett).  
- Site: digest progressive disclosure live; i18n packs en/es/zh/ja/pt; FOUC black-page fix shipped.
