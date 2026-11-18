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


## Batch E — contract dependency and mana disclosure

The numerical model now shares one source-backed contract implementation:
`src/contract-scenarios.js` for Forbidden Contract, Royal Contract and
Terrifying Pact. Their source values are *maximum conditional* buffs, not
passive account power. The solver scores these only when full activation
is opted into, and insists that both prerequisite contracts exist. Pact's
gold bonus is conditional on Forbidden Contract and its damage bonus on
Royal Contract; the two must never be mixed or unconditionally added.

After optimization, `result.contractScenario` explicitly exposes the
observed skill levels, maximum damage/gold in logarithmic form, initial
mana drain coefficients, Titan reduction (not folded into damage),
and the impossibility of verifying sustained mana/ramp uptime from the
current export. The UI warning is localized in all four languages.
`calculateModeledScenario` now marks the unverified mana uptime in its
coverage gaps.

Test suite:
- `tests/contract-scenarios.test.js`: actual 8.4 bonus-table coefficients,
  full and partial pact dependencies, max-gated source score for all 18
  Damage × Gold combinations, initial mana consumption but no guessed
  uptime, and actual optimizer opt-in/opt-out integration.
- Independent 25/25 V8 numerical checks on the real 8.4 skill/bonus tables.
- Outstanding: complete Node tests and 22k+ SP/regression benchmarks,
  automatic extraction of unambiguous mana stats, sustained-uptime
  modeling when source-backed, and in-game 2,000-stage loss guard.

No stage gain is predicted; do not merge or deploy PR #18 yet.

## Batch F — research/resource integrity and source-backed linear coefficients (17 November 2026)

- Research source: 169 additive \`GemstoneLevel\` nodes from
  \`GemstoneResearchInfo.csv\` and 62 \`TitanSouls*\` nodes from
  \`TitanResearchInfo.csv\`. Each valid resource entry retains its exact
  \`level × EffectPerLevel\` contribution and source table. This is **resource
  progression**, not extra damage or gold, and never compounds into an
  already-exported gemstone multiplier.
- Titan/Necrobear research aliases are merged by canonical node ID. Identical
  cross-section purchases count once; disjoint nodes unite; same-section
  duplicate IDs, conflicting levels, missing/invalid levels and incomplete
  2048-entry sections are rejected with explicit reasons. A truncated
  research or Titan Card source is excluded from the fixed numerical account
  baseline rather than contributing a falsely complete fragment.
- Aggregate Titan Souls per-day/per-prestige additions, raw drop chance and
  Gemstone Research level additions are shown **only when verifiable from
  the entire present source**. Invalid or truncated input yields unknown
  totals, not zero, while individually verified rows remain audit evidence.
  Base/effective Gemstone level remains unknown; no invented capped chance,
  soul production rate, or stage gains.
- The 18-build coverage ledger reports rejected research nodes and
  truncation. The UI clearly distinguishes unknown aggregate resource
  rates in all four locales. Versioned browser imports were updated.
- Regression tests: both source catalog cardinalities and 18-build scoring,
  mirrored/contradictory/invalid Necrobear purchases, research and Titan Card
  truncation, scientific-value isolation, and anti-double-counting.

**Validation remains pending** for full \`npm test\`, \`npm run check:data\`,
22,600+ SP and actual gameplay. These are not declared successful without
execution. PR remains a draft and must not deploy or merge.

## Batch G — permanent artifacts, enchantments, additive damage and amplifier eligibility (17 Nov 2026)

**Real source data**: 103 permanent artifacts in the versioned `ARTIFACT_CATALOG`
(`vendor/account-catalog.js`, imported from the 8.4 game CSV).
`src/account-artifacts.js` computes each recorded main effect in
base-10 logarithms using `1 + EffectPerLevel × Level^GrowthExpo ×
EnchantmentMagnitude_if_enchanted`. For unbounded scientific levels this
avoids converting `1e9999` to Infinity; capped artifacts still require a
valid integer level. A missing enchant flag on an enchantable artifact is
unknown, not automatically false. `src/account-profile.js` now also
accepts the TT2 full-export boolean strings `"True"` and `"False"`.

**Game Hive DevLog #88 (v5.10)** explicitly adds fifteen named uncapped
artifacts to The Magnifier's target eligibility (including Heart of Storms,
Sticky Fruit, Titania's Sceptre and the skill-branch amplifiers), and four
to The Treasure of Fergus (Apollo Orb, Hades Orb, Laborer's Pendant,
Titania's Sceptre). These are now mapped by canonical artifact ID in addition
to generic uncapped damage/gold icon types. Titania's Sceptre is boosted by
both, but its Sorcerer skill interaction is *not* misrepresented as a direct
unconditional All Damage multiplier.
[Official v5.10 notes](https://gamehive.com/blog/devlog-88-version-5100-patch-notes-2633/).

The v5.19 post-release clarification from lemmingllama confirms that The
Magnifier also boosts **The White Dwarf**, despite White Dwarf being capped:
[DevLog #106 discussion](https://www.reddit.com/r/TapTitans2/comments/vu9fch/).
Using the current 8.4 catalog at capped level 40, Magnifier's coefficient is
`1 + .1125 × 40 = 5.5`; Fergus is `1 + .225 × 40 = 10`.
The logarithm of an eligible main effect is *multiplied* by that coefficient;
for Titania it is multiplied by both. Neither coefficient multiplies the
separate additive Artifact Damage pool.

**White Dwarf is counted exactly once per distinct, currently owned artifact.**
Explicit `salvaged:true` or `owned:false` export rows no longer count or
score. Duplicate mirrors are collapsed; level conflicts exclude the
conflicting main effect, but retain the uniquely established ownership
count. Unknown artifact IDs or truncated input make the total count
unverifiable; the White Dwarf derived multiplier is then excluded instead
of using a fabricated exact count. Its score is
`ownedArtifactCount × boostedWhiteDwarfMainEffectLog10`, routed once
to AllDamage, independently of direct artifact effects.

**Additive Artifact Damage** remains a conservative partial baseline:
sum verified `DamageBonus × level` contributions in log-sum-exp space, then
apply a *known* Heavenly Sword main effect once. This sum is independent
of Magnifier/Fergus and White Dwarf. Ambiguous main enchantments, missing
rows and source-specific enchantment-to-pool relationships are not claimed
to form a complete 8.4 damage formula. Fully truncated artifact sections
contribute *no* artifact score, even if an initial 512-row fragment parses.

**Integration**: derived White Dwarf and additive damage each enter the
fixed account `AllDamage` ledger once, not talent marginal scoring.
`accountIntegration.artifacts` and scenario coverage now expose source
counts, unknown IDs, salvaged rows, amplifier targets/factors, verified
White Dwarf count and truncated/partial baselines. Four-language UI
shows these values without claiming stages.

**Automated coverage**:
`tests/permanent-artifact-interactions.test.js` exercises the 5.10
target lists, double amplification, post-5.19 White Dwarf, boolean export,
enchantments/scientific levels, duplicate/conflicting amplifiers, salvaged
ownership, unknown/truncated sources, Heavenly Sword ordering and all
18 damage/gold optimizer combinations. The full Node suite and high-SP
benchmark must still be executed where the complete checkout is available.
No in-game 8.4 parity or stage progression is certified.

**Further work**: conditional skill/hero/artifact conversion, actual
artifact enchantment-to-damage-pool parity, artifact-related pet/equipment
dependency coefficients, full-stage calibration. Do not merge/deploy PR #18.

## Batch H — Transcendence season 13: additive Monument Damage and count-dependent main effects (17 Nov 2026)

### Verified source boundaries

- Season 13 began **12 August 2026**. Its official categories are
  **Celestial Temples, Journey of the Vipers, Kingdom of the Arcanas**.
  [Game Hive DevLog #231](https://www.reddit.com/r/TapTitans2/comments/1vlh4fk/).
  The source 8.4 catalog contains 52 monument definitions, of which 33
  have the current `IsActive` flag. That flag is *not* a substitute for
  an explicitly known season; unknown/old seasons cannot score monuments.
- Lemmingllama states in the
  [Monument Tier List](https://www.reddit.com/r/TapTitans2/comments/14ylq4a/)
  that **Monument Damage stacks additively**. Game Hive's
  [v6.11 patch notes](https://gamehive.com/blog/devlog-161-version-6-11-0-patch-notes/)
  confirm that the *uncapped Monument Damage exponent* was raised from
  0.425 to 0.53. The 8.4 catalog provides the applicable `DamageBonus`
  and `DamageExpo` for every current row (including capped 0.55 values).

### Calculation and integration

The previous implementation `log10(DamageBonus) +
DamageExpo * log10(Level)` described a polynomial-scale damage factor,
inconsistent with the game-scale multi-thousand-order Monument Damage
values. Batch H computes the independently sourced damage exponent:

```text
Individual Monument Damage = DamageBonus ^ (Level ^ DamageExpo)
log10(Individual) = log10(DamageBonus) * 10^(DamageExpo * log10(Level))
Total Monument Damage log10 = log10(sum(10^individualLog10))
```

For example, at level 19,410 with `DamageBonus=1e20` and
`DamageExpo=0.55`, the calculated source-derived log10 is ~4,565,
rather than ~22; its order of magnitude agrees with player-reported
large Monument Damage figures (historical patch values will differ).
This is source-supported **provisional 8.4 scaling**, not independently
checked against every in-game monument value.

- `src/account-damage-pools.js` uses a stable base-10 log-sum-exp; it
  rejects multipliers whose *logarithm* itself exceeds finite IEEE-754
  capacity (for example `Level=1e9999` with positive DamageExpo).
  No Infinity/NaN value enters the score.
- `src/account-monument-derived.js` contributes a **single additive
  Monument Damage AllDamage entry** to the existing fixed-account ledger,
  based only on current-season monuments with known ID, usable level,
  non-conflicting ownership and an official season rotation. No
  cross-branch SP credit, repeat-per-monument multiplication or
  season-12 legacy power.
- `EnchantmentMagnitude` continues to boost verified monument main
  effects, while `EnchantmentMult` is **kept separately as an
  unscored candidate** for Monument Damage; the exact placement of
  this enchantment multiplier in the damage stack remains unverified.
  The baseline therefore excludes this speculative enhancement.
  Missing enchant flags may block main effects but do not invent
  enchantment enhancements to the raw damage pool.
- The `GoldPerMythicSet` (King Cobra Statue) and
  `DamagePerEquipmentSet` (Thieves' Guild) main effects now use the
  **verified canonical count of completed equipment sets**, not owned
  items or equipped pieces. The main-effect log10 multiplier is
  multiplied by the appropriate count; if the unlocked-set roster
  is missing/truncated, the count-dependent main effect is excluded.
  Raw additive Monument Damage remains independent of those counts.
- `PerSeasonDay` effects and other conditional main effects remain
  explicitly unscored until per-day activation, limits and full game
  semantics can be verified. The season age is retained as a diagnostic,
  **not** a made-up time multiplier.
- The 4-language UI/ledger disclose eligible and excluded monuments,
  season, completed-set dependencies, unresolved enchantments,
  unrepresentable values and the additive AllDamage contribution.
  The result is still **not** a reliable stage predictor.

### Tests, sources and release gate

- `tests/monument-season-damage.test.js` covers category rotation,
  merged exports, salvaged/unowned items, old seasons, scientific
  scaling, unrepresentable values, additive algebra, enchantment
  separation, count-dependent main effects and the 18 Damage×Gold
  combinations through `optimizeBuild`.
- Existing `tests/account-power.test.js` regression expectations
  were corrected to use the exponential Monument Damage law.
- Complete `npm test`, dataset check, 22,600-SP benchmark, browser tests,
  and game-vs-source numeric parity must be run on a complete checkout.
  The account score remains provisional and the PR stays DRAFT.



## Batch I — equipment source reductions and coupled Aura primaries (17 November 2026)

The five equipped items are **not five independent multipliers**. Normal Aura
primaries are Sword/Helmet/Slash **Primary Effect boosts**, not unconditional
All Damage. Their source-specific bonus can only enter the score when the
target primary is explicitly selected and can be reduced to the active
damage/gold strategy. An aura may not manufacture a helmet or sword bonus
when its target is missing or unsupported. The target's own item-primary
amplifier and the aura's item-primary amplifier are calculated separately;
secondary rolls inherit neither boost.

Implemented in `src/equipment-scenarios.js` and
`src/equipment-reductions.js`: source-specific `TapDamage` and
`AllHeroDamage`/ `HeroDamage` coefficients from the pinned
`vendor/reductions.js`, plus direct 6-damage/3-gold-family reductions;
per-effect diagnostics distinguish inapplicable, unverified, and modeled
bonuses. The Aura shortlist depends on the chosen Sword/Helmet/Slash.
Explicit gear overrides trigger a *fresh Aura choice*, rather than using
an outdated Aura shortlist. The chosen setup also explores the **top two**
independently screened Sword/Helmet/Slash candidates jointly with eligible
Auras; a weaker standalone primary can win by enabling a stronger coupled
Aura. This is bounded candidate optimization, **not** global optimality over
all inventory items or hero-class rotations. The existing five exotic equipment pets, sets,
Gemstones and artifact primary amplifiers still apply once to the primary
slot only. All 18 source combinations are covered by targeted tests.

Source evidence:
- [Game Hive v6.2 patch notes](https://gamehive.com/blog/devlog-140-version-6-2-0-patch-notes/)
  (Elder Snow Cap All Hero primary; slot-specific secondaries)
- [TT2 Wiki equipment primary categories](https://tap-titans-2.fandom.com/wiki/Equipment)
  (Aura Sword/Helmet/Slash primary strength, not a standalone damage type)
- [TT2 Compendium Knight's Valor](https://www.tt2-compendium.com/sp/wiki/skills/knightsvalor)
  (TapDamage contributors)
- MIT-licensed `vendor/reductions.js` (damage-source conversion coefficients,
  with in-game 8.4 parity still requiring an anonymized export).

**Unresolved (not estimated):** Hero-family helmet rotation without actual
strongest hero and hero stat, crit and chance caps, duration/uptime, gunblade
patch-specific reductions, Unique per-resource primary values, secondary
probability effects and cross-pet/gear/SP optimization. The scenario score
is a **non-calibrated log10 proxy**, never a stage prediction. Imported
equipment categories and aura aliases must be checked against a genuine
TT2 8.4 export before claiming full coverage.


## Batch J — hero weapon sets / Clan Scrolls (17 November 2026)

Pinned 8.4 HelperInfo roster has **37 heroes**. Only a complete unique nontruncated 37-ID weapon level collection with valid nonnegative safe integer levels proves `completeSets = min(levels)`. Each verified full set contributes historical **×5 All Hero Damage**, or `completeSets × log10(5)`, **once** in the fixed account score. Source `vendor/reductions.js:AllHelperDmg` routes the same `AllHelperDamage` family from permanent artifacts and Clan Scroll #3 by damage build. It is not unconditional AllDamage and is never a per-SP talent bonus.

Individual hero weapon ×1.5 upgrades require the *dominant hero*, ascension and type; these remain unscored. Morgelai Sword, Ringing Stone, Quill of Scrolls, Old King's Stamp, MythicSmith and ScrollTutor are explicit **unmodeled amplifiers**: no double counting or unverified composition. The 18 Clan Scroll source categories are audited individually; unrecorded scrolls do not imply a full set, and a truncated scroll collection now scores **no fragment**. Additive scroll types remain outside the multiplier ledger. Diagnostics expose source gaps and an unverified specialized hero helmet as unsafe for automatic recommendation. UI diagnostic messages are translated to FR/UK/RU. No score is an in-game stage prediction.

Source: [Tap Titans 2 Wiki heroes](https://tap-titans-2.fandom.com/wiki/Heroes), [TT2 community guide](https://www.reddit.com/r/TapTitans2/comments/9nmj6m/), versioned 8.4 `vendor/hero-roster.js`, `vendor/clan-scrolls.js`, `vendor/reductions.js` and `vendor/account-catalog.js`. Regression tests in `tests/hero-weapons-scroll-routing.test.js` cover 18 build pairs and the real optimizer; full Node/22k/real-player validation still required. PR #18 stays DRAFT.


## Batch K — base-hero correction, 37 individual weapons, Ringing/Morgelai and dominant-hero class (17 Nov 2026)

**Correction to Batch J:** the historical hero weapon bonuses are BASE hero damage, distinct from source-reduced `AllHelperDamage` from artifacts/Clan Scrolls. The documented masteries do **not** suffer a second build-specific `AllHelperDmg` reduction. `src/account-power.js` now separately scores `BaseHeroDamage` once, while keeping the existing `AllHelperDamage` conversion for genuinely reduced artifact/scroll terms. This corrects prior underweighting on some builds; it is not an in-game stage estimate.

**Actual 8.4 catalog:** `vendor/hero-classes.js` records the 37 active HelperIDs and the precise Spell/Melee/Ranged classes from `HelperInfo.csv`. The importer retains a `dominantHero` ID and class **only** if an explicit supported export field identifies one uniquely and matches the source catalog; it refuses to infer a strongest hero from latest unlock, weapon levels, or conflicting/unknown IDs. The inventory/hero catalog alone is not a live hero DPS snapshot.

**Source-backed weapon arithmetic:** all 37 per-hero weapon levels remain individualized. `log10(weapon bonus for a given hero) = weaponLevel × log10(1.5 × morgelaiFactor)`; at a verified capped Morgelai level 50, `morgelaiFactor=1.5`, so each weapon is ×2.25 for that **hero**. These terms are computed and audited but **not** added to an AllDamage/AllHelperDamage aggregate without verified hero DPS weights, level/ascension and actual total-damage composition. Similarly, verified capped Ringing Stone amplifies the completed-set base to `fullSets × log10(5 × ringingFactor)`; at level 50, the historical per-set base is ×7.5. Missing/conflicting/partial artifact data do not fabricate either booster. Each booster is used at most once; MythicSmith, ScrollTutor and seasonal/Worldshaper dependencies remain diagnosed but unscored until their interaction is confirmed.

**Helmet dependency:** the auto shortlist for Pet/Clan Ship only excludes Ranged/Spell/Melee helmets of an incompatible class when an **explicit** dominant hero ID is recognized. Otherwise the old unverified rotation is preserved for evidence, with automatic recommendation still marked unsafe if a class-specific helmet is selected. A valid hero ID narrows class eligibility but does **not** magically prove class helmet damage, contribution share or stage gain. The bounded Aura coupling and 2-per-slot search are preserved.

**Tests/diagnostics:** `tests/hero-weapons-scroll-routing.test.js` updated for corrected base route; `tests/hero-dominance-and-boosts.test.js` covers 37 source classes, explicit/conflicting dominance, ×2.25/×7.5, invalid artifact evidence, 18 damage×gold combinations and gear class gating. UI diagnostics localized EN/FR/UK/RU and cache versions synchronized. **Release gates remain open**: full Node suite, actual 22,600 SP and pet-pair benchmarks, live TT2 8.4 artifact numbers, hero dominance, helmet DPS and stage progression.

**Sources**: [lemmingllama's resource guide (v5.19)](https://gamerch.com/taptitans2/380266) (base damage distinction, ×1.5 individual and ×5 complete, Morgelai/Ringing 50%), [Game Hive v6.5](https://gamehive.com/blog/devlog-146-version-6-5-0-patch-notes/) (Clan Scroll rework and Quill/Stamp effects), [Game Hive v7.11 Worldshaper](https://www.reddit.com/r/TapTitans2/comments/1kzavgy/) (boost scaling, not guessed in the current score), pinned 8.4 CSV and catalog. Exact 8.4 in-game parity not certified.

## Batch L — hero-weapon and Clan Scroll booster dependencies (17 November 2026)

Verified pinned TT2 8.4 EquipmentSetInfo.csv catalog: MythicSmith is a permanent
completed-set bonus with two independent bonus types: HelperWeaponBoost=1.25
and HelperWeaponSetBoost=1.25; both have Inc=1, so are CP-independent.
Only explicit completed-set ownership from a non-truncated account collection
can activate this pair, even after the set's equipment pieces are sold.

Full 37-hero weapon sets enter the fixed BaseHeroDamage ledger ONCE:
  fullSets * log10(5 * RingingFactor * MythicSmithSetFactor).
Individual hero weapon levels remain auditable, NOT global AllDamage:
  level * log10(1.5 * MorgelaiFactor * MythicSmithIndividualFactor).
At source level 50, Ringing and Morgelai each contribute x1.5;
with MythicSmith the full-set factor is x9.375 and the individual weapon
factor x2.8125. Individual hero DPS, hero ascensions, levels, class
damage shares and specialized helmet coefficients are not known reliably
from the present export; they are never added as universal damage.

Artifact92 Quill of Scrolls (ClanScrollBoost) and Artifact93 Old King's Stamp
(ClanScrollSetBoost) are both capped at 50, with main-effect formula
1+0.005*level; at 50 both give x1.25. Separate targets prevent double count:
  scroll_effect_log10 = level*log10(scrollBonusAmount)
  boosted = scroll_effect_log10 * QuillFactor
  set_percent = fullSets > 0 ? (0.05 + (fullSets-1)*0.10) : 0
  final_boosted = boosted * (1 + set_percent * StampFactor)
This follows the 6.5 scroll-set percent definition and the two distinct
8.4 bonus types. The combination is a SOURCE-BASED PROVISIONAL model:
the exact in-game ordering still requires independent account comparison.
Do not score additive ManaPoolCap, ManaRegen, TapDamageFromHelpers scroll
rows as multipliers. Partial scroll rosters never establish a set count.
Unknown/contradictory/truncated/recycled amplifier inputs do not produce
additional power: diagnostics expose the missing or conflicted factor.

ScrollTutor source rows use ClanScrollBoost=0.25 and
ClanScrollSetBoost=0.25 (ADDITIVE coefficients). Their combination with
Quill and Stamp is not proven: their values remain audit-only, NOT x0.25.
Worldshaper is mentioned by the 7.11 community notes, but its numerical
row is absent from the current pinned 8.4 EquipmentSetInfo-derived catalog.
Worldshaper is unscored, with an explicit source-gap diagnostic.

Integration: src/hero-progression.js, src/account-scrolls.js,
src/account-power.js, src/account-dependencies.js, src/engine.js,
src/calculation-ledger.js; translated diagnostic messages in
src/app.js and src/i18n.js (EN/FR/UK/RU). Four HTML entrypoint script
cache URLs and app/worker/engine imports use 20261117-hero-scroll-l.
Nothing is deployed to GitHub Pages.

New tests/hero-scroll-amplifier-stack.test.js declares ten Node tests:
source rows, sold equipment, stacking, invalid ownership, incomplete
rosters, conflicts, additive guards, 18 fixed build routes and 18
native optimizeBuild integrations. Prior mixed Ringing/MythicSmith
assertion is adapted in tests/hero-weapons-scroll-routing.test.js.
These tests MUST be executed with the full Node checkout before a release.
V8-only targeted module checks are distinct from native npm test.

Release gate remains closed: log10 weighted proxy is not a prediction
of stages, and the observed Pet/Fairy circa 2,000-stage regression has
not been validated as fixed. Next large lot: hero ascension and strongest
hero DPS from verified exports, Worldshaper/ScrollTutor source stacking,
then complete Node tests and 22,600 SP in-game calibration.

Sources: TT2 8.4 pinned vendor/account-catalog.js and
vendor/clan-scrolls.js; Game Hive 6.5 Clan Scroll rework
https://gamehive.com/blog/devlog-146-version-6-5-0-patch-notes/ ;
worldshaper discussion https://www.reddit.com/r/TapTitans2/comments/1kzavgy/ .


## Batch M (2026-11-17) — Display-name aliases, additive scroll lanes, hero snapshots

This section **supersedes** the Batch L claim that Worldshaper and
ScrollTutor have no source-backed numerical application. The internal
8.4 catalog uses different identifiers from the names announced by Game Hive:

| Public mythic set | Internal 8.4 set ID | Verified primary bonus rows | Evidence |
| --- | --- | --- | --- |
| **The Worldshaper** (7.11) | `MythicSmith` | `HelperWeaponBoost=1.25`, `HelperWeaponSetBoost=1.25` | Game Hive DevLog #189 + EquipmentSetInfo 8.4 |
| **Dragon Weaver** (7.4) | `ScrollTutor` | `ClanScrollBoost=0.25`, `ClanScrollSetBoost=0.25`, both additive | Game Hive DevLog #171 + EquipmentSetInfo 8.4 |

Public names, optional "The", and existing internal IDs normalize to **one**
canonical ID, from the unlocked **permanent completed-set** collection.
Two aliases in a save do not imply two owned sets and are explicitly
diagnosed as mirrored entries. Partial collections are not inferred from
currently-held gear. Existing `MythicSmith` and `ScrollTutor` internal
identifiers remain supported. **The numerical secondary Prestige Relic
effect is NOT inferred from this crosswalk**: the public patch text and
the pinned CSV require a separate formula audit, so only the two primary
weapon/scroll rows are asserted by this alias.

### Worldshaper, per-hero weapons, hero levels

The 37-hero full-weapon-set fixed baseline remains

```
log10BaseHero = verifiedFullSets *
  log10(5 * RingingStoneFactor * WorldshaperSetFactor)
WorldshaperSetFactor = 1.25 when permanently owned
individualHeroWeaponLog10 = heroWeaponLevel *
  log10(1.5 * MorgelaiSwordFactor * WorldshaperIndividualFactor)
WorldshaperIndividualFactor = 1.25 when permanently owned
```

The full-set base enters the fixed ledger **once**, with no damage-source
reduction. Individual-hero weapon multipliers are **still diagnostic only**:
the optimizer does not know their marginal effect on the sum of DPS over
all heroes, or their interaction with the currently-equipped helmet.

An optional **explicit** `heroLevels` / `HeroLevels` / `heroProgression`
section can supply records containing `id`, `level`, `ascension`,
and optional `dps` in scientific notation. These records are **not
fabricated** from the weapon inventory. The strict 37-ID roster checks
duplicates, invalid levels and ascensions, truncated sources, and unknown
IDs. When all 37 current DPS values are present, stable log-sum-exp
derives the current DPS and Melee/Ranged/Spell shares; a conflict with
explicit DominantHeroID is diagnosed. An all-zero DPS roster does not
produce a speculative dominant hero. Current DPS already contains weapon
and equipment effects: **do not add it to fixed damage** or claim a
helmet/hero optimum until a genuinely unboosted level/ascension damage
model and 8.4 stacking rules are verified.

### Dragon Weaver and Quill/Stamp

The 8.4 `ScrollTutor` primary `Amount=0.25` means **+25%**
(`1 + 0.25 = 1.25`), never `×0.25`. When Dragon Weaver is verified
and its respective lane has no competing owned amplifier, apply

```
individualFactor = QuillFactor * (DragonWeaverIndividualEligible ? 1.25 : 1)
setPercentFactor = StampFactor * (DragonWeaverSetEligible ? 1.25 : 1)
baseScrollLog10 = scrollLevel * log10(scrollBonusAmount)
modeledScrollLog10 = baseScrollLog10 * individualFactor *
  (1 + verifiedCompleteSetPercent * setPercentFactor)
```

DragonWeaverIndividualEligible requires no owned Quill; set eligibility
requires no owned Stamp. This intentional *lane isolation* avoids
inventing whether +25% is added or multiplied to the artifact's
improvement. If both Quill and Dragon Weaver are owned, count only
the previously verified Quill individual lane; independently count
Dragon Weaver's set lane if Stamp is absent. If both Quill and Stamp are
owned, count neither Dragon Weaver lane until cross-stacking is proven,
and mark `dragon-weaver-artifact-cross-stack-unverified`. This is an
**incomplete lower bound**, not a complete stack model. Three additive
resource scroll categories remain unscored. Missing 18-scroll roster
cannot establish any number of full scroll sets.

### Integration, tests, gates

Files: `src/equipment-set-aliases.js`, `src/hero-levels.js`, plus
profile/hero/scroll import, fixed score, dependency DAG, optimization
coverage, translated diagnostics and four HTML entrypoints. Cache marker:
`20261117-hero-scroll-m`. The source of the public labels is verified
against pinned primary rows; these aliases are not generic normalization
of every unknown set in the game.

New `tests/hero-scroll-lot-m.test.js`: 12 native Node test cases covering
the two aliases and mirrored IDs, long scientific DPS, conditional
two-lane stacking, 18 fixed Damage×Gold routes, and 18 native optimizer
integrations. Existing Batch L tests are adjusted to account for the
verified standalone Dragon Weaver effect. **Declared Node tests are not
proof they ran.** For release, execute `npm test`,
`npm run check:data`, `npm run bench:22k -- --all --sp 22600`,
pair-search and compare a real 8.4 account with in-game progress.
Keep the PR DRAFT, no merge, and no GitHub Pages deployment.

Provenance:
- Game Hive DevLog #171, Dragon Weaver:
  https://gamehive.com/blog/devlog-171-version-7-4-0-patch-notes/
- Game Hive DevLog #189, The Worldshaper:
  https://gamehive.com/blog/devlog-189-version-7-11-0-patch-notes/
- `vendor/account-catalog.js` 8.4 primary bonus rows.
- Game Hive 6.5 Clan Scroll:
  https://gamehive.com/blog/devlog-146-version-6-5-0-patch-notes/

**Still open for Batch N or a dedicated formula gate:** exact
Dragon Weaver × Quill/Stamp stacking, ascension and individual hero
level DPS, specialized helmet class reductions, unverified relic
secondary effects, complete native test/benchmark pipeline and
the Pet/Fairy ~2,000-stage regression. The log10 scoring proxy remains
uncalibrated; no stage estimate is certified.


## Batch N — 2026-11-18: TT2 8.4 spells, six-slot loadout, cap SP effects and mana evidence

### Source contract and anti-double-count gates

- TT2 8.4 `vendor/spells.js` / `vendor/active-spell-caps.js`
  (ActiveSkillInfo.csv) provide **11 spell IDs**, A/M at **levels 1–40**
  (A0/M0 = level 1, A29/M29 = 30, A39/M39 = 40), base
  cap 30, mana costs and source duration/cooldown fields. Spell effects
  have per-build damage/gold reductions from `spell_reductions`.
  The **six simultaneously equipped spell slots** do not mean that all
  11 can be credited. Spells requiring talents are unavailable until
  that unlock is purchased.
- Optional six-slot **actual export** aliases:
  `selectedSpells` / `SelectedSpells` /
  `equippedSpells` / `EquippedSpells`; the parser stores only
  allowlisted, sanitized spell IDs in `profile.spellLoadout`, not raw data.
  Duplicate, unrecognized, missing, conflicting or **more than six**
  spell records NEVER establish a valid equipped loadout. Imported
  spell level dictionaries are NOT converted to selection data.
  No additional manual form is required, but not all game export
  formats expose this section; missing information remains a diagnostic.
- A valid loadout plus **maximum-spell activation scenario** is required
  before the six *baseline* main effects are scored. The pre-existing
  max-stage >= 15,000 convention remains an **explicitly labeled
  assumption**, NOT evidence that those spells are currently active
  or sustained. `assumeMaxSpells=false` overrides that convention.
- New `src/spell-scenarios.js` resolves the 6-slot source and applies
  `baseSpellLog10 = log10(ActiveSkillInfo.A[(baseCap + FallenAngel) - 1])`
  only for **currently unlocked selected spells**. In detail, the base
  is level 30, or 35 with verified Fallen Angel. Damage and gold are
  reduced with exact per-spell `spell_reductions`, and gold is
  additionally weighted once by `settings.goldWeight`.
  No multipliers are invented for missing A levels beyond the table.
- The **SP-induced bonus cap** from Twilight Bell,
  Echoflurry Onslaught, Phantom Blades and Ancient Mastery is *already*
  a marginal effect in `scoreAtLevel` and must not also be inserted
  into the scenario baseline. Their per-spell caps are taken from the
  8.4 skill B rows. Only credit marginal spell strength when its spell
  is among the actual six, the source is a max-level scenario, and
  any cross-branch unlock is **provably purchased** through a minimum
  / explicitly preserved current investment. The separable branch-DP
  cannot presume a future different-branch skill will be purchased.
  Unknown cap value may understate a real synergy, but does not
  manufacture a source-backed multiplier.
- Missing or incomplete loadout instead protects existing
  spell-cap skill investments in the optimizer, preventing a
  Pet/Fairy or another build from selling proven in-game talents
  solely because their contribution is not numerically understood.
- `recommendSourceSpellSlots` provides up to six **notional source-only
  candidates** based on eligible spell A rows, exact reductions and
  the chosen Damage×Gold context. These are **not equipped**, not
  mana/uptime optimized, and **never added to the score**. This
  avoids requiring players to type all their spell values.
- Actual scenario ledger adds the **selected base spell value only**
  as a conditional **fifth component**:
  `total = skillSP + fixedAccount + gear + activePetsAbovePassives
       + selectedBaseSpellLog10`.
  `accountAdjustedScore = skillSP + fixedAccount` remains unchanged;
  the cast baseline is not falsely called a fixed permanent account
  bonus. Source-based cap deltas remain marginal inside skill scores.
  This is still a **proxy**, not an actual stage projection or a
  proof of globally optimal spell loadout.

### Mana: exact raw source rows, no guessed sustain

- New `src/mana-evidence.js` reports
  `MPCapacityBoost` (Limit Break), `ManaStealSkillBoost` (Mana
  Siphon) and `ManaMonster` (Manni Mana) source A/B values
  at the **chosen actual SP levels**, without inventing mana proc
  frequency, cast frequency, mana-per-minute, duration extension or
  effective combat uptime. Exact selected spell base/final M rows are
  retained; the total **one cast per selected spell** mana cost is
  shown separately from the already-modeled conditional contracts'
  **initial drain** (which grows over time). Multiplayer multicast
  costs and precise active durations still require formulas.
- `Mana Pool` / `Mana Regen` may optionally appear in the exported
  final player stats. These are **already effective values** and
  must never be multiplied by Limit Break, Clan Scrolls or Titan
  Research again. The comparison with one-cast gross cost is a
  static snapshot, **not** a sustainability or full-uptime proof.
- Source durations and cooldowns are audit metadata only.
  Mana sufficiency, spell casts, contract ramp and resource-limited
  optimization remain **unverified** and cause explicit coverage gaps.

### Integration and tests

Files: `src/spell-scenarios.js`, `src/mana-evidence.js`,
`src/account-profile.js`, `src/spell-caps.js`,
`src/effects.js`, `src/engine.js`,
`src/calculation-ledger.js`, `src/app.js`,
`src/i18n.js`, `src/worker.js`, four localized HTML
entrypoints, and the two audit documents. New revision
`20261118-spell-mana-n` propagates across entrypoints/worker/engine
module imports without publishing Pages.

`tests/spell-scenarios-lot-n.test.js` declares **16 Node tests**:
11-source/6-slot contract, export parse, conflicts/truncation,
primary A29 routing and M29 costs, Fallen Angel A34, activation
opt-out, 4 cap skills/unlock minima, source-only recommendation,
mana evidence/initial contract drain, 18 fixed Damage×Gold routes,
18 native `optimizeBuild` / `calculateModeledScenario` cases and
absence of unverified stage claims. These tests must run in native
Node before release. Targeted V8 sandbox checks are NOT equivalent
to `npm test`.

Remaining release gates: `npm test`, `npm run check:data`,
`npm run bench:22k -- --all --sp 22600`, pair search, game export
loadout verification, actual boss-stage mana/uptime and in-game
Pet/Fairy regression comparison. **Do not merge or deploy**.
This work does not calibrate the log10 proxy or resolve observed
stage regressions. Unproven cross-branch spell/perk synergies,
multicast resource requirements, effects scaling with *number of
active spells*, and true cast schedules are still unresolved.

Source references: `vendor/spells.js` and `vendor/skills.js` TT2
8.4; source repository https://github.com/rawrzcookie/TT2_CSV ;
Game Hive 7.17 DevLog
https://gamehive.com/blog/devlog-205-version-7-17-0-patch-notes/ ;
8.4 DevLog
https://gamehive.com/blog/devlog-239-version-840-patch-notes/ ;
Compendium mana guide
https://www.tt2-compendium.com/fr/builds/build/pet-fairy ;
six-slot player discussion
https://www.reddit.com/r/TapTitans2/comments/oohl85/ .

 
## Lot O — 18 novembre 2026 : interactions pets, passifs, équipements, gemmes et bonus croisés

### Modifications implémentées
- Les passifs `AllHelperDamage` et `TapDamage` de familiers Legacy et Transcendent, jusque-là inventoriés mais exclus du ledger fixe, sont intégrés comme multiplicateurs **réduits par build** selon les coefficients épinglés `vendor/reductions.js` : `AllHelperDmg[damage]` et `TapDmg[damage]`. Cela prend en compte aussi le bonus permanent `TapDamage` d'artefacts vérifiés (exemple : Drunken Hammer). Aucun passage fictif en `AllDamage` ni double comptage avec l'actif ou les SP.
- Les pets actifs `AllHelperDamage` et `TapDamage` entrent dans la sélection et l'échantillonnage Combat Techniques avec leurs réductions sources, notamment Tap partiel en Gold Gun, inapplicable en Clan Ship. Les candidats sans niveau positif fiable dans l'export ne sont pas proposés.
- Une même famille d'équipement peut être amplifiée par **plusieurs familiers distincts** : les passifs exotiques `Pet26` à `Pet30`, combinés avec les familiers transcendants `SeasonalPet1` (Armor), `SeasonalPet6` (Helmet), `SeasonalPet14` (Aura), `SeasonalPet15` (Slash), sont sommés une fois **par ID de pet** en log10. Ancien problème : le `.find()` ignorait une partie des sources. Les effets demeurent attachés au primaire de l'équipement sélectionné; aucune secondaire n'est artificiellement amplifiée.
- **Cumul non prouvé exclu :** `Restored Rune Heart` (`Artifact46`) et les gemmes `EquipmentPetEffect` restent appliqués aux cinq pets exotiques d'équipement explicitement concernés. Leur application à un pet transcendant portant le même `*Boost` est non certifiée en TT2 8.4 : le passif saisonnier indépendant peut compter, mais son amplification par cette rune/gemme n'est pas inventée et est signalée par `seasonal-equipment-pet-rune-stack-unverified`.
- Les rapports par build exposent sources de passifs, effets saisonniers d'équipement, routes conditionnelles exclues et incertitudes de stacking. Cache-bust `20261118-pet-equipment-o` dans les imports et les **quatre** pages HTML, sans publication GitHub Pages.

### Tests/validation, règles et limites
- Nouveau `tests/pet-equipment-lot-o.test.js` : 9 tests Node **déclarés**, comportant 18 combinaisons Damage×Gold du routage fixe et 18 appels `optimizeBuild`/ledger à 0 SP; cas d'export manquant/contradictoire, pets Legacy/Transcendent, double-source équipement, rune/gemstone, grand exposant `1e9999`, effet `TapDamage` d'artefact.
- Les tests Node, `npm test`, `npm run check:data`, benchmark `--all --sp 22600`, pair-search, navigateur, CI et in-game restent à **exécuter effectivement** avant publication. Ne pas confondre les tests ciblés V8 et la suite native.
- Les familiers `CritDamage`, `JackpotGold`, `MultiMonstersGold`, les effets secondaires non sourcés et les mécaniques d'attaque des familiers restent non réductibles sans contrôle d'une vraie partie; les bonus saisonniers autres que les valeurs exportées demeurent incertains. Le modèle ne prédit aucun nombre réel de stages. Régression Pet/Fairy précédemment observée : gate **bloquante**, non démontrée corrigée.
- Sources : catalogues 8.4 versionnés `vendor/pets.js`, `vendor/transcendent-pets.js`, `vendor/reductions.js`, `vendor/account-catalog.js`; [Game Hive, Pets FAQ](https://gamehive.helpshift.com/hc/en/3-tap-titans-2/faq/88-what-are-pets-and-how-do-i-level-them-up/), [TT2 Compendium, Combat Techniques](https://www.tt2-compendium.com/pl/wiki/skills/combattechniques), [Game Hive, v8.4](https://gamehive.com/blog/devlog-239-version-840-patch-notes/). Les comparaisons sur export réel restent requises.

**Suite recommandée, lot P :** terminer les dépendances de buffs/attaques actifs, probabilités et secondes statistiques d'équipement avec valeurs TT2 vérifiées, commencer calibration des effets DPS → HP de stage; en parallèle exécuter la suite native complète et les benchmarks 22 600 SP, puis reproduire les exemples réels du clan. PR #18 **DRAFT**, ni fusion, ni Ready for Review, ni Pages.

 
## Lot P — 18 novembre 2026 : couplage actif pets × équipement × SP et conditions de bonus

### Calculs et parcours réellement implémentés
- **Garde d'amplificateur commune :** `verifiedEquipmentPetAmplifierTarget` isole les cinq pets exotiques d'équipement (`Pet26`–`Pet30`). La Rune Heart et les gemstones `EquipmentPetEffect` sont appliquées uniquement à ces IDs, dans **les deux voies** : passif d'équipement et pet actif. Les pets transcendants de même famille sont pris en compte à leur valeur intrinsèque sans leur inventer cet amplificateur. `petScenarioEvidence` signale l'exclusion de la voie saisonnière non démontrée.
- **Cohérence source des sets :** `activePetSetLevelBonus` n'accepte plus le drapeau historique `settings.sets.Samurai` : l'augmentation de niveau actif provient uniquement de l'acquisition permanente du set attestée par une collection non tronquée de sets débloqués. Les pièces peuvent être revendues sans perdre le bonus. Un ancien lien ou cache de formulaire ne crée plus de faux +25 %.
- **Cooptimisation bornée des pets et de l'équipement :** les deux meilleurs candidats par slot de cible et les Auras compatibles sont classés avec `petScenarioScore` **du couple actif réel**. Une Sword primaire TapDamage qui gagne en score autonome peut perdre face à AllDamage lorsqu'un pet d'équipement actif préfère une réduction différente. Ce terme actif ne sert **qu'au classement de l'équipement** ; le registre final conserve `equippedGearLog10` indépendant et `activePetsAbovePassivesLog10` une seule fois. Le worker recalcule maintenant `gearSelectionEffects`, les poids d'objets, `optimizeBuild` et `calculateModeledScenario` **pour chaque couple évalué** ; l'équipement retourné correspond au couple gagnant. Ni optimum global sur l'inventaire ni convergence Pet×Gear×SP entière ne sont certifiés.
- **Effets secondaires conditionnels :** `equipmentSecondaryEvidence` distingue explicitement les bonus connus mais non convertibles sans activation : critique, chance/probabilité, Jackpot et Multiple Titan Gold. Ces effets sont diagnostiqués et exclus du score de combat final, au lieu de traiter `1e9999` de gold conditionnel comme un AllDamage. Les secondaires TapDamage/HeroDamage et effets directs disposent déjà des réductions sources du lot I et restent indépendants des boosteurs primaires. `modeledScenarioCoverage` publie `unverified-conditional-equipment-secondaries`.
- **Diagnostics/localisation/cache :** quatre langues FR/EN/UK/RU, état de recherche couplée, sources de boost équipement, cumul saisonnier non prouvé et compte de secondaires conditionnelles. Cache-bust `20261118-pet-coupling-p` appliqué aux imports et aux quatre pages HTML. Pas de GitHub Pages.

### Contrôles, limites et sources
- Nouveau `tests/pet-gear-lot-p.test.js` : **9 tests natifs déclarés**, dont les 18 couples Damage×Gold via `optimizeBuild` + registre ; Rune+gemstone active/passive, sets achetés vs faux drapeau manuel, changement réel de Sword selon pet actif, secondaire critique/Jackpot/Chance non scorée, examen du véritable worker et régression Pet/Fairy explicitement bloquante.
- L'état des tests **réellement exécutés** est à détailler dans le commentaire GitHub du lot. Ne pas annoncer `npm test`, `check:data`, benchmark `22 600 SP`, tests navigateur, CI ou vraie partie comme réussis sans exécution.
- Les sorts au cap et l'uptime ne prédisent pas le déroulement du boss ; les chances critique/Jackpot, la fréquence Multiple Titan Gold, le dégât d'attaque des familiers et le jeu au réel nécessitent des sources de déclenchement et des captures. On ne peut pas obtenir une estimation fiable de stages à partir du score proxy. **La régression Pet/Fairy observée reste non corrigée par preuve.**
- Sources : `vendor/pets.js`, `vendor/transcendent-pets.js`, `vendor/reductions.js`, `vendor/skills.js` version 8.4 ; [TT2 Compendium Combat Techniques](https://www.tt2-compendium.com/pl/wiki/skills/combattechniques) (désigne nommément Annabelle, Cosmos, Effie, Percy et Taffy) ; [Game Hive Pets FAQ](https://gamehive.helpshift.com/hc/en/3-tap-titans-2/faq/88-what-are-pets-and-how-do-i-level-them-up/); [TT2 Wiki équipement](https://tap-titans-2.fandom.com/wiki/Equipment) (secondaires de Chance/Jackpot/Multiple Titan Gold) ; [DevLog 8.4 #239](https://gamehive.com/blog/devlog-239-version-840-patch-notes/).
- **Prochain lot Q :** calculs dépendants d'activation des pets et secondaires seulement avec distributions sourcées et données exportées, conversion DPS réel → stage HP et calibration Pet/Fairy via véritables mesures ; suite de tests Node/native et benchmarks 22 600 SP exigés comme gate. Conserver PR #18 ouverte **DRAFT**, ne pas fusionner, pas de Ready, pas de Pages.


## Lot Q — 18 novembre 2026 : couples familiers complets dans la shortlist et screening des équipements

**Correction fonctionnelle 1 :** l'ancien coordinate descent pouvait s'arrêter
sur D1/G1 supérieur à D2/G1 et D1/G2 alors que D2/G2 était meilleur.
Le worker utilise désormais `selectPetPair(...,{exhaustiveShortlist:true})`
pour évaluer tous les couples de sa shortlist 3×3 (au plus neuf).
Chaque couple recalcule son équipement, ses poids de primaires, l'allocation
SP puis son ledger; les mêmes couples ne sont pas évalués deux fois.
Les anciennes recherches par alternance restent disponibles pour les
appelants qui n'activent pas le mode exhaustif.

**Correction fonctionnelle 2 :** la présélection des pets ne dépend plus
uniquement de l'équipement sélectionné avant que le pet actif soit connu.
`petCandidateGearWeightEnvelope` examine chaque primaire d'équipement
possédé, compatible et numériquement reconnu dans un inventaire non tronqué.
Il conserve la meilleure **réduction de source** réalisable par slot pour
comparer les candidats ; les Auras requièrent un primaire compatible réel.
Cette borne sert seulement à classer les candidats et **n'est jamais ajoutée
au score final**. Après sélection, le worker recalcule les vrais équipements
et l'optimiseur pour chaque couple. La meilleure réduction par slot n'est
ni une multiplication supplémentaire ni une garantie d'un ensemble
simultanément réalisable.

Aucun avertissement technique supplémentaire en interface : le flux joueur
reste simple. Les effets secondaires critiques, Jackpot Gold, Multiple
Titan Gold, probabilités et dégâts d'attaque active des pets restent exclus
en l'absence de distribution source complète et d'équivalence 8.4 vérifiée.
La méthode cherche exactement les 3×3 **présélectionnés**, pas l'optimum
global sur toutes les combinaisons pets × gear × SP. Le proxy log10 ne
prévoit toujours aucun nombre d'étages. Les anciens résultats Pet/Fairy
(-2000 étapes environ) restent des vérifications in-game non résolues.

Les tests nouveaux couvrent un piège de maximum local, 9 évaluations
uniques et les messages de progression, recherche à un slot, Auras
liées, inventaire absent/tronqué, secondaires non réinterprétées,
18 Damage×Gold via moteur/ledger et intégration worker. Le workflow
GitHub Actions du lot Q permet l'exécution native Node 22 du test,
de `check:data` et du benchmark 22 600 SP sur la branche existante.
Il ne publie PAS GitHub Pages. Les résultats CI effectifs doivent être
lus après le push; l'existence du workflow n'est pas un test réussi.
Les comparaisons Pet/Fairy réelles restent nécessaires avant tout merge.

Sources : `vendor/reductions.js`, `vendor/pets.js`,
`vendor/transcendent-pets.js`, `src/equipment-reductions.js`
(TT2 8.4), https://www.tt2-compendium.com/en/builds/build/cs-hog ,
https://tap-titans-2.fandom.com/wiki/Equipment et
https://gamehive.com/blog/devlog-239-version-840-patch-notes/ .


## Lot R — 18 novembre 2026 : correction réelle TapDamage et validation native des anciens lots

Le lot Q a permis une première exécution native des tests du dépôt :
**347/363 tests réussis, 16 échecs** sur le SHA Q final, malgré la
réussite de `check:data` et du benchmark synthétique à 22 600 SP (18 routes).
Le lot R est la remise en cohérence du modèle et de ses tests historiques.

### Effets réellement corrigés
- **Drunken Hammer `Artifact29`** est un artefact permanent dont
  `bonusType=TapDamage` en TT2 8.4. Son effet principal vérifié
  (`1 + EffectPerLevel × Level^GrowthExpo`, enchantement explicitement
  attesté et amplificateurs source le cas échéant) est désormais routé
  dans `extractFixedAccountPower` comme **TapDamage**, puis réduit
  **une seule fois** via `vendor/reductions.js:TapDmg` pour chaque
  famille de dégâts. Ce n'est ni AllDamage ni un deuxième bonus de
  la somme additive Artifact Damage ; les données conflictuelles
  et tronquées ne sont pas artificiellement scorées.
- **Sets permanents :** `optimizeBuild.accountIntegration.permanentSetPower`
  expose les décomptes source par rareté, la quantité des cinq
  effets « × par nombre de sets » et la complétude de la collection.
  C'est un diagnostic sur un calcul existant, **pas un deuxième score**.
- **Benchmark Pet × Gear × SP :** le mode `--pair-search` suit la
  recherche du vrai worker (jusqu'à 9 paires shortlistées, équipement
  reclassé pour chaque paire, poids convertis selon la source et
  recomputation de l'optimisation SP et du registre). L'ancienne
  recherche par alternance n'est plus utilisée dans ce benchmark.

### Tests historiques réconciliés avec les invariants actuels

- Une collection de ressources contradictoire ou partielle a
  un total **inconnu (`null`)**, pas un total 0 ni la somme
  favorable des seules lignes saines ; les lignes restent inspectables.
- Un cap de sort 40 dans le CSV n'atteste pas les 6 slots actifs :
  `complete=false` reste correct. Un pet au niveau 100 a
  déjà 100 % de son bonus passif, donc sans amélioration du niveau
  actif le bonus supplémentaire de sa sélection est **zéro**.
- Le ledger d'optimisation inclut les bonus permanents de sets
  en plus du ledger des artefacts/monuments ; la comparaison des
  18 routes monumentaires tient désormais compte de **cette**
  séparation, sans attribuer le set au Monument Damage.
- L'export comporte 18 sections facultatives (dont `heroLevels`).
  Les URLs d'import JS/CSS comportent volontairement une révision
  cache-busting, le sitemap contient 4 racines et 4 guides SEO ;
  les liens Leskasoft pointent vers `www.leskasoft.fr/{lang}`.
  Les tests n'exigent plus d'anciens chemins obsolètes.
- L'intitulé UI existant du contrôle de protection des skills dispose
  de ses traductions FR/UK/RU ; **aucun nouvel avertissement technique**
  n'est ajouté au parcours utilisateur.

`tests/native-regressions-lot-r.test.js` couvre en plus la vraie
route TapDamage, la prudence sur les recherches de ressources, le
report des sets et l'absence de certitude sur les sorts. Le workflow
CI Node 22 exécute `npm test`, `check:data`, benchmarks 22 600 et
50 000 SP, plus `--pair-search`; seule l'exécution CI effective
confirmera leur réussite.

### Limites
Le score log10 ne prédit toujours pas les stages. Les taux critiques,
Jackpot, Multi Titan et dégâts d'attaque active des pets, mana/uptime,
HP/stage et l'ancienne régression Pet/Fairy d'environ −2 000 stages
restent à vérifier avec des sources TT2 8.4 et des parties réelles.
Les benchmarks sans `--profile` sont synthétiques et ne représentent
pas le vrai compte à 22 600 SP. Pas de fusion, de Ready for Review ni
de déploiement Pages : la PR #18 reste DRAFT.

Sources : `vendor/account-catalog.js`, `vendor/reductions.js` TT2 8.4 ;
Game Hive Pets FAQ
https://gamehive.helpshift.com/hc/en/3-tap-titans-2/faq/88-what-are-pets-and-how-do-i-level-them-up/ ;
Drunken Hammer https://tap-titans-2.fandom.com/wiki/Drunken_Hammer ;
Transcendence saison 13 https://www.reddit.com/r/TapTitans2/comments/1vlh4fk/ .


## Lot S — validation 3×3 réelle dans le worker

Un test natif utilise six familiers possédés dans un profil synthétique, deux épées et deux armures alternatives. Il vérifie neuf couples, neuf événements de progression, le budget SP et la cohérence du ledger final. Le benchmark distingue maintenant les paires effectivement évaluées du smoke sans profil : `realPairEvaluations` et `realPairSearchValidated`. Le mode `--require-real-pairs` échoue sans export local et sans au moins deux familiers éligibles par slot. Aucun export joueur n'est enregistré ni publié. Les probabilités critiques, Jackpot, MultiTitan, mana et HP/stage restent non calculées sans source vérifiée.


### Lot S complet — critique garanti Heavenly Strike, couplage des armures et validation CI

En TT2 8.4, Angelic Radiance garantit que **Heavenly Strike** est un coup critique (https://e9wiki.com/tt2/en/skill-tree). Les bonus `CritDamage` et `CriticalDamage` disposent donc d'une activation certaine **dans le build Heavenly Strike uniquement**. Les effets sources de l'artefact 59 (The Retaliator), du passif Soot et des équipements équipés peuvent désormais contribuer au moteur et au score final : artefact/pet dans le compte fixe ; équipement dans les cinq slots. Aucun double comptage, aucun effet ajouté à `AllDamage`. Pour les cinq autres builds, le taux critique réel est inconnu et ces bonus restent non scorés. `CritChance` n'est pas appliqué séparément à Heavenly Strike.

La recherche liée `Pet × Gear × SP` parcourt les deux alternatives d'armure en plus des autres slots ; elle compare au plus 32 combinaisons de cinq slots par couple de familiers shortlistés, selon les bonus source connus, les Auras liées et les éventuelles sélections explicites. Les armures ne sont jamais fabriquées depuis un inventaire absent ou tronqué. Ce parcours borné ne prouve pas l'optimum mondial.

Une fixture 8.4 **entièrement synthétique** avec six familiers, six équipements et aucun compte réel valide la recherche de couples dans la CI, avec `--pair-search --require-real-pairs`. Elle complète les tests 3×3 du worker et ne doit pas être confondue avec la régression de −2 000 stages du joueur Pet/Fairy à 22 600 SP, non encore reproduite in-game. Critiques autres que HS, Jackpot, MultiTitan, mana/uptime et HP des stages restent hors score sans formules vérifiées.


## Lot T — Observations de probabilités et budget de mana sourcés (18 novembre 2026)

### Probabilités critiques, Jackpot et plusieurs titans
`src/conditional-probabilities.js` extrait trois **observations finales** lorsque
l'export contient explicitement une valeur de probabilité **en pourcentage**
(`42.5%`, `Critical Chance %` ou `CritChancePercent` et équivalents).
`0.5` sans unité reste ambigu et **n'est jamais interprété en 0,5 % ou 50 %**.
Une valeur invalide, hors de 0–100 %, ou des miroirs contradictoires
neutralisent toute la famille de probabilité, sans choisir la ligne la plus
favorable. Les sources et raisons sont retenues sans données identifiantes.

Pour chaque famille, la valeur `100 × p` donne le nombre moyen d'événements
sur 100 occasions **de même probabilité**. C'est une espérance
mathématique élémentaire, **pas** un effet Gold, un multiplicateur DPS,
un taux de rencontre garanti ni un gain d'étages. Dans
`damage = Heavenly Strike`, le critique est garanti par Angelic
Radiance, distinctement du taux de critique observé dans l'export ;
pour les cinq autres types de dégâts, aucune chance intrinsèque n'est
inventée. Les chances Jackpot et Multiple Titan restent non scorées
car leur traduction en dégâts/gold de boss et leur distribution réelle
sont insuffisamment établies. **Aucun score de compétence n'est modifié.**

Les preuves sont connectées à `parseAccountProfile`, au
`calculateModeledScenario` définitif, au worker et à sa couverture
interne. L'interface destinée au joueur n'ajoute aucun avertissement technique.

### Mana — faisabilité prouvable, pas de temps d'activation inventé
`src/mana-evidence.js` calcule à partir de la réserve et régénération
**finales explicitement importées** et des coûts tabulés des sorts choisis :
- coût d'un lancement par sort et faisabilité à réserve pleine ;
- manque éventuel pour un lancement complet des six slots ;
- régénération passive par minute, durée purement théorique de
  reconstitution du budget initial à régénération passive seule ;
- consommation nominale `Σ coût_source / durée_source` pour un lancement
  à chaque durée **de table 8.4** (ni extension, ni multicast) et écart
  avec la régénération passive observée ;
- solde initial `regen_finale − drain_initial_contrats` lorsque ces
  deux nombres sont connus.

Ce sont des **instantanés arithmétiques conditionnels**, pas une
simulation de rotations effectives : Mana Siphon demande la fréquence
des attaques/tentatives spéciales, Manni Mana une distribution de rencontres,
les durées réelles incluent les prolongations, les multicasts ont leurs
coûts et le drain des contrats croît au cours du temps. Les coefficients
de talents ne sont pas ajoutés de nouveau aux stats finales importées.
Le moteur ne retire pas automatiquement de compétences à partir de cette
observation. Les résultats restent internes à la couverture et au ledger,
sans nouveau bruit pour les joueurs.

### Vérification
`tests/conditional-probabilities-lot-t.test.js` couvre le format des
percentages, les miroirs conflictuels, les taux non inventés, HS garanti,
les coûts de mana et un tour **6 dégâts × 3 Gold** comparant des comptes
identiques avec/sans chances : les totaux log10 doivent rester égaux.
Le benchmark de profils fictifs inclut ces données finales explicites,
et les tests gardent la comparaison Pet/Fairy observée (environ 750 stages
entre deux arbres à ~22,6k SP) comme **preuve de test en jeu, pas formule
de conversion**. Le cas historique à −2 000 stages reste à reproduire
avec ses vraies statistiques avant fusion.

Sources vérifiées : TT2 8.4 `vendor/spells.js`,
`vendor/active-spell-caps.js`, `vendor/skills.js` ; Mana Siphon du
Compendium https://www.tt2-compendium.com/en/wiki/skills/manasiphon ;
Angelic Radiance et chances de plusieurs titans
https://e9wiki.com/tt2/en/skill-tree ; source Game Hive Special Titans
https://gamehive.helpshift.com/hc/en/3-tap-titans-2/faq/83-what-do-the-special-titans-do/ .
Aucune publication de donnée de joueur ni de promesse de stage.
