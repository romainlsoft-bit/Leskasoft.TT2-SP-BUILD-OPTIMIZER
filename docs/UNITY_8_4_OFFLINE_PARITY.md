# TT2 8.4 — independent Unity catalogue attestation

As part of the source-independence audit, `npm run check:data` no longer downloads
`rawrzcookie/TT2_CSV`. It verifies an immutable, locally embedded cryptographic
snapshot of **the player's extracted Android TT2 8.4 Unity TextAssets**.

The read-only extraction yielded `SkillTreeInfo2.0.csv`, `ActiveSkillInfo.csv`,
`PetInfo.csv` and `EndgamePetInfo.csv`. The repository stores **only field
projection digests, schema and source hashes**, not the game's original
assets, DLLs, APK, account export or any private user data.

| Catalogue | Verified | Fields per item | Notes |
| --- | ---: | ---: | --- |
| Skills | 72/72 | 345 | Costs, prerequisites and A/B/C/D per-level values |
| Active spells | 11/11 | 176 | The 11 actual slot-eligible spells |
| Legacy pets | 30/30 | 8 | Names, type, base/inc/improvement and equipment roles |
| Seasonal pets | 15/15 | 8 | Numerical coefficients; **not** seasonal IsActive flag |

Three non-slot fairy/support rows are present in the source ActiveSkillInfo
but have *empty trailing fields*. The inherited table uses `-` on some
unused columns; they are intentionally **not declared bit-for-bit equal**.
Seasonal pet `_1` carries different `IsActive` flags from the main file;
we retain the existing unknown-season diagnostic rather than infer ownership.

## Commands

- `npm run check:data`: checks that the vendored values have not drifted from
  the independently extracted official source attestation; works offline.
- `npm run check:data -- --unity-dir D:\Leskasoft\TT2\TT2-APK-analysis\unity-assets\...\tables`:
  compares **every mapped field against actual local Unity CSVs**, including
  raw input file SHA-256; rejects source and vendor mismatch. Pass the actual
  directory containing the four original CSV files.
- `npm test`: runs regression tests for normalisation, source parsing, game
  semantics, scientific notation, and stale-source failures.

The snapshot verifies *data fields*, not the complete behavioral formulas.
In particular, the community `vendor/reductions.js`, `vendor/qol-baseline.js`,
and some scalar tables remain adapted work. **Keep `THIRD_PARTY_NOTICES.md`
until reused copyrighted portions have actually been replaced**. Later
independently developed replacements can be acknowledged in their own files;
we must not remove licenses merely because numerical data coincides.

A changed game version requires fresh Android extraction and a fresh audited
snapshot; this checker intentionally never auto-accepts unknown game values.