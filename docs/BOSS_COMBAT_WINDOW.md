# Boss combat windows and source-Stage-Skip trade-offs (issue #9)

These two facilities apply to **all six TT2 damage builds** and all three
gold sources. They are not Pet/Fairy heuristics, do not cap Warlord and
do not claim to rank actual achievable maximum stages yet.

## 1. Explicitly measured boss combat window

\`src/boss-combat-window.js\` exports:

- \`simulateBossCombatWindow(settings, levels, scenario)\`
- \`compareMeasuredBossWindows(candidates)\`
- \`log10Add(a, b)\`

Example (data invented for API illustration ONLY):

\`\`\`js
import {simulateBossCombatWindow} from "./src/boss-combat-window.js";
const window = simulateBossCombatWindow(
  {damage:"Pet",gold:"Fairy",maxStage:1000},
  {PetDmg:1,PetQTE:3},
  {enabled:true,stage:1000,windowSeconds:30,
   events:[
     {channelId:"pet-attack",second:1,damage:"1e67",count:2},
     {channelId:"lightning-burst",second:3,damage:"1e70"}
   ]}
);
\`\`\`

Damage strings remain in scientific notation even at exponents of 30,000;
the log-space engine never constructs huge JavaScript floating-point damage
numbers. \`second\` and \`count\` are **caller-provided observations or
explicit what-if hypotheses**; the simulator never derives attacks per
second, proc frequencies, or cooldowns from a talent's multiplier.

The reports list cumulative single-target damage and the first hit event
whose aggregate damage exceeds the three unmodified boss HP thresholds
(−30%, nominal, +30%). The attack responsible for the **crossing** is
reported separately from its *source talent* Stage Skip. Source-local Stage
Skip is never added to damage or treated as a guaranteed stage advance.
An event with \`count>1\` is a group: the exact winning hit *within that
group* is not calculated.

### Mana and contracts

The optional \`contractMana\` object is passed to the existing
\`simulateContractTimeline\` implementation. The scenario supplies observed
or explicit **starting mana, capacity, passive regeneration, free ticks,
spell costs and mana events**. The native 1 Hz ramp applies only while
funded in that hypothetical timeline. If observed attack damage already
includes contract effects, applying the ramp again is **forbidden**; set
\`damageExcludesContractEffects:true\` only for a genuinely *unbuffed*
damage baseline. Full Terrifying Pact credit is a separate explicit
assumption \`assumeFullPactDuringFundedTicks:true\`, not measured uptime.

Nothing about the model's mana budget proves that the actual game has
the same passive regeneration, event order, activation times or native
cancellation logic. It cannot predict live behavior without verification.

### Two complete trees

\`compareMeasuredBossWindows\` requires **independent observations per
tree** at the same stage and time window. Passing a previous tree's
measured hit to a different tree would be invalid; the existing single
hit UI in PR #33 continues to display it only for the original tree.

## 2. Additional complete allocations, optional

\`src/push-frontier.js\` exports
\`explorePushParetoFrontier(settings,{solve,maxConstrained})\`.

With the **Explore push alternatives** checkbox enabled and an eligible
attack chosen in the existing source Stage Skip selector, the worker:

1. Completes its normal pet, equipment and SP candidate search.
2. **Only for the final pet/equipment selection**, optimizes one
   unconstrained tree and up to two additional full trees at distinct
   source-Stage-Skip thresholds that are affordable by SP source costs.
3. Shows the Pareto alternatives among the evaluated feasible trees:
   sourced Stage Skip, proxy score (log10), spent SP and complete build
   JSON for in-game comparison.

Two metrics are displayed rather than blended with a fabricated coefficient.
An alternative may have higher source Stage Skip but lower modeled damage/gold
score. Neither the Pareto set nor the comparator is proof of better
boss damage or actual stage gain. Parent-tree SP prerequisites and user
exclusions are still checked by the normal solver. Infeasible constraints
are reported, not adopted.

The option is **off by default**, so normal optimizations perform no
extra search. Multi-contract scenario reranking is kept separate and is
explicitly unsupported in this additional Pareto search.

## 3. UI polish

Success and error toasts use a consistent, flat dark surface. Removed
the bright colored top/left frame and 5 px stripe, preserving icons,
text, semantics and dismissal behavior. Updated the stylesheet version
across English, French, Ukrainian and Russian pages.

## Validation required before merge

- \`npm run check\` — full Node tests, native skill data and versioned imports
- \`npm run bench:push\` — 18 builds at 22,600 SP
- \`npm run bench:issue30\` — 36 baseline regressions
- Optional UI exploration and clipboard toast visual check in all 4 locales
- For real gains, **independently collect Stats/attack measurements of
  at least two valid allocations**. No personal game export enters the repo.

A targeted self-contained V8 audit verified 18/18 source attack/gold
combinations using explicit boss-hit events and 18/18 source threshold
Pareto traversals (mocked optimizer callback). These **are not** the
full Node test suite nor gameplay validation.

## Still required to fully resolve issue #9

A source-backed attack damage dependency graph that distinguishes:
common stats, source-specific hit multipliers, hero abilities, pets,
conditional contracts, crits, proc timing, spell activation and boss HP
reductions. It needs *real observed measurements* to calibrate
Tactical Insight and other reduction-table weights. A confident
boss-push scorer cannot be developed from multiplying independent skill
table fields and assuming availability; keep the current weighted
damage/gold proxy as a reversible default until qualified.
