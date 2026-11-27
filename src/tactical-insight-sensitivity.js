import {coefficientBreakEven} from "./ti-break-even.js?v=20261123-boss-specials-r1&introduced=20261127-r1";
/**
 * Sensitivity of the PROPOSED vs CURRENT skill trees to the unverified
 * community Tactical Insight / HelperBoost coefficient.
 *
 * This is a re-scoring of TWO EXISTING trees, not a second optimizer, not
 * a stage predictor and not a claim that Tactical Insight has zero value.
 * Other unverified effects and the spell/pet context are held unchanged.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {scoreAtLevel} from "./effects.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&score=20261123-cadence-separated-r1&ember=20261123-ember-fire-sword-gate-r1&jackpot=20261123-native-jackpot-expectation-r1&mc=20261123-multicast-no-guessed-x10-r1&crit=20261124-cleaving-crit-event-r1&ambush=20261124-ambush-conditional-gold-r1&dimensional=20261127-r1&poisonsprout=20261127-r1&proccoupling=20261127-r1&integrity=20261127-r2";
import {sourceSpent} from "./investment-audit.js?v=20261123-boss-specials-r1&poisonsprout=20261127-r1";

const SKILL_IDS=Object.keys(skillInfo);
const unavailable=(reason)=>({schema:"tt2-ti-current-vs-proposed-sensitivity-v1",
 status:"not-comparable",reason,affectsAllocation:false,
 predictsStageGain:false,independentGameplayValidation:false});
function levelsValid(tree){
 return SKILL_IDS.every(id=>{
  const value=Number(tree?.[id]??0);
  return Number.isSafeInteger(value)&&value>=0&&
   value<=Number(skillInfo[id].MaxLevel);
 });
}
const totalSpent=tree=>SKILL_IDS.reduce((sum,id)=>
 sum+sourceSpent(id,Number(tree?.[id]??0)),0);
const totalScore=(tree,context)=>SKILL_IDS.reduce((sum,id)=>
 sum+scoreAtLevel(id,Number(tree?.[id]??0),context),0);
const relativeTolerance=(a,b)=>1e-8*Math.max(1,Math.abs(a),Math.abs(b));

/**
 * Compare unchanged trees in the exact same pet/gear/spell context.
 * Excluding ONLY TI's non-native heuristic must not suppress real set
 * effects earned from the Warlord branch; scoreAtLevel preserves those.
 */
export function tacticalInsightRecommendationSensitivity(current,proposed,
 settings={}){
 if(settings.tacticalInsightCalibration?.enabled===true||
    settings.resolvedTacticalInsightLocal?.enabled===true)
  return unavailable("local-measured-calibration-already-active");
 if(settings.excludeUnverifiedTacticalInsight===true)
  return unavailable("tactical-insight-heuristic-already-excluded");
 if(!levelsValid(current)||!levelsValid(proposed))
  return unavailable("invalid-skill-tree-level");
 if(!SKILL_IDS.some(id=>Number(current?.[id]??0)>0))
  return unavailable("no-current-skill-tree");
 const budget=Number(settings.skillPoints);
 if(!Number.isSafeInteger(budget)||budget<0||budget>50000)
  return unavailable("invalid-skill-point-budget");
 const currentSp=totalSpent(current),proposedSp=totalSpent(proposed);
 if(currentSp>budget||proposedSp>budget)
  return unavailable("skill-tree-exceeds-budget");
 // Some guaranteed spell unlocks and opt-in minimums are incorporated into
 // the score context. Scoring an older tree as if it satisfied those gates
 // would give it access to a spell it cannot actually use.
 const minimums=settings.minimums||{};
 if(Object.entries(minimums).some(([id,level])=>
    Object.hasOwn(skillInfo,id)&&
    Number(current?.[id]??0)<Number(level)))
  return unavailable("current-tree-does-not-meet-modeled-minimums");
 const normal={...settings,excludeUnverifiedTacticalInsight:false};
 const excluded={...settings,excludeUnverifiedTacticalInsight:true};
 const normalCurrent=totalScore(current,normal);
 const normalProposed=totalScore(proposed,normal);
 // Other skills' scores are identical. Re-score ONLY the TI contribution
 // to preserve existing SP-tree-set bonuses while avoiding duplicate work.
 const ti="HelperBoost";
 const originalTI=Number(current?.[ti]??0),newTI=Number(proposed?.[ti]??0);
 const excludedCurrent=normalCurrent-
  scoreAtLevel(ti,originalTI,normal)+scoreAtLevel(ti,originalTI,excluded);
 const excludedProposed=normalProposed-
  scoreAtLevel(ti,newTI,normal)+scoreAtLevel(ti,newTI,excluded);
 const values=[normalCurrent,normalProposed,excludedCurrent,excludedProposed];
 if(!values.every(Number.isFinite))
  return unavailable("non-finite-proxy-score");
 const normalDelta=normalProposed-normalCurrent;
 const excludedDelta=excludedProposed-excludedCurrent;
 const tol=relativeTolerance(normalCurrent,normalProposed);
 const excludedTol=relativeTolerance(excludedCurrent,excludedProposed);
 return {
  schema:"tt2-ti-current-vs-proposed-sensitivity-v1",
  status:"compared-same-model-context",
  damage:settings.damage,gold:settings.gold,
  currentSpentSp:currentSp,proposedSpentSp:proposedSp,budget,
  tacticalInsightLevels:{current:originalTI,proposed:newTI},
  community:{currentScoreLog10:normalCurrent,proposedScoreLog10:normalProposed,
   proposedMinusCurrentLog10:normalDelta},
  heuristicExcluded:{currentScoreLog10:excludedCurrent,
   proposedScoreLog10:excludedProposed,
   proposedMinusCurrentLog10:excludedDelta},
  coefficientSensitivity:coefficientBreakEven(excludedDelta,normalDelta),
  proposedPositiveOnlyWithCommunityCoefficient:
   normalDelta>tol&&excludedDelta<=excludedTol,
  proposedImprovesUnderBothTIModels:
   normalDelta>tol&&excludedDelta>excludedTol,
  // This is about ONLY the uncalibrated TI coefficient. No inference
  // about unknown buffs, procs, active skills or in-game stage outcomes.
  noReoptimizationPerformed:true,otherUnverifiedEffectsHeldConstant:true,
  zeroTacticalInsightValueNotAsserted:true,
  affectsAllocation:false,predictsStageGain:false,
  independentGameplayValidation:false
 };
}
