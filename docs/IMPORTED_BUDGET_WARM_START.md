# Imported budget warm start — issue #9

Above the existing 12k SP threshold, the coarse grid and integer pair refinement can remain in a local optimum. Reuse the imported tree's branch SP totals as a second starting capacity vector when the certified upper bound still leaves room for improvement. Clamp to current branch capacity limits, raise to verified feasible floors, reject invalid/empty/over-budget seeds and incompatible projected capacities. Never trust the imported allocation or its score: reconstruct from the current exact branch frontiers. Run up to eight existing full-pair passes; retain the better feasible result. No extra branch DP and no changes to scoring coefficients. Exact small-budget solves are unchanged.

A reproducible five-branch counterexample in the tests gives 176 with grid/pair search and 187 with the imported seed, matching exact DP. This is a synthetic modeled score, not a stage gain. The warmStart diagnostic is distinct from pairRefinement, and the original upper bound is retained. Worst-case additional work is one bounded pair refinement; the actual timing and gains on TT2 imports require the local benchmarks.

Qualification: npm run check; npm run bench:22k; npm run bench:issue30; npm run test:e2e. No GitHub Actions.
