# A second SP allocation when the Tactical Insight proxy is fragile

The optimizer still returns its usual build. However, when a **real current
skill tree is imported** and the read-only Tactical Insight sensitivity audit
shows that the proposed build beats the imported tree **only under the
unverified community TI coefficient**, the final winner's context is used
to compute **one additional complete allocation**.

- The second allocation uses the existing
  `excludeUnverifiedTacticalInsight: true` scenario.
- The same damage/gold route, SP budget, unlocked spells, minimums,
  imported protections, and finally selected pet and equipment are reused.
- Each candidate is a complete `optimizeBuild` solution, not a mutation of
  individual talent levels or a synthetic hit-damage calculation.
- The baseline score is authoritative from the regular solver; the
  alternate score is authoritative from the conservative solver. Cross-model
  scores are calculated by adding/removing **only** the marginal TI score,
  preserving native spell unlock constraints and skill-tree-set effects.
- The second tree is exposed as JSON in the model-details panel (EN/FR/UK/RU)
  **only when it differs and improves the score with TI's unverified
  coefficient excluded**. No new input is required.
- User-visible comparisons are proxy log10 differences under the two
  hypothetical models, not predicted max stages, DPS or real damage.
  A zero TI coefficient is NOT a claim that TI has no in-game benefit.
- Solver errors, invalid levels/budget, absent current tree, measured TI,
  an existing TI exclusion or contract-scenario comparison do not block
  the original result. The extra solve is performed **after** the final
  pet/gear winner, never for each candidate.

The goal is to offer an actionable **alternative tree to compare in the
game's Stats screen**, with the original recommendation kept intact.
No automatic selection of the alternative and no arbitrary Warlord cap.
All six damage sources and three gold sources use the same mechanism.

### Verification

Standalone Node commands, run on a developer workstation or an
explicitly authorized TeamCity pipeline:

```bash
node --test tests/ti-alternative.test.js
npm run check
npm run bench:issue30
npm run bench:push
```

**GitHub Actions is forbidden in this repository**; never add a workflow.
A controlled in-game comparison is still needed to calibrate the real
Tactical Insight effect and stage gains.
