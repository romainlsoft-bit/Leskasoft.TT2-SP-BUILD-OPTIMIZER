# Transmutation Jackpot Gold: do not treat chance-dependent gold as permanent

The first-party TT2 8.4 SkillTreeInfo2.0 source has **two separate columns**:

- `Transmutation.A[n]` — `JackpotGold`, the multiplier **when eligible**.
- `Transmutation.B[n]` — `JackpotGoldChance`, a chance contribution.

Previously the optimizer simply credited `log10(A[n])` to ALL gold routes
as though every gold reward were a guaranteed Jackpot.

The actual account-level chance, capped interactions, base Jackpot
multipliers and proportions of eligible events are **not fully resolved
for a proposed SP tree**. Therefore the skill's optional model uses a
clearly labeled **source-only event scenario**, based solely on A and B:

```
model_multiplier = (1 - B[n]) + B[n] * A[n]
modeled_skill_log10 = goldWeight * log10(model_multiplier)
```

The implementation uses `binaryExpectedMultiplierLog10` with
`positiveLog10` in log space, rather than constructing large
intermediate multipliers. At level zero the score is zero. This is a
**hypothetical expected amount of one eligible gold event under the
talent's own chance**; it is NOT a verified relative gain for the actual
account, a real-world chance observation or a direct stage forecast.
Other imported Jackpot chances are never silently reused after changing
the skill tree.

The imported Transmutation skill is protected when
`protectUnmodeledSkills` is enabled so that an incomplete event model
cannot silently remove an existing investment. No manual DPS input,
attack type selector or frequency estimate is added. The result report
contains `jackpotSourceOnly` and the UI explains its limitation.
All 18 combinations of 6 damage builds × 3 gold sources share the same
scoring rule.

Evidence and motivation:
- Game-local source files `vendor/skills.js`.
- Game Hive, DevLog #86 (Jackpot Gold activates with a chance on titan kills):
  https://www.reddit.com/r/TapTitans2/comments/pltk6m/
- `src/conditional-probabilities.js`, which already separates imported
  final Jackpot chance from a skill-tree-dependent hypothetical change.

Validation, run locally or on a pre-authorized TeamCity agent:

```bash
node --test tests/transmutation-native-score.test.js
npm run check
npm run bench:issue30
npm run bench:push
```

**Do not use GitHub Actions for this repository.**
