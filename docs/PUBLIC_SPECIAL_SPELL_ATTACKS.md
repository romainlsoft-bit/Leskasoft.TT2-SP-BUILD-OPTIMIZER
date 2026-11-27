# Public special-spell boss attacks — issue #9

The pinned native catalog gives Voltaic Sails A=ThunderVolleySkillAmount and B=ThunderVolleySkillSpecialDamage, and Weakpoint Throw A=StreamOfBladesSkillAmount and B=UltraDaggerTargetDamage. The existing additive score implementation already supports both B modifiers under explicit flags, but the normal public optimizer never enabled those flags.

For the existing ideal push scenario, assume the Thunder Volley special hit only for Clan Ship with a verified selected Thunder Ship spell and assumed maximum spells; assume a hit on a Blade Stream target only for Dagger with the corresponding verified selected spell. Respect absent, conflicting, duplicate, truncated and inactive spell evidence. The effective solver minima guarantee the unlock. Override stale flags on public calls; leave explicit lower-level diagnostic callers unchanged. Report the two modeled conditions in the four localized sites. Do not treat cooldown, duration, target count or stage skip as damage. No new coefficient or UI control.

Source: https://tt2.wiki/en/skill-tree (Voltaic Sails and Weakpoint Throw), native 8.4 source columns and existing scoreAtLevel formulas. The conditional special-hit scenario is an implementation decision consistent with the ideal boss policy, not a measured hit probability or a stage forecast. Searing Light and Anchoring Shot are not enabled indiscriminately: the inspired hero and stun availability still require separate evidence.

Qualification: npm run check; npm run bench:22k; npm run bench:issue30; npm run test:e2e. No GitHub Actions.
