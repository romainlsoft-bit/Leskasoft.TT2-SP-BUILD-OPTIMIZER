# TT2 8.4 multicast — remove fictitious always-on per-charge bonuses

## Proven source issue

Prior `src/effects.js` code scored every selected multicast skill as
`r * charges * (1 + log10(A))`. The `+1` gave a **fabricated 10× per
multicast charge** in addition to the actual source value `A`.
For Hand of Midas, two local arrays (`mcA`, `mcB`) guessed extra
100×/10×/… bonuses, including another boost to unrelated gold sources.
For Eventide Afterglow, `TwilightFairyGloomBonusDamage` (source C)
was added as if every boss was affected by Gloom.

These terms can directly bias the skill-point dynamic program.

## Changed score

Every one of the ten source multicast skills now has the same rule:

```text
weightedLog10 = routeReduction × modeledCharges × log10(A_at_skill_level)
```

- The source table's `BonusTypeA=*StacksBonus` and
  `BonusTypeB=*Stacks` are checked before use.
- Available charges derive from `multicastSkillEvidence`, requiring
  a valid equipped spell (up to six slots), its unlock and a supported
  maximum-level hypothesis. Existing set-related extra charges and
  an explicitly modeled charge limit still apply.
- **No invented 10× per charge.**
- **No guessed extra Midas gold table**; use only the native A.
- **No unverified Eventide Gloom (C) as permanent damage**. Existing
  user investments in this skill are preserved with
  `protectUnmodeledSkills` until the Gloom effect is calibrated.
- No change to the base equipped spell calculation and no assumption
  that all casts can be sustained with the account's mana.
- No added input field, arbitrary SP cap or predicted max stage.

The result still uses a **source-only conditional multiplier model**;
mana availability, actual cast count and Gloom target status are not
guaranteed. It is not proof of game-accurate DPS or stage gains.

References:
- TT2 8.4 source table `vendor/skills.js`
- TT2 Wiki skill tree:
  https://tt2.wiki/en/skill-tree
- TT2 Compendium Eventide Afterglow:
  https://www.tt2-compendium.com/en/wiki/skills/eventideafterglow
- Game Hive multicast patch introduction (DevLog #73):
  https://www.reddit.com/r/TapTitans2/comments/m8j0nw/

## Local qualification only

```bash
node --test tests/multicast-native-no-guess.test.js
npm run check
npm run bench:issue30
npm run bench:push
```

**GitHub Actions is prohibited in this repository.** None is added.
