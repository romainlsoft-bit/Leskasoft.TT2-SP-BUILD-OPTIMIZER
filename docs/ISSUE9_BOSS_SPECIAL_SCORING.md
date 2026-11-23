# Boss-special damage score gates — TT2 8.4, issue #9

Three talents were scored as if their **attack-specific damage A multiplier**
applied constantly, even to an ordinary attack. On a boss push, this
overvalues temporary burst modes and makes unrelated trees look strong.

| Talent | Native A source | Applies only when |
|---|---|---|
| BossDmgQTE (Flash Zip) | PetBossQTEDamage | Flash Zip boss QTE is charged and used |
| PuppetMaster (Nightmare Puppeteer) | ShadowCloneSkillSpecialDamage | Shadow Clone triggers Nightmare Damage through special attempts |
| MagnumOpus (Magnum Opus) | MagnumOpusDamage | The gold gun is in Magnum Opus form |

Sources: pinned 8.4 `SkillTreeInfo2.0` (names, BonusTypeA/B) and
https://tt2.wiki/en/skill-tree (ability descriptions and requirements).

## Implementation

Each **A direct-damage component** is now scored only when its own
explicit boss-state setting is true:

- `assumeFlashZipAtBoss`
- `assumeNightmareAtBoss`
- `assumeMagnumOpusAtBoss`

These switches default to false and are independent of source damage/gold
selection. Their source requirements are not inferred from merely
*owning* the skill. When disabled, all unmodeled levels retained from an
import are protected under the existing policy
`protectUnmodeledSkills=true`, so the optimizer does not silently strip
investments whose real activation is unknown.

Flash Zip B is a cooldown **multiplier** and is never converted into
per-hit damage without the existing explicitly measured boss-window
mechanism. Nightmare Puppeteer's special-attempt RATE (B) is not another
hit-damage multiplier. Magnum Opus B is Stage Skip, not damage.
These effects are never double counted into A.

The game's ordinary Pet, Lightning Burst, Shadow Clone, Gold Gun, and
Dagger damage sources remain unchanged by these flags. They work for
all six damage builds and three gold sources, not a Pet-only optimizer.

The app exposes and persists each assumption in EN/FR/UK/RU, serializes
non-sensitive assumption flags into shared build links, and clears them
when importing a different account.

## Limits and validation

These are **user-confirmed combat assumptions**, not demonstrated
100% uptime. This correction does not predict special-attack probability,
resource sustenance, boss HP or stages. The conservative default may
produce a less powerful-looking tree if the player uses specials
effectively but has not ticked the corresponding conditions.

Before claiming improvement, run `npm run check`,
`npm run bench:issue30`, `npm run bench:push`, browser tests in all
four locales and a controlled Stats / boss-window comparison in game.
Source-only tests must not claim a real-stage improvement.
