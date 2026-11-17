# PR #18 — Complete TT2 v8.4 calculation engine

> **Implementation scope**, not a claim of completion. All systems below belong
> to this pull request; opening the PR does not mean their effects are already
> supported or proven. Do not merge until all source, integration, benchmark and
> gameplay gates are fulfilled.

## Goal and data contract

Calculate the highest-value skill-point allocation for each of the six supported
damage sources × three gold sources, with **the complete exported account**
as immutable input and only permitted optimization decisions (SP allocation,
two simultaneous active pets, selectable equipment). No unprovided game
inventory, level, set ownership, artifact enchantment flag or uptime is inferred.
All operations must be numerically stable in scientific/log10 space for high
Transcendence and 22,600+ SP accounts.

Unlike the historic weighted damage/gold proxy, the final model must have
**source-backed coefficient reductions, activation conditions and stacking
rules** for all applied effects, including nonlinear and conditional
interactions. A formula is not complete merely because the corresponding
source exists in a catalog. A derived effect must be applied **once** and
its provenance and active condition must be inspectable.

## Cross-system execution phases and open work

| Phase | Scope / remaining acceptance criteria |
| --- | --- |
| 0. Source import | Validate **real anonymized** TT2 8.4 JSON account exports, all 17 collection sections, 24 fixed gemstones, 45 pets, 52 monuments, 103 permanent artifacts, 214 equipment sets, 20 Unique items, 37 hero weapons, 18 Clan Scrolls, Titan Cards/Research; reject conflicts, missing fields, and old seasons. |
| 1. Account inventory | Resolve permanent set ownership even if pieces have been sold; resolve Unique items separately; correctly derive acquisition timestamps, Crafting Power, set tiers, late-game level boosters and set-level conditional formula branches. |
| 2. Resource progression | Titan Souls, Necrobear/Forbidden Research, 120 Titan Cards, Mystic Research GemstoneLevel, effective Gemstone rarity/levels and equipment-granted levels: distinguish balances/consumption from multiplier power and avoid double counting exported effective values. |
| 3. Artifacts | Primary effects for all 103 artifacts; enchantment magnitudes, EnchantmentMult, additive Artifact Damage, White Dwarf, Magnifier, Treasure of Fergus and conditional conversions. Prove stacking order and eligibility, including extreme-scientific levels. |
| 4. Transcendence | Season age, category rotation, all 52 monuments, enchantments, additive Monument Damage, season-day bonuses and caps; season-specific exotic/transcendent pet eligibility. No historical season leakage. |
| 5. Pets | All 30 permanent + 15 Transcendent: actual level scaling and resets, 5-level passive shares, simultaneously selected Damage and Support pets, active skill effects, equipment pets, Artifact/Gemstone/Rune boosts, additional set/hero/skill multipliers, attack-damage conversion and all dependent families. |
| 6. Equipment | Five selected primaries, all valid secondary effects, weapon and Gunblade reductions, helmet rotation, set/Unique boosts, Crafting Power, Ring of Calisto, Exotic pet primary boosts and probability/chance caps. Current selections must be checked against available inventory. |
| 7. Heroes | All 37 heroes and swords, complete hero weapon sets, Ringing Stone, Morgelai Sword, hero skills, hero-family/type and ascension bonuses, level-specific hero damage and source-specific damage reduction to each build. |
| 8. Clan Scrolls | All 18 categories, complete set calculation, nonlinear/additive scroll statistics, Quill/Old King/ScrollTutor/ScrollMaster and hero damage/gold conversion. Do not assume missing roster entries are level zero. |
| 9. Spells | Maximum active spell levels from game table, Fallen Angel and talent caps, duration, uptime, mana regeneration and cost, activation requirements, multicast/multi-stack, conditional casts, actual stage-dependent caps. |
| 10. SP talents | All 72 skills with exact sourced levels, dependencies, per-build reductions, tier requirements; interactions with 1–9 including Terrifying Pact/Forbidden/Royal Contract, Astral Awakening orb count, Hayst, Snap, dagger timing, lightning strike, Deadly Strike, companion and Gold Gun special mechanics. No unsourced universal reduction coefficient. |
| 11. Global optimization | Respect prerequisites, protected unknown conditional investments and total SP; compare all eligible pet and gear choices; no invalid independent 3×3 pet assumption; protect DP-cache signatures when context changes; handle nonadditive cross-branch interactions before claiming mathematical optimality. |
| 12. Absolute account model | Source-specific conversions and boss Titan HP curves; compute damage/gold and limit-stage feasibility for a given account, not merely an arbitrary weighted score. Farming speed/uptime must remain a separate scenario; automatic cross-build choice stays disabled until calibrated. |
| 13. Delivery | Four-language UI, transparent diagnostics, privacy-safe input handling, clipboard/in-game export round trip, mobile layout and SEO claims reflecting reality. |

## Hard invariants

1. **No repeated multiplier** when an effect appears as a pet passive, gemstone
   primary, equipment amplifier, set permanent effect and/or imported display
   value. Account-level constants must not be injected into each individual
   skill's marginal value.
2. **No fabricated game state**: unlocked sets come from the exported completed
   set collection, not inventory; pet selections do not imply ownership;
   uncertain saved SP effects are protected by default; historical seasons
   do not count as present-day bonuses.
3. **No silent unknown-as-zero**: unknown input is a provenance state; missing
   data is not interpreted as an actual 0 in a recommendation.
4. **No fake optimality claim**: the existing solver bounds only the explicit
   additive scoring proxy. Cross-skill, nonlinear, mana, conditional and
   timing interactions must either be scored accurately or remain excluded
   from the claimed objective.
5. **No stage prediction from log10 score** before validating the damage/gold
   reduction, HP scaling and push/farm scenario. Display source category and
   uncertainty.
6. **Numeric safety** up to 50,000 SP and scientific values (e.g. 1e9999).
   Every source value must be finite in its transformed domain and every
   computed component must explain its provenance.

## Implementation batches (all remain within PR #18)

- **Batch A (started):** one score ledger for skills + fixed account +
  selected gear + active pets above passives, identical manual/automatic
  aggregation, finite checks and no additive double-counting. An optional
  **18-build** benchmark reads a *local only*, sanitized account export;
  it emits no player identity or raw export.
- **Batch B:** complete the dependency graph and actual effect formulas
  across research, sets, artifacts, monuments, pets, gems, hero weapons,
  Clan Scrolls, all equipment secondaries and enchantments.
- **Batch C:** implement all 72 talent interaction paths, physical spell
  conditions and nonlinear cross-branch score corrections; validate
  all damage and gold source conversions.
- **Batch D:** optimize interchangeable gear + active pet slots with full
  interaction-aware scoring; ensure cache invalidation and deterministic
  recommendation and fallback on incomplete inventory.
- **Batch E:** add source-backed absolute push/farm estimates only after
  independent player export/screenshot calibration.
- **Batch F:** complete CI, browser and 22.6k+ SP performance regression,
  end-to-end player import/export, all four locales and manual gameplay
  approval.

## Required release evidence

- [ ] Full `npm test`, `npm run check:data` and source dataset parity.
- [ ] Source links / formula derivations for **every** modeled source,
  including full-set effects, enchantments, low-level pets, stage/uptime.
- [ ] Every applicable effect is either scored exactly once or explicitly
  reported as unresolved. No unexplained omissions.
- [ ] **All 18** damage × gold combinations across 0, low, medium and 22,600+
  SP with account fixture and missing-data fixture. `--all` must actually
  run 18 combinations, not the previous sample of 3.
- [ ] Two independent active pet slots, complete equipment set and sold-item
  permanence, full Gemstone + Necrobear chains, no historical season leakage.
- [ ] Actual TT2 export round trip including four languages and phone UI.
- [ ] Reproduce the observed Pet/Fairy loss of ~2,000 stages from issue #9
  with the original inputs and a winning baseline; reject regressive
  builds. Preserve conditional contract skills until confirmed safe.
- [ ] 22.6k/50k SP benchmark, exact/upper-bound distinction, memory and
  runtime evidence on constrained client hardware.
- [ ] Manual review and explicit sign-off; **no merge or GitHub Pages update**
  before these gates are complete.

## Current status

The branch inherits PR #17 as merged: a large account-import and
partial formula layer. **The PR #18 first batch is NOT a complete game
model** and cannot be advertised as predicting stage gains. All other
batches and validation gates above remain open.

Sources for further verification: TT2 maintained data in
`vendor/`, [Game Hive](https://www.gamehive.com/blog/),
[TT2 Compendium](https://www.tt2-compendium.com/), and
the [TT2 community](https://www.reddit.com/r/TapTitans2/).
