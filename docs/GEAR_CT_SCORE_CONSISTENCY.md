# Gear ranking / Combat Techniques — issue #9

The existing solver already scores the A component (EquipmentPetEffect) and B component (ActivePetLevel) of Combat Techniques separately. The gear search previously used petScenarioScore(context, CT) but omitted petEquipmentCombatTechniquesIncrement(context, CT). This omitted a gear-dependent term from the coordinate-search step, so an owned item with a higher source reduction could lose even when it would win with the solved CT level.

The new gear ranking adds the existing CT A function, with weights built by the same helper as the final gear selection. A family with several pets retains its passive eligibility if any member has a passive share, instead of relying on the last row in a Map. Both shortlisted and full gear-combination ranking use the same path. The additional term is used for ranking only; independentScore is unchanged and the SP solver remains the only place that credits the marginal CT A contribution. No new game formula or coefficient is introduced.

Synthetic source-table counterexample: a Shadow Clone sword with TapDamage (.6) beats AllDamage (1) by 2 log10 at CT=0. At CT=50, with an owned level-100 Pet26, the existing CT A factor 3.51e21 implies a differential of .4*log10(3.51e21), greater than 2. The correct gear choice reverses. This is a modeled-score counterexample, not an observed gameplay result.

Tests compare ranked candidates with independently assembled gear/pet/CT terms, enforce manual choices, and confirm absence of phantom pet effects. Qualification: npm run check; npm run bench:22k; npm run bench:issue30; npm run test:e2e. No GitHub Actions.
