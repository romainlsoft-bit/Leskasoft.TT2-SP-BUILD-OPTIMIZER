# Issue #30 — implementation and qualification

This change is a correction of the **8.4.0 tabulated proxy**, not a claim
of exact 8.4.2 damage formulas, real-world stage gain, or optimal uptime.

## Changes

1. Spell-dependent multicast stacks are only scored for a valid equipped
   six-slot spell loadout, a demonstrably unlocked spell and an enabled
   maximum-spell hypothesis. Each source skill maps to its own spell, including
   **Eventide Afterglow** and **Midas Overflow**. The modeled charges are
   limited to the skill level and the FB/FF set cap, optionally reduced by
   observed available charges. Imported talent minimums, prerequisite costs
   and independent skill-tree-set scoring remain legal when the spell is absent
   or its uptime cannot be demonstrated. An absent loadout is marked
   `unknown-loadout`, distinct from `spell-absent` and `spell-locked`.
   Diagnostics expose source duration/cooldown, maximum charges, modeled
   charges, and the fact that effective uptime is still unverified.
2. **ChestAmount** and **GoldChesterson** now route to Fairy and Chesterson
   (factor 1) but never to HoG. The same function is reused for equipment
   (primary and secondary), fixed account effects (artifacts/research/pets)
   and the gear search. The existing skill talent Chesterson Incense already
   followed this route in the pinned reductions table.
   **ChestersonGoldStageAmount** is a duration effect and receives no
   multiplicative gold score. Reference:
   https://www.tt2-compendium.com/en/wiki/skills/chestersonincense ;
   https://www.tt2-compendium.com/fr/builds/build/pet-fairy
3. Imports no longer reuse a previous account's SP budget. A nonnegative
   **declared** integer, including zero, is authoritative. If absent, use the
   imported tree's **spent** SP, mark the budget `inferred`, and allow manual
   correction. Warn when declared SP is below the imported tree's cost.
   Grouped decimal integers (`22,600`, `792,100`, `22 600`) are accepted;
   ambiguous comma/dot formats are rejected.
4. **Flash Zip** counts A as damage per activation. B reduces the cooldown
   and can no longer penalize the damage score. Any additional activations
   require an explicit baseline cooldown and window; absent evidence adds
   zero frequency multiplier. Heart of Gold cadence has its own explicit
   window and baseline, and is only attributed to HoG.
   Reference: https://www.tt2-compendium.com/en/wiki/skills/flashzip
5. Pet-pair theoretical upper bounds now envelope **all** visited
   gear/Combat Techniques subproblems, not only the best feasible equipment.
   A missing bound prevents certification. The finer gear-level ranking
   remains separate from pet-level certification; unexplored inventory and
   omitted pets are never claimed to be globally dominated.
6. The coarse cross-branch SP grid is anchored on each branch's first
   **feasible** DP budget, including all mandatory prerequisite and tier
   costs, instead of the sum of isolated minimum skill costs.

## Regression coverage

New `tests/issue-30-regressions.test.js` checks strict budget parsing,
two account imports through the real import code path, equipped/absent/locked
multicasts and Midas/Twilight branches, 1,000 SP allocation, Fairy/Chesterson/HoG
fixed-account routing and the ×100 vs ×2 armor duel, Flash Zip cooldown
windows, the 12,001/12,000 SP prerequisite boundary, and the 100/99/98/105
pet-pair upper-bound counterexample.

Two outdated assertions are updated: the profile catalog now has 19
sections, and the worker request intentionally passes through
`keepContractsConservative(structuredClone(state))`.

Targeted V8 execution in the GitHub-connected session confirmed the
multicast, Flash Zip, gold conversion, grid, and upper-bound counterexamples.
**Full Node tests, `npm run check:data`, `npm run check:modules`,
the 18 damage/gold pairs at 22,600/50,000 SP, and the worker/browser
integration have not been rerun locally**. These gates must pass before
merge/deployment. The issue's prior baseline was 537/539, not a post-fix
test result.

## Remaining independent verification

- Compare a player export and proposed tree at the same stage, pet pair,
  inventory, selected spells, and contract state; record remaining SP,
  per-source score, and in-game Stats preview. Do not claim stage gains from
  unsynchronized contract or prestige timing.
- The export may identify game version 8.4.2 while the controlled tables
  remain 8.4.0. A verified 8.4.2 coefficient change should be captured as
  a new data-table update, not silently extrapolated.
- Source spell durations and maximum stacks do not establish effective
  mana sustain or real-time activation uptime. Explicit cadence inputs
  need calibration against reproducible in-game observations.
