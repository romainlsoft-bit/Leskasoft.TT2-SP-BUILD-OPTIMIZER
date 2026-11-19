# Terrifying Pact 15 vs 22: TT2 8.4 Stats observation — 20 Nov 2026

## Observations and caveats

A player tested level 15 in the temporary skill-tree Stats preview, without applying the allocation. The screenshot reads All Damage 4.62e18386, Pet Damage 3.60e4241, Fairy Gold 7.07e4245. Earlier conversation transcription for level 22 reads All Damage 4.61e18386, Pet Damage 3.59e4241, Fairy Gold 7.07e4245. The original level-22 image was NOT independently reexamined here.

The player had reconnected before the level-15 capture and flagged effects depending on elapsed seconds since the previous prestige. These are not controlled simultaneous measurements. Observed small differences cannot be attributed solely to Pact.

## Independently sourced game mechanics

Source: vendor/skills.js (TT2 8.4 SkillTreeInfo2.0) and https://www.tt2-compendium.com/en/wiki/skills/terrifyingpact

| Attribute | Level 15 | Level 22 |
| --- | ---: | ---: |
| Total Pact SP invested | 442 | 975 |
| A, gold while Forbidden Contract active | x2.92e40 | x5.84e69 |
| B, damage while Royal Contract active | x2.12e28 | x6.86e48 |
| C, fewer non-boss Titans during either contract | 7 | 7 |

15 -> 22 theoretically adds **+29.3010 log10 gold** and **+20.5099 log10 damage** at the corresponding MAXIMUM active effects; the titan-count reduction does not change. The investment costs +533 SP. These are SOURCE differences, not measured combat results.

The Stats screen does not demonstrate those huge conditional maxima. This is consistent with inactive contracts, preview-specific omission, or changed runtime conditions; it does NOT establish that Pact lacks a combat effect. The mana supply, ramp duration, uptime and effective live multipliers remain unverified.

## Implementation and safety

The diagnostic compareTerrifyingPactLevels reports source-only level differences and is exposed as pactSourceLevelComparison in resolveContractScenario when a prior imported Pact level exists. It never adds a bonus to the optimization score. The existing conservative scenario still scores contract maxima at zero when unverified, and protects imported contract levels by default. No speculative multiplier, hidden nerf, or stage-prediction claim was added.

Automated tests cover the exact 15/22 source entries, Co0 cost indexing, reversibility, and conservative gating. Further meaningful calibration would require comparable ACTIVE contract combat states; no further Stats-panel screenshots are requested.
