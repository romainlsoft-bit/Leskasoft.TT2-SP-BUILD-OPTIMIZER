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
