# Full-account SP optimizer — release gate (work in progress)

**Do not merge this feature branch into main and do not deploy GitHub Pages until all gates are checked and reviewed against real player exports.** The public page is sourced from main.

## Verifiable integration achieved on this branch

- Catalogues from TT2 game CSVs: 103 regular artifacts, 52 seasonal artifacts, 214 sets, 198 supported *multiplicative* Gemstone Research rows, 120 titan cards and 149 supported *multiplicative* Titan Research rows.
- Import normalization handles 688-node research trees without the previous 512-record truncation, plus explicit Titan Research and seasonal artifacts. It excludes account IDs and stores huge scientific values as strings.
- Exact game-data rows tested against user's screenshots: Titan1/Ohohono lv93 = 1.3299^93 = ×3.2746e11; GemstoneResearch 284 lv20 = 14.6089^20 = ×1.9604e23.
- Fixed account bonuses are combined in log10 space for known *explicit* damage/gold types. They are not optimization variables; changing SP does not recompute fixed data.
- Typed dependency DAG covers fixed inventory, owned sets, artifact effects, equipment-granted levels, effective gemstones, heroes, pets, effective equipment and skill effects. Recursive invalidation and cycle detection are tested.
- Incomplete effects are explicitly reported, not assigned estimated coefficients. This is a first layer of the account power engine, not a validated stage simulator.

## Time-dependent effects, owned Unique items and Hero Weapons

- **30 set effects** in EquipmentSetInfo.csv are marked PerDay=TRUE. Their original PerDay and MaxValue metadata are now retained. These effects remain out of numerical scoring until verified date AND formula are available.
- **Date of set completion** = acquisition of the fifth *distinct* slot (weapon, helmet, armor, aura, slash), never the beginning of the current Transcendence. Use the explicit completion date or five equipment acquisition dates from the export if and only if supplied. If absent, ignore the time-dependent effect. No player-entered date, no guessed date, and no replacement with season date.
- **Transcendence season age** is a separate parameter. Read the export start date, or match exported season number to a versioned official calendar. Season 13 start 2026-08-12 from Game Hive DevLog #231.
- **Hero weapons**: preserve actual individual levels; full set and hero damage calculations remain unscored until the current complete roster, stacking and all relevant bonuses are independently checked.
- **Unique equipment**: possession is distinct from equipment currently worn. Detect ownership of Unique items in the export; don't make permanent effects disappear on unequip. Numerical bonus is unverified for now.
- An ignored effect means **unknown in-game contribution**, not zero in-game power. Never present the proxy as an absolute damage model.

## Clan Scrolls and spell level caps (not yet complete)

- ClanScrollInfo.csv (18 types) is imported without inferring individual levels from aggregate stats. Raw non-additive scroll multipliers are in log10. Additive scrolls, ScrollTutor, ScrollMaster and completed-set amplification remain unmodeled.
- Active spells have base cap 30 (not 29). Fallen Angel gives +5 and four tier-five skills each give up to +5 to their own spell families. The input assumption is spells active and at max when Max Stage >= 15,000.
- The available source is A0..A39; capped at 40, the value for A40 must not be extrapolated. Full spell modeling needs a verified level 40 value.
- Perks are intentionally out of scope.

## Must be completed **before** public release

- [ ] Validate actual export field names and nested structures with anonymized full TT2 8.4 account exports, including seasonal monuments, research, equipped gear, exotic and transcendent pets.
- [ ] Implement and independently verify numerical artifact effects, enchantments, set effects for crafting power, all jewellery/equipment primary and secondary effects, and relationships between these subsystems.
- [ ] Resolve sourced dependency chains and detect/reject non-solvable cycles. Test equipment -> pet levels -> exotic equipment boost -> equipment effects, gemstone-level boosts, hero-type helmets, and clan/hero weapons.
- [ ] Determine individual and combined effects of all relevant Mystic Gemstones and Necrobear research including *nonmultiplicative* nodes; do not misinterpret Titan Soul balance as a damage multiplier.
- [ ] Calibrate *cross-build* absolute damage/gold conversion and model spell uptime, mana, conditional skills, farming time and push limits. Only then enable automatic damage-source / gold-source selection.
- [ ] Fix missing exotic equipment boost interactions in active-pet rankings. Verify two independent pet slots and 3 best candidates per type.
- [ ] Regression-test all 18 Damage/Gold combinations across different SP levels and complete accounts, including real observed stages. Ensure the former Pet/Fairy -2,000 stages regression remains prevented.
- [ ] Validate all Hero Weapon collection/level multipliers, Unique equipment permanent effects, and time-based set/monument formulas against complete TT2 exports; uncomputable effects remain omitted.
- [ ] Run full Node test suite and browser tests for import, calculators, language changes and small-screen layout.
- [ ] Run benchmark on 22,600+ SP with account context, and confirm cache invalidation avoids full recomputation for unchanged branches.
- [ ] Verify level-40 spell values, cap-dependent skill interactions and scroll-set/amplification formulas against complete exports.
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
