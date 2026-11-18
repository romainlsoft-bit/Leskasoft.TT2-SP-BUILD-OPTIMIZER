# TT2 8.4 — Mana skill scoring audit (2026-11-18)

The official Unity SkillTreeInfo2.0 / BonusInfo records from the player's
Android client identify:

- MPCapacityBoost / Limit Break: ManaPoolCap (additive), AllManaSourceMult
  (mana-source multiplier).
- ManaStealSkillBoost / Mana Siphon: ManaTapRegenAmount (additive),
  ManaStealChance (percentage chance).

Neither skill's A magnitude is a direct damage/gold multiplier.
The inherited rawrzcookie-style reduction table gave *both* a 0.05
damage reduction for every one of the six damage builds, and the generic
score path calculated 0.05 × log10(A). This treated mana capacity and
mana regeneration as damage without a sourced conversion.

The corrected scoreAtLevel source term is zero for these two skills.
A verified skill-tree-set bonus earned per SP remains scored separately,
and manually requested QoL minimum levels remain binding. No mana uptime,
Siphon activation rate, stage prediction or direct resource-to-damage
conversion has been invented.

Tests assert zero unsourced score for all six damage types and three gold
types at four levels each (144 cases), and protect mandatory mana-QoL
constraints. Other mana and chance mechanics still need dedicated native
analysis and in-game Stats calibration.

This is *not* a claim that mana is unimportant for gameplay: it is a
statement that the old 0.05 damage proxy is not a TT2 damage formula.
