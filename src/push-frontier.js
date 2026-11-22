/**
 * Bounded, Pareto-oriented search for ALL six TT2 damage builds and three
 * gold sources. No invented conversion between Stage Skip and damage.
 *
 * Each row is a FULL feasible SP tree optimized under one sourced
 * Stage Skip floor. The UI presents non-dominated trade-offs, not a
 * fabricated globally best stage gain. The current additive scoring model
 * remains unchanged and is explicitly labeled as a proxy.
 *
 * Opt-in: this can require up to four additional high-SP optimizations.
 */
import {sourcedStageSkipChannels}
 from "./attack-channels.js?v=20261122-combat-window-r1";
import {stageSkipAtLevel}
 from "./push-skip-target.js?v=20261122-combat-window-r1";
import {skillInfo} from "../vendor/skills.js?v=20261122-combat-window-r1";

const SCHEMA="tt2-source-skip-pareto-frontier-v1";
const empty=(reason)=>({schema:SCHEMA,status:"unresolved",reason,
 rows:[],chosenBestByStageGain:false,globalOptimalityProven:false});
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const sourceSpec=(settings)=>{
 const choices=sourcedStageSkipChannels(settings.damage);
 return choices.find(x=>x.id===settings.pushAttackChannelId);
};
const high=(item,level)=>stageSkipAtLevel(item.sourceSkillId,
 item.sourceColumn,level);
function targets(spec,maxCount,budget,baselineSkip){
 const maxLevel=Number(skillInfo[spec.sourceSkillId]?.MaxLevel);
 if(!Number.isSafeInteger(maxLevel)||maxLevel<1)throw new Error("Bad source skill max");
 // Only sample achievable SOURCE costs, not the full maximum tier.
 // A source-cost-feasible candidate may still violate prerequisites;
 // the full optimizer is responsible for rejecting it.
 const candidates=[],source=skillInfo[spec.sourceSkillId];
 let cost=0,previous=baselineSkip;
 for(let i=1;i<=maxLevel;i++){
  cost+=Number(source["Co"+(i-1)]??Infinity);
  if(!Number.isSafeInteger(cost)||cost>budget)break;
  const skip=high(spec,i);
  if(skip>previous)candidates.push({level:i,sourceSkip:skip,sourceCost:cost});
  previous=Math.max(previous,skip);
 }
 if(!candidates.length)return [];
 const count=Math.min(maxCount,candidates.length);
 const picks=[];
 for(let n=0;n<count;n++){
  const index=count===1?0:Math.round(n*(candidates.length-1)/(count-1));
  const row=candidates[index];
  if(!picks.some(item=>item.sourceSkip===row.sourceSkip))picks.push(row);
 }
 return picks;
}

function evaluatedRow(id,result,settings,spec,requested=null){
 const level=Number(result.levels?.[spec.sourceSkillId]??0);
 const skip=high(spec,level);
 const score=Number(result.score),upper=Number(result.optimality?.upperBound);
 if(!finite(score)||!finite(upper)||upper<score-1e-8)
  throw new Error("Unbounded push Pareto score");
 return {
  id,requestedSourceSkip:requested,sourceStageSkip:skip,
  sourceSkillId:spec.sourceSkillId,sourceSkillLevel:level,
  scoreProxyLog10:score,scoreUpperBoundLog10:upper,
  proxyGapLog10:Math.max(0,upper-score),
  spent:result.spent,levels:result.levels,
  branchTotals:result.branchTotals,
  optimalityMode:result.optimality?.mode,
  sourceSkillPrerequisitesEnforced:true,
  sameDamageAndGoldSource:true,observedBossHitNotTransferred:true,
  scoreRepresentsMeasuredDps:false,stageGainPredicted:false
 };
}
/** Called ONCE after pet/gear selection, never inside every candidate solve.
 * solve(settings) is the existing production optimizer with the same account,
 * gear, pets, spell loadout, min/max restrictions and SP budget.
 */
export function explorePushParetoFrontier(settings={},{
 solve,maxConstrained=3,baselineResult=null
}={}){
 if(settings.pushFrontierEnabled!==true)
  return {schema:SCHEMA,status:"not-requested",rows:[]};
 const spec=sourceSpec(settings);
 if(!spec)return empty("select-an-attack-with-source-stage-skip");
 if(spec.role==="charged")return empty("charged-state-is-not-an-attack");
 if(typeof solve!=="function")throw new TypeError("A constrained solve callback is required");
 const limit=Number(maxConstrained);
 if(!Number.isSafeInteger(limit)||limit<1||limit>4)
  throw new RangeError("Push frontier comparison budget must be 1–4");
 if(settings.contractMultiScenario?.enabled===true)
  return empty("contract-scenario-comparison-is-separate");
 if(settings.assumeContractsAtMax===true)
  return empty("unverified-contract-maximum-scenario");
 const common={...settings,pushFrontierEnabled:false};
 const sourceBaseline={...common,pushSourceStageSkipTarget:0};
 // Existing result is reusable only when it was genuinely unconstrained.
 const base=baselineResult?.pushSkipTarget?.enabled===false?
  baselineResult:solve(sourceBaseline);
 const rows=[evaluatedRow("unconstrained",base,common,spec)];
 const attempted=[],budget=Number(settings.skillPoints);
 for(const candidate of targets(spec,limit,budget,rows[0].sourceStageSkip)){
  const skip=candidate.sourceSkip;
  if(skip<=rows[0].sourceStageSkip)continue;
  // Skip obviously unaffordable source costs before running the DP.
  let cost=0;for(let k=0;k<candidate.level;k++)
   cost+=Number(skillInfo[spec.sourceSkillId]["Co"+k]??Infinity);
  if(!Number.isSafeInteger(cost)||cost>budget){
   attempted.push({sourceSkip:skip,status:"infeasible-source-cost"});
   continue;
  }
  try{
   const settingsAtTarget={...common,pushSourceStageSkipTarget:skip};
   const result=solve(settingsAtTarget);
   if(result.pushSkipTarget?.satisfied!==true)
    throw new Error("Source skip constraint not satisfied");
   const row=evaluatedRow("floor-"+skip,result,settingsAtTarget,spec,skip);
   if(rows.some(existing=>existing.sourceStageSkip===row.sourceStageSkip&&
       existing.scoreProxyLog10>=row.scoreProxyLog10-1e-8)){
    attempted.push({sourceSkip:skip,status:"identical-or-weaker-feasible-result"});
   }else rows.push(row);
   attempted.push({sourceSkip:skip,status:"solved"});
  }catch(err){
   // A requested floor can conflict with other minima, tier unlocks,
   // exclusion or budget. Never fail the original winning allocation.
   attempted.push({sourceSkip:skip,status:"infeasible-or-solver-error",
    reason:String(err?.message??err).slice(0,250)});
  }
 }
 // Pareto across the VISITED, feasible candidates only: one axis is
 // source-local skip, the other the present additive proxy score.
 const marked=rows.map((row,i)=>{
  const dominatedBy=rows.filter((other,j)=>j!==i&&
   other.sourceStageSkip>=row.sourceStageSkip&&
   other.scoreProxyLog10>=row.scoreProxyLog10-1e-7&&
   (other.sourceStageSkip>row.sourceStageSkip||
    other.scoreProxyLog10>row.scoreProxyLog10+1e-7)).map(other=>other.id);
  const provablyDominatedBy=rows.filter((other,j)=>j!==i&&
   other.sourceStageSkip>=row.sourceStageSkip&&
   other.scoreProxyLog10>row.scoreUpperBoundLog10+1e-7)
   .map(other=>other.id);
  return {...row,dominatedWithinVisited:dominatedBy,
   certifiedProxyDominatorsWithinVisited:provablyDominatedBy};
 });
 const pareto=marked.filter(row=>row.dominatedWithinVisited.length===0)
  .sort((a,b)=>a.sourceStageSkip-b.sourceStageSkip||
   b.scoreProxyLog10-a.scoreProxyLog10);
 return {schema:SCHEMA,status:"explored",
  build:settings.damage,gold:settings.gold??null,
  sourceAttackId:spec.id,sourceSkillId:spec.sourceSkillId,
  baselineScoreLog10:rows[0].scoreProxyLog10,
  baselineSourceStageSkip:rows[0].sourceStageSkip,
  rows:marked,pareto,attempted,
  optimizedFullTreeForEachFeasibleTarget:true,
  recommendedBestByActualStage:false,
  chosenBestByStageGain:false,
  globalOptimalityProven:false,
  exhaustiveOverSourceStageSkip:false,
  allBuildTypesShareExactImplementation:true,
  noAssumedWarlordCap:true,sourceSkipNotConvertedToDamage:true,
  noRealBossHitPrediction:true};
}
