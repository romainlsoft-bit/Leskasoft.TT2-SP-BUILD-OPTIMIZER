# Candidate cross-pet reranking — TT2 8.4

The baseline pair/gear shortlist is enumerated using the established conservative objective; selecting the first pair and THEN considering contracts can miss a different pet pair whose **contract window** favors its SP allocation.

For explicit opt-in only, `rerankVisitedContractPetPairs` inspects every ALREADY VISITED pet-pair candidate (the existing search caps screening) and calculates the **source-based** contract-window preview without launching a second full SP search for each pet pair. Up to three pairs then receive additional expensive SP optimizations: the top scenario previews and **always the original conservative winner**. The selected result and active pet IDs now agree.

The scorer remains `base modeled log10 + user's declared fraction * source 1Hz window log10`, including the previous opt-in caveats on mana and Terrifying Pact. Each finalist is solved conservatively after optional optimistic seed levels. If a solution changes Combat Techniques, the original gear compatibility guard rejects its replacement.

**No global optimality guarantee.** A pair not shortlisted for full SP search might have been better after a different contract investment; gear alternatives within each pair also were not explored under the new objective. Existing upper bounds and comparative charts from the conservative objective cannot be repurposed as certification. The diagnostic exposes `scenarioRankingCertified:false`, `originalPetSearchBoundsNotApplicable:true`, and visited/shortlisted pair counts; no stage forecast or measured uptime.

Performance: at most three full alternative-comparison runs in the **entire request**, not for every gear in every pet pair. The default mode incurs no scenario rerank cost. Integration and unit tests include pair changes, selected pets/ledger synchronization, deterministic ties, error fallbacks and no invented probabilities.
