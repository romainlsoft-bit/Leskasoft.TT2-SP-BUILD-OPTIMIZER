# Transcendence Season 14 — Data and scoring provenance (2026-11-26)

## Calendar and rotation
- Season starts **26 November 2026**, per TT2 community wiki: https://tt2.wiki/en/guides/transcendence .
- Active monuments: **Pirate (11)** + **Viper (11)** + **Celestial (11)**. **Arcanas inactive**.
- **180,000 stage** is the Transcendence entrance threshold, *not* a seasonal maximum.
- Older season 13 exports remain archived; 24–25 November is between seasons.

## Unity CSV evidence (pinned, immutable)
- `csv/EndgameSeasonArtifactInfo.csv`, Git blob **ea82d1f49af816f9a43e58849b1aa21cbc4b072d**:
  52 monuments, 33 `IsActive=TRUE`: Pirate 11, Viper 11, Celestial 11.
  Full snapshot in `vendor/season14-monuments.js`. All 52 records and all modeled fields were checked field-by-field against this GitHub blob on 2026-11-26.
- `csv/EndgamePetInfo.csv`, Git blob **b2e8ffe778f22f6742447284ac05ede113f6c992**:
  15 stored pets, only **10 active**: Clang, Scaly, Snuggles, Chitter, Quippy,
  Lullabye, Lemon, Sonara, Sandy, Clawsette.
  IDs: SeasonalPet1,2,3,4,6,7,8,11,13,14. Snapshot in `vendor/season14-pet-roster.js`.
- **Cross-check**: `EndgamePetInfo_1.csv` blob
  **3d4ac87949893f3619d3c8d43d3638eec55de820** has precisely the ten
  Season 13 active pets published by Game Hive in
  https://gamehive.com/blog/devlog-231-transcendence-season-13/ .
  Likewise `EndgameSeasonArtifactInfo_1.csv` blob
  **eec56aa2468fd049ab7f07db2d69a7e4e0007c04** has season-13
  Celestial/Viper/Arcanas rotation.
  Variant A matches the community wiki season-14 Pirate/Viper/Celestial rotation.
  Hence season-14 active pet interpretation is *strongly corroborated*; there
  is no claim that Game Hive separately published those exact ten names yet.

Source repository: https://github.com/rawrzcookie/TT2_CSV/tree/main/csv .

## Scoring rules
- Resolve monument identifiers and numeric fields from the **correct season's**
  catalog. Season-13 B overrides must NEVER be added to season-14 A.
- Eligible, explicitly owned monuments can contribute directly modeled effects
  and conservative additive Monument Damage once; unknown conditional and
  unverified enchantment stacking effects remain out of numerical scoring.
- Only active season-14 pets with **positive levels actually present** in
  a season-14-stamped, untruncated account export may influence the score.
  Seasonal rows without season metadata, inactive pets, or impossible >10-pet
  seasonal collections cannot become active by default.
- Historical stage values >180k are not silently reused. Current season-14
  exports, manually entered post-rollover values, saved state with explicit
  season marker and newly generated links can retain >180k.
- Six damage builds × three gold routes = 18 combinations. Never optimize
  only Pet/Fairy.

## Qualification
- Source parity checked: all **52/52** catalog rows and all mapped CSV fields
  match blob ea82d1f…, zero mismatches; active pet roster exactly matches
  blob b2e8ff….
- Static syntax and targeted JavaScript smoke checks passed in the connector
  environment for changed core modules and season-14 eligibility.
- Full test suite `npm run check` and performance benches have **not been run**;
  GitHub Actions remains prohibited. Run locally/TeamCity before merging PR #54.
- User in-game SP/Stats validation still needed to calibrate dependent
  monument and pet interactions, particularly new-season build-push outcomes.
