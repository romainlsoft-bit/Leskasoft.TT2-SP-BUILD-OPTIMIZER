# Critical mathematical audit — TT2 Skill Optimizer v0.1

## Scope of the evidence

On 15 November 2026, the 72 rows of the existing skill-table module were compared field-by-field against `SkillTreeInfo2.0.csv` from the maintained public CSV repository. The sampled values, costs, prerequisites, names, levels and bonus columns matched. The skill-tree CSV was last updated in September 2026. This is **evidence for the skill-tree dataset**, not proof of end-to-end compatibility with all TT2 8.4 gameplay effects, equipment or Clan Technology.

## Problems observed in the legacy solver

1. **Unsafe pruning.** The original `getImportant` selection discarded a higher-cost intermediate state if an earlier state had a better score. This is not generally safe *before* tier unlocks: a dominated intermediate state may be the only route to a higher-tier skill.
2. **Hard-coded prerequisite indices.** The previous solver relied on handwritten arrays of skill indices for tier-5 dependencies. They could become incorrect when a patch adds, reorders or removes a skill.
3. **Numerical overflow/underflow.** Extremely large `10^x` or compounded multipliers may exceed IEEE-754 double range, making an otherwise useful score infinite or `NaN`.
4. **Confusing worker usage.** A worker controlled the UI state but the actual computation still ran on the page's main thread.
5. **Conditional synergies.** The former `TerrifyingPact` calculation treated a contract skill as active if it was merely *selected* for optimization, even if its allocated level was zero. This can overvalue builds lacking the contract.
6. **Model versus gameplay.** The optimizer maximizes weighted damage/gold multipliers, not actual stage progression speed, which depends on cooldowns, speed skips, latency, availability, play patterns, equipment, talents and other factors.

## Changes implemented

- **Exact per-branch DP** indexed by integer SP cost and the last three prerequisite-presence bits. It preserves intermediate states until all tier prerequisites have been applied.
- Prerequisites and tier SP thresholds are generated directly from `TalentReq` and `SPReq` source fields, rather than positional magic numbers.
- **Exact cross-branch max-plus convolution** for at-most-SP budgets up to 12,000 SP. Its concave envelope is only an *upper bound* for pruning candidate evaluations; all selected candidates are evaluated using real scores. Synthetic reference tests compare the results to an unpruned quadratic algorithm.
- **Log10-space score functions** for all 72 skill IDs and six damage builds, reducing overflow risk.
- A real **ES module Web Worker** performs the optimization off the UI thread.
- A conservative treatment of `TerrifyingPact`: count the contract synergy only when the contract is explicitly guaranteed by existing levels/minimums.

## Validation performed during implementation

- All **72** skill definitions compared equal to their current source CSV counterparts for the inspected columns.
- **7,614** finite numerical evaluations of the original score formula agreed with the rewritten log-space score to within 1e-6 across six damage sources, three gold types and sampled levels; **126** intentional disagreements were attributable to `TerrifyingPact` being treated as active by mere selection. This sample is a regression comparison, not proof that the formulas represent the live game.
- New convolution compared with exhaustive loops for 60 random monotonic test pairs without mismatches.
- Real 72-skill calculations returned valid allocations for SP budgets 0, 50, 200, 600, 1,000 and 2,000 (not a device-specific performance promise).
- Node unit tests exercise exactness on synthetic small trees, source model validity, import/export and parent prerequisites.

## Remaining limitations / release gates

- **Weighted proxy**: The mathematical optimum is only guaranteed for the modeled additive log-damage/gold objective. It cannot be labeled the *best real-world TT2 build* without comparative in-game results.
- **Conditional interactions**: Cross-skill combinations and dynamic equipment activation are not yet represented exactly. The conservative treatment of contracts can undervalue some real synergies.
- **Scope of data updates**: Skill data, spells, reductions and QoL baselines are versioned separately. Equipment bonuses and Clan Technology introduced in 8.4 require dedicated model validation.
- **Very large SP budgets**: The exact dynamic program has potentially high computational cost for many thousands of SP and should be benchmarked on mid-range phones. The UI currently caps the budget at 50,000 SP. Neither elapsed time nor memory is guaranteed.
- **UI import compatibility**: Game export formats may change; importers must be validated against real 8.4 player exports.
- **Upper envelope assumptions**: Convolution correctness depends on the upper concave envelope being a valid bound. A critical differential test exposed and corrected a bug in the split-scan bounds; after the correction, 500 randomized variable-capacity convolutions matched exhaustive enumeration. The implementation is verified by exhaustive randomized cases, and should receive additional property tests at larger budgets and numeric extremes.
- **Gameplay verification**: Before marking the version as fully validated, independently check the formulas against the actual patch and playtest multiple builds.

## Further improvement strategy

1. Expand synthetic oracle tests and add regression fixtures from actual 8.4 player exports.
2. Introduce an independent scoring specification based on official game mechanics, separated from inherited formulas.
3. Model conditional skills as coupled state variables or solve multiple activation scenarios with exact constraints.
4. Benchmark high-SP cases; introduce a certified approximation/bound if exact runtime becomes prohibitive, and expose the approximation flag in the UI.
5. Add source-version provenance, changelog and explicit release-gate evidence before advertising the version as verified.

## High-SP bounded optimization, validated at 50,000 SP

Beyond 12,000 SP, exact per-branch dynamic programming is retained. Cross-tree allocation is performed on a grid of at most ~2,500 increments for the uncommitted budget, and the grid convolution itself is exhaustively evaluated (no pruning). The grid step is `q=ceil(freeBudget/2500)`.

**Certification:** Let `m` denote the number of branches, `F` the mandatory minimum-cost total and `B` the available SP budget. For every exact allocation `b_i`, rounding up its additional branch budgets `b_i - F_i` to increments of `q` increases their total grid allocation by at most `m` increments. Therefore the maximum grid score at `floor((B-F)/q) + m` is an upper bound on the exact optimum under the additive model. The grid allocation at `floor((B-F)/q)` is always feasible and provides a lower bound. This yields a mathematically certified *score gap*, although the optimizer is not always globally exact at very high budgets.

The worker reports per-branch/combination progress and supports cancellation. A 50,000-SP test with actual skill-tree data for Clan Ship / Fairy Gold completed in approximately 17.4 seconds within a JavaScript test environment (49,973 SP spent; lower model score 1482.6982, upper model score 1483.9538; gap ≤ 1.2556 log10 units). This is not evidence of a specific Android completion time. Performance varies by device and build type.

**Important:** A bounded score gap is not a guarantee of build performance in the real game. The ratio-based efficiency option at >12,000 SP uses a grid approximation without a separately certified optimum for the score-per-SP ratio.

Additional automated tests compare 500 mixed dense/sparse max-plus cases to brute-force results, 300 constrained small-tree cases to an exhaustive oracle, and bounded-grid upper/lower certificates against exact small-model optima.
