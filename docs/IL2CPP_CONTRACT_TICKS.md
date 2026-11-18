# IL2CPP contract ticks — source-backed diagnostic (18 Nov 2026)

This implementation uses the player's own TT2 8.4 Android binary (no binary
included in the repository). The ARM64 loops were analyzed at the following
relative virtual addresses:

- ForbiddenContract.ManaBurnBonusEffectLoop: 0x25D3678
- RoyalContract.ManaBurnGoldLoop: 0x25D6F94

Both are started with InvokeRepeating: first call immediately, subsequent
calls every 1 second. The loops increment effectTimeCount, including free
mana-burn ticks. Each charged tick increments a separate manaBurnCount.
The formulas reconstructed in the native audit are:

- bonus(ticks) = maximumBonus ^ min(1, ticks / timeUntilMax)
- chargedTicks = max(0, ticks - freeTicks), only when freeTicks is known
- current charged mana cost = baseManaCost × chargedTicks
- total mana spent over charged ticks = baseManaCost × n(n+1)/2

The sample traces are source-only arithmetic, *not* actual uptime.
The actual effective maximum, timeUntilMax and base cost come from
BonusModel.GetBonus and can include modifiers beyond the SkillTreeInfo2.0
table's A / B / BonusAmountD. The effective number of free ticks is not
present in the account export. Never assume zero free ticks as a player fact.

The diagnostic integrates into resolveContractScenario as nativeTickEvidence,
even when assumeContractsAtMax is disabled, so the score remains unchanged.
Its samples explicitly distinguish hypothetical no-free-tick cost from
actual free-tick cost, which remains unknown when unexported.

**Not modeled:** passive regen chronology, mana taps/siphon, fairy mana,
contract cancellation, overlapping contracts, simultaneous spell casts,
stage skips, observed progress or stage outcomes.

Run: node --test tests/contract-native-ticks.test.js
Full test suite: npm test (required separately before merging).
