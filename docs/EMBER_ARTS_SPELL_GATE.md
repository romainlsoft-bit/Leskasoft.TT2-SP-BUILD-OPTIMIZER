# Native Ember Arts (PetBonusBoost) spell gating — TT2 8.4

Source: `vendor/skills.js` (`SkillTreeInfo2.0.csv`):

- **A = `PetDamage`**: permanent Pet Damage. The talent retains this
  independently of the active six-slot spell loadout.
- **B = `TapBoostSkillAmount`**: Fire Sword spell damage, NOT another
  permanent Pet Damage multiplier. It only contributes to the modeled
  build-specific skill score when `spellEffectScorable("TapBoost", settings)`
  is true. That requires Fire Sword in a verified selected-spell loadout
  and the same max-level spell assumptions used by the other native
  spell-specific talents.

The old scorer added B to every suitable damage route, even if the
player equipped Shadow Clone or no spell loadout at all. This
overvalued Ember Arts (and can overallocate SP into its talent).

For imported trees, if Fire Sword cannot be verified, the existing
`protectUnmodeledSkills` policy now preserves the current Ember Arts
level. The source A Pet Damage is still calculated, and the protection
does **not** cap Warlord or prevent new investments when appropriate.
The investment audit gives a specific reason for the preservation.

No manually-entered attack power, cooldown, uptime, critical-hit rate
or other fictitious coefficient is introduced. No inference of gameplay
stage gains is made.

Evidence:
- Native `BonusTypeA/B` values: pinned skill table
- TT2 Compendium, Ember Arts:
  https://www.tt2-compendium.com/en/wiki/skills/emberarts
- TT2 wiki spells and mana:
  https://tt2.wiki/en/guides/spells-mana-and-multicast

Run locally / in an explicitly authorized existing TeamCity pipeline:
```bash
node --test tests/ember-arts-spell-gate.test.js
npm run check
npm run bench:issue30
```

**GitHub Actions is prohibited.** No workflow changes.
