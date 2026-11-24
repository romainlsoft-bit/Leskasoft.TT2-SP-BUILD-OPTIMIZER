# Ambush: Multiple Titan Gold is an encounter-dependent multiplier

TT2 8.4 first-party source `vendor/skills.js` identifies:

- `MultiMonsters.A[n]`: `MultiMonstersGold`, a multiplier to the gold
  **collected from a multiple-Titan group**, not each ordinary
  Chesterson gold opportunity.
- `MultiMonsters.B[n]`: `MultiMonstersMaxCount`, a **group size cap**,
  not a probability or bonus applied on every encounter.

The previous generic skill scoring assigned
`goldWeight × log10(A[n])` to all Chesterson gold as if every reward
were collected from a group.

## Revised source-limited scenario

The [TT2 Wiki guide](https://tt2.wiki/en/guides/stage-skip-and-titan-skip)
documents a **1% base multiple-Titan appearance chance** (before
bonuses from Love Potion, account progress and equipment).

For each positive Ambush level, the new conditional proxy uses only
the documented **base** group chance:

```text
p = 0.01
source-only event expectation = (1-p) + p × A[n]
score = goldWeight × chestersonReduction × log10(expectation)
```

Use `binaryExpectedMultiplierLog10` and `positiveLog10` to
avoid very-large-multiplier overflow.

The score remains zero for non-Chesterson gold routes, and zero
at skill level 0. The raw native B group cap is retained as
unscored evidence; it is **never converted into a chance**.

**Crucial limitations:** the player may have a far higher group
chance than the 1% guide base. Actual group sizes, gold collection
timing, other source chance bonuses and eligible opportunity mix
are not verified. This is an intentionally conservative
source-only hypothetical scenario, **not** an accurate expected
in-game gold gain, calibrated Chesterson conversion or an estimated
maximum stage. We do not transplant observed current-chance values
to a newly distributed SP tree.

Under `protectUnmodeledSkills`, imported Ambush investments are
preserved rather than eliminated merely because the model is
incomplete. No new inputs, manual attack settings, fake damage
parameters or arbitrary branch limits are introduced.

Source:
- `vendor/skills.js` pinned TT2 8.4 catalog
- https://tt2.wiki/en/guides/stage-skip-and-titan-skip
- https://www.tt2-compendium.com/en/wiki/skills/ambush

Local qualification on Node / authorized TeamCity, **no GitHub Actions**:

```bash
node --test tests/ambush-native-conditional-gold.test.js
npm run check
npm run bench:issue30
npm run bench:push
```
