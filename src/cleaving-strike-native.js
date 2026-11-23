/**
 * Source-only Cleaving Strike (HeavyStrikes) critical event model.
 *
 * SkillTreeInfo2.0 A = CritDamage, B = additive CritChance.
 * Neither the imported final chance nor CritDamage from the CURRENT
 * account may be transplanted to an optimized skill tree.
 * Heavenly Strike is a special case: Angelic Radiance guarantees a crit.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {positiveLog10} from "./account-artifacts.js?v=20261123-boss-specials-r1";
import {binaryExpectedMultiplierLog10}
 from "./conditional-probabilities.js?v=20261123-boss-specials-r1";

const source=skillInfo.HeavyStrikes;

/**
 * Hypothetical per-eligible-hit expected multiplier.
 * This is NOT actual crit DPS: proc eligibility, base critical chance,
 * additional critical damage, enemy mechanics and other modifiers are
 * deliberately not inferred.
 */
export function cleavingStrikeSourceEvidence(level,damage){
 const n=Number(level);
 if(!Number.isSafeInteger(n)||n<0||n>Number(source.MaxLevel))
  throw new RangeError("Invalid Cleaving Strike source level");
 if(source.BonusTypeA!=="CritDamage"||
    source.BonusTypeB!=="CritChance")
  throw new Error("Cleaving Strike source types changed");
 const guaranteed=damage==="Heavenly Strike";
 if(n===0)return {
  schema:"tt2-cleaving-strike-source-only-v1",status:"not-invested",
  level:n,damage,sourceCriticalChance:0,
  effectiveHypotheticalChance:guaranteed?1:0,
  sourceCritDamageLog10:0,sourceExpectedLog10:0,
  guaranteedByHeavenlyStrike:guaranteed,
  assumesZeroOtherCriticalChance:!guaranteed,
  accountExpectationVerified:false,predictsStages:false
 };
 const p=Number(source["B"+n]);
 const logA=positiveLog10(source["A"+n]);
 if(!Number.isFinite(p)||p<0||p>1||logA===null||logA<0)
  throw new Error("Invalid Cleaving Strike source chance or damage");
 const assumedChance=guaranteed?1:p;
 const score=binaryExpectedMultiplierLog10(assumedChance,logA);
 if(!Number.isFinite(score)||score<0)
  throw new Error("Unscorable critical event expectation");
 return {
  schema:"tt2-cleaving-strike-source-only-v1",
  status:guaranteed?"guaranteed-heavenly-strike-critical":
   "hypothetical-talent-only-critical-event",
  level:n,damage,sourceCriticalChance:p,
  effectiveHypotheticalChance:assumedChance,
  sourceCritDamageLog10:logA,sourceExpectedLog10:score,
  guaranteedByHeavenlyStrike:guaranteed,
  assumesZeroOtherCriticalChance:!guaranteed,
  importedFinalChanceNotReused:true,
  otherCriticalDamageNotReapplied:true,
  appliesToEveryHit:false,accountExpectationVerified:false,
  predictsStages:false
 };
}
