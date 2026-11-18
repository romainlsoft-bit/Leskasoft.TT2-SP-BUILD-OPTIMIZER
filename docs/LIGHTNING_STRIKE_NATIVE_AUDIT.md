# Lightning Strike — native source and bounded conditional scoring

TT2 Android 8.4 `PlayerController.TryLightningAttack()`, RVA
`0x24878C0`, reads `BonusModel.GetBonus` for:
- `LightningStrikeChance` (BonusType 329): a random proc check;
- `LightningStrikeDamage` (BonusType 330): a fraction of current monster HP;
- `LightningStrikeEfficiency` (BonusType 331): raised to
  `currentLightningStrikeCount` before applying the next hit.

This proves an additional condition for the source model: the actual number
of Lightning Strike procs against a boss. It is **not** the quantity used by
the inherited `0.022 × cloneRate × timeToKill` expression; neither the
GameHive client nor the JSON export establishes this as a calibrated rate.

## Change

- Source effects A/B are retained, but skill score is **zero by default**
  whenever hit count cannot be verified; existing invested points are
  protected by the engine's opt-out safety minimum, not credited with
  imaginary damage.
- An explicit, programmatic `assumeSourceOnlyLightningStrike:true` +
  integer `lightningStrikeHits` scenario computes
  `-sum(log10(1-A[level] * B[level]^i))` for i = 0..hits-1, relative to
  level 0. This source-only calculation requires unchanged hit count and
  assumes no unmodeled modifiers to GetBonus(330/331). It is not an
  in-game stage estimate, proc prediction or automatically exposed UI value.
- `src/lightning-strike-evidence.js` exports source diagnostics and the
  engine ledger flags missing hit-count evidence. The runtime no longer
  imports `vendor/clone.js`.

The `vendor/clone.js` file and third-party attribution remain in the
repository pending provenance/license review, but no longer affect math.

## Validation and limitations

Unit tests include all **18 damage/gold combinations**, numerical
three-hit examples, malformed samples, and protection of existing levels.
Full npm test, real Stats panel calibration and measured lightning procs
remain required. Future work must separately verify stacked bonus
multipliers and proc changes caused by equipment or skills.
