# TT2 8.4/8.4.1 — Account calculation provenance, 20 Nov 2026

## What the source tables establish

The repository contains source-backed multipliers for **120 Titan Cards, 149 multiplicative Titan Research nodes and 198 multiplicative Gemstone Research nodes**. Separate tables contain **62 Titan Soul resource nodes** and **169 Gemstone Level resource nodes**. Resource-level additions are **not** direct damage multipliers; the player's displayed effective gemstone effects may already include researched levels, so the same levels are never multiplied a second time.

The account power engine computes direct effects of owned permanent artifacts and season-eligible monuments from the 8.4 data and their enchantment flags, with separate conservative additive Artifact Damage and Monument Damage pools. Some counted, conditional, time-based, set-boosted and enchantment interactions remain unverified; the source tables alone do not settle in-game application order. A fixed account bonus common to all SP allocations does **not** change their relative ordering in an additive log proxy.

## This audit's code changes

- `account-gemstones.js` now routes **explicitly exported** `TapDamage`, `AllHeroDamage`, `AllHelperDamage`, `HeroDamage` and `CritDamage` to the same damage/gold source reductions **already implemented** by `fixedAccountScore` / `equipmentEffectReduction`; no new made-up coefficients.
- `account-profile.js` allowlists a separate `clanTechnology` collection, added in 8.4. Do not infer from personal tech-point contributions what the clan has unlocked.
- `account-clan-technology.js` recognizes resource and teamwork-related bonus families for diagnostics only. No actual node coefficients or effective clan-wide stacking are asserted without a verified table and export.
- `account-source-coverage.js` uses the current actual fixed scorer's existing per-type weights to show how many **numeric input rows are relevant to this build**; unknown and equipment/pet-dependent sources are separated. Reports never contain player identities or raw account data. It does not claim all game bonuses are modeled.
- Account integration displays a compact coverage summary and marks Clan Technology as not exported, identified-but-unscored, or unknown. Every report is explicitly **source-limited**, not a gameplay DPS or stage prediction.

## Version and season warnings

Game Hive announced TT2 **8.4.1 for 17 November 2026** (DevLog #240, primarily bug fixes): https://gamehive.com/blog/devlog-240-version-841-patch-notes/. The pinned engine's Unity data is still verified for **8.4.0** only; read 8.4.1 player exports carefully. On 20 Nov, fan E9 Wiki lists Season 13 as ending **24 Nov 2026**, but this is not an official game timer; a live in-game countdown has priority and stale monuments should not be blindly reused after rollover.

The 8.4 official notes introduce clan technology:
https://gamehive.com/blog/devlog-239-version-840-patch-notes/
and the 20 Nov official DevUpdate explains its clan-wide nature:
https://gamehive.com/blog/devupdate-166-tech-check/

## Remaining gates

No GitHub Actions are run, triggered or required for this change. Tests are committed for **local execution** (`npm test` and `npm run check:data`) only, and have **not been executed in the current environment**. The fixed account baseline is not a globally validated SP, pet, gear and stage simulator. Source counters can be high even when significant conditional effects remain unmodeled.
\n## Supplementary set coverage and version guard\n\nCompleted equipment sets are scored in their own ledger, not duplicated in `extractFixedAccountPower.entries`. The provenance audit therefore also accepts the already-resolved `permanentSetPower` and `extractTimedSetPower` ledgers, counting only the contributions relevant to the selected damage/gold build. This is a **reporting** consolidation, never an additional score term.\n\nWhen an imported JSON explicitly reports `8.4.1`, the UI now warns that the source math catalog was last validated against `8.4.0`. Official 8.4.1 notes primarily contain bug fixes, but source parity was not independently rechecked.\n