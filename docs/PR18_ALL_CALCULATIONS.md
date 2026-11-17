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

## Substantial batch B1 — pet-pair score consistency and inventory safety (17 Nov 2026)

This batch addresses *three coupled recommendation defects*, not a complete
source-accurate account simulator.

1. **Damage/Gold pet pairing:** the old worker chose the winning Damage pet
   against one Gold pet, then changed the Gold pet without re-evaluating the
   first slot. With account-dependent Combat Techniques and a new optimized
   skill tree, that can produce a pair which was never jointly validated.
   `src/pet-pair-search.js` performs alternating coordinate passes, caches
   identical pair evaluations, checks the winning Damage pet against the
   *final* Gold pet and reports `converged:false` instead of claiming global
   correctness when the iteration cap is reached. At most three preselected
   candidates per slot; **not a guarantee of the best of 45 pets or all pairs**.
2. **Pet screening at unknown Combat Techniques levels:** `recommendPets`
   no longer presumes CT level 30 for every build. It samples level 0,
   one-quarter, half, three-quarters and the source-defined skill cap, and
   includes the actual incremental Exotic Equipment Pet CT A influence.
   This is a heuristic screening envelope, not a proven upper bound on the
   untested levels; candidates are re-optimized through the solver later.
3. **Truncated equipment imports:** 512 saved items are not a reliable
   *complete* item collection when the source had >512. The automatic gear
   shortlist is **suppressed** for truncated inventories; a user explicitly
   selecting a present item can still score that one item without pretending
   the remainder of the inventory is absent. Missing explicit selections,
   unsupported primaries/secondaries and uncertain equipment amplifiers are
   preserved as separate audit defects, never replaced with better-looking
   guessed equipment.

The unified scenario ledger now also reports a structured coverage object
(inventory completeness, missing/invalid choices, unmodeled sources, pet
selection validity, missing gear slots, unresolved Gemstones and Stage
HP/cross-skill limitations). UI messages are localized in English/French/
Ukrainian/Russian and clearly flag truncated gear and nonconvergent pet
pair choices. No score is advertised as a stage-gain prediction.

### New regression fixtures and verification commands

- `tests/pet-pair-search.test.js`: synthetic coupled pet/gold score table
  where a stale Damage winner demonstrably changes after Gold choice,
  nonconvergence, evaluation cache, missing slot, ties, invalid scores.
- `tests/pet-selection-envelope.test.js`: 0..CT-cap screening,
  source-dependent Exotic pet CT A advantage, real seasonal pets,
  source-specific gold eligibility.
- `tests/equipment-coverage.test.js`: truncated 513-row inventory,
  explicitly chosen surviving equipment, invalid explicit item, incomplete
  sources, invalid pet selectors, and raw account provenance.
- `tests/worker-pair-integration.test.js`: actual worker result must match
  the selected pet pair in its own score ledger; no automatic gear score
  from a truncated inventory.
- Fixed the older regression assertion that incorrectly classified
  `Pet20` (Jaws, FairyGold) as `GoldAll`.
- Run `npm test`, `npm run check:data`,
  `npm run bench:22k -- --all --sp 22600` (18 fixed-pet combinations),
  then `npm run bench:22k -- --all --sp 22600 --pair-search
  --profile /path/to/anonymized-account.json` (actual two-slot shortlist
  search; more expensive). No raw account export should enter Git or logs.

**The release gates remain open.** Even convergence among shortlisted pets
does not verify full cross-build optimality, in-game stage gains or effects
that still lack source-backed scaling rules.

## Substantial batch B2 — owned set multipliers × Crafting Power (17 Nov 2026)

This batch closes a substantial **missing numeric account baseline**: until
now, many unlocked equipment sets were merely listed in the dependency
catalog (other than the PerDay subset and selected spell/skill flags). The
static TT2 8.4 EquipmentSetInfo CSV contains **214 sets**, **354 bonus rows**
and **30 separate PerDay rows**. There are **78 non-PerDay, directly
source-typed damage/gold multipliers** with all three `Amount/Inc/Expo`
parameters, including 20 Unique equipment sets.

### Formula and numerical constraints

For a supported *multiplicative* bonus and integer Crafting Power `CP >= 1`:

```text
Bonus = Amount × Inc ^ ((CP - 1) ^ Expo)
log10(Bonus) = log10(Amount) + ((CP - 1) ^ Expo) × log10(Inc)
```

Source: `vendor/account-catalog.js` from TT2 8.4
`EquipmentSetInfo.csv`. Historical community explanation:
https://gamerch.com/taptitans2/379812 (Crafting & Equipment Set
Information), which specifically identifies the diminishing CP exponent and
exceptions such as mythic primary bonuses that do not improve with CP.
**Game version 8.4 parity remains to be checked against an export and in-game
set-power values**. The installed 8.4 CSV's `Inc` and `Expo` override old
hardcoded descriptions.

`src/account-permanent-sets.js` resolves independently:
- **permanent completed-set ownership** from the unlocked set collection;
  currently equipped or unsold pieces do NOT establish complete ownership;
- **Unique equipment** from explicit Unique ownership, an equipped item or
  present inventory and its game-source EquipmentID -> set mapping. The
  identity is canonicalized, so one Unique listed in several sources counts
  **once**;
- **Crafting Power** from the account export. A conflicting old UI value does
  not override it; an explicitly supplied value when not exported is marked
  unverified. If CP is *unknown*, only the guaranteed **CP=1 lower-bound**
  multiplier from `Amount` is scored and the missing CP boost stays
  unresolved;
- **direct damage/gold types** enter the fixed-account score once per
  source; these are account constants within a given damage/gold combination,
  not independently multiplied into the marginal score of every talent;
- **equipment-type boosts** (`SwordBoost`, `HelmetBoost`, `ArmorBoost`,
  `AuraBoost`, `SlashBoost`, `AllEquipmentEffect`) amplify only the
  supported primary bonus of the appropriate selected gear. The equipped
  item's secondary effects do not inherit primary-only multipliers.
- **all other bonuses** remain evidence with an explicit
  `conditional-or-additive-set-effect` status, not a guessed damage factor.
  PerDay rows continue through `src/account-set-bonuses.js` alone.

Additionally, the two source-catalogued `ActivePetLevel` set effects
(`Samurai` +25% and `Ninetails` / Lucky Fox Saint +10%) now contribute to
**active**, not passive, pet levels. They are resolved from completed-set
ownership and do not require retaining equipped pieces. They are *not*
reinterpreted as an account-wide Pet Damage multiplier.

### Verification

- New `tests/account-permanent-sets.test.js` covers catalog integrity,
  CP scaling at 1/2/5/9/100/500, no reported CP and lower-bound behavior,
  conflicting UI versus exported CP, permanent effects after equipment is
  sold, one-time Unique set ownership, explicit false/unowned sets, direct
  damage/gold source routing across **18** build combinations, equipment
  primary versus secondary separation, and Ninetails+Samurai.
- The account coverage ledger flags unknown CP, truncated owned sets,
  conflicting CP and conditional set effects. New UI explanations are in
  EN/FR/UK/RU.
- All changes remain a **provisional scoring layer** pending a real-player
  export with detailed CP/set multiplier values and the full Node/browser
  test suite. There is still no validated stage-gain simulator.

**Still missing:** all conditional/additive set effect chains (including
`EquipmentSecondaryDamageEffect`, `DamagePerEquipmentSet`, skill class
effects, spell count, cooldown, crit and GemstoneLevel), fully accurate
nonlinear hero damage conversions, complete PerDay crafting interactions,
actual game parity, and cross-build stage calibration. Keep PR #18 DRAFT.

## Batch C — 8.4 bonuses *per completed set* (17 November 2026)

The static 214-set catalog has five multiplicative effects that were previously
recognized but **not computed** because their value is contingent on the count
of other complete sets. The dependency is now explicit in
`src/account-permanent-sets.js`:

| Source effect | Required count | Route |
| --- | --- | --- |
| `DamagePerEquipmentSet` (Blacksmith) | Every distinct completed equipment set | AllDamage |
| `DamagePerMythicSet` (Mech / Mechanized Sword) | Completed Mythic sets | AllDamage |
| `DamagePerLegendarySet` (Diamond) | Completed Legendary sets | AllDamage |
| `DamagePerUniqueSet` (Collector) | Owned Unique sets | AllDamage |
| `GoldPerLegendarySet` (Midas) | Completed Legendary sets | GoldAll |

Each source's **Crafting Power-adjusted multiplier** is computed as in the
previous batch, then **raised to the verified category count** (add
`count * log10(multiplier)`, not `count * multiplier`). A complete
category count comes from the full exported unlocked-set collection, not
the player's current worn/retained gear. Explicitly owned Unique sets are
de-duplicated with the completed-set roster and remain permanent after sale.
Missing or truncated completed-set records, or unrecognized catalog IDs,
make the category count unverified: the per-set effect is **not scored**,
not treated as `count=0` nor estimated from inventory.

Individual permanent set multipliers still apply separately; neither the
per-set bonus nor the individual set bonus is counted twice. The set count is
independent of an optimizer candidate's SP allocation and remains in the fixed
account ledger. Equipment-primary boosters continue along their separate path
and do not multiply secondary rolls.

The source mechanic is confirmed by [Game Hive's Mechanized Sword patch
notes](https://www.gamehive.com/blog/tt2-devlog-30-v212-patch-notes/)
(`×2 All Damage per Mythic Set`) and [a TT2 community discussion on
per-set exponentiation](https://www.reddit.com/r/TapTitans2/comments/17hvccc/).
The contemporary 8.4 `EquipmentSetInfo.csv` catalog is the source for
Amount/Inc/Expo, set IDs and bonus categories. Exact in-game power parity,
particularly the interpretation of an export's Unique collection,
**still requires player validation**.

`tests/per-set-counts.test.js` covers: five actual catalog rows, expected
mythic/legendary/unique/total counts, arithmetic in log10 at CP5, sold items,
duplicate Unique sightings, absent or truncated complete-set collection,
inventory-only Mythic pieces, unknown-as-zero safeguards and the complete
6×3 matrix through `optimizeBuild`. UI report and coverage ledger now
disclose when the count is not verified.

**The public release gate is still closed.** Recomputing these immutable
account constants does not prove a better marginal SP allocation or accurate
stage prediction. No deploy from PR #18.


## Batch D — six source-verified skill-tree bonuses per allocated SP

Official Game Hive DevLog #140:
https://gamehive.com/blog/devlog-140-version-6-2-0-patch-notes/

The six Mythic sets `FairyKnight`, `FireKnight`,
`ElectricWarlord`, `WaterSorcerer`, `EarthRogue`,
`SteampunkKnight` each grant **×1.01 All Damage per actual skill point
allocated to their corresponding skill tree**. The versioned 8.4 catalog
uses `SkillTree*AllDamage` effect types; `Inc=1` means the factor is
independent of Crafting Power.

`src/skill-tree-set-effects.js` resolves proven completed-set ownership
(not live gear), maps the six types onto six branches and uses the exact
`Co0..CoN` cumulative source cost for every skill level. The new term
is incorporated **before optimization** inside `scoreAtLevel` rather
than incorrectly appended as a fixed account constant. Diagnostics
include per-branch spending, coefficients and total modeled effect.
The UI also discloses unverified ownership when the set collection is
absent, without inferring sets or asking for interminable manual values.

**Important:** for users owning *all six* sets and spending exactly the
same total SP, the per-SP addition is constant across branches. For
partial Mythic ownership it can alter which branch receives the next
SP. It still does not imply an accurate stage predictor.

Verification:
- Focused V8 checks: **5,184 / 5,184** on the 72 current source skills,
  18 Damage/Gold combinations and levels 0/1/5/Max, with actual
  8.4 vendor skill/bonus tables, checking the incremental difference
  precisely equals `log10(1.01) × cumulative allocated SP`.
- `tests/skill-tree-set-effects.test.js`: all 6 branches, 18 combo
  optimizer integrations, ownership permanence, missing/truncated roster,
  no double accounting, per-branch report.
- Must still run full `npm test`, `npm run check:data` and high-SP
  benchmark on CI. No direct game parity proof yet.

**PR #18 remains DRAFT; all release gates remain open.**
