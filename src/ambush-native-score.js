/**
 * TT2 8.4 Ambush (MultiMonsters) source-limited Chesterson-gold model.
 *
 * Unity SkillTreeInfo2.0: A = MultiMonstersGold, B = MultiMonstersMaxCount.
 * B is a maximum COUNT, not an encounter chance or gold multiplier.
 * TT2 Wiki Stage/Titan Skip guide documents a 1% base multi-Titan
 * encounter chance. Other chance sources (Love Potion, equipment, player
 * progression) are NOT carried over or guessed in a different skill tree.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {positiveLog10} from "./account-artifacts.js?v=20261123-boss-specials-r1";
import {binaryExpectedMultiplierLog10} from "./conditional-probabilities.js?v=20261123-boss-specials-r1";

// The public guide's documented BASE scenario only, not actual player
// multiple-Titan chance or a calibrated proc rate for Chesterson farming.
export const GUIDE_BASE_MULTIPLE_TITAN_CHANCE=0.01;
const source=skillInfo.MultiMonsters;

export function ambushSourceEventEvidence(level){
 const n=Number(level);
 if(!Number.isSafeInteger(n)||n<0||n>Number(source.MaxLevel))
  throw new RangeError("Invalid Ambush source level");
 if(source.BonusTypeA!=="MultiMonstersGold"||
    source.BonusTypeB!=="MultiMonstersMaxCount")
  throw new Error("Ambush native effect types changed");
 const maxCount=Number(source["B"+n]);
 if(!Number.isSafeInteger(maxCount)||maxCount<0)
  throw new Error("Invalid Ambush source group-size cap");
 if(n===0)return {
  schema:"tt2-ambush-conditional-gold-v1",level:n,status:"not-invested",
  sourceGoldMultiplierLog10:0,sourceMaxMultipleTitanCount:maxCount,
  modeledBaseEncounterChance:GUIDE_BASE_MULTIPLE_TITAN_CHANCE,
  sourceOnlyExpectedGoldLog10:0,
  countIsNotChance:true,bonusOnlyForMultipleTitanEncounters:true,
  assumesOnlyGuideBaseChance:true,realEncounterRateVerified:false,
  actualGoldDistributionVerified:false,predictsStages:false
 };
 const logA=positiveLog10(source["A"+n]);
 if(logA===null||logA<0)
  throw new Error("Invalid native Ambush multiple-Titan gold multiplier");
 const value=binaryExpectedMultiplierLog10(
  GUIDE_BASE_MULTIPLE_TITAN_CHANCE,logA);
 if(value===null||!Number.isFinite(value)||value<0)
  throw new Error("Invalid Ambush source-only gold event expectation");
 return {
  schema:"tt2-ambush-conditional-gold-v1",level:n,
  status:"guide-base-source-only-hypothetical",
  sourceGoldMultiplierLog10:logA,sourceMaxMultipleTitanCount:maxCount,
  modeledBaseEncounterChance:GUIDE_BASE_MULTIPLE_TITAN_CHANCE,
  sourceOnlyExpectedGoldLog10:value,
  countIsNotChance:true,bonusOnlyForMultipleTitanEncounters:true,
  assumesOnlyGuideBaseChance:true,otherChanceSourcesIgnored:true,
  realEncounterRateVerified:false,actualGoldDistributionVerified:false,
  predictsStages:false
 };
}
