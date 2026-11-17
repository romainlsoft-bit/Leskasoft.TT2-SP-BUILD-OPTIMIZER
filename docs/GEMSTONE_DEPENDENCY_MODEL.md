# Gemstone → equipment → pet → skill dependency ledger
17 November 2026 — TT2 8.4, PR #17 (draft / not published)

## Sources and version boundary

- Game Hive [version 8.0 notes](https://gamehive.com/blog/devlog-225-version-8-0-0-patch-notes/) (3 July 2026): 10 → 24 gemstone identities, fixed primary/secondary effects per gemstone, rarity breakpoints, Gemstone Research extensions.
- Game Hive [version 8.1 notes](https://www.gamehive.com/blog/devlog-229-version-8-1-0-patch-notes/) (31 July 2026): rebalanced Boss Damage and hero-related combination bonuses. Never reuse pre-8.0 random gemstone assumptions.
- Game Hive [version 7.16 notes](https://gamehive.com/blog/devlog-203-version-7-16-0-patch-notes/): equipment can confer additional Gemstone Level (e.g. +10%); therefore the player-stat level's meaning cannot safely be inferred solely from Mystic Research purchases.
- TT2 8.4 CSV catalogs: `vendor/account-scaling.js`, `vendor/account-research-resources.js`, and the explicit account export.

## Implemented dependency route

```text
Player JSON export
  ├─ Mystic Research (GemstoneLevel + purchased levels)
  │    └─ diagnostic level hypotheses only, NO repeated bonus scaling
  └─ 24 fixed gemstone identifiers
       ├─ explicit direct bonus (e.g. PetDamage, GoldAll)
       │    └─ fixed account baseline → damage/gold reduction
       ├─ explicit equipment boost (SwordBoost / AllEquipmentEffect)
       │    └─ equipmentPrimaryAmplifiers → *primary* equipment effect
       │         ├─ Exotic pet passive (level and 5-level fraction)
       │         ├─ Restored Rune Heart artifact
       │         └─ chosen gear primary
       │              └─ equipmentPetSlotWeights → Combat Techniques
       └─ unverified dependent type → diagnostic only
```

The factors above are **separate effects**. For a sword with a valid direct damage primary:
- A gemstone with `SwordBoost:1e60` contributes +60 log10 to that equipment's primary, not +60 to the global damage baseline and not +60 for each equipment slot.
- `AllEquipmentEffect:1e12` contributes +12 log10 to the primary in **each qualifying selected slot**, with its own gold-weight factor where appropriate, not directly to skill-tree damage.
- A gemstone with `PetDamage:1e40` contributes +40 log10 to the Pet damage baseline, not to other damage builds.
- `GemstoneLevel` purchases are additive level resources, not multiplicative damage entries. Exported gemstone bonuses can already contain the level research; **never apply it a second time**.

## Import guarantees

1. Resolve fixed stone identifiers case-insensitively, accepting an identical mirrored row only once.
2. Exclude conflicting duplicate identifiers entirely, rather than selecting the larger number.
3. On truncated exports, score no gemstone rows; omitted rows could conflict with those observed.
4. Validate scientific-format multipliers in logarithmic space (`1e9999` is safe); exclude invalid, zero and subunit bonuses from an unsupported positive-bonus path.
5. Repeated identical effects on one gemstone are not automatically stacked. Other effects remain separate when the export explicitly declares distinct values.
6. Record unknown bonus types and malformed entries, but never invent reduction coefficients.
7. Feed the same explicit values to the fixed account baseline and the equipment scorer without counting equipment-only multipliers as standalone damage.
8. Mark imported or missing source data honestly. This is not a complete gameplay simulator; totals cannot guarantee a particular stage gain.

## Remaining release work

- Verify all 24 canonical names and effect paths from the actual 8.4 GemstoneInfo and GemstoneBonusTypeScaling tables; do not assume exported individual multipliers are identical to raw progression values.
- Determine whether an exported Gemstone Level is base, displayed, or effective for each supported account version. Account report shows `reportedLevel` and a **research-only hypothetical** `basePlusResearchHypothesis`, never uses that hypothesis to score.
- Validate non-multiplicative and contextual gemstone effects (hero damage reductions, Crit, special abilities), gear primary/secondary interaction and skill effects against the live game. Unresolved mechanics stay out of numeric scoring.
- Run full Node tests (`npm test`), data checks, all 18 damage/gold combinations at 22k+ SP, browser tests, and real in-game stage regression before removing the draft flag or publishing.

