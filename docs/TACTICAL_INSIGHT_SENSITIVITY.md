# TT2 8.4: compare current and proposed builds without trusting a single TI coefficient

The first-party source table records Tactical Insight / HelperBoost A
(`HelperMultiplicativeSkillBoost`) and B
(`HelperAdditiveSkillBoost`). The large community `reductions.HelperBoost`
coefficients are *not* a validated native reconstruction of hero powers.
A Pet/Fairy result may depend substantially on this one heuristic.

## Automatic, read-only sensitivity audit

When a current skill tree exists, the optimizer scores the **same two exact
trees** under two scoring assumptions:

1. The current heuristic Tactical Insight score.
2. The same score with **only** that unverified Tactical Insight contribution
   removed. Skill-tree-set bonuses at the TI level are retained.

It displays proposed-minus-current deltas in log10. If the original model
prefers the proposed tree but exclusion does not, it warns the user to
compare these trees in the in-game **Stats** screen before committing SP.

The comparison does **not** solve another tree, alter the recommendation,
invent an attack frequency, predict a stage difference, or assert TI gives
zero actual damage. All other modeled effects and uncertainty remain
unchanged. This audit applies to all **six damage × three gold** choices,
not just Pet/Fairy.

The diagnostic is deliberately unavailable if a local two-point
Tactical Insight measurement already replaces the heuristic, if the
experimental heuristic exclusion is already on, if no current investments
exist, if either tree exceeds the SP budget, or if the current tree fails
the minimum skill/spell assumptions imposed on the comparison.

## Validation

`node --test tests/ti-recommendation-sensitivity.test.js` tests source data,
the 18 routes, score-reversal sensitivity, cost and minimum safeguards, and
the integration with `optimizeBuild`.

`npm run check`, `npm run bench:issue30`, `npm run bench:push` are
**local/manual commands**. **GitHub Actions is prohibited in this repo.**

A controlled game comparison with the same hero roster, gear, pets,
contracts, buffs and stage is still needed to establish real gameplay value.
