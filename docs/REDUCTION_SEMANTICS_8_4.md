# TT2 8.4 — Conditional reduction audit (Unity BonusInfo)

The 18 build routes previously relied on the MIT-licensed
`vendor/reductions.js` table even for bonus types that are *not*
unconditional permanent damage. This is a first-party-source-backed
semantic correction, not a replacement for all those reduction
coefficients. Preserve attribution for reused tables.

Verified directly against the player's official Android 8.4 Unity
`SkillTreeInfo2.0` and `BonusInfo`:

| Talent | A bonus type | Source semantics | Change |
|---|---|---|---|
| Anchoring Shot | ClanShipStunDamage | Stun damage only on stunned titan | Count A only with explicit `assumeBossStunned=true` |
| Dimensional Shift | ShadowCloneAllSkillBoost | Stronger spells **while Shadow Clone is active** | Exclude unverified uptime / all-skill amplification |
| Poison Edge | UltraDaggerPoisonBoost | Additive percentage poison bonus | Exclude arbitrary `log10(1+10*A)` conversion |
| Sprouting Salts | KratosMonsterBonusAmount | Kratos/Sprout stack mechanic | Exclude hypothetical `B*log10(A)` as permanent AllDamage |

The latter three source mechanics remain visible via
`conditionalSkills.rows` but are **not numerically modeled** until
the source conversion and activation rules are verified. The
calculation-ledger coverage includes
`unverified-conditional-skill-multipliers` when relevant.

To avoid tearing down existing useful builds during partial modeling,
`optimizeBuild` protects existing investment in the unverified
talents by minimum levels (unless the caller explicitly disables
`protectUnmodeledSkills`). The protection is not a claimed score.

The `assumeBossStunned` option is deliberately *not* set automatically
by the UI or inferred from any damage family; explicit hypothetical
usage is supported for comparison only, and still does not prove actual
stun uptime.

**Not yet solved:** uptime, stun source availability and hit timing,
effective SC skill boost conversion and spell loadout, active poison
stacking and duration, Kratos/Sprout spawn and buff-stack conditions.
These cannot be inferred from a constant coefficient in the old
community optimizer.

Tests cover 18 damage/gold pairs at source levels and validate
documented bonus type identities, conservatism, explicit stun opt-in,
and transparent coverage. Full npm suite + game Stats calibration
remain required before merge.
