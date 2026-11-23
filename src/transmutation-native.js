/**
 * Native TT2 8.4 Transmutation: Jackpot Gold is conditional on an
 * eligible Jackpot event. It is not unconditional All Gold.
 *
 * This computes ONE deliberately limited source-only hypothetical event
 * expectation, with only the talent's tabulated Jackpot chance B.
 * Imported chance and account-specific jackpot multipliers cannot be
 * transferred to another SP allocation. The result is NOT a verified
 * marginal gain for the actual account, a drop-rate measurement, or a
 * claim about real maximum stages.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {positiveLog10} from "./account-artifacts.js?v=20261123-boss-specials-r1";
import {binaryExpectedMultiplierLog10} from "./conditional-probabilities.js?v=20261123-boss-specials-r1";

const row=skillInfo.Transmutation;

export function transmutationSourceEventEvidence(level){
 const n=Number(level),max=Number(row.MaxLevel);
 if(!Number.isSafeInteger(n)||n<0||n>max)
  throw new RangeError("Invalid Transmutation source level");
 if(row.BonusTypeA!=="JackpotGold"||
    row.BonusTypeB!=="JackpotGoldChance")
  throw new Error("Transmutation source types changed; update the native model");
 if(n===0)return {level:n,status:"not-invested",
  nativeJackpotChance:0,nativeJackpotMultiplierLog10:0,
  sourceOnlyExpectedGoldLog10:0,
  assumesZeroOtherJackpotChance:true,accountExpectationVerified:false};
 const p=Number(row["B"+n]);
 const amount=positiveLog10(row["A"+n]);
 if(!Number.isFinite(p)||p<0||p>1||amount===null||amount<0)
  throw new Error("Invalid native Transmutation chance or Jackpot multiplier");
 const expected=binaryExpectedMultiplierLog10(p,amount);
 if(expected===null||!Number.isFinite(expected)||expected<0)
  throw new Error("Unable to model native Jackpot event expectation");
 return {level:n,status:"source-only-hypothetical",
  nativeJackpotChance:p,nativeJackpotMultiplierLog10:amount,
  sourceOnlyExpectedGoldLog10:expected,
  onlyTalentChanceUsed:true,otherAccountChanceExcluded:true,
  existingAccountJackpotMultipliersExcluded:true,
  assumesZeroOtherJackpotChance:true,
  expectedValueOfOneEligibleGoldEventOnly:true,
  appliesToEveryAttackHit:false,
  stageGainPredicted:false,accountExpectationVerified:false};
}
