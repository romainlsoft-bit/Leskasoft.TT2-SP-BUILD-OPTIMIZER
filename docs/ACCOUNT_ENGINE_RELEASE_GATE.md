# Full-account SP optimizer — release gate (work in progress)

**Do not merge this feature branch into main and do not deploy GitHub Pages until all gates are checked and reviewed against real player exports.** The public page is sourced from main.

## Verifiable integration achieved on this branch

- Catalogues from TT2 game CSVs: 103 regular artifacts, 52 seasonal artifacts, 214 sets, 198 supported *multiplicative* Gemstone Research rows, 120 titan cards and 149 supported *multiplicative* Titan Research rows.
- Import normalization handles 688-node research trees without the previous 512-record truncation, plus explicit Titan Research and seasonal artifacts. It excludes account IDs and stores huge scientific values as strings.
- Exact game-data rows tested against user's screenshots: Titan1/Ohohono lv93 = 1.3299^93 = ×3.2746e11; GemstoneResearch 284 lv20 = 14.6089^20 = ×1.9604e23.
- Fixed account bonuses are combined in log10 space for known *explicit* damage/gold types. They are not optimization variables; changing SP does not recompute fixed data.
- Typed dependency DAG covers fixed inventory, owned sets, artifact effects, equipment-granted levels, effective gemstones, heroes, pets, effective equipment and skill effects. Recursive invalidation and cycle detection are tested.
- Incomplete effects are explicitly reported, not assigned estimated coefficients. This is a first layer of the account power engine, not a validated stage simulator.

## Must be completed **before** public release

- [ ] Validate actual export field names and nested structures with anonymized full TT2 8.4 account exports, including seasonal monuments, research, equipped gear, exotic and transcendent pets.
- [ ] Implement and independently verify numerical artifact effects, enchantments, set effects for crafting power, all jewellery/equipment primary and secondary effects, and relationships between these subsystems.
- [ ] Resolve sourced dependency chains and detect/reject non-solvable cycles. Test equipment -> pet levels -> exotic equipment boost -> equipment effects, gemstone-level boosts, hero-type helmets, and clan/hero weapons.
- [ ] Determine individual and combined effects of all relevant Mystic Gemstones and Necrobear research including *nonmultiplicative* nodes; do not misinterpret Titan Soul balance as a damage multiplier.
- [ ] Calibrate *cross-build* absolute damage/gold conversion and model spell uptime, mana, conditional skills, farming time and push limits. Only then enable automatic damage-source / gold-source selection.
- [ ] Fix missing exotic equipment boost interactions in active-pet rankings. Verify two independent pet slots and 3 best candidates per type.
- [ ] Regression-test all 18 Damage/Gold combinations across different SP levels and complete accounts, including real observed stages. Ensure the former Pet/Fairy -2,000 stages regression remains prevented.
- [ ] Run full Node test suite and browser tests for import, calculators, language changes and small-screen layout.
- [ ] Run benchmark on 22,600+ SP with account context, and confirm cache invalidation avoids full recomputation for unchanged branches.
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
