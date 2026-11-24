/**
 * Produce ONE optional, fully feasible SP alternative under the existing
 * "exclude unverified Tactical Insight" scenario, only after a selected
 * build's current-vs-proposed audit has found a ranking reversal.
 *
 * Never automatically replace the original build: removing a community
 * coefficient is a sensitivity experiment, NOT native TT2 calibration.
 * The same final pet, equipment, spells, constraints and budget are reused.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {scoreAtLevel} from "./effects.js?v=20261123-boss-specials-r1&score=20261123-cadence-separated-r1&ember=20261123-ember-fire-sword-gate-r1&jackpot=20261123-native-jackpot-expectation-r1&mc=20261123-multicast-no-guessed-x10-r1&crit=20261124-cleaving-crit-event-r1&ambush=20261124-ambush-conditional-gold-r1";
import {sourceSpent} from "./investment-audit.js?v=20261123-boss-specials-r1";

const IDS=Object.keys(skillInfo);
const SCHEMA="tt2-ti-two-tree-alternative-v1";
const unavailable=(status,reason)=>({schema:SCHEMA,status,reason,
 appliedToRecommendation:false,realStageGainPredicted:false});
const valid=(tree)=>tree&&typeof tree==="object"&&IDS.every(id=>{
 const n=tree[id]??0;
 return Number.isSafeInteger(n)&&n>=0&&n<=Number(skillInfo[id].MaxLevel);
});
function spSpent(levels){
 return IDS.reduce((sum,id)=>sum+sourceSpent(id,levels[id]??0),0);
}
const tolerance=(a,b)=>1e-7*Math.max(1,Math.abs(a),Math.abs(b));

export function exploreTacticalInsightAlternative(settings={},original=null,{
 solve
}={}){
 const diag=original?.modelAttribution?.tacticalInsightSensitivity;
 if(diag?.proposedPositiveOnlyWithCommunityCoefficient!==true)
  return unavailable("not-needed","current-recommendation-not-ti-dependent");
 if(settings.excludeUnverifiedTacticalInsight===true||
    settings.tacticalInsightCalibration?.enabled===true||
    settings.resolvedTacticalInsightLocal?.enabled===true)
  return unavailable("not-applicable","ti-already-calibrated-or-excluded");
 if(settings.contractMultiScenario?.enabled===true||
    settings.allowContractScenarioReallocation===true)
  return unavailable("not-applicable","independent-contract-candidate-comparison");
 if(typeof solve!=="function")
  throw new TypeError("Tactical Insight variant needs a constrained solver");
 if(!valid(original.levels))
  return unavailable("unresolved","invalid-original-tree");
 const budget=Number(settings.skillPoints);
 if(!Number.isSafeInteger(budget)||budget<0||budget>50000)
  return unavailable("unresolved","invalid-budget");
 const options={...settings,excludeUnverifiedTacticalInsight:true,
  // A new alternative must not recursively trigger the extra solve.
  tacticalInsightAlternativeEnabled:false};
 let alternate;
 try{alternate=solve(options);}
 catch(err){return unavailable("unresolved","alternative-solver-error:"+
  String(err?.message??err).slice(0,140));}
 if(!valid(alternate?.levels))
  return unavailable("unresolved","invalid-alternative-tree");
 const originalSpent=spSpent(original.levels);
 const alternativeSpent=spSpent(alternate.levels);
 if(originalSpent>budget||alternativeSpent>budget)
  return unavailable("unresolved","budget-invariant-violated");
 // The real solver scores already include its validated effective
 // spell minima and source unlock conditions. Re-scoring all 72 skills
 // with caller settings would accidentally lose those effective minima.
 // The ONLY changed objective term is the TI community heuristic: use
 // its exact local difference to translate each authoritative solver score.
 const normal={...settings,excludeUnverifiedTacticalInsight:false};
 const noHeuristic={...settings,excludeUnverifiedTacticalInsight:true};
 let originalNormal=Number(original.score),
     alternativeExcluded=Number(alternate.score);
 const deltaTI=level=>scoreAtLevel("HelperBoost",level,normal)-
  scoreAtLevel("HelperBoost",level,noHeuristic);
 let originalExcluded,alternativeNormal;
 try{
  originalExcluded=originalNormal-deltaTI(original.levels.HelperBoost??0);
  alternativeNormal=alternativeExcluded+
   deltaTI(alternate.levels.HelperBoost??0);
 }catch(err){return unavailable("unresolved","score-evaluation-error:"+
  String(err?.message??err).slice(0,140));}
 if(![originalNormal,alternativeNormal,originalExcluded,
  alternativeExcluded].every(Number.isFinite))
  return unavailable("unresolved","non-finite-score");
 const changed=IDS.some(id=>(original.levels[id]??0)!==
  (alternate.levels[id]??0));
 const gainExcluded=alternativeExcluded-originalExcluded;
 if(!changed||gainExcluded<=tolerance(originalExcluded,alternativeExcluded))
  return unavailable("no-distinct-alternative","no-better-tested-tree-under-exclusion");
 // Both alternatives are valid source-cost trees, with the SAME settings.
 // This is only a two-candidate comparison, NOT an optimum in the game.
 return {
  schema:SCHEMA,status:"explored",
  levels:alternate.levels,spent:alternativeSpent,budget,
  originalSpent,changedSkillCount:IDS.filter(id=>
   (original.levels[id]??0)!==(alternate.levels[id]??0)).length,
  originalTILevel:original.levels.HelperBoost??0,
  alternativeTILevel:alternate.levels.HelperBoost??0,
  community:{originalLog10:originalNormal,alternativeLog10:alternativeNormal,
   alternativeMinusOriginalLog10:alternativeNormal-originalNormal},
  excludedTI:{originalLog10:originalExcluded,alternativeLog10:alternativeExcluded,
   alternativeMinusOriginalLog10:gainExcluded},
  originalScoreUnchanged:true,petGearContextReused:true,
  oneExtraSPOptimization:true,allSixDamageAndThreeGoldTypes:true,
  representsUnverifiedHeuristicExclusion:true,
  claimsTIHasZeroInGameEffect:false,
  testedOnlyTwoTrees:true,doesNotProveRealStageAdvantage:true,
  appliedToRecommendation:false,realStageGainPredicted:false
 };
}
