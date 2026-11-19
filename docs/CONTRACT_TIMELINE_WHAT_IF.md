# TT2 8.4 conditional contract timeline — explicit shared-mana what-if

## Scope

The implementation in `src/contract-timeline.js` simulates the 1Hz recurrence in `docs/IL2CPP_CONTRACT_TICKS.md` with a **joint mana pool**. It replaces neither the live game nor the current additive SP objective. It is an *optional, transparent diagnostic*.

Inputs are explicitly supplied: starting and capacity mana, passive mana regeneration per second, **free tick counts for each active contract** (zero must be explicit), window in seconds (1..3600), optional known mana receipts and spell cost events. No missing field is guessed. The first contract tick occurs immediately at t=0, with regen only before later ticks. Mana is capped at capacity. Charges use source B(level) times the number of charged ticks; free ticks advance the effect clock without payment. Both contracts share one mana balance. If a single joint tick cannot be funded, simulation stops and explicitly reports the first unfunded second. This **does not assert actual in-game cancellation order**.

Damage / gold source maxima rise by `maximum ^ min(1, ticks/timeUntilMax)`, computed in base-10 logarithms. Source-only Terrifying Pact maximum A/B is provided in separate fields conditional on the corresponding contract; their live instantaneous-versus-ramped application is **not presumed**. Contract damage/gold fields are **never applied** to the optimizer score. Pact's titan-count speed effect remains separate. `BonusModel.GetBonus` runtime modifiers, free tick effects of sets, tap/siphon cadence, stage timing and full spell casts cannot be reconstructed from the account export.

## Scope and provenance safeguards

- A filled what-if scenario is *not* evidence of actual free ticks or mana events; even known user inputs do not validate in-game uptime.
- Imported full-pool and regeneration snapshots are not silently used for new allocations, because the changed SP tree can alter both.
- With no scenario, mana evidence exposes `status:not-requested`; incomplete or invalid inputs yield explicit `missing-or-invalid-inputs`. No unexplained zero.
- The modeled shared-payment stop is only a reference: the game's native contract shutdown order, competing spell activations, runtime buffs and other mana income are not certified.
- Source snapshots are pinned to 8.4. See https://www.tt2-compendium.com/en/wiki/skills/forbiddencontract and https://www.tt2-compendium.com/en/wiki/skills/royalcontract; native audit details in `docs/IL2CPP_CONTRACT_TICKS.md`.

## Test coverage

`tests/contract-timeline.test.js` exercises 1Hz growth, free ticks, regen/cap, simultaneous shared mana, level 15/22 Pact bounds, explicit external events, missing inputs, huge scientific values, 18 damage/gold routes, and proves the diagnostic does not affect score, SP allocation or stage claims.

The user-facing tool can display the opt-in scenario's funded tick count and exhaustion point, but must state that it is NOT measured uptime. Do not auto-enable maximum contract assumptions or convert simulated source value into additional SP score.
