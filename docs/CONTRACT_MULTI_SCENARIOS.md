# Contract-aware candidate selection — TT2 8.4 (20 November 2026)

This module provides a **limited, opt-in** multi-scenario *candidate comparison*, not a generalized joint stochastic optimizer or a game-stage predictor.

## Two explicitly declared states

The user supplies an active-contract fraction `p` from 0 to 1 and a full explicit shared-mana timeline (`startingMana`, `manaCapacity`, `passiveRegenPerSecond`, `freeTicks` per active contract, `durationSeconds`). `p` is a **subjective scenario weight**, never a measured probability. The alternative state is **no active contract** with weight `1-p`.

For an allocation C with conservative weighted log-score `S(C)` and source-only tick-window bonus `B(C)`, the *scenario score* is:

    U(C) = S(C) + p * B(C).

`B` is the mean log10 bonus over the complete user-defined window. Ticks after the hypothetical shared-pool exhaustion contribute zero; the bonus ramps according to the native source. This arithmetic is **not** the log10 of mean DPS, a stage prediction, or an inferred uptime model.

Terrifying Pact A/B are not credited by default. An additional explicit option `pactAtMaxDuringFundedTicks` adds their **full maximum source value** during funded ticks. The real effect timing, free ticks and modifier stacking are still unverified.

## Candidate generation, anti-double-counting

1. Start with a complete **conservatively** optimized build for fixed selected gear and pets.
2. Run a separate optimizer seed with `assumeContractsAtMax=true` to discover a potentially useful *contract investment allocation*. This seed **is not itself eligible for ranking**, since its score already includes full conditional maximums.
3. Use the three contract levels from that seed as *minimum levels* in a new **conservative** `optimizeBuild` invocation. This returns a budget-feasible candidate with no conditional contract maximum already in its score.
4. Rank the baseline and this alternative with `U` above. Ties favor the baseline. Refuse to replace the current recommendation if Combat Techniques levels change, as the old gear primary/secondary coupling may then be invalid.
5. Label results as **best of two explored, same-pet/same-gear SP candidates only**. The remaining pet/gear optimizers still use their original proxy; do not represent the result as an exhaustive search or globally optimal.

Insufficient SP, invalid timeline data or absent scenario weights preserves the baseline (the alternative is not fabricated). There are no probability defaults; the optional mode must be intentionally enabled. The model uses the source-formula 1Hz contract tick recurrence and may not match the native cancellation order. No new maximum-contract power is injected into the original skill score.

## Validation requirements

Automated tests check exact declared weighting, 15/22 Pact gating, shared-mana exhaustion, safety bounds, default-off behavior, seed reoptimization, CT safety and all 18 damage×gold routes. The feature is a **hypothetical recommendation within a small candidate set** and the game calibration gate remains OPEN.

## Additional bounded contract-level probes (2026-11-20)

The single maximally-active seed alone systematically missed useful intermediate Pact levels (e.g. a player's saved level 22 compared with level 15). An explicitly opted-in *Pact maximum while ticks are funded* scenario now generates up to three **SP allocation candidates**: the 8.4 optimistic seed, a Pact level reduced to roughly two-thirds of the current allocation, and a Pact-priority variant with low active Forbidden/Royal levels. **Two-thirds is a search heuristic, not a multiplier formula.** Every candidate is then solved with the conservative scoring objective so that no conditional maximum is already double-counted.

Only an explicitly enabled scenario with a valid active fraction and explicit mana timeline can bypass existing current-level protection **for those three contract talents alone**. All other unmodeled skills remain protected, and explicit user's minimum levels still apply. This is a comparison of a *bounded candidate set*, never an assertion of global optimality; in particular, Pact effects in actual combat remain uncalibrated.

Each candidate whose Combat Techniques level changes is excluded from application to a fixed gear selection. The next highest-scoring **compatible** candidate can still win. Cost bound: at most one optimistic seed and three conservative SP solves per final pet/gear context, and at most three selected pet pairs in the current reranker. Default mode incurs no additional solve.
