# Optimizer boundaries — audit #56

The public engine API, settings, scoring coefficients, solver, cache and result schema are intentionally preserved.

- engine.js: parse/import, constraints, score cache, solve, assemble result.
- model-attribution.js: reconstruct and explain existing score from solved levels and cached level scores; no alternative allocation.
- optimization-account-baseline.js: fixed and timed account evidence, permanent sets and dependency coverage. No addition of skill-dependent set power to the fixed baseline.
- worker.js: message protocol, pet/gear selection, per-request branch cache, progress and response.
- final-candidate-decision.js: optional final-choice contract, push and Tactical Insight comparisons with injected cached solver. Does not launch worker or redo equipment search.

The two joint gear-search strategies share the same scoring callback, solver and bound function. The four localized HTML entries and worker/engine module references carry an identical architecture revision where applicable. Existing source-structure assertions now target the responsible module, while integration tests continue exercising the public API.

Qualification: npm run check; npm run bench:22k; npm run bench:issue30; npm run bench:push; npm run test:e2e. All local, no GitHub Actions. No runtime qualification claimed before actual execution. Remaining work: further engine/worker decomposition only when supported by a concrete responsibility boundary; translation loading and deployed HTTP/SEO checks remain separate.
