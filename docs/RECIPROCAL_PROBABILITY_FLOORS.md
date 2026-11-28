# Reciprocal probability floor credits — issue #9

PR #76 credited the change in Love Potion at the guaranteed Ambush level, and the change in Loaded Dice at the guaranteed event levels. This omitted the guaranteed interaction in the reverse direction.

For love increment L(a,l), with guaranteed levels a0,l0, credit L(a0,l) to Love Potion and L(a,l0)-L(a0,l0) to Ambush. The mixed derivative of log10(1+p*(M-1)) with respect to p and M is nonnegative, so the sum cannot exceed L(a,l) on feasible levels. When either partner is fixed to its floor the full interaction is recovered.

For each eligible event, denote D(event,d) = weighted log10 expected-event gain from Hayst's Loaded Dice factor. Credit D(eventFloor,d) to Loaded Dice; for its partner talent credit D(eventUpgraded,d0)-D(eventFloor,d0). For Ambush hold Love Potion at its guaranteed floor to avoid counting the same probability increase twice. D is nondecreasing with the event magnitude/probability in the pinned uncapped domain, and its increase with event magnitude/probability is nondecreasing with the Hayst factor. This is a conservative additive lower bound on the same source-only joint proxy. The credits are exactly zero below/equal to the partner floor and no extra damage arises from HS guaranteed criticals.

The final diagnostics v2 report reverse credits and remaining residual, not an actual probability or a stage forecast. The score is still the additive proxy. No account multiplier is added, no new settings or coefficients, no solver passes added. Without positive guaranteed levels the corresponding reverse terms are zero; optimizing all partners jointly without guaranteed floors remains unsolved.

Existing 1000 seeded lower-bound checks retained, with 510 fixed Love Potion scenarios, 186 fixed Loaded Dice scenarios, inactive gates and 18-route integration. Qualification: npm run check; npm run bench:22k; npm run bench:issue30; npm run test:e2e. No GitHub Actions.
