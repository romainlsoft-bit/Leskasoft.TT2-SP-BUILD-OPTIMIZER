# TT2 8.4 client source audit — season 13 (2026-11-18)

Scope: **all 18 damage/gold combinations**, never one build. The Pet/Fairy
regression is a diagnostic case, not an exclusive target.

## What was verified

The player's own installed, unmodified Android client yielded Unity TextAsset
tables. The raw APK, game binaries and player-private export are **not** committed.

- Unity extraction archive SHA-256:
  `529bd4d82e6093a48678a11ae47e7dab70a278a338b12e17b767ecf771647aa3`
- Unity container SHA-256:
  `95d181c6ffcf794b7a9f1dcecef1de35a7b851a62f2e376d50f0b56f9981edd8`
- `SkillTreeInfo2.0`: 72 skills, all 345 mapped columns match `vendor/skills.js`
  with lossless decimal/scientific normalization.
- `ArtifactInfo`: 103/103 mapped records match.
- `EquipmentSetInfo`: 214/214 sets match (including modeled bonus fields).
- `PetInfo`: 30/30 permanent pet coefficient sets match.
- `EndgamePetInfo`: 15/15 seasonal pet coefficient sets match; the
  alternate _1 file differs in six `IsActive` flags. Do not infer seasonal
  ownership from them.
- `EndgameSeasonArtifactInfo`: 52 monuments match the *previous*
  repository catalog; marks Pirate/Viper/Arcanas active.
- `EndgameSeasonArtifactInfo_1`: **51 IDs and 226 mapped fields differ**;
  marks Celestial/Viper/Arcanas active. User confirmed Celestial and no Pirate
  in the live 8.4 season. This is the chosen season-13 source.

## Fix

`vendor/account-catalog.js` now exposes the old `...EMBEDDED_A` table
for audit and the current `SEASON_ARTIFACT_CATALOG` as A with the exact
numerical delta from `EndgameSeasonArtifactInfo_1`. No invented formula,
no source table mixing, no conversion of large scientific values to
JavaScript Number on import.

A regression test hashes all 52 records and all 14 relevant fields to
`fc7604a0` (FNV-1a32 over canonical key-value lines). The matrix test
checks finite fixed account scores for **6 damage × 3 gold** choices.

## Limits — not yet claims of correctness

This independently verifies embedded values, not *which* Unity asset is
loaded at every call site or whether later InfoDocs server updates override
the embedded data. The in-game season rotation is consistent with _1.

There are still independent formula and dynamic-uptime assumptions to audit:
bonus reductions, snapshot-vs-live statistics, additive pools, contract
ramp/mana and absolute stage predictions. No deployment or automatic merge
is warranted until gameplay validation and the full PR #18 gates hold.
