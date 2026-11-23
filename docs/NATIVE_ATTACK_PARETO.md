# Native attack modifier Pareto search (TT2 8.4; issue #9)

This opt-in experiment solves **complete skill trees** using the same original
Skill Points, selected pets/gear, account, import, protected minimums and
modeled damage/gold score. It adds two source-specific alternatives whose
mandatory minimum level is chosen from the actual `SkillTreeInfo2.0` bonus
column of the selected attack. The source columns are mapped in
`attack-channels.js`; no new weights are attached to Stage Skip or attack
frequency.

## What this is

- Axis 1: native bonus magnitude for **one specific attack**, in log10. This
  remains a partial multiplier, *not* complete real hit damage or DPS.
- Axis 2: the existing weighted damage/gold proxy, with its existing
  assumptions, score gaps, protected skills and bounded optimization.
- A row contains the entire allocation, SP spent, source talent level, source
  multiplier, proxy score and an export. Only visited feasible rows are
  Pareto-filtered, not all feasible trees.
- Its result never automatically replaces the standard recommended build.
  The user can compare exported full trees with the TT2 in-game Stats screen.

A channel without an invested talent has **no known source multiplier**,
not a fabricated 1x. The `charged` Pet state and Gold Gun's skip-only route
are not killing attacks. Source modifiers from one attack are never added to
another attack, and no historical hit from the prior allocation is reused.

## Constraints and performance

- Max two extra constrained full-tree solves by default **after** the
  selected pet/gear context is finalized, never once per equipment permutation.
- Source-only skill cost is only a cheap prefilter; the full optimizer
  validates real prerequisites, tier unlocks, user minimums and the SP budget.
- An infeasible alternative is reported, not silently promoted.
- If the attack requires a spell that is explicitly not equipped, no
  alternative is calculated. Missing loadout evidence is reported and never
  treated as verified.
- Unknown activation, special attack cadence, charged uptime, true boss HP
  changes, real gold collection, mana and contract effects are not predicted.
- No Warlord cap and no special Pet/Fairy coefficient are introduced.

## Validation

`npm run check`, `npm run bench:push`, `npm run bench:issue30` and browser
tests for EN/FR/UK/RU remain required. Before claiming an improvement in
stages, collect independent in-game Stats / boss-window observations for the
original and every candidate tree, at the same stage, buffs, equipment and
pet configuration. Preserve the original account export privately.

Source tables: pinned 8.4.0 Unity SkillTreeInfo2.0 (local). Mechanics
cross-check: https://www.tt2-compendium.com/en/wiki/skills/lightningburst
and https://tt2.wiki/en/skill-tree . These external pages corroborate the
mechanical distinction but do not calibrate the community reduction matrix.
