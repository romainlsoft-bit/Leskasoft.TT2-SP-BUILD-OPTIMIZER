# Dimensional Shift — issue #9

The pinned 8.4 talent BossTimer has A=ShadowCloneAllSkillBoost and B=ShadowCloneAllSkillDurationRate. The Compendium describes a boost to active spells during Shadow Clone; the E9 game-code guide specifies multiplication of each primary spell effect, including Shadow Clone itself:
- https://www.tt2-compendium.com/en/wiki/skills/dimensionalshift
- https://tt2.wiki/en/guides/spells-mana-and-multicast (updated 2026-11-26)
- https://www.gamehive.com/blog/tap-titans-2-v211-patch-notes/ (historical confirmation of primary-only behavior)

Under the existing conditional maximum-selected-spell scenario, require ShadowClone in the verified selection. For every selected spell with an available source primary baseline and a guaranteed unlock, use its existing route weights. Sum damage reductions plus gold priority times gold reductions, then multiply by log10(A(level)). This is the marginal gain only, inside scoreAtLevel. Duration B is diagnostic, not another damage factor. Do not apply a second multiplier to multicasts, secondary spell effects, fixed account or the spell baseline. Do not infer simultaneous real uptime or mana sustainability. The route weights are the already-used community proxy, not independently calibrated native reductions.

Remove the imported-level floor only when all selected primary effects are evaluable in that scenario. If selection, maximum activation or a required unlock is unavailable, preserve the old protection. There is no new user setting. Tests cover 18 routes, zero levels, selection failures, unlocked/locked spells, zero gold weight, real engine and ledger. No predicted stage gains. Qualification: npm run check; npm run bench:issue30; npm run test:e2e. No GitHub Actions.
