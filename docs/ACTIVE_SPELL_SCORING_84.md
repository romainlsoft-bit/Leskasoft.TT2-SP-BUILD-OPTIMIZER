# Active spell source bonus scoring and Coordinated Offensive (issue #9)

## Problem and scope

Previously the additive SP score gave damage credit to seven skill A columns
for *equipped active spells*, even if the exported equipped six-slot loadout
did not confirm those spells. It also treated the Warlord `ClanQTE` bonus
`ActiveAllHelperDamage` as an unconditional hero-damage multiplier.

Source: pinned Unity `SkillTreeInfo2.0` and `ActiveSkillInfo`, cross-checked
against TT2 Compendium descriptions. Coordinated Offensive's hero damage
requires summoning the clanmate during battle (not permanent uptime).

## Source-level changes

The following entries are scored only if the required active spell is
confirmed by the existing `spellEffectScorable` selection and unlock gate:

| Skill | Required equipped spell | Source bonus |
|---|---|---|
| FireTapSkillBoost (Summon Inferno) | TapBoost | TapBoostSkillAmount |
| CritSkillBoostDmg (Assassinate) | CritBoost | CritBoostSkillAmount |
| Backstab | CritBoost | CritBoostSkillCritDamage |
| TwilightGathering | TwilightFairy | TwilightFairySkillAmount |
| TwilightBell | TwilightFairy | TwilightFairySkillAmount |
| DualPetBoost (Summoning Circle) | DualPet | DualPetAmount |
| MidasSkillBoost (Midas Ultimate) | HandOfMidas | HandOfMidasSkillAmount |

TwilightBell's *distinct* spell-cap benefit is still calculated separately
when its other spell is selected and its cap unlock is guaranteed. No
cross-skill cap is counted twice.

`ClanQTE` (Coordinated Offensive) gets a direct hero-damage score only
when the player explicitly opts into `assumeCoordinatedOffensiveActive`
for the limit-stage boss. The toggle defaults to false; in all four locales.

When the loadout or battle condition is unknown, existing levels of these
skills from the imported tree are preserved by the pre-existing uncertainty
protection (if enabled). Thus no false claim that the skill is useless in
game is made, and neither a Warlord cap nor a Pet-specific override is added.

## Boundaries

This is **not** a complete combat simulator. Confirmed equipment is not proof
of active duration; the configured boss-window conditions remain user
hypotheses. This update does not solve the Tactical Insight hero-power
reduction coefficients, unknown partial spell uptime, mana sustain,
probabilistic activation, or source-coupled damage conversions.

It affects the same normal skill optimizer used by six damage builds and
three gold sources. These score improvements must still be calibrated
against independent game Stats measurements at a fixed stage/buffs.

Qualification: `npm run check`, `npm run bench:issue30`,
`npm run bench:push`, browser EN/FR/UK/RU, in-game benchmarks. No
automatic GitHub Actions workflow should be enabled.
