# Poison Edge / Sprouting Salts — issue #9

The pinned Unity 8.4 source declares PoisonedBlade A as UltraDaggerPoisonBoost, D as UltraDaggerPoisonMaxCount (10), and KratosSummon A/B/C as KratosMonsterBonusAmount / KratosMonsterStacks / KratosMonsterSpawnChance. The public ideal boss policy now assumes one poison application and maximum **talent-source** Sprout stacks. Both increase all damage routes, without a community reduction. No activation is presumed by the lower-level engine if flags are absent.

Poison is an additive fraction: a level-1 source of 1.45 means +145%, or 2.45x for one poisoned hit. Score log10(1+A), not log10(A), and not 10 stacks by default. Sprout stacks multiply: score B*log10(A) (at level 1, 3.5^2 = 12.25x). Spawn chance is not damage; no extra stack count, equipment bonus or historical 5x per-stack bug is invented. These are scenario scores, not verified uptime or stages. Keep imported floors where the corresponding assumption is absent. The UI displays the modeled stack counts, in all four languages.

Sources:
- https://tt2.wiki/en/skill-tree (current source rows and +145% poison, max 10; Sprout A/B)
- https://www.reddit.com/r/TapTitans2/comments/1533a7v/ (additive poison example from community)
- https://gamehive.com/blog/devupdate-63-growth-of-the-sprout-2672/ (official stacking All Damage until prestige)
- https://gamehive.com/blog/devlog-96-version-5140-patch-notes-2694/ (official removal of unintended 5x per stack)
- https://tap-titans-2.fandom.com/wiki/Sprout (indexed formula A^stacks; full page inaccessible during verification)
- https://www.reddit.com/r/TapTitans2/comments/sv789u/ (independent discussion of stack formula)

The chosen one-poison and maximum-source-Sprout scenario is an implementation decision; it needs game comparison to validate its appropriateness, especially for short runs. No new UI controls. Run npm run check; npm run bench:22k; npm run bench:issue30; npm run test:e2e. No GitHub Actions.
