/**
 * Deterministic boss-window evaluator for all six TT2 damage builds.
 *
 * Inputs are COMPLETE OBSERVED or explicitly scripted per-hit events.
 * There is NO inferred attack frequency, proc rate, damage, spell cost,
 * extra equipment bonus, attack uptime or stage outcome.
 *
 * Stage HP: docs/BOSS_PUSH_PHYSICS.md and pinned boss-push-evidence module.
 * Contract mana: reuse the existing, audited 1 Hz shared pool simulator.
 * A hit bonus from contracts is applied only when the caller expressly
 * confirms their hit magnitudes EXCLUDE those effects. No double-counting.
 */
import {bossPushEvidence,parseObservedHitLog10}
 from "./boss-push-evidence.js?v=20261123-conditional-score-r1";
import {simulateContractTimeline}
 from "./contract-timeline.js?v=20261123-conditional-score-r1";
import {skillInfo} from "../vendor/skills.js?v=20261123-conditional-score-r1";

const MAX_EVENTS=512;
const MAX_WINDOW_SECONDS=3600;
const LOG_07=Math.log10(.7);
const LOG_13=Math.log10(1.3);
const LOOPS=["min","nominal","max"];
const SOURCE_SCHEMA="tt2-deterministic-boss-window-v1";

const validInt=(n,min,max)=>
 typeof n==="number"&&Number.isSafeInteger(n)&&n>=min&&n<=max;
const optionalInt=(value,def,min,max)=>{
 if(value===undefined||value===null||value==="")return def;
 const n=Number(value);
 if(!validInt(n,min,max))throw new RangeError("Invalid boss-window integer");
 return n;
};
const invalid=(reason)=>({
 schema:SOURCE_SCHEMA,status:"unresolved",
 reason,diagnosticOnly:true,predictsInGameStages:false,
 affectsOptimization:false,unmeasuredAttacksNeverInferred:true
});
/** Stable log10(10^a + 10^b), including extreme TT2 exponents. */
export function log10Add(a,b){
 if(a===Number.NEGATIVE_INFINITY)return b;
 if(b===Number.NEGATIVE_INFINITY)return a;
 if(!Number.isFinite(a)||!Number.isFinite(b))
  throw new RangeError("Invalid logarithmic hit");
 const top=Math.max(a,b),bottom=Math.min(a,b);
 return top+Math.log10(1+10**(bottom-top));
}
function parseEvents(raw,seconds,channels){
 if(!Array.isArray(raw)||raw.length>MAX_EVENTS)
  throw new RangeError("The combat window needs at most 512 explicit hit events");
 const entries=[],ids=new Set(channels.map(c=>c.id));
 for(let i=0;i<raw.length;i++){
  const event=raw[i];
  if(!event||typeof event!=="object"||Array.isArray(event))
   throw new TypeError("Invalid combat hit event");
  if(!ids.has(event.channelId))
   throw new RangeError("Hit source is not in the selected build");
  const second=Number(event.second),count=optionalInt(event.count,1,1,1_000_000);
  if(!validInt(second,0,seconds-1))
   throw new RangeError("Hit event second exceeds the boss window");
  const log10=parseObservedHitLog10(event.damage);
  if(log10===null)throw new RangeError("Each hit requires a measured damage amount");
  entries.push({channelId:event.channelId,second,count,damageLog10:log10,
   userSpecified:true,originalIndex:i});
 }
 return entries.sort((a,b)=>a.second-b.second||a.originalIndex-b.originalIndex);
}
const readMultiplierLog=(id,field,level)=>{
 const raw=skillInfo[id]?.[field+level];
 const log=parseObservedHitLog10(raw);
 if(log===null)throw new Error("Unrepresentable source contract multiplier");
 return log;
};
function damageAtSecond(second,simulation,levels,scenario){
 if(simulation?.status!=="simulated"||second>=simulation.fundedTicks)
  return {damageLog10:0,source:"inactive-or-unfunded",pactApplied:false};
 const source=simulation.terms?.ForbiddenContract;
 const ramp=source?
  source.sourceMaxLog10*Math.min(1,(second+1)/source.sourceRampSeconds):0;
 const pactEligible=simulation.activeContracts.includes("RoyalContract")&&
  Number(levels.TerrifyingPact||0)>0;
 const pact=scenario.assumeFullPactDuringFundedTicks===true&&pactEligible?
  readMultiplierLog("TerrifyingPact","B",Number(levels.TerrifyingPact)):0;
 return {damageLog10:ramp+pact,
  source:"hypothetical-native-ramp-plus-opt-in-pact",pactApplied:pact!==0};
}
/**
 * @param {object} settings - damage, gold, maxStage, optional selectedSpells
 * @param {object} levels - the EXACT skill tree for the observed hits
 * @param {object} scenario:
 *   enabled:true, windowSeconds:1..3600, stage:optional observed boss stage,
 *   events:[{channelId,second,damage,count?}] in decimal/scientific form,
 *   contractMana?: {enabled:true,startingMana,manaCapacity,
 *     passiveRegenPerSecond,freeTicks,manaEvents?,spellCosts?}
 *   damageExcludesContractEffects:true only for explicitly unbuffed hits;
 *   assumeFullPactDuringFundedTicks:true opt-in maximum hypothetical.
 *
 * A single recorded hit repeated n times is an assumption explicitly made
 * by the caller; this module does not extrapolate or invent a cadence.
 */
export function simulateBossCombatWindow(settings={},levels={},scenario=null){
 if(!scenario||scenario.enabled!==true)
  return invalid("not-requested");
 const seconds=optionalInt(scenario.windowSeconds,null,1,MAX_WINDOW_SECONDS);
 if(seconds===null)return invalid("explicit-window-seconds-required");
 const stage=scenario.stage??settings.pushBossStage??settings.maxStage;
 const source=bossPushEvidence({
  ...settings,pushBossStage:stage,pushObservedAttackChannelId:null,
  pushObservedHitDamage:null
 },levels);
 const events=parseEvents(scenario.events,seconds,source.channels);
 if(events.length===0)return invalid("explicit-attack-events-required");
 const byId=new Map(source.channels.map(x=>[x.id,x]));
 for(const event of events){
  const channel=byId.get(event.channelId);
  if(channel.role==="charged")return invalid("charged-state-is-not-a-hit");
  if(channel.eligibleForObservedHit!==true)
   return invalid("attack-availability-unverified:"+channel.id+":"+
    channel.spellStatus);
 }
 const hasContracts=scenario.contractMana?.enabled===true;
 let mana=null;
 if(hasContracts){
  mana=simulateContractTimeline(levels,{
   ...scenario.contractMana,enabled:true,durationSeconds:seconds
  });
  if(!["simulated","no-active-contract-talents"].includes(mana.status))
   return invalid("invalid-contract-mana-timeline:"+mana.status+
    (mana.reasons?.length?":"+mana.reasons.join(","):""));
 }
 // Explicitly applying contract ramps to an already-buffed observed hit
 // would invent damage and double count. This is a hard guard.
 const contractDamageActive=hasContracts&&mana.status==="simulated"&&
  mana.activeContracts.some(id=>
   id==="ForbiddenContract"||id==="RoyalContract");
 if(contractDamageActive&&
    scenario.damageExcludesContractEffects!==true)
  return invalid("contract-hit-damage-baseline-not-confirmed");
 if(scenario.assumeFullPactDuringFundedTicks===true&&!hasContracts)
  return invalid("pact-needs-explicit-mana-timeline");
 const hp=source.unmodifiedBossHpLog10;
 const target={
  min:hp+LOG_07,nominal:hp,max:hp+LOG_13
 };
 let cumulative=Number.NEGATIVE_INFINITY,logDps=null;
 const wins=Object.fromEntries(LOOPS.map(key=>[key,null]));
 let totalHits=0,withPact=0,contractBonusesCounted=0;
 const processed=events.map((event,i)=>{
  const channel=byId.get(event.channelId);
  const contract=contractDamageActive?
   damageAtSecond(event.second,mana,levels,scenario):
   {damageLog10:0,source:"no-contract-damage",pactApplied:false};
  const eventLog10=event.damageLog10+Math.log10(event.count)+
   contract.damageLog10;
  cumulative=log10Add(cumulative,eventLog10);
  totalHits+=event.count;
  if(contract.damageLog10!==0)contractBonusesCounted++;
  if(contract.pactApplied)withPact++;
  const skip=channel.sourceStageSkip; // Separate source alternatives, never summed.
  for(const roll of LOOPS)if(wins[roll]===null&&cumulative>=target[roll]){
   wins[roll]={second:event.second,eventIndex:i,winningAttack:channel.id,
    winningAttackRole:channel.role,
    stageSkipSources:skip,
    shadowCloneSplash:channel.shadowCloneSplash,
    fullSkipSource:channel.fullSkipSource,
    totalAttacksUntilWin:totalHits,
    hpRoll:roll,
    conditionalOnActualAttackAndSharedSkip:true};
  }
  return {second:event.second,channelId:channel.id,count:event.count,
   perHitLog10:event.damageLog10,
   contractHypothesisLog10:contract.damageLog10,
   source:contract.source,combinedEventLog10:eventLog10,
   cumulativeDamageLog10:cumulative,
   wasActualAttackFrequencyMeasured:true};
 });
 if(cumulative!==Number.NEGATIVE_INFINITY)
  logDps=cumulative-Math.log10(seconds);
 return {schema:SOURCE_SCHEMA,status:"simulated-explicit-events",
  build:settings.damage,gold:settings.gold??null,stage:source.stage,
  windowSeconds:seconds,bossHpLog10:hp,bossHpRollsLog10:target,
  events:processed,eventsProvided:events.length,hitsProvided:totalHits,
  totalDamageLog10:cumulative,windowAverageDamageLog10:logDps,
  firstKillByHpRoll:wins,
  robustKillWithUnmodifiedHp:wins.max!==null,
  killWithNominalUnmodifiedHp:wins.nominal!==null,
  maxStageSkipOnKillingSourcePredicted:false,
  sourceStageSkipNeverAddedToDamage:true,
  appliedContractBonusEvents:contractBonusesCounted,
  assumedFullPactEvents:withPact,
  manaTimeline:mana?{
   status:mana.status,simulatedActiveSeconds:mana.fundedTicks??0,
   firstUnfundedSecond:mana.firstUnfundedSecond??null,
   remainingMana:mana.remainingMana??null,
   claimedActualUptime:false,sourceOnly:true
  }:null,
  assumptions:{
   eventDamageMeasuredForExactlyTheseTalentLevels:true,
   eventScheduleExplicitlyProvided:true,allAttacksAndHitCountsCovered:false,
   hpReductionsModeled:false,randomHpRollRangeOnly:true,
   sharedStageSkipModeled:false,realAttackCooldownsVerified:false,
   freeManaProcRatesInferred:false,
   contractManaScenarioHypothetical:hasContracts,
   contractHitExclusionsConfirmed:
    !contractDamageActive||scenario.damageExcludesContractEffects===true,
   assumedPactMaximumWhileFunded:
    scenario.assumeFullPactDuringFundedTicks===true,
   selectedSpellsFromSettings:source.channels.some(c=>
    c.spellStatus==="equipped")
  },
  diagnosticOnly:true,affectsOptimization:false,
  predictsInGameStages:false};
}
/**
 * Compare only independently supplied event scripts. NEVER reuse one tree's
 * hit magnitudes with a different candidate's talent allocation.
 */
export function compareMeasuredBossWindows(candidates=[]){
 if(!Array.isArray(candidates)||candidates.length<2||candidates.length>8)
  throw new RangeError("Compare 2 to 8 independently measured scenarios");
 const ids=new Set();
 const results=candidates.map((candidate,i)=>{
  if(!candidate||typeof candidate!=="object")
   throw new TypeError("Invalid independently measured candidate");
  const id=candidate.id??String(i);
  if((typeof id!=="string"&&typeof id!=="number")||
     String(id).trim()===""||ids.has(String(id)))
   throw new RangeError("Each independently measured candidate needs a unique ID");
  ids.add(String(id));
  const report=simulateBossCombatWindow(candidate.settings,
   candidate.levels,candidate.scenario);
  return {id,report};
 });
 const first=results[0].report;
 if(first.status!=="simulated-explicit-events")
  return {status:"unresolved",reason:first.reason,results};
 for(const {report} of results){
  if(report.status!=="simulated-explicit-events")
   return {status:"unresolved",reason:report.reason,results};
  if(report.stage!==first.stage||report.windowSeconds!==first.windowSeconds)
   return {status:"unresolved",reason:"incompatible-boss-windows",results};
 }
 const robust=results.filter(x=>x.report.robustKillWithUnmodifiedHp);
 const earliestRobustSecond=robust.length?
  Math.min(...robust.map(x=>x.report.firstKillByHpRoll.max.second)):null;
 // Input events have whole-second precision: equal seconds are a tie,
 // not evidence that the first submitted build is faster.
 const fastestRobustObservedIds=robust
  .filter(x=>x.report.firstKillByHpRoll.max.second===earliestRobustSecond)
  .map(x=>x.id);
 return {schema:"tt2-observed-boss-window-comparison-v1",
  status:"compared-independent-events",
  results,
  fastestRobustObservedId:fastestRobustObservedIds.length===1?
   fastestRobustObservedIds[0]:null,
  fastestRobustObservedIds,
  fastestRobustObservedSecond:earliestRobustSecond,
  tiedFastestRobustObservation:fastestRobustObservedIds.length>1,
  comparedOnlyIndependentlyMeasuredTrees:true,
  producesNewSkillPointAllocation:false,stageGainPredicted:false};
}
