# TT2 8.4: conditional native skill-scoring guards (issue #9)

The DP optimizer scores a weighted log(damage/gold) *proxy*, not validated
in-game stages. A source bonus type cannot be converted into a permanent
global multiplier when its source is a spell, special hit or temporary state.

## Corrected formulas and evidence

| Talent | Source BonusType | Before | Now |
|---|---|---|---|
| Heroic Might (`HelperDmgSkillBoost`) | `HelperBoostSkillAmount` | Always credited as hero damage | A-level damage credited only if **War Cry / HelperBoost** is selected in an independently validated six-slot spell loadout and max-spell scenario |
| Voltaic Sails (`ClanShipVoltage`) | `ThunderVolleySkillAmount`, `ThunderVolleySkillSpecialDamage` | A × B credited even with no Thunder Volley equipped | A only when Thunder Volley is selected, activated in modeled scenario and its skill unlock guaranteed. B is credited only with the explicit special-hit assumption |
| Weakpoint Throw (`CriticalHit`) | `StreamOfBladesSkillAmount`, `UltraDaggerTargetDamage` | A × B treated as permanent Dagger damage | A requires an equipped active Stream of Blades and guaranteed unlock; B requires an explicitly marked Dagger target |
| Searing Light (`HelperInspiredWeaken`) | `InspiredHelperDamage`, `InspiredHelperCount` | Damage A × count B assumed permanently | Damage A only when inspired helpers are explicitly assumed active. Count B is **not** treated as an unconditional multiplier |
| Phantom Vengeance (`CloneDmg`) | `ShadowCloneSkillAmount`, `ShadowCloneSkillAttackRate` | Damage A multiplied by `(4+B)/4`, assuming a 4/s rate without source | Damage A only. B remains a *rate*, not fabricated damage |

Source: pinned Unity `SkillTreeInfo2.0` rows in `vendor/skills.js`,
`ACTIVE_SPELL_CAPS` for spell unlocks; existing loadout evidence and
maximum-spell activation conditions in `src/spell-scenarios.js`.

The new `spellEffectScorable` function reuses the **same** spell selection,
six-slot validity, maximum-spell hypothesis and verified unlock minima as
the cap marginal calculations. This prevents silent credits for unavailable
spells and avoids introducing a second incompatible selection rule.

## Protection against losing unmodeled existing investments

If the imported build already invests in a conditional talent but its
availability cannot be scored, `optimizeBuild` preserves its imported level
by default, as for other unknown conditional skills. The protection can be
explicitly disabled using the *existing* UI control, not a new hidden switch.

The optimizer does **not** invent timings, actual target marks, inspired hero
activations, clone attacks/second, special attack rates, or DPS. Explicit
scenario-only flags in the code are NOT proof of live gameplay or automatic
activation. The full SP allocation remains legal under native costs, tiers,
prerequisites and all six damage / three gold settings.

## Qualification

- Run `npm run check`; include `tests/conditional-native-score.test.js`.
- Run `npm run bench:issue30` and `npm run bench:push` for 22.6k/50k SP.
- Compare real in-game Stats at equivalent stage, selected spells, pets,
  equipment, buffs and SP budget. Missing active-spell loadouts must not
  produce a recommendation described as gameplay-optimal.
- Keep issue #9 OPEN until the hero-power dependency graph, measured attack
  windows and independent results are calibrated.

This correction changes *which skills receive proxy credit*; it does not
assert a demonstrated gain in stages.
