/**
 * Single numerical ledger for a complete candidate setup.
 *
 * This is NOT a game-stage estimator. It assembles the independently
 * modeled log10 terms without recomputing or reapplying any account source:
 *
 * - skill-tree optimized score: dependent on allocated SP;
 * - fixed account score: main artifacts, research, eligible monuments,
 *   direct passive pets and dated bonuses already computed by the engine;
 * - primary + recognized secondary effects of exactly the selected 5 gear;
 * - incremental effect of two separately selected active pets above their
 *   already-counted passive baseline.
 *
 * Do not add another fixedAccountScore here, nor multiply these values by
 * account Gemstone levels. Both would double-count existing contributions.
 */
import {petScenarioScore} from "./pet-scenarios.js";

function finite(value,label){
 if(typeof value!=="number"||!Number.isFinite(value))
  throw new TypeError("Non-finite modeled "+label+" log10 score");
 return value;
}

export function calculateModeledScenario(result,settings,gearSelection){
 if(!result||!settings)throw new TypeError("Missing optimization result or settings");
 const skillLog10=finite(result.score,"skill-tree");
 const fixedAccountLog10=finite(result.fixedAccount?.weightedLog10,"fixed-account");
 const equippedGearLog10=finite(gearSelection?.independentScore??0,"equipment");
 const activePetsAbovePassivesLog10=finite(
  petScenarioScore(settings,0),"selected-pets");
 const totalLog10=finite(skillLog10+fixedAccountLog10+
  equippedGearLog10+activePetsAbovePassivesLog10,"total");
 const accountAdjusted=finite(result.accountAdjustedScore,"account-adjusted");
 const discrepancy=Math.abs(accountAdjusted-(skillLog10+fixedAccountLog10));
 if(discrepancy>1e-7*Math.max(1,Math.abs(accountAdjusted)))
  throw new Error("Fixed account baseline differs from engine accountAdjustedScore");
 const fixed=result.fixedAccount;
 return {
  schema:"tt2-modeled-scenario-v1",
  totalLog10,skillLog10,fixedAccountLog10,equippedGearLog10,
  activePetsAbovePassivesLog10,
  damageLog10:finite(fixed.damageLog10,"damage"),
  goldLog10:finite(fixed.goldLog10,"gold"),
  goldWeight:Number(settings.goldWeight),
  components:4,
  fixedAccountRecognized:Number(fixed.matched)||0,
  selectedGearCount:Object.keys(gearSelection?.selected||{}).length,
  selectedDamagePet:settings.selectedDamagePet??null,
  selectedGoldPet:settings.selectedGoldPet??null,
  unresolvedDependencyCount:Number(result.accountIntegration?.unmodeledEffects)||0,
  // The existing solver optimizes only its documented additive proxy.
  optimizedForActualStages:false,allAccountEffectsModeled:false,
  supportsAutomaticCrossBuildSelection:false
 };
}

/**
 * Difference between candidate scores, in log10 units. Never call this an
 * in-game stage gain: log10 damage and the real game stage HP curve differ.
 */
export function compareModeledScenarios(a,b){
 if(a?.schema!=="tt2-modeled-scenario-v1"||b?.schema!=="tt2-modeled-scenario-v1")
  throw new TypeError("Incompatible modeled scenario");
 return finite(a.totalLog10-b.totalLog10,"scenario difference");
}
