# TT2 8.4 — Why a 26-level Terrifying Pact is not necessarily an optimizer recommendation

2026-11-18 real-game feedback: Pet/Fairy reached about 792100, but the user
reports too many Warlord SP and 26 levels in Terrifying Pact. A historical
import at 22654 SP already contained:
- TerrifyingPact 26 -> **2156 SP**
- ClanShipStun (Anchoring Shot) 26 -> **420 SP**
- HelperDmgQTE (Astral Awakening) 15 -> **442 SP**

Under the default `protectUnmodeledSkills=true` context, if
`assumeContractsAtMax=false`, `assumeBossStunned=false` and
`astralActivations=0`, **3018 SP (13.32%) can be automatically frozen**
from the imported tree rather than freely optimized, including 862 SP in
Warlord alone. These levels may still be beneficial in real play. It is
incorrect to call this evidence of an optimal allocation; the current
`protectedSkills` mechanism is an intentional *safety constraint*.

There is a second, independent source gap:
`HelperBoost` (Tactical Insight) affects **multiplicative/additive hero
skills**. Unity BonusInfo marks both as additive percentages, not direct
AllDamage/AllGold bonuses. The community reduction table maps this to
Pet=111 and Fairy=83. The current Pet/Fairy score at goldWeight=.7
therefore weights `log10(1+A)` by `111+0.7×83=169.1`,
while it does not separately model B's hero skill interactions.
This proxy may bias Warlord SP allocations, but we cannot invent a new
factor until native hero skill aggregation and current hero skill roster
are audited. The actual in-game improvement following a player-adjusted
Warlord allocation is evidence worth testing, not proof of a unique
replacement coefficient.

## Changes

- `src/investment-audit.js` derives exact locked SP from
  `SkillTreeInfo2.0` cumulative Co costs and outputs the reasons,
  percentages and source status separately from the solver score.
- `optimizeBuild().investmentAudit` and localized UI results show protected
  historical SP and the Tactical Insight reduction provenance.
- No alteration to the currently successful +2600-stage Pet/Fairy scoring
  model. Do **not** auto-release 2156 SP from Pact or arbitrarily
  redistribute them.
- 18 route tests ensure diagnostic independence and accurate protected
  cost accounting.

## Next real-game calibration

Compare actual Stats and best-stage attempts with *controlled* changes
to Pact and Warlord skills while the season, stage, pet pair, equipment,
active spell loadout and buffs are held constant. Most importantly,
record whether Forbidden / Royal Contracts reach their maximum and
how long their actual effects are sustained. Both contract maximums
and Tactical Insight hero-skill aggregation need native/gameplay checks
before any scorer weight can be changed safely.
