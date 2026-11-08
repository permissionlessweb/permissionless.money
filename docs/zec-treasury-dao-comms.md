# ZEC treasury & DAO oversight — comms prep

**Status:** draft for team / partner communications (not grant-desk copy)  
**Audience:** ZecHub, DAO operators, residual grant stakeholders  
**Related:** residual ZCG desk at `/zk`, bounty board / community event plane  

---

## Intent

How residual **ZEC** (and related program funds) can be held and administered with clear roles:

- operational execution by the project team and named third parties  
- **oversight** by ZecHub DAO as admin  
- on-chain structure on **Cosmos Hub** rather than an ad-hoc multisig narrative  

---

## Proposed structure (high level)

```
                    ZecHub DAO
                 (admin oversight)
                         │
                         ▼
            Cosmos Hub DAO instance
     (spawned for this program / residual)
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   Project team    Named 3rd parties   (optional)
   (execution)     (execution /        more modules
                    specialized work)
          │              │
          └──────┬───────┘
                 ▼
     Terp account · Polytone proxy account
     (cross-chain control surface into Terp /
      program deployments as designed)
```

### Pieces

| Piece | Role |
|--------|------|
| **Cosmos Hub DAO** | Program treasury and governance surface for residual funds; proposals, spending rules, visibility. |
| **ZecHub DAO** | **Admin oversight**—approvals, checks, and community-aligned control over material moves. Not day-to-day engineering. |
| **Team + third parties** | Execute work (engineering, events, compute sponsorship, audits) under the DAO’s rules. |
| **terp-account + Polytone proxy** | Cross-chain account pattern so Hub-side control can act toward Terp (and related) deployments without collapsing custody into a single opaque key. |

Exact module set (cw-dao / DAO DAO stack, polytone channel endpoints, spending thresholds) should be fixed in a follow-up technical note once Hub + Terp channel assumptions are frozen.

---

## What this is *not*

- Not a single mega-login for chat, bounties, and treasury.  
- Not “team holds ZEC in a personal wallet.”  
- Not replacing ZecHub’s own governance—oversight is **additive** admin responsibility for this program’s pot.  
- Not a claim that every residual line item is already wired on Hub; this is the **intended custody and oversight design** for comms and implementation planning.

---

## Comms talking points (short)

1. **Funds sit under a Cosmos Hub DAO**, not under informal custody.  
2. **ZecHub DAO is admin oversight** so Zcash community institutions retain a clear check.  
3. **Team and third parties execute** under that structure; they don’t replace oversight.  
4. **terp-account + Polytone proxy** is how Hub-side control reaches Terp-side program surfaces when needed.  
5. **Bounties and community events** can draw from the same governed pot under transparent proposals.

---

## Open decisions (fill before public claim)

- [ ] Final Hub chain-id / DAO factory deployment path  
- [ ] ZecHub admin capability set (threshold, veto, spending caps)  
- [ ] Named third-party roles and onboarding  
- [ ] Polytone connection (Hub ↔ Terp) readiness and fail-closed behavior  
- [ ] Relationship to residual budget line items (compute, audit, hackathon rewards)  
- [ ] Public transparency: explorer links, proposal templates, disclosure cadence  

---

## Related product surfaces

| Surface | Relation |
|---------|----------|
| `/zk` residual desk | Narrative residual; not the treasury UI |
| DAO-DAO bounty board | Possible spending / work surface under the DAO |
| Community event plane | Rewards and credits should reference governed funding |

---

## Next drafting steps

1. Technical annex: Polytone + terp-account proxy sequence diagram.  
2. ZecHub-facing one-pager (this file condensed, no engineering jargon).  
3. Align residual budget sheet rows to proposal categories under the Hub DAO.
