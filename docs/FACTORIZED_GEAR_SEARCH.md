# Factorized gear search — issue #9

The fixed-Combat-Techniques gear objective consists of independent primary/secondary contributions, active equipment-pet increments and the marginal Combat Techniques equipment-pet effect. The latter terms are linear in the selected slot's existing source reduction weight, so they can be evaluated once at unit weight. Non-equipment pets add a constant across gear choices. The only modeled gear-to-gear dependency is an Aura linked to exactly one Sword, Helmet or Slash primary.

For each eligible Aura, enumerate every eligible item in its target slot (or one independent case if unlinked). Other slots take their independent maximum. This covers the full fixed-CT modeled objective, not all real game mechanics or all joint SP/gear choices. Work is O(sum of non-Aura inventory sizes + sum over Auras of target inventory sizes), rather than a five-slot Cartesian product. Manual choices narrow the factors, and missing/truncated inventory cannot be certified. No new coefficients and no additional terms in the final ledger.

Diagnostics distinguish actual candidate configurations visited from individual slot evaluations and the full inventory product; `exactAcrossSP` stays false. The full joint gear/SP enumeration threshold is unchanged. The top-three individual display suggestions remain heuristic; the selected gear is from the new search.

Tests compare a pure reference Cartesian search (120 seeded scenarios), a fourth-ranked standalone sword that wins with an aura, 500-item scalability, and actual inventory/ledger score comparisons for 18 routes at two CT levels. No GitHub Actions. Run npm run check, npm run bench:22k, npm run bench:issue30 and npm run test:e2e.
