# Local joint probability comparison — issue #9

The existing solver maximizes the additive proxy S, which already includes guaranteed floor credits C. The source-only joint proxy is J(x) = S(x) + [F(x) - C(x)], where F is the existing joint Love Potion / Loaded Dice expectation. The residual is taken from the existing probability evidence; adding the full F again would double count C.

Starting from the additive solver's feasible tree, compare single-level moves and two-coordinate moves touching at least one of the five probability talents, including simultaneous upgrades. For an upgrade exceeding the spare budget, also test the smallest reduction of each other single donor talent that funds it. Each candidate must satisfy the exact ordered branch-prefix gates, prerequisite unlocks, effective minima, exclusions, maximum levels and global SP budget. Choose only strictly better feasible J, for at most four passes. Cache residuals by the five relevant levels. No additional branch DP or invented probability coefficients. The additive result and certificate remain unchanged. The separate alternative JSON appears in the model-attribution details only when a strict gain is found.

This is local improvement, not a global joint optimizer; no claim that a better source-only score yields more stages. Some valid improvements need multiple donors or moves across a local valley and remain unsearched. Pet and gear search still ranks on the additive proxy, and the alternative applies to its selected context. Actual player proc rates remain unknown. Runtime at 22.6k and 50k must be checked locally; the pass bound is independent of budget. No GitHub Actions.

Qualification: npm run check; npm run bench:22k; npm run bench:issue30; npm run test:e2e.
