# Attack channels and push-stage model — all builds

The optimizer supports **all six damage builds × all three gold sources**, not
one special-case Pet/Fairy optimizer. Issue #9's Pet/Fairy observations are
regression inputs, **not** empirical multipliers or a reason to cap Warlord.

## Phase 1: source-backed attack pathways (this PR)

`src/attack-channels.js` separates table entries for each attack:

| Build | Primary attack and verified special channels |
| --- | --- |
| Clan Ship | ship shot; Thunder Volley |
| Pet | normal pet attack; Lightning Burst; Flash Zip charged-pet bonus |
| Shadow Clone | Shadow Clone; Nightmare Puppeteer |
| Heavenly Strike | Heavenly Strike |
| Dagger | ordinary dagger; Phantom Blades |
| Gold Gun | Gold Gun; Magnum Opus; Golden Missile stage-skip support |

The report exposes individual *skill-table* damage multipliers, Titan Skip,
Stage Skip and cooldown-source fields. A Spell-dependent channel has
`equipped`, `not-equipped` or `unverified` evidence; an absent six-spell
loadout is **never silently treated as equipped**.

Flash Zip's tabulated PetBossQTEDamage describes a **Charged Pet state**.
It must not be fabricated as an unconditional per-hit Zip multiplier.

Stage Skip is applied only upon a qualifying kill; Titan Skip affects
normal-titan progress. Neither is interchangeable with damage, and some
attacks are special full skips. The report does **not** add their values
together because global Stage Skip, spell multipliers, full-skip
preconditions, the hit source and real boss health are currently unresolved.
Source reference:
https://e9wiki.com/tt2/en/guides/stage-skip-and-titan-skip

`attackChannelEvidence` and `compareAttackChannels` are available through
`optimizeBuild` as `attackChannels` and `attackChannelChanges`. The web UI
exposes the former in the selected build's result, and strings are provided
in English, French, Ukrainian and Russian.

The existing **additive score attribution** is also exposed as
`modelAttribution`: per-skill and per-tree log10 contributions, the
largest modeled contributors, and a reconstruction check against the
DP objective. The UI can now reveal why the proxy spends heavily on
Warlord, Sorcerer or any other tree for any of the six builds. A large
score from Tactical Insight or another conditionally modeled talent is
not evidence of matching real boss damage.

**No fictional DPS, stages or proc rates are calculated. Neither the
solver's skill score nor its output allocation is modified in phase 1.**
That is a deliberate safety property until the proposed multi-channel
objective can be calibrated.

## Phase 2A: explicit source Stage Skip constraint (implemented, opt-in)

A target is an **integer source-local Stage Skip** in the selected attack's
native skill-table column, *not* global Stage Skip and *not* a stage forecast.
This is a real feasible constraint on SP allocations for ALL six builds and
three gold sources.

- The player optionally selects one eligible attack channel and an integer
  target. The source tables determine the **smallest required talent level**.
- The level becomes an actual \`minimum\` before the branch DP solves the
  entire tree. Dependencies, SP budget, stage unlock, explicit exclusions,
  existing QoL and preserved skill rules remain intact.
- A spell-dependent channel is rejected when the six-spell loadout verifies
  it is **not** equipped. A missing loadout is marked *unverified*, never
  silently marked equipped.
- The UI and the requested setting are supported in EN/FR/UK/RU, including
  share links and cached modules with a uniform release version.
- The browser worker solves an **unconstrained comparator once**, only
  after choosing the final pet/gear context. It returns both complete SP
  trees, per-branch SP moves and a comparison of the OLD proxy scores.
  The source Stage Skip benefit receives **no invented score multiplier**.
  Where high-SP DP is approximate, the comparison says so.
- The default target zero produces the exact legacy optimization, including
  existing Pet/Fairy and all other build behaviors.

\`src/push-skip-target.js\` owns validation and level mapping;
\`src/attack-channels.js\` owns the common attack source registry.
\`tests/push-skip-target.test.js\` covers all 18 combinations, constraints,
selected/missing spells, disabled defaults, invalid/unreachable targets,
locales and the benchmark wiring. \`npm run bench:push\` exercises
all 18 combinations at 22,600 SP with a source target.

### Important limitations

This is **not** a full boss-killing objective: the solver still optimizes
the existing weighted damage/gold proxy under the Stage Skip constraint.
Real hit damage, stage HP reductions, kill probability, mana/uptime,
shared/global skip and full-skip eligibility are not yet calibrated against
genuine player Stats. Do not assume a faster farm or a higher maximum stage
from a positive source Stage Skip value. The source dataset is pinned to
8.4.0 and 8.4.2 parity remains unverified.

The source-only constraint is a testable, meaningful way to trade proxy
power against a verified type of progress without mixing skip counts into
damage logarithms. A player must choose their own target; **there is no
hidden Pet/Fairy preference or Warlord spending cap**.

## Phase 2B: an actual boss-kill / push objective (not completed)

1. For **each of the six builds**, model the attack's base damage,
   skill-dependent multipliers, eligibility, spell activation, uptime,
   cooldown, titan/boss hit type and full-skip conditions. Shared source
   bonuses must affect *all* eligible attack pathways, not just an
   assumed Pet "base" DPS. Do not sum mutually exclusive attack states.
2. Distinguish a *normal DPS* source, an *available boss-killing burst*
   source and the *on-kill progress* (Stage/Titan Skip) source. Build a
   windowed combat evaluator with source tables and explicit player inputs
   where the export is insufficient. No use of invented stage HP formulas.
3. Optimize the same general score interface for every damage build,
   with the gold source independently selectable. Add robust boss-window
   scenarios for the contracts, Hayst, spells, and mana, with verified
   inputs and no assumed 100% uptime.
4. Constrain or calibrate Tactical Insight's inherited constant hero-skill
   weights with **real account hero evidence**, rather than universally
   penalizing Warlord. Do not add an ad-hoc SP cap for any tree.
5. Differential tests using *actual player Stats* snapshots and builds
   at fixed pets/gear/spells/contract state. Compare observed ordinary
   damage, the decisive attack, skip and stage progress separately.
   Keep private player exports out of the repository.
6. Always run the six damage builds × three gold sources, 1k/22.6k/50k
   SP, and exact-vs-bounded DP correctness checks before promoting a new
   objective to production. Keep the old additive score as a fallback
   and expose the assumptions / confidence of the new score.

### Qualification

Targeted V8, using the repository's own vendor skill-table source, passed
18 combinations and checked the Pet burst / Flash Zip / missing spell
source fields. The Node test module
`tests/attack-channels.test.js` covers each build and every gold
selection, internal skill IDs, field type provenance, before/after changes,
spell gating, safety limits and optimized results.

**The complete Node suite, module checks, source data checks, 22,600 SP
constrained benchmark and browser rendering have not yet run on this
branch.** A green result from the previous PR #31 is not evidence for
this PR. Keep it DRAFT until those checks succeed.

Targeted V8 audits confirmed the source field mappings for 18 damage/gold
combinations (including 102 table fields) and the source skip floor
resolver for the same 18 combinations. The module graph was versioned
uniformly as `20261122-push-target-r2`; the Node module-graph verifier
still needs to run.

Note: source tables are pinned to TT2 **8.4.0** while player exports may
report **8.4.2**. Exact patch parity requires a separate source diff.
