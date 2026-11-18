# Critical mathematical audit — TT2 Skill Optimizer v0.1

## Scope of the evidence

On 15 November 2026, the 72 rows of the existing skill-table module were compared field-by-field against `SkillTreeInfo2.0.csv` from the maintained public CSV repository. The sampled values, costs, prerequisites, names, levels and bonus columns matched. The skill-tree CSV was last updated in September 2026. This is **evidence for the skill-tree dataset**, not proof of end-to-end compatibility with all TT2 8.4 gameplay effects, equipment or Clan Technology.

## Problems observed in the legacy solver

1. **Unsafe pruning.** The original `getImportant` selection discarded a higher-cost intermediate state if an earlier state had a better score. This is not generally safe *before* tier unlocks: a dominated intermediate state may be the only route to a higher-tier skill.
2. **Hard-coded prerequisite indices.** The previous solver relied on handwritten arrays of skill indices for tier-5 dependencies. They could become incorrect when a patch adds, reorders or removes a skill.
3. **Numerical overflow/underflow.** Extremely large `10^x` or compounded multipliers may exceed IEEE-754 double range, making an otherwise useful score infinite or `NaN`.
4. **Confusing worker usage.** A worker controlled the UI state but the actual computation still ran on the page's main thread.
5. **Conditional synergies.** The former `TerrifyingPact` calculation treated a contract skill as active if it was merely *selected* for optimization, even if its allocated level was zero. This can overvalue builds lacking the contract.
6. **Model versus gameplay.** The optimizer maximizes weighted damage/gold multipliers, not actual stage progression speed, which depends on cooldowns, speed skips, latency, availability, play patterns, equipment, talents and other factors.

## Changes implemented

- **Exact per-branch DP** indexed by integer SP cost and the last three prerequisite-presence bits. It preserves intermediate states until all tier prerequisites have been applied.
- Prerequisites and tier SP thresholds are generated directly from `TalentReq` and `SPReq` source fields, rather than positional magic numbers.
- **Exact cross-branch max-plus convolution** for at-most-SP budgets up to 12,000 SP. Its concave envelope is only an *upper bound* for pruning candidate evaluations; all selected candidates are evaluated using real scores. Synthetic reference tests compare the results to an unpruned quadratic algorithm.
- **Log10-space score functions** for all 72 skill IDs and six damage builds, reducing overflow risk.
- A real **ES module Web Worker** performs the optimization off the UI thread.
- A conservative treatment of `TerrifyingPact`: count the contract synergy only when the contract is explicitly guaranteed by existing levels/minimums.

## Validation performed during implementation

- All **72** skill definitions compared equal to their current source CSV counterparts for the inspected columns.
- **7,614** finite numerical evaluations of the original score formula agreed with the rewritten log-space score to within 1e-6 across six damage sources, three gold types and sampled levels; **126** intentional disagreements were attributable to `TerrifyingPact` being treated as active by mere selection. This sample is a regression comparison, not proof that the formulas represent the live game.
- New convolution compared with exhaustive loops for 60 random monotonic test pairs without mismatches.
- Real 72-skill calculations returned valid allocations for SP budgets 0, 50, 200, 600, 1,000 and 2,000 (not a device-specific performance promise).
- Node unit tests exercise exactness on synthetic small trees, source model validity, import/export and parent prerequisites.

## Remaining limitations / release gates

- **Weighted proxy**: The mathematical optimum is only guaranteed for the modeled additive log-damage/gold objective. It cannot be labeled the *best real-world TT2 build* without comparative in-game results.
- **Conditional interactions**: Cross-skill combinations and dynamic equipment activation are not yet represented exactly. The conservative treatment of contracts can undervalue some real synergies.
- **Scope of data updates**: Skill data, spells, reductions and QoL baselines are versioned separately. Equipment bonuses and Clan Technology introduced in 8.4 require dedicated model validation.
- **Very large SP budgets**: The exact dynamic program has potentially high computational cost for many thousands of SP and should be benchmarked on mid-range phones. The UI currently caps the budget at 50,000 SP. Neither elapsed time nor memory is guaranteed.
- **UI import compatibility**: Game export formats may change; importers must be validated against real 8.4 player exports.
- **Upper envelope assumptions**: Convolution correctness depends on the upper concave envelope being a valid bound. A critical differential test exposed and corrected a bug in the split-scan bounds; after the correction, 500 randomized variable-capacity convolutions matched exhaustive enumeration. The implementation is verified by exhaustive randomized cases, and should receive additional property tests at larger budgets and numeric extremes.
- **Gameplay verification**: Before marking the version as fully validated, independently check the formulas against the actual patch and playtest multiple builds.

## Further improvement strategy

1. Expand synthetic oracle tests and add regression fixtures from actual 8.4 player exports.
2. Introduce an independent scoring specification based on official game mechanics, separated from inherited formulas.
3. Model conditional skills as coupled state variables or solve multiple activation scenarios with exact constraints.
4. Benchmark high-SP cases; introduce a certified approximation/bound if exact runtime becomes prohibitive, and expose the approximation flag in the UI.
5. Add source-version provenance, changelog and explicit release-gate evidence before advertising the version as verified.

## High-SP bounded optimization, validated at 50,000 SP

Beyond 12,000 SP, exact per-branch dynamic programming is retained. Cross-tree allocation is performed on a grid of at most ~2,500 increments for the uncommitted budget, and the grid convolution itself is exhaustively evaluated (no pruning). The grid step is `q=ceil(freeBudget/2500)`.

**Certification:** Let `m` denote the number of branches, `F` the mandatory minimum-cost total and `B` the available SP budget. For every exact allocation `b_i`, rounding up its additional branch budgets `b_i - F_i` to increments of `q` increases their total grid allocation by at most `m` increments. Therefore the maximum grid score at `floor((B-F)/q) + m` is an upper bound on the exact optimum under the additive model. The grid allocation at `floor((B-F)/q)` is always feasible and provides a lower bound. This yields a mathematically certified *score gap*, although the optimizer is not always globally exact at very high budgets.

The worker reports per-branch/combination progress and supports cancellation. A 50,000-SP test with actual skill-tree data for Clan Ship / Fairy Gold completed in approximately 17.4 seconds within a JavaScript test environment (49,973 SP spent; lower model score 1482.6982, upper model score 1483.9538; gap ≤ 1.2556 log10 units). This is not evidence of a specific Android completion time. Performance varies by device and build type.

**Important:** A bounded score gap is not a guarantee of build performance in the real game. The ratio-based efficiency option at >12,000 SP uses a grid approximation without a separately certified optimum for the score-per-SP ratio.

Additional automated tests compare 500 mixed dense/sparse max-plus cases to brute-force results, 300 constrained small-tree cases to an exhaustive oracle, and bounded-grid upper/lower certificates against exact small-model optima.

## 16 November 2026 — issue #9, Pet/Fairy vs in-game stage progression

A user supplied two genuine game-version 8.4 skill trees. The first **reaches 750 more stages** than the optimizer's previous allocation. The first costs 22,640 SP, the second 22,642 SP. Per branch, the first vs second allocation is Knight 3,088/3,006, Summoner 6,870/6,484, Warlord 1,650/1,414, Sorcerer 2,989/3,728, Rogue 4,288/4,303 and Alchemist 3,755/3,707. Thus the original assumption that the optimizer overspent Warlord **was incorrect**.

Under Pet/Fairy and gold weight 0.7 with basic default score inputs, the old additive model itself preferred the first tree by +22.694 log10 score units (1041.063 vs 1018.370). Re-optimizing at 22,642 SP with default QoL produces a third, different allocation (score ~1113.874, reconstructed score matching exactly). The two JSON exports do not include the input settings/constraints that produced the earlier optimizer output. We must not claim the solver is defective merely from outputs obtained under unknown settings.

**Verified corrections to scoring assumptions**:

- Quick Fortune has `AllGoldDuringHayst`, so its gold multiplier should not count at a hard boss when Hayst is absent. Its cloaking chance is not a damage multiplier. See [TT2 Compendium — Quick Fortune](https://www.tt2-compendium.com/en/wiki/skills/quickfortune).
- Philosopher's Flux has `BossDamageDuringSnap` and a separate non-boss titan bonus. Its boss multiplier must not be credited when Snap is absent. See [TT2 Compendium — Philosopher's Flux](https://www.tt2-compendium.com/en/wiki/skills/philosophersflux).
- Astral Awakening (internal `HelperDmgQTE`) increases hero damage per orb tap, up to five taps. The previous code multiplied by five unconditionally; now the player may configure 0–5 taps achievable during a boss fight. See [TT2 Compendium — Astral Awakening](https://www.tt2-compendium.com/de/wiki/skills/astralawakening).

The advanced panel now exposes these three explicit combat conditions with conservative defaults (inactive Hayst, inactive Snap, zero Astral taps). These assumptions are included in shared settings links and recorded with the solver result. This is **partial remediation only**. It cannot explain or guarantee reversal of a 750-stage loss without actual settings and a multi-profile in-game validation.

Still to investigate: hero-power counts in Tactical Insight, mana/uptime for contracts, effect interactions, QoL floors and constraints, all other skill effect conversions, current patch differences. No cap based on a player's previous Warlord allocation is permitted.


## Observed Pet/Fairy regression — 16 November 2026

An anonymized pair of TT2 8.4 skill trees provides a real gameplay comparison: **750 additional stages** for the better tree. The two valid trees spend **22,640 / 22,642 SP**. The better tree spends **1,650 SP in Warlord** versus **1,414**, disproving a proposed arbitrary Warlord cap. The optimizer tree spends **3,728 SP in Sorcerer**, versus **2,989**, primarily because it raises **Terrifying Pact from level 22 to 25** (+737 SP).

Under the corrected conservative boss assumptions (no Hayst, Snap, Astral taps or contract maxima), the weighted log-score prefers the real better tree (847.43 vs 822.17). The earlier calculation (936.06 vs 913.81) still incorrectly credited maximum Forbidden/Royal Contract bonuses as unconditional. When the two contracts are treated as guaranteed active at maximum, the old score reverses this ranking. Thus the regression implicates scenario assumptions and the proxy's validity; it does not yet prove that the dynamic-programming solver itself is incorrect. Exact optimizer settings that generated the losing tree are not known. Neither build fully respects the current `qol=recommended` floors.

**Partial fix:** `ForbiddenContract` and `RoyalContract` table maxima require sustained mana and time. They, and the conditional `TerrifyingPact` bonuses, are now scored at zero by default at the limit-stage boss unless `assumeContractsAtMax` is explicitly enabled. The opt-in scenario requires both contract skills to have at least one level, which makes the selected scenario internally consistent. It does **not** simulate time-to-max, mana drain, cooldowns or gameplay, and must not be described as complete resolution of the 750-stage regression. A standalone anonymous regression fixture preserves the exact pair of submitted trees.

Mechanics: https://www.tt2-compendium.com/en/wiki/skills/terrifyingpact ; https://www.tt2-compendium.com/en/wiki/skills/forbiddencontract ; https://www.tt2-compendium.com/en/wiki/skills/royalcontract .


## November 2026 — fix for catastrophic unspent-SP ratio mode

The legacy “Maximize score per newly spent SP” option selected the maximum average score per SP, **not** the strongest build under the player's total SP budget. It reproduced a 22,642-SP Pet/Fairy recommendation using only **10 SP** with QoL disabled. This is a fundamental mismatch of objectives, not an issue parsing the entered budget.

The ratio option has been removed from all UI locales and ignored in both the engine and the backward-compatible solver signature. Previously persisted mode settings and shared links are normalized to full-budget power; versioned UI/worker entry points prevent cached old JS from silently reactivating the retired option. Tests cover legacy settings and a high-SP Pet/Fairy benchmark. At-most-budget optimization can still leave a small remainder due to cost granularity; it is not an instruction to buy low-value skills. This does not yet validate actual stage outcomes (#9).


## 17 November 2026 — full-account export extraction (first implementation)

Settings → Services → Export may contain artifacts and enchantments,
Mystic Gemstones and Mystic Research, Titan Cards and Forbidden Research,
pets, hero weapons, passive skills, monuments, owned equipment sets and
potentially equipped gear. Some fields vary by TT2 version and can be absent.
A Skill Tree-only \`Version/Skills\` export contains none of this context.

\`src/account-profile.js\` imports a **bounded, allowlisted** snapshot:
only recognized game mechanic collections and numeric account statistics are
retained, not the player's raw JSON, account ID, name, email or clan data.
Levels of artifacts, Titan Souls and other large values are preserved as
scientific-notation strings to avoid overflow. The UI reports which sections
are **actually found** in the export, in EN/FR/UK/RU. We explicitly separate
owned sets from equipment currently worn. Missing data is not interpreted
as a zero-level upgrade. Only the normalized profile is stored locally.
It is never included in shareable build links.

### Mathematical scope and what remains open in issue #9

- The optimizer already applies supported equipment-set effects for FB,
  FF, tFA etc., including sets imported through account export.
- Imported relics, artifacts, Titan Souls, Necrobear research, Gemstones
  and Mystic Research **are not yet used as additional score coefficients**.
- Many permanent global multipliers have the same effect on every candidate
  Pet/Fairy allocation, so they cancel in comparisons and do not change the
  SP optimum. Other effects alter marginal value through unlocked hero
  skills, damage/gold source interactions, spell uptime and mana conditions.
- No unsourced multiplier or arbitrary tree cap has been introduced.
  Test actual bonus semantics and reproduce the observed in-game stage
  differences before using these sources to alter SP recommendations.
- Collection field aliases and record shapes must be confirmed against
  a genuine, sanitized TT2 8.4 full-account export; the tests cover
  representative schemas, not all future game versions.


## 17 November 2026 — account-aware pet comparison, equipment shortlist, cached solver

### Fixed account baseline versus selectable variables

Imported **gemstones, Mystic Research, Titan Souls spent, Titan Cards,
Forbidden Research, artifacts, relics and monuments** are fixed inputs
for each session. No optimizer candidate reallocates them or treats the
Titan Soul balance itself as damage. The parser reads their available
values for future independently validated mechanics. These sources are
currently *not* all translated into damage/gold coefficients. Seasonal
monument validity and exact 8.4 export field names require checking
against a real sanitized full-account export.

Variables in the first implementation: SP allocations, equipped
**Damage pet** and **Gold/Support pet** (separate slots), and
interchangeable equipment choices. Equipment inventory and currently
equipped pieces may be absent from TT2's account export. In that case
the UI does not invent equipment or infer a currently worn piece from
the list of owned sets.

### Pet ranking and resolution order

- \`vendor/pets.js\` is derived from \`PetInfo.csv\` (rawrzcookie/TT2_CSV),
  including the 30 pets' individual primary bonus categories and
  Damage versus Support slots.
- Resolve imported pet levels first; then already-owned sets (such as
  Samurai), and \`CombatTechniques\` Active Pet Level bonus; then
  effective levels, active/passive bonuses and weighted score. The
  pet-level snapshot is memoized by import profile identity.
- Rank **three damage pets and three gold pets independently**, never
  all nine pairs. For each candidate, re-optimize using a shared
  per-branch DP cache. Unchanged branch score arrays and prerequisites
  use their original solved frontier instead of a new exhaustive DP.
- This is a **Pet bonus proxy**. It currently recognizes a limited
  set of damage/gold bonus types; unavailable damage conversion
  factors, equipment-pet interactions and complex upgrades remain
  unscored. Do not declare these rankings true stage maxima.

### Equipment and helmets

\`src/equipment-scenarios.js\` reads item inventory *only when present*,
shortlists two options for Sword, Helmet, Armor, Aura, Slash, and scores
only recognized, numeric first-effect unconditional multipliers.
Unknown item bonuses are displayed with an unscored indicator.
For Dagger/Heavenly Strike/Gold Gun/Shadow Clone, the helmet shortlist
accepts Gunblade; for the other builds it recognizes Elder Snow Cap
or Ranged / Spell / Melee hero helmet rotation. There is **no assumption**
that multiple hero helmets can be worn at the same time. This choice
comes from the player's strategy specification and must be independently
checked against 8.4 game mechanics and real inventories.

The current solver **does not yet evaluate higher-order gear→gear or
gear→gem→pet dependencies** and does not pretend to. Those effects
require source-backed rules and a dependency graph:
fixed account -> level effects -> effective equipped item/pet levels ->
equipment/pet bonuses -> skill score. An unverified dependency is not
assigned an arbitrary multiplier.

### Cross-build auto selection

Automatic damage source and gold source selection is **not enabled**.
Current additive damage/gold scoring proxies lack validated scaling
between different damage sources, so comparing their raw totals would
produce unreliable "best" choices. This remains part of issue #9
and must be calibrated with actual account data and in-game outcomes.

Full-account exports up to 8 MB are accepted, and the original raw
JSON is removed from the manual paste field after successful import.
The normalized profile is stored locally but never appended to a
shareable link.

Source reference:
https://github.com/rawrzcookie/TT2_CSV/blob/main/csv/PetInfo.csv


## 17 November 2026 — live -2,000 stage regression and safety guard

A Pet/Fairy player at roughly 22,600 SP reports losing **2,000 stages**
with the new optimizer. The allocation overspent relative to the player's
successful Warlord distribution and **removed Forbidden Contract**.

The deterministic 22,640/22,642-SP Pet/Fairy fixture reproduces the root
cause of the disappearing contract investments: under the conservative
default \`assumeContractsAtMax=false\`, Forbidden Contract, Royal Contract
and Terrifying Pact have **zero modeled value**. The optimizer consequently
removed the player's already-invested levels, redistributing the SP elsewhere
(including Warlord). This proxy assumption must not silently delete
potentially valuable skills and then present the result as an improvement.

**Mitigation (default ON):** when current levels are supplied, the optimizer
retains only those existing conditional skills whose actual bonus is
deliberately not modeled: FC/RC/TP when full contract bonuses are not assumed,
Quick Fortune without Hayst, Philosopher's Flux without Snap, and Astral
Awakening without taps. Their imported levels become explicit minimums.
This is NOT a Warlord allocation cap and does NOT pretend to predict actual
contract mana/uptime. The guard can be disabled in Advanced settings; the
existing "keep all current levels" option remains separate.

A regression test compares guarded and unguarded Pet/Fairy allocations at
22,642 SP and verifies the retained contract skills and the direct effect
on Warlord spend. All four localized pages include the new setting and
responsive alignment rules for variable-length text and controls.

**Remaining limitation:** the score is still a weighted log-proxy. Further
mechanical verification of contract activation, skill interactions,
cross-build/gear rankings, and actual stages gained is mandatory before
claiming the optimizer recommends the objectively strongest build.
Issue #9 remains open. The actual -2,000 stage test's complete build settings
and equipment export are not yet captured in an anonymized regression case.


## 17 November 2026 — seasonal Transcendent pets

The catalog originally contained only the 30 permanent Legacy and Exotic pets.
Full TT2 exports can contain SeasonalPet1 through SeasonalPet15 in petLevels.
The previous importer kept these levels but discarded these pets before ranking.

The new seasonal catalog comes from rawrzcookie/TT2_CSV
EndgamePetInfo.csv. Transcendent bonuses improve every 5 levels beginning
at level 5; permanent pet bonuses improve every 20 levels beginning at 120.
MaxImprovementLevels is a limit on improvement count, not pet level.
The ranking uses only positive pet levels from the current account export.
CSV IsActive values must not be taken as proof of ownership or applicability
to the player's current Transcendence season.

Two separately equipped slots, Damage and Support/Gold, are maintained,
and the three best suitable candidates in each slot are compared separately.
The now supported seasonal candidates are shown with a Transcendent label.

**Scope:** These changes improve pet ranking, not the full-account simulator.
Gemstone, Necrobear/Titan Soul, monument and artifact bonuses are imported
but remain UNSCORED where no verified differential skill interaction exists.
Exotic pets with equipment primary bonuses remain visible but are unranked
without the precise equipped item and its supported mechanics.

Source: https://github.com/rawrzcookie/TT2_CSV/blob/main/csv/EndgamePetInfo.csv
Official: https://gamehive.com/blog/devlog-149-version-6-6-0-patch-notes/


## 17 November 2026 — six Mythic skill-tree damage-per-SP effects

**Source-backed nonconstant objective term.** Game Hive DevLog #140 (version
6.2.0, 5 September 2023) explicitly replaced Tier-4 bonus levels on six
Mythic sets with **×1.01 All Damage per skill point assigned to a specific
skill tree**:
https://gamehive.com/blog/devlog-140-version-6-2-0-patch-notes/

The 8.4 EquipmentSetInfo.csv includes `SkillTreeKnightAllDamage`,
`SkillTreePetAllDamage`, `SkillTreeWarlordAllDamage`,
`SkillTreeSorcererAllDamage`, `SkillTreeRogueAllDamage` and
`SkillTreeAlchemistAllDamage`. All six rows have `Amount=1.01`,
`Inc=1`, `Expo=1` and are independent of Crafting Power. They
respectively amplify Red/Knight, Orange/Summoner, Yellow/Warlord,
Blue/Sorcerer, Green/Rogue, Purple/Alchemist **skill-point spending**.

A skill candidate at level L costs the cumulative source SP
`sum(Co0...Co[L-1])`. The exact modeled marginal term, in log10 units, is

```text
  skillLevelSetBonus(skill, L) =
    cumulativeSpentSP(skill, L) × log10(1.01)
      if its matching Mythic set is explicitly completed,
    0 otherwise
```

The independent score sum over each branch is `log10(1.01) ×
totalSpentSPInThatBranch`. Ownership is taken ONLY from the unlocked-set
collection; present inventory pieces are not used to guess completed sets.
Sold items do not reduce the permanent bonuses. If all six sets are
completed and the solver spends the same total SP, this source contribution
is the **same across all branch allocations**, so it does **not** alter
relative scores between those allocations. If some sets are missing, the
branch-specific coefficients differ and the best allocation **can** change.

This value belongs **inside the marginal DP score**, not in the
`fixedAccount` constant or the equipped-item score. There is no additional
global multiplier when calculating the output. The per-branch score and
SP count appear in `accountIntegration.skillTreeSetPower`.

Evidence:
- Official Game Hive release note (linked above).
- Version-pinned 8.4 `vendor/account-catalog.js` and
  `vendor/skills.js`, with source amounts, branches and cumulative SP costs.
- `tests/skill-tree-set-effects.test.js`: six catalog rows, sold pieces,
  inventory-only negatives, duplicate ids, incomplete ownership lists,
  six branch score comparisons and 18 Damage × Gold combinations.
- V8 local verification of **5,184** comparative source-score evaluations:
  all passed and finite. This verifies the scoped arithmetic,
  **not** full game-stage simulation or all other skill multipliers.

Remaining high-priority skill dependencies: the two Contract skills,
Terrifying Pact's conditional activation/mana, per-slot pet boosts,
supported nonmultiplicative skill-class boosters, spell uptime,
Hero damage source reductions, and HP/stage calibration. The release
gate remains closed.


## 17 November 2026 — source-backed conditional contracts and Pact

The previous numerical model scored three independent contract talents using
an implicit "both contracts at maximum" user toggle. This could be mistaken
for always-active account power. The game source tables and TT2 Compendium
confirm that the effects are **not passive**:

- `ForbiddenContract` A = maximum damage while the contract is active.
  Its B is the initial mana cost per second.
- `RoyalContract` A = maximum gold while the contract is active.
  Its B is the initial mana cost per second.
- `TerrifyingPact` A = extra gold *while Forbidden Contract is active*;
  B = extra damage *while Royal Contract is active*;
  C = titan-count reduction during either contract. That C is not damage.
- No single export proves that the user has mana to sustain the contracts
  or that the maximum ramp is reached during each push-limit boss.

`src/contract-scenarios.js` provides the formula for each skill, conditional
on **explicitly assumed full contract activation** and guaranteed nonzero
contract minima. The optimizer continues to force minimum level 1 of both
contracts in that opt-in mode, preventing a Pact score without those skills.
If the user did not opt in, **all three maximum bonuses contribute zero to
the proxy**, while the established protection for previously invested,
unmodeled skills remains in effect. Levels and mana-rate source observations
are kept in the diagnostic record.

After optimization, `result.contractScenario` reports separate conditional
maximum damage/gold log10 contributions, the two source initial drain
coefficients, Titan reduction as a non-damage QoL effect, whether maxima
were assumed, and explicit `manaSustainable:false`,
`uptimeVerified:false` and `predictsStageGain:false`. It does **not**
add these terms a second time to the fixed-account ledger. The current
export does not justify computing sustained uptime, future drain growth
or a stage estimate.

Data provenance:
- Versioned `vendor/skills.js` bonus type A/B/C values for the three
  skills and `vendor/reductions.js` build compatibility.
- https://www.tt2-compendium.com/en/wiki/skills/forbiddencontract
- https://www.tt2-compendium.com/en/wiki/skills/royalcontract
- https://www.tt2-compendium.com/en/wiki/skills/terrifyingpact
- https://www.reddit.com/r/TapTitans2/comments/10yuoht/
  (Game Hive v5.26, introduced Terrifying Pact).
- `tests/contract-scenarios.test.js`: maximum-only gating, Pact A/B
  dependency separation, no free mana claims, source B initial drains,
  terminal snapshot, score consistency across 18 builds, invalid inputs
  and opt-in versus protected-current allocation.
- Focused V8 verification: **25/25** checks on actual versioned source
  data and all 18 Damage/Gold combinations. Full Node/browser tests and
  in-game mana/stage validation are still open release gates.

## Research and resource integrity — Batch F (2026-11-17)

- TT2 v8.4 \`GemstoneResearchInfo.csv\`: 169 \`GemstoneLevel\` additive nodes.
  \`TitanResearchInfo.csv\`: 62 additive Titan Souls acquisition nodes.
  Formula for each *purchased* resource node: \`level * EffectPerLevel\`;
  \`BaseEffect=GrowthExpo=0\` for this generated subset. Other Necrobear
  research effect families remain handled separately and are not resource
  contributions by implication.
- Exported Gemstone effects can already contain the effective level.
  \`Gemstone Level\` stat is ambiguous (base vs effective). The
  \`stat + research\` figure is a hypothesis, **not a scored multiplier**.
  Per-day and per-prestige research terms do not determine actual income;
  raw drop chance does not determine capped final chance.
- Inconsistent research ID mirrors are not summed. An incomplete section
  prevents numerical research scoring from that section; unresolved
  aggregates stay null rather than masquerading as verified zero.
- New tests in \`tests/resource-research-integrity.test.js\` exercise source
  counts, invalid/mirrored/contradictory IDs, truncation and all 18
  damage/gold combinations. No in-game multiplier parity or full suite
  has been claimed for this batch.

## 17 November 2026 — PR #18 Batch G, permanent artifact dependency audit

The v8.4 source catalog and Game Hive v5.10/v5.19 patch notes define
uncapped artifact magnification eligibility, capped White Dwarf exception,
and Fergus' separate gold routes. The source-backed capped level-40 values
are Magnifier ×5.5 and Fergus ×10. Main effect coefficients are exponentiated
in log space; two eligible amplifiers multiply their exponents, not their
additive Artifact Damage rows.

`True`/`False` enchantment flags from actual game-style JSON are parsed
without changing the level's scientific notation. Unknown enchantment flags,
salvaged records, duplicate IDs, contradictory amplifier levels and truncated
collections cannot silently become valid bonuses. White Dwarf is scored
only with a verified distinct currently-owned artifact count. The separate
sum of `DamageBonus × Level` is explicitly conservative; Heavenly Sword
applies once, and no fictional enchantment multiplier is added to the sum.

The account ledger routes derived damage only to fixed AllDamage (not the
skill-tree marginal objective). 18 Damage×Gold combinations are covered by
regression tests. No assertion of accurate in-game stage gains follows from
a successful numeric score. Further gameplay validation and the full Node
test/bench gates are mandatory.

Sources: https://gamehive.com/blog/devlog-88-version-5100-patch-notes-2633/ ;
https://www.reddit.com/r/TapTitans2/comments/vu9fch/ ;
https://tap-titans-2.fandom.com/wiki/The_White_Dwarf .

## 17 November 2026 — PR #18 Batch H, season-13 Monument Damage audit

Source: the 52-record 8.4 monument catalog, Game Hive DevLog #231
(current seasonal categories and date), DevLog #161 (monument growth
exponent), and lemmingllama's Monument Tier List (additive stacking).
The earlier damage implementation took `DamageBonus × Level^DamageExpo`
and produced tiny exponent values compared to the actual multi-thousand-
order Monument Damage figures. The 8.4 source-derived formula is
`DamageBonus^(Level^DamageExpo)`. Its log10 values are *added in linear
damage space*, not summed directly as log10 across different monuments.
Astronomical scientific levels that would overflow even the log10 score
are omitted with explicit diagnostics, not silently saturated or rounded.

Main monument effects and the additive Monument Damage baseline have
independent routes into the fixed account ledger. Counted mythic/all-set
bonuses are exponentiated by verified complete sets only. `PerSeasonDay`
and other conditional mechanics remain unscored; monument
`EnchantmentMult` affects only diagnostics pending proof of its exact
position in game stacking, and no guessed bonus enters the score.
Unknown season, stale source rows and truncated exports never contribute
to this pool. The fixed-account damage term is common to all SP
allocations and does not claim accurate stage progression.

Sources:
https://www.reddit.com/r/TapTitans2/comments/1vlh4fk/
https://www.reddit.com/r/TapTitans2/comments/14ylq4a/
https://gamehive.com/blog/devlog-161-version-6-11-0-patch-notes/



## 2026-11-17 — batch I, equipment primary dependency audit

**Modeled:** item primary `log10(multiplier) × sourceReduction`;
sourceReduction = 1 for matching direct damage, goldWeight for matching
gold and `vendor/reductions.js` for explicitly supported Tap/All Hero
conversion. Unsupported effect labels and unavailable conversion ratios
are NOT converted to a universal damage factor. Nonmatching equipment
secondaries are diagnosed as inapplicable rather than as absent formula
or as a positive multiplier. Scientific `1e9999` stays in log space.

**Coupled Aura:** `SwordBoost`, `HelmetBoost`, `SlashBoost` and
their explicit `*PrimaryEffect` labels link exclusively to the matching
selected gear's **primary** bonus; their score is zero/unknown if that
primary is missing or unverified. Independently applied Ring/slot/artifact/
set/pet amplifiers remain on each owning primary; secondary rolls are
never multiplied. Auto Aura ranking runs *after* target gear selection,
and is recomputed when an explicit target is selected. A bounded search over
up to two screened choices per Sword/Helmet/Slash category protects against
independently selecting a locally stronger piece with a worse coupled Aura
multiplier. It is a heuristic shortlist, not a global optimality certificate.

**Known limitations:** no exact Gunblade reduction; no hero class/ascension
selection, unique per-resource counters, per-boss crit/uptime, or coherent
pet×gear×SP global optimum. In-game item export equivalence is not yet
proven. Full Node/bench browser tests only count as validated if actually
executed; absence of CI evidence is not a passed gate.


## 17 Nov 2026 — Batch J

A full set of 37 weapon levels contributes `log10(5) × min(levels)` to AllHelperDamage **only** after verifying unique IDs, untruncated source and valid level range. The source reduction `AllHelperDmg[damage]` is applied once to the fixed total, including the prior unscored AllHeroDamage/scroll contributions. Individual weapon ×1.5 levels, dominant hero class/ascension, class helmets, Ringing/Morgelai, Quill/Stamp and MythicSmith/ScrollTutor boosts remain unresolved without 8.4 parity. Truncated Clan Scroll exports cannot score a convenient partial baseline. The engine remains an uncalibrated log10 scoring proxy, not a stage predictor.


## 17 Nov 2026 — Batch K base hero damage and boosters

Correct J: completed hero weapon sets affect **base** hero damage, so the full-set type is `BaseHeroDamage` added once without build-specific `AllHelperDmg` reduction. That table still reduces true `AllHelperDamage` from artifacts and Clan Scroll #3. Verified uncapped? No: Morgelai `Artifact71` and Ringing `Artifact91` are **capped level 50**, at source `perLevel=0.01`; each at 50 gives factor `1.5`. Ringing modifies the fully verified full-set factor from ×5 to ×7.5, `sets×log10(5×factor)`. Morgelai modifies the **individual hero** weapon coefficient from ×1.5 to ×2.25, `level×log10(1.5×factor)`, exposed per 37 source IDs but excluded from global score until relative hero DPS, ascent/level, equipped class and multipliers are proven. Unsupported MythicSmith/ScrollTutor, Worldshaper, Quill/Stamp and seasonal boosters are *not* compounded.

Only explicit non-conflicting export `DominantHeroId`/ `StrongestHeroId` identifying a canonical 8.4 helper can establish a dominant class for filtering helmet candidates. This ID alone is not proof of its damage share, and no class-helmet multiplier is scored from it. No fabricated stages. Full ESM Node suite and in-game 8.4 parity remain required.

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

 
## Lot O (2026-11-18) — source-reduced pet passives and multi-pet equipment primaries

**Permanent pet damage lane, now wired:** `fixedPetHeroLog = Σ(logPassivePetMultiplier(heroPet)) × reductions.AllHelperDmg[damage]`; `fixedTapLog = Σ(logPassivePetMultiplier(tapPet)) × reductions.TapDmg[damage]`. The independently modeled artifact `TapDamage` log contributions share the latter reduction exactly once in `fixedAccountScore`. `BaseHeroDamage` remains a distinct and unreduced source. Neither pet contribution becomes unconditionally universal. The source-reduced active-candidate weighting uses `equipmentEffectReduction` consistently. `activePetGain` continues to subtract each currently equipped pet's already-counted passive, so scoring a pet cannot duplicate the fixed contribution.

**Multiple pet sources of one equipment-primary type:** the earlier `find(bonusType)` in `equipmentPrimaryAmplifiers` discarded all but the first of an Exotic equipment pet and Transcendent equipment pet sharing a type. `filter(bonusType)` now preserves all positively leveled source pet IDs and adds their individually computed passive log10 once to the chosen equipment primary. This remains independent of secondary rolls and the fixed account damage ledger. The `petSources` diagnostic identifies which pet contributed; the bounded 2-per-slot gear search remains a heuristic, not globally certified.

**Amplitude uncertainty:** `EquipmentPetEffect` from Rune Heart and explicit gemstones is proven for five Exotic pets of `Pet26`–`Pet30`; its application to the seasonal counterpart with the same primary type is **not proven**. Exclude the seasonal cross-stack while counting its independently verified base passive; emit `seasonal-equipment-pet-rune-stack-unverified` in gear amplification unknowns and coverage. No gemstone research level is reapplied to an already exported gem multiplier.

**Numerical and release gates:** logarithmic `1e9999` bonus values must stay finite; missing/conflicting pet levels cannot enter candidate screening; all 18 fixed Damage×Gold reductions and 18 zero-SP native optimizer routes are declared as tests, but are not certified until actual Node execution. Pet critical/chance, jackpot/multimonster gold and active pet attack DPS are unscored until a formula and game-export parity establish a valid reduction. All-score, hero-class and true stage-HP conversions remain incomplete. No predicted stage improvement, no claim that the real Pet/Fairy loss is fixed. See `docs/PR18_ALL_CALCULATIONS.md`, lot O, for sources and status. Do not merge or deploy the DRAFT PR.

 
## Lot P / 18 Nov 2026 — pet-aware gear search and source-limited cross amplifiers

**Single eligibility predicate:** `verifiedEquipmentPetAmplifierTarget(pet)` is true only for the five explicitly named Exotic equipment pets (Pet26–Pet30) supported by the Combat Techniques and EquipmentPetEffect sources. Applying the same rune/gemstone to a Transcendent pet's **active** bonus was an inconsistency with lot O's conservative **passive** path. The active path now excludes that unverified cross-stack. `petScenarioEvidence` returns source IDs of excluded seasonal bonus interactions; coverage reports this without scoring imaginary multipliers.

**Permanent set provenance:** `activePetSetLevelBonus` uses only the nontruncated permanent owned-set collection, not `settings.sets.Samurai` stale checkbox/link flags. The set remains active after items are sold.

**Bounded coupling:** For each of at most three shortlisted pets per category, the worker re-runs equipment selection, applies primary reduction weights to the actual selected pet, solves the SP allocation, then evaluates one non-double-counted ledger. Candidate gear ranking and the 2-per-target primary + compatible Aura shortlist include selected active equipment pet gain purely as a decision metric; final `gearSelection.independentScore` never includes it. This is not joint exhaustive global optimization or in-game calibrated comparison. An active pet cannot apply a nonexistent equipment primary or secondary.

**Conditional secondaries:** CriticalDamage/CritChance, JackpotGold/JackpotGoldChance, MultiMonstersGold, chance/probability families are tagged `conditional-chance-crit-or-nonboss-gold` and remain out of boss damage/gold, pending precise proc rates and final gold-source conversion. This is source-audited exclusion, not a new numeric multiplier. Tap/Hero and explicitly matched direct equipment secondary types keep their existing source reductions; gear primary boosts never spill onto secondaries.

**Tests/gates:** Nine new Node tests declared, including 18 route scenarios and actual worker pair execution. Separate targeted V8 checks may compile/evaluate isolated modules but do not imply the native ESM suite is green. Execute `npm test`, `npm run check:data`, `npm run bench:22k -- --all --sp 22600`, pair-search and verify the Pet/Fairy −2000 stage regression against actual TT2 8.4 before any merge. Mathematical score remains log10 proxy, not a stage estimator or verified optimal damage strategy.


## Lot Q : deux défauts de recherche corrigés sans inventer de formules

Le coordinate descent n'est pas garanti exact même au sein de ses 3×3
familiers présélectionnés. Le worker évalue maintenant les neuf couples
possibles au plus, avec leurs véritables gear/SP/ledger, en mémorisant
chaque paire. L'ancienne stratégie reste disponible si demandée mais
n'est plus celle de l'optimisation standard. Le screening des familiers
utilise la borne de **réduction** source des équipements compatibles et
achetés, au lieu d'une sélection préalable biaisée par l'absence de
pet actif. Une Aura n'apporte une borne que si son primaire lié existe.
Aucune valeur de cette borne ne passe dans le ledger final.

Une recherche exacte sur une shortlist de trois par slot n'est pas une
preuve d'optimum global : présélection, deux équipements par slot et
séparation des branches SP restent heuristiques. Les taux de proc
critique/Jackpot/Multiple Titan, dégâts de pet et HP par stage n'ont
pas de calibration complète 8.4; restent non scorés. Aucun gain d'étages
n'est estimé. Tests Node déclarés sur le piège de maximum local, 3×3,
Auras, intrants invalides, 18 routes. Le workflow de vérification
Node/check:data/22 600 SP ne vaut preuve que si ses jobs réussissent.
La PR demeure DRAFT et le benchmark in-game Pet/Fairy est obligatoire.


## R — Native assertions aligned with conservative 8.4 source semantics

The previously executed native Q workflow had 16 failures remaining
among 363 tests. This lot resolves a genuine numerical omission:
`Artifact29` / Drunken Hammer `TapDamage` is now admitted to the
fixed artifact type ledger. Its own main effect is separately calculated
from additive Artifact Damage, and receives its TapDmg build
reduction in `fixedAccountScore` exactly once. It cannot turn
into unconditional AllDamage or double-count the pet passive.

Other fixed model semantics are *intentionally not relaxed* for
tests: contradictory/truncated research yields unknown resource totals
rather than zero or a partial favorable total; cap data alone
does not verify active six-spell loadout or mana sustain; an active
pet at level 100 has no incremental base-stat bonus above its full
passive unless the equipped level is amplified. Permanent set bonuses
belong in the engine's fixed score but not in the monument-only
account baseline. Their per-rarity counts are now visible as
read-only audit metadata.

Static HTML tests now accept source-versioned JS/CSS, eight genuine
canonical sitemap entries, and locale-preserving Leskasoft URLs
rather than stale revisions. The pair-search benchmark is
reconciled with the production worker: candidate gear envelope,
complete shortlist of up to 3×3 and gear/SP recomputation per pair.
**Neither native tests nor synthetic bench success certifies a
predicted stage gain.** The Pet/Fairy regression and empirical
crit/proc/mana/HP mechanics remain release gates.
