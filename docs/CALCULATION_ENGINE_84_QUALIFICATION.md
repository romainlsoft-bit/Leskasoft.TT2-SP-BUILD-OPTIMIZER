# TT2 8.4 — integrated engine qualification

This is a **source-bounded, deterministic skill-point optimizer** across
**six damage sources × three gold sources**. It is not a game emulator and
must never promise the best *real stage* without independent in-game tests.

## Consolidated changes

- PR #19: source-correct Celestial/Viper/Arcanas monuments for season 13
  (the client also packages the older Pirate/Viper/Arcanas table).
- PR #20: source-backed Forbidden/Royal contract ramp and mana tick
  *diagnostics only*, with unknown free ticks and uptime.
- PR #21: remove fabricated direct damage reductions for mana capacity
  and mana siphon.
- PR #22: gate unverified Anchoring Shot, Dimensional Shift,
  Poison Edge and Sprouting Salts conditions; preserve existing SP levels
  rather than optimizing them away because our model is incomplete.
- PR #23: replace remote community CSV verification with **offline SHA-256**
  snapshots of the player's own TT2 8.4 Unity data (72 skills,
  11 playable spells, 30 legacy and 15 seasonal pets).
- This consolidation: remove unverified Lightning Strike attack-count
  formula `0.022 * cloneRate * timeToKill`. Use native BonusType
  329/330/331 semantics to provide source-only conditional diagnostics
  and optional explicit hit-count comparison.

## Test gates

`npm test` must pass the original suite plus new fixture and matrix tests.
`npm run check:data` must pass without network.
Optionally execute `npm run check:data -- --unity-dir <local-files>`
against `TT2-Unity-catalogue/tables` on a development computer.
Existing exhaustive gear/pet and 22k-SP benchmarks remain necessary.

The integrated 18-route regression checks:
- finite scores, admissible SP budgets, exact ledger component accounting;
- only Celestial/Viper/Arcanas monuments in season 13;
- no direct damage scored from unsourced mana, special-titan stacks,
  unverified poison, SC-active, stun or Lightning Strike hit frequency;
- no automatic cross-build optimum or stage-gain prediction claimed.

## Known mathematical limits

- Conversion coefficients in `vendor/reductions.js` still include
  community-origin assumptions; independent first-party confirmation is
  **incomplete**. Retain third-party MIT notices until independently
  replaced portions are exhaustively identified and legally reviewed.
- Proc distributions, exact Lightning Strike hit count, observed boss
  time-to-kill and HP curve are not verified by a static export.
- Spell activations/multi-cast uptime, mana sources, contract sustain,
  temporary buffs and some exotic-pet and equipment cross-effects are
  conditional; source CSV rows alone cannot prove full values.
- No single exported JSON proves optimality of every possible pet,
  equipment and SP combination; the UI reports explored domain and bounds.

## Status

Data parity and targeted tests are grounded in the actual client export.
A full `npm test` run, CI checks and live TT2 Stats calibration must still
be completed *before* merge. This document does not mislabel
the completed work as a fully validated gameplay model. No auto merge
or deployment.
