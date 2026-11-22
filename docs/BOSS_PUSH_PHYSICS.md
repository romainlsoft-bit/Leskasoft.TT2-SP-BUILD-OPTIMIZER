# TT2 8.4 boss-push physics — six builds

## Scope

This implements the next **source-backed physics layer** for the **same six
damage builds and three gold sources**, without imposing a Pet/Fairy-only
optimizer. It does NOT claim to have solved the complete optimal build problem.

The prior PR #32 exposed source attack channels and a source-only Stage Skip
floor. This PR adds boss HP, raw observed decisive-hit comparisons and
refined per-channel eligibility to distinguish **killing a boss** from
**skipping stages after that kill**.

## Sources and formulas

Unofficial wiki, published against TT2 game data:

- HP and boss formula: https://e9wiki.com/tt2/en/guides/titan-hp-and-damage
- Stage Skip, full-skip and Shadow Clone splash:
  https://e9wiki.com/tt2/en/guides/stage-skip-and-titan-skip
- Spell duration and mana:
  https://e9wiki.com/tt2/en/guides/spells-mana-and-multicast
- Skill tables pinned in \`vendor/skills.js\` (8.4.0).

All HP calculations are **log10** to avoid overflow even when TT2 uses
damage numbers like \`1.23e30000\`:

\`\`\`text
Lnormal(s) = log10(17.5) + min(s,100)*log10(1.38)
           + 0.03*max(0,s-100)^1.098
           - 0.03*max(0,s-180000)^1.0002*log10(1.2)
Lboss(s) = Lnormal(s)
         + log10(min(500,1.13^(0.005*s)))
         + log10([8,2,3,4,5][s % 5])
\`\`\`

A boss's unmodified HP can vary by ±30% around the sourced baseline.
The report shows whether **one real observed hit** is larger than the
upper bound, smaller than the lower bound, or dependent on the HP roll.
Other HP reductions, attack proc rates and boss timer extensions are
NOT inferred; a hit below the lower bound can still contribute to a kill
through **multiple hits** or effects not modeled here.

## Evidence contracts

\`bossPushEvidence(settings,levels)\` returns a source-backed independent
attack report, including the boss HP at the measured stage, table-backed
Stage Skip and an observed hit when provided.

- Only the explicitly selected hit can be compared with boss HP.
- An observed damage such as \`1.23e30000\` is parsed logarithmically:
  normal JavaScript Numbers cannot store the literal damage.
- It is **not** a DPS measure or a calibrated entire-attack damage score.
- Flash Zip "charged" describes a state/buff, **not an independent killing
  hit**; it cannot be treated as a separate observed hit.
- Clone's normal boss splash chance uses \`(splash-.01)/.99\`, with no
  invented proc frequency. A Nightmare Puppeteer hit uses the sourced
  special-hit sure-splash rule, conditional on a successful boss kill.
- The Stage Skip fields remain *source talent additions*, not guaranteed
  total skip. A boss must be killed for the Stage Skip path to matter.
- Confirmed missing spell loadouts prevent interpreting an attack as
  ready. Missing loadout information remains unknown.

**The observed damage belongs to \`settings.currentLevels\`** with the
real pets, gear, spells and buff conditions that produced it. It must
NEVER be transferred to a newly recommended build. \`optimizeBuild\`
returns:

- \`bossPushCurrent\`: HP and the *observed single hit* for the player's
  current skill tree;
- \`bossPushProposed\`: HP and *source-only* attack eligibility/Stage Skip
  for the new tree, with the measured damage cleared.

An optional measured boss stage is separate from the player's Max Stage.
The latter continues to govern tier unlocks.

## Why the optimizer still does not change SP with this new evidence

The pinned SP model assigns source-dependent skill weights from a
community reduction table. It does **not** prove the complete attack hit
damage, active buff availability or how much a Hero-skill bonus really
modifies an account's Pet burst. Reusing its aggregate damage/gold score
to synthesize an actual Lightning Burst or Heavenly Strike hit would
simply recreate the Warlord overvaluation problem.

Hence this evidence **does not change** \`optimizeBuild\`'s allocations,
\`optimality\` claims or the selected gear/pets. The source-only
Stage Skip constraints from PR #32 remain optional and functional.

## Next steps in issue #9

1. Obtain game-verifiable baseline damage for **each selected killing
   attack** and the account state at that time.
2. Build a typed attack-damage dependency graph separating shared effects,
   source-specific special attack multipliers, skill durations and
   charging states, avoiding double-counting.
3. Use observed damage across at least two allocations to calibrate the
   graph, especially Tactical Insight / Hero-skill reductions, contracts,
   Lightning Burst, Flash Zip and non-Pet counterparts.
4. Model a finite boss-time window, repeated attacks, spell/contract mana
   constraints, availability and the Stage Skip from the actual killing
   source. Do not rank alternatives on a guessed proc rate.
5. Only then activate a comparative **boss-push objective** (with a
   reversible additive-model fallback) for all 18 build/gold combinations.
6. Validate against actual in-game Stats before/after pairs and observed
   progression. Keep raw private player exports out of Git history.

## Qualification gates

- \`npm run check\` (full Node tests, Unity data parity, ESM import graph)
- \`npm run bench:issue30\` (36 baseline regression scenarios)
- \`npm run bench:push\` (18 source Stage Skip scenarios)
- Browser verification of EN/FR/UK/RU and scientific hit input
- User-supplied real in-game evidence before claiming better stage gain

A targeted V8 source audit passed all 18 build/gold combinations and
verified Shadow Clone special vs normal splash and the Flash Zip
charged-state distinction. It does not replace the complete Node suite.
