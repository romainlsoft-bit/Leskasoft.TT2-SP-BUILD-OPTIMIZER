# Full-account SP optimizer — release gate (work in progress)

**Do not merge this feature branch into main and do not deploy GitHub Pages until all gates are checked and reviewed against real player exports.** The public page is sourced from main.

## Verifiable integration achieved on this branch

- Catalogues from TT2 game CSVs: 103 regular artifacts, 52 seasonal artifacts, 214 sets, 198 supported *multiplicative* Gemstone Research rows, 120 titan cards and 149 supported *multiplicative* Titan Research rows.
- Import normalization handles 688-node research trees without the previous 512-record truncation, plus explicit Titan Research and seasonal artifacts. It excludes account IDs and stores huge scientific values as strings.
- Exact game-data rows tested against user's screenshots: Titan1/Ohohono lv93 = 1.3299^93 = ×3.2746e11; GemstoneResearch 284 lv20 = 14.6089^20 = ×1.9604e23.
- Fixed account bonuses are combined in log10 space for known *explicit* damage/gold types. They are not optimization variables; changing SP does not recompute fixed data.
- Typed dependency DAG covers fixed inventory, owned sets, artifact effects, equipment-granted levels, effective gemstones, heroes, pets, effective equipment and skill effects. Recursive invalidation and cycle detection are tested.
- Incomplete effects are explicitly reported, not assigned estimated coefficients. This is a first layer of the account power engine, not a validated stage simulator.
- Account import coverage labels all 17 allowlisted sections in EN/FR/UK/RU; the diagnostic subtracts already-scored PerDay effects from the unresolved-effect count and distinguishes complete Hero Weapon/Clan Scroll sets.
- Conflicting duplicate card, research or scroll IDs are excluded from numerical scoring altogether rather than being counted twice or arbitrarily choosing the first level.

## Time-dependent effects, owned Unique items and Hero Weapons

- **30 set effects** in EquipmentSetInfo.csv are marked PerDay=TRUE. Their Amount/Inc/Expo/MaxValue metadata are retained. Source-derived PerDay formulas (min(Amount^completedDays, MaxValue)) are now evaluated only with a verified export-based date; directly applicable damage/gold types enter the proxy, while equipment/skill-dependent types remain separately flagged. In-game formula parity still requires validation.
- **No manual equipment-set toggles:** all four web-language pages remove the mythic-set checkbox grid; ownership and engine flags are reconstructed exclusively from the completed-set collection in the export. Old localStorage flags and share-link sets are ignored. If the export lacks that collection, ownership is unknown and not fabricated.
- **Permanent after sale:** owned equipment sets are an unlocked collection, not the items currently equipped or present in inventory. Full-set effects remain active after sale; the collection is not reconstructed from five currently owned pieces. Explicit false/unlocked=false/completed=false records are excluded. Duplicate owned-set records are de-duplicated before power aggregation; conflicting explicit completion dates invalidate only the affected time bonus.
- **Date of set completion** = acquisition of the fifth *distinct* slot (weapon, helmet, armor, aura, slash), never the beginning of the current Transcendence. Use an explicit completion date or five dated slot records from a genuine historical equipment acquisition section of the export. Today's equipment inventory cannot prove initial completion because pieces can be sold and re-acquired. If no historical evidence exists, ignore *only* the affected PerDay effect, not the already-unlocked permanent set effects. No player-entered date, no guessed date or season-date substitution.
- **Transcendence season age** is a separate parameter. Read the export start date, or match exported season number to a versioned official calendar. Season 13 start 2026-08-12 from Game Hive DevLog #231.
- **Hero weapons**: 37 active hero IDs from TT2 8.4 HelperInfo.csv. Count complete sets only when all 37 weapon levels are explicitly present; level-by-level unboosted multipliers are ×1.5 per weapon and ×5 per complete set (TT2 Wiki Heroes). Never collapse independent hero bonuses into a universal AllDamage coefficient; Morgelai Sword and Ringing Stone/related boosts remain unresolved.
- **Unique equipment**: all 20 Unique item IDs are matched against TT2 8.4 C_EquipmentInfo.csv and their set IDs. Ownership is reconciled from explicit Unique records, completed sets, owned inventory and equipment keyed by slot. An item is counted once, whether currently equipped or not. Unknown IDs do not generate bonuses; permanent scaling and Crafting Power interactions remain unverified.
- An ignored effect means **unknown in-game contribution**, not zero in-game power. Never present the proxy as an absolute damage model.

## Transcendence monuments — source-identification stage

- All 52 TT2 8.4 EndgameSeasonArtifactInfo.csv monuments have category, activity, cap, damage, cost and enchantment metadata; 33 are catalog-marked active.
- The import combines `monuments` and `seasonArtifacts` by catalog ID or name (including apostrophes), so duplicate entries do not stack. Conflicting levels, mismatched explicit season markers, invalid capped levels and missing time evidence are flagged.
- Exactly four monument bonus rows depend on Transcendence age: `JackpotGoldPerSeasonDay`, `AllDamagePerSeasonDay` (twice), `CritDamagePerSeasonDay`. Season 13's documented start (2026-08-12) yields 97 elapsed days on 2026-11-17.
- Monument main-effect scaling now uses the same sourced artifact structure: 1+EffectPerLevel×Level^GrowthExpo, enchantment multiplying the coefficient by EnchantmentMagnitude; represented in log10. Direct unconditional types enter the provisional score only when season rotation allows them; time/skill/spell/hero/gear-dependent bonuses are computed separately but excluded from scoring until their condition is modeled. The separate additive Monument Damage pool and EnchantmentMult interactions (which differ for SeasonalArtifact34) remain unresolved. `EffectPerLevel` and `GrowthExpo` are retained as metadata, not treated as universally valid standalone multipliers.

## Permanent artifacts and enchantments — numeric main effect layer

- All 103 artifact primary effects share the TT2Master implementation `1 + EffectPerLevel * Level^GrowthExpo`. Artifacts with `enchanted=true` use the source `EnchantmentMagnitude` multiplier on EffectPerLevel; the result is calculated entirely in log10 without rounding huge scientific levels.
- Explicit known direct AllDamage, GoldAll, Pet, Clan Ship, Dagger, Gold Gun, Fairy, HoG, HS and Shadow Clone types enter the provisional score. Other artifacts retain a separately calculated effect but do **not** receive invented damage/gold source reductions.
- Duplicate or conflicting enchanted artifact records are excluded rather than scored twice. The additive artifact-damage boost pool, Heavenly Sword amplification, Gold damage conversion, conditional and skill cap chains remain incomplete.
- Reference implementation: https://github.com/nebula2/tt2-master/blob/main/src/TT2Master/Model/Arti/ArtifactOptimization.cs (`EffectAtLevel`). Enchantment scaling: https://www.reddit.com/r/TapTitans2/comments/cvnz7m/
- For monuments, official DevLog #231 declares season 13 categories Celestial/Viper/Arcanas. These override stale `IsActive` values in older TT2_CSV snapshots, preventing Pirate seasonal bonuses from leaking into season 13. If the season cannot be matched to a verified category calendar, the bonus may be inspected but **never scored**.
- Missing enchantment status is **not treated as unenchanted** for items whose EnchantmentMagnitude differs from 1; the main numerical score is withheld pending an explicit export field. Boolean enchantment flags are normalized before computing their effects.

## Additive damage pools — separate diagnostic computations

- DamageBonus in ArtifactInfo.csv is preserved for all 103 artifacts. The historical TT2Master code uses `DamageBonus * Level` for artifact damage.
- EndgameSeasonArtifactInfo.csv exposes DamageBonus and DamageExpo for monuments. A separate diagnostic computes `DamageBonus * Level^DamageExpo` with logarithmic summation, respecting official season eligibility; Game Hive confirms Monument Damage stacks **additively**, not by multiplying each monument.
- Raw `EnchantmentMult` is retained separately from `EnchantmentMagnitude`. The only row whose two fields materially differ is SeasonalArtifact34 (Temperance Training Ground: 10 versus 1e20). We calculate a possible enchanted additive pool but do **not** inject it into the score until its exact stacking/interactions are confirmed in game.
- All calculations remain stable for huge scientific levels. Missing enchant status is not guessed.

## Separate Artifact Damage / Heavenly Sword / White Dwarf chain

- Artifact Damage is the ADDITIVE sum of source DamageBonus×Level contributions (logarithmic summation), independent from individual artifact's multiplicative primary effects. A conservative direct AllDamage baseline now includes the recognized raw pool and the verified Heavenly Sword multiplier. Missing enchantment effects, unrecognized artifacts or missing Heavenly Sword level remain explicit omissions; never assume the conservative baseline is the total game multiplier.
- The White Dwarf's per-owned-artifact effect is applied to each uniquely recognized, positive-level, non-conflicting owned artifact. Its effect is amplified by the Magnifier under the official v5.19 rule; the artifact count is not made up from a hardcoded 103.
- This conservative fixed AllDamage account baseline is common to every SP allocation with the same account, so it **cannot** correct the marginal skill optimizer or guarantee a stage gain. Additional artifact enchantment pool contributions and remaining per-source reductions still require validation.

## Artifact multiplier boosters: Magnifier and Treasure of Fergus

- The Magnifier (`Artifact80`) and The Treasure of Fergus (`Artifact81`) are capped boosters. A verified booster raises eligible artifacts' multiplicative primary effect to its power; it does not multiply the separate additive Artifact Damage pool. Retain BonusIcon for all 103 catalog artifacts to identify uncapped damage/gold effects.
- Version 5.10 explicitly added Heart of Storms and Sticky Fruit to Magnifier eligibility, Apollo Orb and Hades Orb to Treasure of Fergus eligibility. The White Dwarf was added to Magnifier in version 5.19. This materially amplifies the Legacy/Exotic pet boosts already incorporated via these artifact effects.
- If a listed booster exists with unreadable or conflicting source level, its dependent artifact effects are skipped rather than silently assuming an unequipped booster. Exceptional hybrids remain outside this known subset.

## Secondary effects of equipped gear — direct subset

- Import up to six explicit secondary type+amount pairs from SecondaryEffects/SecondaryBonuses, string Type:Amount and paired BonusTypeB..F/BonusAmountB..F and numeric suffixes. The same roll represented twice is counted once.
- Normalize aliases Weapon/Sword, Hat/Helmet, Suit/Chest/Armor, Aura and Slash. Ranking and selected equipment now include verified direct damage/gold effects from secondaries, each conditioned on the selected damage/gold source. Unknown chances, mana, probability, crit/deadly and hero/equipment-dependent secondaries are reported without made-up reduction factors.
- This remains a partial equipment ranking. Ring of Calisto, crafting-power scaling, secondary chance caps and pet equipment-boost amplifiers require additional verified mechanics.

## Passive pet bonuses and tier-dependent amplifiers

- All 30 permanent pets are loaded. Account-wide passive share: no bonus below 5, +5 percentage points per five levels, 100% at level 100, with logarithmically stable computations. Previously active pet rankings calculated only an additional selected-pet increment and omitted the entire passive baseline.
- Direct passive AllDamage/BossDamage and GoldAll/FairyGold/GoldBoss contributions are now included once in the fixed context, while other pet bonus types stay diagnostic pending hero/equipment/skill reductions.
- Heart of Storms/Apollo Orb and Sticky Fruit/Hades Orb are resolved from source artifact effects and applied to corresponding Legacy/Exotic Damage/Gold pet bonuses, respectively, never to unrelated types or Pet Attack Damage. Missing enchantment flags remain unknown.
- Equipped-pet ranking compares only the increment above passive, preventing 100%-passive pets from being counted twice. Fatal Samurai and Combat Techniques still alter the active pet's bonus via effective levels.
- All active pets, equipment pets and Transcendent season/hero/special conditions still need full in-game qualification. Raw multiplier proxy does not guarantee stages gained.

## Gemstones and Titan Souls — utility research integrated

- TT2 8.4 has **169 GemstoneLevel research nodes**. All 169 have `BaseEffect=0`, `EffectPerLevel=1`, `GrowthExpo=0`, `MaxLevel=30`: the bonus contributed by an explicitly purchased node is +1 gemstone level per research level. Imported purchases are now summed without assuming missing nodes are zero. Any unknown/duplicate/out-of-range purchase is excluded.
- TT2 8.4 Titan Research contains **62 Titan Soul utility nodes**: 27 `TitanSoulsChance` (+0.002 raw fractional chance per purchased level), 21 `TitanSoulsPerDay` and 14 `TitanSoulsPerPrestige` (source-specific additive increments). Balances and lifetime spent souls are preserved as strings. Raw bonus increments are **not** a prediction of total souls generated or a damage multiplier; the game's base earnings, chance caps and daily accrual are not yet modeled.
- The `titanResearch`/`forbiddenResearch` export sections are merged by node ID and purchased level, without losing disjoint nodes or double-counting mirrored nodes. Duplicate IDs in the same section and inconsistent levels across sections are rejected for **both** numerical research scoring and utility ledgers.
- The web's account baseline panel now shows purchased GemstoneLevel research and Titan Soul income/chance deltas from the export in FR/EN/UK/RU. Missing sections display unknown instead of invented zero; these resource gains do not enter the damage score.
- The 8.0 Gemstone rework has fixed gemstone effects. The bonus levels from Mystic Research are intentionally **not added on top of explicit exported gemstone multipliers** because those values may already include the upgrade; the source GemstoneBonusTypeScalingInfo.csv contains 46 gemstone bonus families, but effective-level scaling and item-level boosts still require gameplay verification. We retain the extra research levels separately rather than invent damage from them.
- Data provenance: https://github.com/rawrzcookie/TT2_CSV/tree/main/csv, `GemstoneResearchInfo.csv`, `TitanResearchInfo.csv`, `GemstoneBonusTypeScalingInfo.csv`.

## Clan Scrolls and spell level caps (not yet complete)

- ClanScrollInfo.csv (18 types) is imported without inferring individual levels from aggregate stats. Raw non-additive multipliers are in log10. When all 18 scroll levels are explicitly available, complete-set amplification is applied: first set +5%, each additional set +10%; multiplicative scroll bonus raised to (1+setBoostPercent). See https://tap-titans-2.fandom.com/wiki/Heroes (Clan Scrolls, post 6.5). Additive scrolls, Quill of Scrolls, Old King’s Stamp, ScrollTutor and ScrollMaster remain unmodeled.
- Active spells have base cap 30 (not 29). Fallen Angel gives +5 and four tier-five skills each give up to +5 to their own spell families. The input assumption is spells active and at max when Max Stage >= 15,000.
- **Corrected off-by-one:** A0 is level 1, A29 is level 30, A34 is level 35, and A39 is level 40. A40 would correspond to level 41. The cap-40 table is complete for 8.4.
- Perks are intentionally out of scope.

## Must be completed **before** public release

- [ ] Validate actual export field names and nested structures with anonymized full TT2 8.4 account exports, including seasonal monuments, research, equipped gear, exotic and transcendent pets.
- [ ] Implement and independently verify numerical artifact effects, enchantments, set effects for crafting power, all jewellery/equipment primary and secondary effects, and relationships between these subsystems.
- [ ] Resolve sourced dependency chains and detect/reject non-solvable cycles. Test equipment -> pet levels -> exotic equipment boost -> equipment effects, gemstone-level boosts, hero-type helmets, and clan/hero weapons.
- [ ] Determine individual and combined effects of all relevant Mystic Gemstones and Necrobear research including *nonmultiplicative* nodes; do not misinterpret Titan Soul balance as a damage multiplier.
- [ ] Calibrate *cross-build* absolute damage/gold conversion and model spell uptime, mana, conditional skills, farming time and push limits. Only then enable automatic damage-source / gold-source selection.
- [ ] Fix missing exotic equipment boost interactions in active-pet rankings. Verify two independent pet slots and 3 best candidates per type.
- [ ] Regression-test all 18 Damage/Gold combinations across different SP levels and complete accounts, including real observed stages. Ensure the former Pet/Fairy -2,000 stages regression remains prevented.
- [ ] Validate Hero Weapon boosted effects (Morgelai Sword, Ringing Stone) and hero-specific impact by build source, Unique equipment permanent effects, and time-based monument formulas against complete TT2 exports; uncomputable effects remain omitted.
- [ ] Run full Node test suite and browser tests for import, calculators, language changes and small-screen layout.
- [ ] Run benchmark on 22,600+ SP with account context, and confirm cache invalidation avoids full recomputation for unchanged branches.
- [ ] Verify cap-dependent spell damage interactions, full-spell activation assumptions, scroll full-set (first +5%, subsequent +10%) against actual account exports, and artifact/equipment amplification.
- [ ] Validate PerDay floor-day semantics and formula against real game screenshots; max values match the source table, not a player result.
- [ ] Final code review (source formulas / no hidden assumptions / PII / numerical precision) and manual approval.

## Mathematical rule

For all candidates with the **same** base account and damage/gold source, a common fixed log10 multiplier cancels:

\[
\arg\max_{s \in S}\bigl(\mathrm{skillScore}(s)+\mathrm{fixedAccountScore}\bigr)
=\arg\max_{s \in S}\mathrm{skillScore}(s).
\]

However, fixed multipliers can change the ranking **across damage and gold sources**, and dependent effects can change marginal SP score. Do not silently assume all bonuses cancel.

## Sources

- https://github.com/rawrzcookie/TT2_CSV/tree/main/csv — \`TitanCardInfo.csv\`, \`GemstoneResearchInfo.csv\`, \`TitanResearchInfo.csv\`, \`ArtifactInfo.csv\`, \`EndgameSeasonArtifactInfo.csv\`, \`EquipmentSetInfo.csv\`.
- Player screenshot Nov 17, 2026 confirming the formula of Ohohono and Mystic Research Pet Damage.
- Existing \`docs/MATH_AUDIT.md\` and issue #9.

**Status: NOT RELEASE READY.** This branch must stay unmerged until all prerequisites are satisfied.
