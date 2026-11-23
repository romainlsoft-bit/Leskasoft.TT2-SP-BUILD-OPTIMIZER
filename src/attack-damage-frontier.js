/**
 * Explicit, source-tabulated attack modifier vs skill-score Pareto exploration.
 * All six damage builds and all three gold sources share one implementation.
 * A source multiplier is NOT an entire attack, a DPS or a Stage Skip.
 * Never transfer the player's observed hit to a different allocation.
 */
import {sourcedDamageChannels} from "./attack-channels.js?v=20261123-native-attack-r1";
import {spellSelectionEvidence} from "./spell-scenarios.js?v=20261123-native-attack-r1";
import {skillInfo} from "../vendor/skills.js?v=20261123-native-attack-r1";
import {parseObservedHitLog10} from "./boss-push-evidence.js?v=20261123-native-attack-r1";

const SCHEMA="tt2-84-native-attack-damage-frontier-v1";
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const unresolved=reason=>({schema:SCHEMA,status:"unresolved",reason,
 rows:[],pareto:[],recommendationByRealStages:false});

export function nativeAttackModifierLog10(spec,level){
 const row=skillInfo[spec?.sourceSkillId],column=spec?.sourceColumn;
 if(!row||!["A","B","C"].includes(column)||
   row["BonusType"+column]!==spec.sourceBonusType)
  throw new TypeError("Unverified native attack source mapping");
 const n=Number(level),max=Number(row.MaxLevel);
 if(!Number.isSafeInteger(n)||n<0||n>max)
  throw new RangeError("Invalid native attack talent level");
 // At zero points the channel's talent is not active; never invent 1x.
 if(n===0)return null;
 // TT2 can exceed IEEE-754's exponent range. Parse the catalog's
 // scientific notation in log-space, without converting 1e30000 to Infinity.
 try{return parseObservedHitLog10(row[column+n]);}
 catch{return null;}
}
function sourceCost(row,level){
 let total=0;
 for(let i=0;i<level;i++){
  const cost=Number(row["Co"+i]);
  if(!Number.isSafeInteger(cost)||cost<0)
   throw new Error("Invalid native attack cost");
  total+=cost;
 }
 return total;
}
function targets(spec,baseline,budget,maxCount){
 const row=skillInfo[spec.sourceSkillId];
 const options=[];
 for(let level=baseline+1;level<=Number(row.MaxLevel);level++){
  if(sourceCost(row,level)>budget)break;
  const value=nativeAttackModifierLog10(spec,level);
  if(value===null)continue;
  if(baseline>0&&value<=nativeAttackModifierLog10(spec,baseline)+1e-10)
   continue;
  options.push({level,log10:value});
 }
 const count=Math.min(maxCount,options.length);
 // Sample source level/cost space; NEVER infer DPS or invent the value of SP.
 const result=[];
 for(let i=1;i<=count;i++){
  const index=Math.min(options.length-1,
   Math.max(0,Math.round(i*options.length/(count+1))-1));
  if(!result.some(x=>x.level===options[index].level))
   result.push(options[index]);
 }
 return result;
}
function describe(id,result,spec,requiredLevel=null){
 const level=Number(result.levels?.[spec.sourceSkillId]??0);
 const nativeLog10=nativeAttackModifierLog10(spec,level);
 const score=Number(result.score),upper=Number(result.optimality?.upperBound);
 if(!finite(score)||!finite(upper)||upper<score-1e-7)
  throw new Error("Invalid bounded solver score");
 return {id,levels:result.levels,branchTotals:result.branchTotals,
  spent:result.spent,sourceSkillId:spec.sourceSkillId,
  sourceSkillLevel:level,sourceAttackId:spec.id,
  sourceNativeModifierLog10:nativeLog10,
  sourceAttackAvailableFromTalent:level>0&&nativeLog10!==null,
  requestedNativeSourceLevel:requiredLevel,
  scoreProxyLog10:score,scoreUpperBoundLog10:upper,
  observedHitTransferred:false,sourceModifierIsNotTotalAttackDamage:true,
  attackAvailabilityOrUptimeProven:false,stageGainPredicted:false};
}
/**
 * Explore alternative FULL SP allocations after the selected pets and gear.
 * This does not rerank the main recommendation or alter the normal score.
 * Optimizing the direct attack multiplier as its own axis avoids creating
 * an invented exchange rate between attack multiplier and gold/other damage.
 */
export function exploreNativeAttackDamageFrontier(settings={},{
 solve,baselineResult=null,maxConstrained=2
}={}){
 if(settings.attackDamageFrontierEnabled!==true)
  return {schema:SCHEMA,status:"not-requested",rows:[],pareto:[]};
 const choices=sourcedDamageChannels(settings.damage);
 const spec=choices.find(x=>x.id===settings.attackDamageChannelId);
 if(!spec)return unresolved("choose-native-damage-attack");
 const spells=spellSelectionEvidence(settings);
 if(spec.requiredSpell&&spells.valid&&
    !spells.ids.includes(spec.requiredSpell))
  return unresolved("required-attack-spell-not-equipped");
 if(typeof solve!=="function")throw new TypeError("A solve callback is required");
 if(!Number.isSafeInteger(maxConstrained)||maxConstrained<1||maxConstrained>3)
  throw new RangeError("Use one to three native-attack alternatives");
 const budget=Number(settings.skillPoints);
 if(!Number.isSafeInteger(budget)||budget<0||budget>50000)
  throw new RangeError("Invalid SP budget");
 const common={...settings,attackDamageFrontierEnabled:false,
  pushObservedAttackChannelId:null,pushObservedHitDamage:null};
 // A baseline supplied by the actual winner can be reused because it has
 // the SAME skill constraints; no source target has been added yet.
 const base=baselineResult??solve(common);
 const rows=[describe("original",base,spec)];
 const attempted=[];
 const baselineLevel=rows[0].sourceSkillLevel;
 for(const target of targets(spec,baselineLevel,budget,maxConstrained)){
  try{
   const desired={...common,minimums:{...common.minimums,
    [spec.sourceSkillId]:Math.max(
      Number(common.minimums?.[spec.sourceSkillId]??0),target.level)}};
   const result=solve(desired);
   const found=describe("native-level-"+target.level,result,spec,target.level);
   if(found.sourceSkillLevel<target.level||
      found.sourceNativeModifierLog10===null)
    throw new Error("Constrained native attack level not available");
   if(rows.some(other=>other.sourceSkillLevel===found.sourceSkillLevel&&
       other.scoreProxyLog10>=found.scoreProxyLog10-1e-8)){
    attempted.push({level:target.level,status:"duplicate-or-weaker"});
   }else rows.push(found);
   attempted.push({level:target.level,status:"solved"});
  }catch(e){
   // A source-only cost can pass while real tiers/minima make it infeasible.
   attempted.push({level:target.level,status:"infeasible-or-solver-error",
    reason:String(e?.message??e).slice(0,200)});
  }
 }
 const marked=rows.map((entry,i)=>{
  const dominatedBy=rows.filter((other,j)=>i!==j&&
   (other.sourceNativeModifierLog10??-Infinity)>=
    (entry.sourceNativeModifierLog10??-Infinity)&&
   other.scoreProxyLog10>=entry.scoreProxyLog10-1e-8&&
   ((other.sourceNativeModifierLog10??-Infinity)>
     (entry.sourceNativeModifierLog10??-Infinity)+1e-9||
     other.scoreProxyLog10>entry.scoreProxyLog10+1e-8)).map(x=>x.id);
  return {...entry,dominatedWithinVisited:dominatedBy};
 });
 const pareto=marked.filter(x=>x.dominatedWithinVisited.length===0)
  .sort((a,b)=>
   (a.sourceNativeModifierLog10??-Infinity)-
    (b.sourceNativeModifierLog10??-Infinity));
 return {schema:SCHEMA,status:"explored",
  build:settings.damage,gold:settings.gold,
  sourceAttackId:spec.id,sourceSkillId:spec.sourceSkillId,
  requiredSpell:spec.requiredSpell,spellLoadoutVerified:spells.valid,
  sourceDataVersion:"8.4.0",rows:marked,pareto,attempted,
  changedTrees:marked.some(row=>row.id!=="original"&&
   Object.keys(row.levels).some(id=>row.levels[id]!==rows[0].levels[id])),
  comparisonWithinOneAttackOnly:true,
  directNativeMultiplierOnly:true,
  noAbsoluteHitDamageInferred:true,realAttackUptimeNotProven:true,
  independentGoldWeightProxyUnchanged:true,
  allBuildTypesSupported:true,stageGainPredicted:false,
  recommendationByRealStages:false,globallyOptimal:false};
}
