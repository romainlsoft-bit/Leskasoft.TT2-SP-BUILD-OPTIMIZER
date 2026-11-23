# TT2 8.4 — Tactical Insight two-point local calibration (issue #9)

## Why this is a narrow measured objective, not a complete hero model

The pinned catalog lists `HelperBoost`'s A (multiplicative hero-power
percent) and B (additive hero-power percent) bonuses. The player's imported
hero levels and weapon roster do **not** include a validated inventory of
currently unlocked hero powers with their actual skill category and source.
Consequently, the historical Pet/Fairy reduction weight `111 + 0.7×83`
has no per-account foundation.

A controlled **in-game Stats** comparison is a way to anchor the
Tactical Insight gain in observations without guessing this roster.
The user must measure a *lower* and *higher* Tactical Insight skill level,
with every other allocation, pet, equipment, spell, prestige, stage and
temporary buff held constant. Record **damage and gold** figures for
the selected build and gold source. The in-game Stats preview permits
comparisons without committing a respec.

## Calculation

For damage (D) and gold (G), parse scientific notation as log10
without materializing very large values as JS Numbers:

```text
deltaD = log10(D_high) - log10(D_low)
deltaG = log10(G_high) - log10(G_low)
coord(level) = ln(1 + nativeSourceA(level))
fraction(level) = (coord(level)-coord(low))/(coord(high)-coord(low))
TI_local(level) = fraction(level) * (deltaD + goldWeight*deltaG)
```

The coordinate **only interpolates** within the two observed levels:
it is **not a validated formula for hero-power scaling**. The source B
(additive) contribution is assumed to be present in the observed change,
and is never added again. The actual solver applies an SP minimum of
`low` and a hard maximum of `high` to Tactical Insight. It cannot
produce a recommended TI level outside the measured range; its
precomputed score table uses clamped endpoints solely for internal
lookups at levels it cannot select.

The score is relative to `low`, a fixed requirement of every
calibrated candidate. That constant cancels in optimization, while
the source SP cost of the lower level **does not** cancel.

## Strict safeguards

- Completely opt-in, legacy community and exclusion modes unchanged.
- Damage and gold measurements must both be positive, scientific
  strings allowed (e.g. 1.23e30000).
- The higher-level observations cannot be lower than the first.
- Reject contradictory levels, out-of-range levels, missing metrics,
  or a calibration attached to another damage/gold source.
- Exclusion and measured calibration cannot both be active.
- No invented hero-power counts, estimated real DPS, attack cadence
  or stage-gain predictions.
- Importing a different account or changing damage/gold source clears
  the local calibration.
- The raw measured figures are **not embedded in shared URLs**.
  Shared settings switch to the conservative TI exclusion instead,
  explicitly warning that the same build cannot be reproduced.

This is only a local empirical sensitivity model: actual combat windows,
hero power unlock tables and fully calibrated DPS remain open in issue #9.

## Validation gates

`npm run check`, `npm run bench:issue30`, `npm run bench:push`;
test EN/FR/UK/RU browser interactions; compare independently measured
in-game outcomes. Do not commit private full-account exports or introduce
a paid GitHub Actions workflow.

Sources:
- pinned 8.4 Unity SkillTreeInfo2.0 bonus A/B fields
- https://tt2.wiki/en/skill-tree
- https://www.tt2-compendium.com/fi//wiki/skills/tacticalinsight
